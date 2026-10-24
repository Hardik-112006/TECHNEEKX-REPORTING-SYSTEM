from django.db import models
from django.utils import timezone
from apps.accounts.models import User

class ApprovalWorkflow(models.Model):
    STATUS_CHOICES = [
        ('Pending Stage 1', 'Stage 1: Lead / Technical Review'),
        ('Pending Stage 2', 'Stage 2: Official / Executive Sign-off'),
        ('Approved', 'Formally Approved'),
        ('Changes Requested', 'Changes Requested'),
        ('Rejected', 'Rejected'),
    ]

    workflow_id = models.AutoField(primary_key=True)
    content_type = models.CharField(max_length=50, help_text="e.g. event_proposal, sponsorship_proposal, mou_document, task_submission")
    object_id = models.IntegerField(help_text="Target entity ID")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    submitter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submitted_workflows'
    )
    current_stage = models.PositiveSmallIntegerField(default=1) # 1 or 2
    total_stages = models.PositiveSmallIntegerField(default=2)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pending Stage 1')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'approval_workflows'
        indexes = [
            models.Index(fields=['status', 'current_stage'], name='idx_approval_status_stage'),
            models.Index(fields=['content_type', 'object_id'], name='idx_approval_entity'),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f"Workflow #{self.workflow_id}: {self.title} [{self.status}]"


class ApprovalStageAudit(models.Model):
    DECISION_CHOICES = [
        ('Approved', 'Approved'),
        ('Changes Requested', 'Changes Requested'),
        ('Rejected', 'Rejected'),
    ]

    audit_id = models.AutoField(primary_key=True)
    workflow = models.ForeignKey(
        ApprovalWorkflow,
        on_delete=models.CASCADE,
        related_name='stage_history'
    )
    stage_number = models.PositiveSmallIntegerField()
    stage_name = models.CharField(max_length=100)
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE)
    decision = models.CharField(max_length=30, choices=DECISION_CHOICES)
    feedback = models.TextField(blank=True, default='')
    decided_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'approval_stage_audits'
        indexes = [
            models.Index(fields=['workflow', 'stage_number'], name='idx_audit_workflow_stage'),
        ]
        ordering = ['decided_at']

    def __str__(self):
        return f"Stage {self.stage_number} by {self.reviewer.name}: {self.decision}"
