from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.board.models import Warning, WarningAuditLog, RemovalReview
from apps.tasks.models import Task
from apps.teams.models import Group
from apps.accounts.models import User
from apps.accounts.permissions import is_official, is_board, is_director_of_operations
from apps.activity.services import log_activity

def issue_warning(issued_by, target_user=None, target_group=None, related_task=None, reason="", expiry_date=None):
    """
    Issues a warning from an authorized Board member or Official.
    Enforces maximum 5 active warnings per target user.
    Prevents duplicate active warnings for the same task.
    """
    if not (is_board(issued_by) or is_official(issued_by)):
        raise PermissionDenied("Only authorized Board members or Officials can issue warnings.")

    if not target_user and not target_group:
        raise ValidationError("A warning must target either a specific user or a group.")

    if not reason.strip():
        raise ValidationError("A warning reason is required.")

    # Duplicate warning check for same task
    if related_task and target_user:
        existing = Warning.objects.filter(
            target_user=target_user,
            related_task=related_task,
            status='Active'
        ).exists()
        if existing:
            raise ValidationError(f"An active warning has already been issued to '{target_user.name}' for Task #{related_task.task_id}.")

    # Limit check: Maximum 5 active warnings per user
    if target_user:
        active_count = Warning.objects.filter(
            target_user=target_user,
            status='Active'
        ).count()
        if active_count >= 5:
            # Auto-flag for removal review
            flag_for_removal(
                flagged_by=issued_by,
                target_user=target_user,
                reason=f"Exceeded maximum limit of 5 active warnings. Last warning reason: {reason}"
            )
            raise ValidationError(
                f"User '{target_user.name}' already has 5 active warnings (maximum permitted limit). Automatically flagged for Official removal review."
            )

    warning = Warning.objects.create(
        target_user=target_user,
        target_group=target_group,
        related_task=related_task,
        reason=reason.strip(),
        issued_by=issued_by,
        expiry_date=expiry_date
    )

    WarningAuditLog.objects.create(
        warning=warning,
        action='Warning Generated',
        actor=issued_by,
        actor_name=issued_by.name,
        details=f"Warning issued to {target_user.name if target_user else target_group.name}. Reason: {reason[:80]}"
    )

    log_activity(
        user=issued_by,
        action='WARNING_ISSUED',
        details=f"Warning #{warning.warning_id} issued to {target_user.name if target_user else target_group.name}. Reason: {reason[:60]}"
    )
    return warning


def check_and_generate_overdue_warnings(actor=None):
    """
    Automatically detects overdue tasks (deadline passed, status != 'Approved').
    Avoids duplicate active warnings for the same task.
    """
    now = timezone.now()
    candidate_tasks = Task.objects.filter(
        deadline__isnull=False
    ).exclude(status='Approved').select_related('assigned_to', 'group', 'team')

    director_user = actor or User.objects.filter(role__name='Director of Core Operations').first() or User.objects.filter(role__name='Founder').first()
    
    generated = []
    for task in candidate_tasks:
        active_warning = Warning.objects.filter(related_task=task, status__in=['Active', 'Acknowledged']).first()
        effective_deadline = active_warning.revised_deadline if (active_warning and active_warning.revised_deadline) else task.deadline
        
        if effective_deadline and effective_deadline < now:
            if not active_warning:
                # Generate new warning
                warn = Warning.objects.create(
                    target_user=task.assigned_to,
                    target_group=task.group,
                    related_task=task,
                    reason=f"Automated Overdue Warning: Task '{task.title}' passed its scheduled deadline ({task.deadline.strftime('%b %d, %Y %H:%M')}) without completion.",
                    issued_by=director_user,
                    status='Active'
                )
                WarningAuditLog.objects.create(
                    warning=warn,
                    action='Warning Generated',
                    actor=director_user,
                    actor_name=director_user.name if director_user else 'Director of Core Operations',
                    details=f"Automated overdue warning generated for Task #{task.task_id} ('{task.title}'). Assigned to {task.assigned_to.name if task.assigned_to else 'Unassigned'}."
                )
                generated.append(warn)
            else:
                if active_warning.revised_deadline and active_warning.revised_deadline < now:
                    last_log = active_warning.audit_logs.order_by('-created_at').first()
                    if not last_log or last_log.action != 'Revised Deadline Elapsed':
                        WarningAuditLog.objects.create(
                            warning=active_warning,
                            action='Revised Deadline Elapsed',
                            actor=director_user,
                            actor_name=director_user.name if director_user else 'Director of Core Operations',
                            details=f"Revised deadline ({active_warning.revised_deadline.strftime('%b %d, %Y %H:%M')}) has elapsed without completion."
                        )
    return generated


