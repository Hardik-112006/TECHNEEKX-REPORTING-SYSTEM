from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError
from apps.accounts.models import User
from apps.accounts.permissions import get_role_tier
from apps.approvals.models import ApprovalWorkflow, ApprovalStageAudit
from apps.notifications.services import dispatch_notification

STAGE_NAMES = {
    1: 'Stage 1: Lead Technical & Feasibility Review',
    2: 'Stage 2: Executive Leadership & Budget Sign-off'
}

def can_user_review_stage(user: User, stage_number: int) -> bool:
    """
    Stage 1 eligible: Tier <= 3 (Core Team Lead, Mentor, Official, Founder).
    Stage 2 eligible: Tier <= 2 (Official, Director of Core Operations, Founder).
    """
    if not user.is_authenticated or not user.role:
        return False
    tier = get_role_tier(user.role.name)
    if stage_number == 1:
        return tier <= 3
    elif stage_number == 2:
        return tier <= 2
    return False


@transaction.atomic
def submit_stage_decision(
    workflow: ApprovalWorkflow,
    reviewer: User,
    decision: str,
    feedback: str = ''
) -> ApprovalWorkflow:
    """
    Submits a review decision for the current stage.
    Enforces anti-self-approval, role eligibility, sequential stages, and notifies stakeholders.
    """
    # 1. State check
    if workflow.status in ['Approved', 'Rejected']:
        raise ValidationError(f"This workflow has already been finalized as {workflow.status} and cannot be altered.")

    if workflow.status == 'Changes Requested':
        raise ValidationError("Changes have been requested. The submitter must resubmit before further review.")

    # 2. Anti-Self-Approval guard
    if reviewer.user_id == workflow.submitter_id:
        raise PermissionDenied("Anti-Self-Review Violation: Submitters cannot approve or evaluate their own submissions.")

    # 3. Role eligibility for the current stage
    current_stage = workflow.current_stage
    if not can_user_review_stage(reviewer, current_stage):
        required = "Tier 3 (Core Lead or Official)" if current_stage == 1 else "Tier 2 (Official or Executive)"
        raise PermissionDenied(f"Unauthorized: Reviewing Stage {current_stage} requires {required}.")

    # 4. Feedback mandatory for changes requested or rejection
    if decision in ['Changes Requested', 'Rejected'] and not (feedback and feedback.strip()):
        raise ValidationError({"feedback": f"Reviewer feedback is mandatory when decision is '{decision}'."})

    # 5. Record Stage Audit
    ApprovalStageAudit.objects.create(
        workflow=workflow,
        stage_number=current_stage,
        stage_name=STAGE_NAMES.get(current_stage, f"Stage {current_stage}"),
        reviewer=reviewer,
        decision=decision,
        feedback=feedback.strip() if feedback else ''
    )

    # 6. Apply state transition
    if decision == 'Approved':
        if current_stage < workflow.total_stages:
            # Advance to next sequential stage
            workflow.current_stage = current_stage + 1
            workflow.status = f"Pending Stage {workflow.current_stage}"
            # Notify executive officials of incoming Stage 2 queue
            officials = User.objects.filter(role__name__in=['Founder', 'Official', 'Director of Core Operations'])
            for off in officials:
                dispatch_notification(
                    recipient=off,
                    title=f"Stage {workflow.current_stage} Approval Required: {workflow.title}",
                    message=f"Workflow #{workflow.workflow_id} has passed Stage 1 and is now awaiting Stage {workflow.current_stage} executive sign-off.",
                    notification_type='PENDING_REVIEW',
                    severity='warning',
                    action_url=f"/approvals?id={workflow.workflow_id}"
                )
        else:
            # All stages completed!
            workflow.status = 'Approved'
            dispatch_notification(
                recipient=workflow.submitter,
                title=f"Workflow Approved: {workflow.title}",
                message=f"All {workflow.total_stages} stages of review for '{workflow.title}' have been completed and officially ratified.",
                notification_type='SYSTEM',
                severity='info',
                action_url=f"/approvals?id={workflow.workflow_id}"
            )
    elif decision == 'Changes Requested':
        workflow.status = 'Changes Requested'
        dispatch_notification(
            recipient=workflow.submitter,
            title=f"Revisions Requested: {workflow.title}",
            message=f"Stage {current_stage} review requested revisions: \"{feedback}\". Please update your proposal and resubmit.",
            notification_type='SYSTEM',
            severity='warning',
            action_url=f"/approvals?id={workflow.workflow_id}"
        )
    elif decision == 'Rejected':
        workflow.status = 'Rejected'
        dispatch_notification(
            recipient=workflow.submitter,
            title=f"Workflow Rejected: {workflow.title}",
            message=f"Proposal '{workflow.title}' was rejected at Stage {current_stage}: \"{feedback}\".",
            notification_type='SYSTEM',
            severity='critical',
            action_url=f"/approvals?id={workflow.workflow_id}"
        )

    workflow.save()
    return workflow


@transaction.atomic
def resubmit_workflow(workflow: ApprovalWorkflow, user: User, notes: str = '') -> ApprovalWorkflow:
    """
    Allows the submitter to resubmit after changes were requested.
    Resets to Stage 1.
    """
    if workflow.submitter_id != user.user_id:
        raise PermissionDenied("Only the original submitter can resubmit this workflow.")

    if workflow.status != 'Changes Requested':
        raise ValidationError("Only workflows with status 'Changes Requested' can be resubmitted.")

    workflow.current_stage = 1
    workflow.status = 'Pending Stage 1'
    if notes:
        workflow.description = f"{workflow.description}\n\n[Resubmission Note]: {notes.strip()}"
    workflow.save()

    dispatch_notification(
        recipient=workflow.submitter,
        title=f"Workflow Resubmitted: {workflow.title}",
        message=f"Your revisions for '{workflow.title}' have been resubmitted and entered the Stage 1 review queue.",
        notification_type='SYSTEM',
        severity='info'
    )

    return workflow
