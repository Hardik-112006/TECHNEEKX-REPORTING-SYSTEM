from django.db import models
from django.utils import timezone
from apps.accounts.models import User

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('DEADLINE_APPROACHING', 'Upcoming Deadline Reminder'),
        ('TASK_OVERDUE', 'Task Overdue Alert'),
        ('PENDING_REVIEW', 'Pending Review Reminder'),
        ('ESCALATION', 'Executive Escalation Alert'),
        ('SYSTEM', 'System Broadcast / General'),
    ]

    SEVERITY_LEVELS = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    notification_id = models.AutoField(primary_key=True, db_column='notification_id')
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_column='recipient_id',
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=40,
        choices=NOTIFICATION_TYPES,
        default='SYSTEM'
    )
    severity = models.CharField(
        max_length=20,
        choices=SEVERITY_LEVELS,
        default='info'
    )
    is_read = models.BooleanField(default=False)
    action_url = models.CharField(max_length=255, blank=True, default='')
    related_task_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'notifications'
        indexes = [
            models.Index(fields=['recipient', 'is_read'], name='idx_notif_recipient_read'),
            models.Index(fields=['-created_at'], name='idx_notif_created_at'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.severity.upper()}] {self.title} -> {self.recipient.email}"


class ReminderDispatchLog(models.Model):
    """
    Prevents duplicate notifications for the same event and cooldown interval.
    """
    dispatch_id = models.AutoField(primary_key=True)
    task_id = models.IntegerField(db_index=True)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE)
    reminder_type = models.CharField(max_length=50)
    dispatched_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'reminder_dispatch_logs'
        indexes = [
            models.Index(fields=['task_id', 'reminder_type', '-dispatched_at'], name='idx_dispatch_task_type'),
        ]
        ordering = ['-dispatched_at']

    def __str__(self):
        return f"Task #{self.task_id} {self.reminder_type} -> {self.recipient.email} at {self.dispatched_at}"