def assign_revised_deadline(warning_id, revised_deadline, actor):
    """
    Sets a revised deadline on an active overdue warning and updates the underlying task.
    """
    if not (is_board(actor) or is_official(actor)):
        raise PermissionDenied("Only Director of Core Operations or Officials can assign revised deadlines.")

    warning = Warning.objects.select_related('related_task', 'target_user').get(pk=warning_id)
    if warning.status not in ('Active', 'Acknowledged'):
        raise ValidationError("Cannot set revised deadline on a resolved or inactive warning.")

    old_deadline = warning.revised_deadline or (warning.related_task.deadline if warning.related_task else None)
    warning.revised_deadline = revised_deadline
    warning.revised_deadline_by = actor
    warning.revised_deadline_at = timezone.now()
    warning.save(update_fields=['revised_deadline', 'revised_deadline_by', 'revised_deadline_at'])

    if warning.related_task:
        warning.related_task.deadline = revised_deadline
        warning.related_task.save(update_fields=['deadline'])

    WarningAuditLog.objects.create(
        warning=warning,
        action='Revised Deadline Assigned',
        actor=actor,
        actor_name=actor.name,
        details=f"Revised deadline set to {revised_deadline.strftime('%b %d, %Y %H:%M')}. Previous: {old_deadline.strftime('%b %d, %Y %H:%M') if old_deadline else 'None'}."
    )

    log_activity(
        user=actor,
        action='REVISED_DEADLINE_SET',
        details=f"Set revised deadline on Warning #{warning.warning_id} (Task #{warning.related_task_id}) to {revised_deadline}."
    )
    return warning


def resolve_task_warnings(task, actor=None):
    """
    Automatically marks warnings associated with a completed task as Resolved.
    Preserves full audit history.
    """
    active_warnings = Warning.objects.filter(
        related_task=task,
        status__in=['Active', 'Acknowledged']
    )
    for warn in active_warnings:
        warn.status = 'Resolved'
        warn.resolved_at = timezone.now()
        warn.resolved_by = actor
        warn.save(update_fields=['status', 'resolved_at', 'resolved_by'])

        WarningAuditLog.objects.create(
            warning=warn,
            action='Task Completed & Warning Resolved',
            actor=actor,
            actor_name=actor.name if actor else 'System Approval',
            details=f"Task #{task.task_id} ('{task.title}') successfully completed & approved. Associated overdue warning resolved."
        )


def flag_for_removal(flagged_by, target_user=None, target_group=None, reason=""):
    """
    Flags a member or group for Official removal review.
    """
    if not (is_board(flagged_by) or is_official(flagged_by)):
        raise PermissionDenied("Only Board members or Officials can initiate removal reviews.")

    if not target_user and not target_group:
        raise ValidationError("Removal review must target either a user or a group.")

    # Avoid duplicate pending flags
    existing = RemovalReview.objects.filter(
        target_user=target_user,
        target_group=target_group,
        status='Pending'
    ).first()
    if existing:
        return existing

    review = RemovalReview.objects.create(
        target_user=target_user,
        target_group=target_group,
        reason=reason.strip(),
        flagged_by=flagged_by
    )

    log_activity(
        user=flagged_by,
        action='REMOVAL_FLAGGED',
        details=f"Flagged {target_user.name if target_user else target_group.name} for removal review. Reason: {reason[:60]}"
    )
    return review


