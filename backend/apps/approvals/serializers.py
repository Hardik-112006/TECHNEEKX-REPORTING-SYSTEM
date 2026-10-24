from rest_framework import serializers
from apps.approvals.models import ApprovalWorkflow, ApprovalStageAudit

class ApprovalStageAuditSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.name', read_only=True)
    reviewer_role = serializers.CharField(source='reviewer.role.name', read_only=True)

    class Meta:
        model = ApprovalStageAudit
        fields = [
            'audit_id',
            'stage_number',
            'stage_name',
            'reviewer',
            'reviewer_name',
            'reviewer_role',
            'decision',
            'feedback',
            'decided_at'
        ]
        read_only_fields = fields


class ApprovalWorkflowSerializer(serializers.ModelSerializer):
    submitter_name = serializers.CharField(source='submitter.name', read_only=True)
    stage_history = ApprovalStageAuditSerializer(many=True, read_only=True)

    class Meta:
        model = ApprovalWorkflow
        fields = [
            'workflow_id',
            'content_type',
            'object_id',
            'title',
            'description',
            'submitter',
            'submitter_name',
            'current_stage',
            'total_stages',
            'status',
            'stage_history',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'workflow_id',
            'submitter',
            'submitter_name',
            'current_stage',
            'status',
            'stage_history',
            'created_at',
            'updated_at'
        ]


class WorkflowDecisionInputSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['Approved', 'Changes Requested', 'Rejected'])
    feedback = serializers.CharField(required=False, allow_blank=True, default='')


class WorkflowResubmitInputSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default='')
