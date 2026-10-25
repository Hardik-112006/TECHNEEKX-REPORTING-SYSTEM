from django.db import models
from django.utils import timezone

class Warning(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Acknowledged', 'Acknowledged'),
        ('Resolved', 'Resolved'),
        ('Expired', 'Expired'),
    ]

    warning_id = models.AutoField(primary_key=True, db_column='warning_id')
    target_user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='warnings_received',
        null=True,
        blank=True,
        db_column='target_user_id'
    )
    target_group = models.ForeignKey(
        'teams.Group',
        on_delete=models.SET_NULL,
        related_name='warnings',
        null=True,
        blank=True,
        db_column='target_group_id'
    )
    related_task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='warnings',
        db_column='related_task_id'
    )
    reason = models.TextField()
    issued_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='warnings_issued',
        db_column='issued_by_id'
    )
    status = models.CharField(max_length=20, default='Active', choices=STATUS_CHOICES)
    expiry_date = models.DateField(null=True, blank=True)
    
    # Revised Deadline Tracking (Section 4)
    revised_deadline = models.DateTimeField(null=True, blank=True)
    revised_deadline_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='revised_deadlines_assigned',
        db_column='revised_deadline_by_id'
    )
    revised_deadline_at = models.DateTimeField(null=True, blank=True)

    # Resolution Tracking
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='warnings_resolved',
        db_column='resolved_by_id'
    )

    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'board_warnings'
        indexes = [
            models.Index(fields=['target_user', 'status'], name='idx_warn_user_status'),
            models.Index(fields=['target_group', 'status'], name='idx_warn_group_status'),
            models.Index(fields=['related_task'], name='idx_warn_task'),
            models.Index(fields=['status', '-created_at'], name='idx_warn_stat_created'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        target = self.target_user.name if self.target_user else (self.target_group.name if self.target_group else "General")
        return f"Warning #{self.warning_id} -> {target} [{self.status}]"


class WarningAuditLog(models.Model):
    audit_id = models.AutoField(primary_key=True, db_column='audit_id')
    warning = models.ForeignKey(
        Warning,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        db_column='warning_id'
    )
    action = models.CharField(max_length=80)
    actor = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='warning_audit_actions',
        db_column='actor_id'
    )
    actor_name = models.CharField(max_length=150, null=True, blank=True)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'board_warning_audit_logs'
        indexes = [
            models.Index(fields=['warning', '-created_at'], name='idx_warn_audit_time'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Audit #{self.audit_id} for Warning #{self.warning_id}: {self.action}"


class RemovalReview(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending Official Review'),
        ('Approved_Deactivated', 'Approved (User Deactivated)'),
        ('Rejected', 'Rejected by Official'),
    ]

    review_id = models.AutoField(primary_key=True, db_column='review_id')
    target_user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='removal_reviews',
        null=True,
        blank=True,
        db_column='target_user_id'
    )
    target_group = models.ForeignKey(
        'teams.Group',
        on_delete=models.SET_NULL,
        related_name='removal_reviews',
        null=True,
        blank=True,
        db_column='target_group_id'
    )
    reason = models.TextField()
    flagged_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='flagged_removals',
        db_column='flagged_by_id'
    )
    status = models.CharField(max_length=30, default='Pending', choices=STATUS_CHOICES)
    official_notes = models.TextField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_removals',
        db_column='resolved_by_id'
    )
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'board_removal_reviews'
        indexes = [
            models.Index(fields=['target_user', 'status'], name='idx_rem_user_status'),
            models.Index(fields=['status'], name='idx_rem_status'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        target = self.target_user.name if self.target_user else (self.target_group.name if self.target_group else "General")
        return f"RemovalReview #{self.review_id} -> {target} [{self.status}]"