def resolve_removal_review(resolved_by, review_id, decision, official_notes=""):
    if not is_official(resolved_by):
        raise PermissionDenied("Only the Official Team (Founder / Officials) can finalize removal decisions.")

    review = RemovalReview.objects.get(pk=review_id)
    if review.status != 'Pending':
        raise ValidationError(f"Removal review #{review_id} has already been resolved.")

    if decision not in ('Approved_Deactivated', 'Rejected'):
        raise ValidationError("Decision must be either 'Approved_Deactivated' or 'Rejected'.")

    review.status = decision
    review.official_notes = official_notes.strip()
    review.resolved_by = resolved_by
    review.resolved_at = timezone.now()
    review.save()

    if decision == 'Approved_Deactivated' and review.target_user:
        target = review.target_user
        target.status = 'Inactive'
        target.save(update_fields=['status'])
        log_activity(
            user=resolved_by,
            action='USER_DEACTIVATED',
            details=f"User '{target.name}' ({target.email}) deactivated following Board removal review #{review.review_id}."
        )
    else:
        log_activity(
            user=resolved_by,
            action='REMOVAL_REJECTED',
            details=f"Removal review #{review.review_id} rejected by Official {resolved_by.name}."
        )

    return review


def get_board_monitoring_metrics(user):
    """
    Computes real metrics from persisted records for the Board Monitoring Dashboard.
    Runs automated overdue check.
    """
    # Trigger auto-overdue detection
    check_and_generate_overdue_warnings(actor=user)

    now = timezone.now()

    # 1. Overdue tasks (deadline passed, not Approved)
    overdue_tasks = Task.objects.filter(
        deadline__lt=now
    ).exclude(status='Approved').select_related('assigned_to', 'group', 'team')

    # 2. Tasks awaiting review (status == 'Submitted')
    awaiting_review = Task.objects.filter(status='Submitted').select_related('assigned_to', 'group')

    # 3. Missing reports: Assigned tasks past 48h from creation with no proofs submitted
    missing_reports_tasks = Task.objects.filter(
        status__in=['Assigned', 'In Progress'],
        created_at__lt=now - timezone.timedelta(hours=48)
    ).select_related('assigned_to', 'group')

    # 4. Active warnings
    active_warnings = Warning.objects.filter(status='Active').select_related(
        'target_user', 'target_group', 'issued_by', 'related_task', 'revised_deadline_by'
    ).prefetch_related('audit_logs')

    # 5. Warning History
    warning_history = Warning.objects.filter(status='Resolved').select_related(
        'target_user', 'target_group', 'issued_by', 'related_task', 'resolved_by', 'revised_deadline_by'
    ).prefetch_related('audit_logs')

    # 6. Pending removal reviews
    pending_removals = RemovalReview.objects.filter(status='Pending').select_related('target_user', 'target_group', 'flagged_by')

    # 7. Group progress summaries
    groups = Group.objects.prefetch_related('group_members', 'group_tasks').all()
    group_stats = []
    for g in groups:
        total = g.group_tasks.count()
        completed = g.group_tasks.filter(status='Approved').count()
        overdue = g.group_tasks.filter(deadline__lt=now).exclude(status='Approved').count()
        members_count = g.group_members.count()
        group_stats.append({
            'group_id': g.group_id,
            'name': g.name,
            'members_count': members_count,
            'total_tasks': total,
            'completed_tasks': completed,
            'overdue_tasks': overdue,
            'completion_rate': round((completed / total * 100), 1) if total > 0 else 0
        })

    return {
        'total_overdue': overdue_tasks.count(),
        'total_awaiting_review': awaiting_review.count(),
        'total_missing_reports': missing_reports_tasks.count(),
        'total_active_warnings': active_warnings.count(),
        'total_warning_history': warning_history.count(),
        'total_pending_removals': pending_removals.count(),
        'group_statistics': group_stats,
        'recent_overdue_tasks': [
            {
                'task_id': t.task_id,
                'title': t.title,
                'assigned_to': t.assigned_to.name if t.assigned_to else 'Unassigned',
                'group': t.group.name if t.group else (t.team.name if t.team else 'General'),
                'deadline': t.deadline.isoformat() if t.deadline else None,
                'status': t.status
            }
            for t in overdue_tasks[:12]
        ],
        'pending_removal_reviews': [
            {
                'review_id': r.review_id,
                'target': r.target_user.name if r.target_user else (r.target_group.name if r.target_group else 'Group'),
                'target_user_id': r.target_user_id,
                'reason': r.reason,
                'flagged_by': r.flagged_by.name,
                'created_at': r.created_at.isoformat(),
                'status': r.status
            }
            for r in pending_removals[:8]
        ]
    }
