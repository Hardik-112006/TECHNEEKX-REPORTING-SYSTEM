from django.db import models
from django.utils import timezone

class TaskProof(models.Model):
    proof_id = models.AutoField(primary_key=True, db_column='proof_id')
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        db_column='task_id',
        related_name='proofs'
    )
    submitted_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='submitted_by',
        related_name='submitted_proofs'
    )
    github_link = models.TextField(null=True, blank=True)
    screenshots = models.TextField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    submitted_at = models.DateTimeField(default=timezone.now, db_column='submitted_at')

    class Meta:
        db_table = 'task_proofs'
        indexes = [
            models.Index(fields=['task', '-submitted_at'], name='idx_proofs_task_submitted_at'),
        ]
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Proof #{self.proof_id} for Task #{self.task_id}"

class Review(models.Model):
    DECISION_CHOICES = [
        ('Approved', 'Approved'),
        ('Changes Requested', 'Changes Requested'),
    ]

    review_id = models.AutoField(primary_key=True, db_column='review_id')
    task = models.ForeignKey(
        'tasks.Task',
        on_delete=models.CASCADE,
        db_column='task_id',
        related_name='reviews'
    )
    proof = models.ForeignKey(
        TaskProof,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='proof_id',
        related_name='reviews'
    )
    reviewer = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='reviewer_id',
        related_name='conducted_reviews'
    )
    decision = models.CharField(max_length=30, choices=DECISION_CHOICES)
    feedback = models.TextField(null=True, blank=True)
    reviewed_at = models.DateTimeField(default=timezone.now, db_column='reviewed_at')

    class Meta:
        db_table = 'reviews'
        indexes = [
            models.Index(fields=['task', '-reviewed_at'], name='idx_reviews_task_reviewed_at'),
        ]
        constraints = [
            # Database-level guarantee that a task is approved (and its points awarded) at most once
            models.UniqueConstraint(
                fields=['task'],
                condition=models.Q(decision='Approved'),
                name='uniq_approved_review_per_task',
            ),
        ]
        ordering = ['-reviewed_at']

    def __str__(self):
        return f"Review #{self.review_id} on Task #{self.task_id}: {self.decision}"
