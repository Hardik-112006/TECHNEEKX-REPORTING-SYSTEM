from datetime import timedelta
from django.utils import timezone
from apps.accounts.models import User, Role
from apps.tasks.models import Task
from apps.submissions.models import TaskProof
from apps.notifications.models import Notification, ReminderDispatchLog

COOLDOWN_HOURS = 24

def is_recent_dispatch(task_id: int, recipient: User, reminder_type: str, hours=COOLDOWN_HOURS) -> bool:
    cutoff = timezone.now() - timedelta(hours=hours)
    return ReminderDispatchLog.objects.filter(
        task_id=task_id,
        recipient=recipient,
        reminder_type=reminder_type,
        dispatched_at__gte=cutoff
    ).exists()


def dispatch_notification(
    recipient: User,
    title: str,
    message: str,
    notification_type: str,
    severity: str = 'info',
    related_task_id: int = None,
    action_url: str = ''
) -> Notification:
    notif = Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        severity=severity,
        related_task_id=related_task_id,
        action_url=action_url
    )
    if related_task_id:
        ReminderDispatchLog.objects.create(
            task_id=related_task_id,
            recipient=recipient,
            reminder_type=notification_type
        )
    return notif


def process_reminders_and_escalations() -> dict:
    """
    Evaluates workload deadlines, overdue tasks, and pending review backlogs.
    Dispatches automated reminders and leadership escalations while enforcing duplicate cooldown.
    """
    now = timezone.now()
    summary = {
        'deadline_reminders_sent': 0,
        'overdue_alerts_sent': 0,
        'escalations_sent': 0,
        'pending_reviews_reminded': 0,
        'skipped_cooldown': 0
    }

    # Identify executive leaders for escalations
    officials = list(User.objects.filter(role__name__in=['Founder', 'Official', 'Director of Core Operations']))

    # 1. UPCOMING DEADLINE REMINDERS (due within 24 hours)
    upcoming_tasks = Task.objects.filter(
        deadline__gt=now,
        deadline__lte=now + timedelta(hours=24),
        status__in=['Assigned', 'In Progress']
    ).select_related('assigned_to', 'team')

    for task in upcoming_tasks:
        recipient = task.assigned_to
        if not recipient:
            continue
        if is_recent_dispatch(task.task_id, recipient, 'DEADLINE_APPROACHING'):
            summary['skipped_cooldown'] += 1
            continue

        hours_left = max(1, int((task.deadline - now).total_seconds() / 3600))
        dispatch_notification(
            recipient=recipient,
            title=f"Upcoming Deadline in {hours_left}h: {task.title}",
            message=f"Task #{task.task_id} is scheduled for delivery in {hours_left} hours. Please ensure your progress is saved and proof submitted on time.",
            notification_type='DEADLINE_APPROACHING',
            severity='info',
            related_task_id=task.task_id,
            action_url=f"/tasks?id={task.task_id}"
        )
        summary['deadline_reminders_sent'] += 1

    # 2. OVERDUE TASK NOTIFICATIONS & LEADERSHIP ESCALATIONS
    overdue_tasks = Task.objects.filter(
        deadline__lt=now,
        status__in=['Assigned', 'In Progress', 'Changes Requested']
    ).select_related('assigned_to', 'team')

    for task in overdue_tasks:
        hours_overdue = (now - task.deadline).total_seconds() / 3600.0

        # Direct reminder to assignee
        if task.assigned_to:
            if not is_recent_dispatch(task.task_id, task.assigned_to, 'TASK_OVERDUE'):
                dispatch_notification(
                    recipient=task.assigned_to,
                    title=f"Task Overdue: {task.title}",
                    message=f"Task #{task.task_id} was due on {task.deadline.strftime('%d %b %H:%M')}. Please submit your work or request a deadline extension immediately.",
                    notification_type='TASK_OVERDUE',
                    severity='warning',
                    related_task_id=task.task_id,
                    action_url=f"/tasks?id={task.task_id}"
                )
                summary['overdue_alerts_sent'] += 1
            else:
                summary['skipped_cooldown'] += 1

        # Escalation if overdue by more than 48 hours
        if hours_overdue >= 48:
            lead_recipient = None
            if task.team:
                # Find Core Team Lead in this team
                lead_recipient = User.objects.filter(team=task.team, role__name='Core Team Lead').first()

            escalation_recipients = [lead_recipient] if lead_recipient else officials
            for esc_user in escalation_recipients:
                if not esc_user:
                    continue
                if is_recent_dispatch(task.task_id, esc_user, 'ESCALATION'):
                    summary['skipped_cooldown'] += 1
                    continue

                dispatch_notification(
                    recipient=esc_user,
                    title=f"[ESCALATION] 48h+ Overdue Task: {task.title}",
                    message=f"Task #{task.task_id} assigned to {task.assigned_to.name if task.assigned_to else 'Unassigned'} has exceeded its deadline by {int(hours_overdue)} hours. Leadership intervention or reassignment is required.",
                    notification_type='ESCALATION',
                    severity='critical',
                    related_task_id=task.task_id,
                    action_url=f"/tasks?id={task.task_id}"
                )
                summary['escalations_sent'] += 1

    # 3. PENDING REVIEW REMINDERS (Submitted for > 24 hours)
    submitted_tasks = Task.objects.filter(status='Submitted').select_related('assigned_to', 'team')
    for task in submitted_tasks:
        latest_proof = task.proofs.order_by('-submitted_at').first()
        sub_time = latest_proof.submitted_at if latest_proof else task.created_at
        age_hours = (now - sub_time).total_seconds() / 3600.0

        if age_hours >= 24:
            # Notify lead of team or officials
            reviewers_to_notify = []
            if task.team:
                team_leads = list(User.objects.filter(team=task.team, role__name='Core Team Lead'))
                reviewers_to_notify.extend(team_leads)
            if not reviewers_to_notify:
                reviewers_to_notify = officials[:2]

            for reviewer in reviewers_to_notify:
                if is_recent_dispatch(task.task_id, reviewer, 'PENDING_REVIEW'):
                    summary['skipped_cooldown'] += 1
                    continue

                dispatch_notification(
                    recipient=reviewer,
                    title=f"Review Pending ({int(age_hours)}h): {task.title}",
                    message=f"Submission for Task #{task.task_id} by {task.assigned_to.name if task.assigned_to else 'member'} has been awaiting evaluation for {int(age_hours)} hours.",
                    notification_type='PENDING_REVIEW',
                    severity='warning',
                    related_task_id=task.task_id,
                    action_url=f"/tasks?id={task.task_id}"
                )
                summary['pending_reviews_reminded'] += 1

    return summary
