from django.db import transaction
from django.utils import timezone
from apps.scoring.models import Performance
from apps.activity.services import log_activity

POINTS_PER_TASK_APPROVAL = 10

def award_task_points(task, submitter, reviewer) -> tuple[bool, int, str]:
    """
    Atomically awards points to the submitter upon task approval.
    Enforces strict idempotency: if points were already awarded for this task,
    returns False and does NOT increment points again.
    """
    from apps.submissions.models import Review

    with transaction.atomic():
        # Check if an approval already exists for this task
        if Review.objects.filter(task=task, decision='Approved').exists():
            return False, 0, "Points already awarded for this task (idempotency guard)."

        # Retrieve or create Performance record with row-level lock
        perf, created = Performance.objects.select_for_update().get_or_create(
            user=submitter,
            defaults={'points': 0, 'rank': None, 'updated_at': timezone.now()}
        )

        old_points = perf.points
        perf.points += POINTS_PER_TASK_APPROVAL
        perf.updated_at = timezone.now()
        perf.save()

        # Recalculate ranks across all active performers
        recalculate_leaderboard_ranks()

        # Log audit events
        log_activity(
            user=reviewer,
            action='POINTS_AWARDED',
            details=f"Awarded {POINTS_PER_TASK_APPROVAL} pts to {submitter.name} for Task #{task.task_id} (New total: {perf.points})"
        )

        return True, POINTS_PER_TASK_APPROVAL, f"Successfully awarded {POINTS_PER_TASK_APPROVAL} points to {submitter.name}."

def recalculate_leaderboard_ranks():
    """
    Recalculates dense ranks for all performance records ordered by points descending.
    """
    performers = list(Performance.objects.select_for_update().order_by('-points', 'updated_at'))
    current_rank = 1
    for i, p in enumerate(performers):
        if i > 0 and p.points < performers[i - 1].points:
            current_rank = i + 1
        p.rank = current_rank
        p.save(update_fields=['rank'])
