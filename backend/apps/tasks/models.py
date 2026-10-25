from django.db import models
from django.utils import timezone

class Task(models.Model):
    STATUS_CHOICES = [
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Submitted', 'Submitted'),
        ('Approved', 'Approved'),
        ('Changes Requested', 'Changes Requested'),
    ]

    task_id = models.AutoField(primary_key=True, db_column='task_id')
    title = models.CharField(max_length=200)
    description = models.TextField()
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='created_by',
        related_name='created_tasks'
    )
    assigned_to = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='assigned_to',
        related_name='assigned_tasks'
    )
    team = models.ForeignKey(
        'teams.Team',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='team_id',
        related_name='team_tasks'
    )
    group = models.ForeignKey(
        'teams.Group',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='group_id',
        related_name='group_tasks'
    )
    parent_task = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        db_column='parent_task_id',
        related_name='subtasks'
    )
    status = models.CharField(max_length=30, default='Assigned', choices=STATUS_CHOICES)
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'tasks'
        indexes = [
            models.Index(fields=['assigned_to', 'status'], name='idx_tasks_assigned_to_status'),
            models.Index(fields=['team', 'status'], name='idx_tasks_team_status'),
            models.Index(fields=['group', 'status'], name='idx_tasks_group_status'),
            models.Index(fields=['parent_task'], name='idx_tasks_parent_task'),
            models.Index(fields=['deadline'], name='idx_tasks_deadline'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Task #{self.task_id}: {self.title} [{self.status}]"
