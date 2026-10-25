from rest_framework import serializers
from apps.board.models import Warning, WarningAuditLog, RemovalReview
from apps.accounts.models import User
from apps.teams.models import Group
from apps.tasks.models import Task

class WarningAuditLogSerializer(serializers.ModelSerializer):
    warning_id = serializers.IntegerField(source='warning.warning_id', read_only=True)
    actor_name = serializers.CharField(read_only=True)

    class Meta:
        model = WarningAuditLog
        fields = [
            'audit_id', 'warning_id', 'action', 'actor', 'actor_name',
            'details', 'created_at'
        ]
        read_only_fields = ['audit_id', 'warning_id', 'created_at']


class WarningSerializer(serializers.ModelSerializer):
    target_user_name = serializers.CharField(source='target_user.name', read_only=True, default=None)
    target_group_name = serializers.SerializerMethodField()
    issued_by_name = serializers.CharField(source='issued_by.name', read_only=True)
    task_title = serializers.CharField(source='related_task.title', read_only=True, default=None)
    original_deadline = serializers.DateTimeField(source='related_task.deadline', read_only=True, default=None)
    revised_deadline_by_name = serializers.CharField(source='revised_deadline_by.name', read_only=True, default=None)
    resolved_by_name = serializers.CharField(source='resolved_by.name', read_only=True, default=None)
    audit_logs = WarningAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = Warning
        fields = [
            'warning_id', 'target_user', 'target_user_name',
            'target_group', 'target_group_name',
            'related_task', 'task_title', 'original_deadline',
            'reason', 'issued_by', 'issued_by_name',
            'status', 'expiry_date',
            'revised_deadline', 'revised_deadline_by', 'revised_deadline_by_name', 'revised_deadline_at',
            'resolved_at', 'resolved_by', 'resolved_by_name',
            'created_at', 'audit_logs'
        ]
        read_only_fields = [
            'warning_id', 'issued_by', 'issued_by_name',
            'target_user_name', 'target_group_name', 'task_title',
            'original_deadline', 'revised_deadline_by_name', 'resolved_by_name',
            'created_at', 'audit_logs'
        ]

    def get_target_group_name(self, obj):
        if obj.target_group:
            return obj.target_group.name
        if obj.related_task and obj.related_task.group:
            return obj.related_task.group.name
        if obj.target_user and obj.target_user.group:
            return obj.target_user.group.name
        return 'General'


class WarningCreateSerializer(serializers.Serializer):
    target_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='target_user',
        required=False,
        allow_null=True
    )
    target_group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source='target_group',
        required=False,
        allow_null=True
    )
    related_task_id = serializers.PrimaryKeyRelatedField(
        queryset=Task.objects.all(),
        source='related_task',
        required=False,
        allow_null=True
    )
    reason = serializers.CharField(required=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)


class RevisedDeadlineSerializer(serializers.Serializer):
    revised_deadline = serializers.DateTimeField(required=True)


class RemovalReviewSerializer(serializers.ModelSerializer):
    target_user_name = serializers.CharField(source='target_user.name', read_only=True, default=None)
    target_group_name = serializers.CharField(source='target_group.name', read_only=True, default=None)
    flagged_by_name = serializers.CharField(source='flagged_by.name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.name', read_only=True, default=None)

    class Meta:
        model = RemovalReview
        fields = [
            'review_id', 'target_user', 'target_user_name',
            'target_group', 'target_group_name',
            'reason', 'flagged_by', 'flagged_by_name',
            'status', 'official_notes',
            'resolved_by', 'resolved_by_name',
            'created_at', 'resolved_at'
        ]
        read_only_fields = [
            'review_id', 'flagged_by', 'flagged_by_name',
            'target_user_name', 'target_group_name',
            'resolved_by', 'resolved_by_name',
            'created_at', 'resolved_at'
        ]


class RemovalReviewCreateSerializer(serializers.Serializer):
    target_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='target_user',
        required=False,
        allow_null=True
    )
    target_group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source='target_group',
        required=False,
        allow_null=True
    )
    reason = serializers.CharField(required=True)


class RemovalReviewResolveSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['Approved_Deactivated', 'Rejected'])
    official_notes = serializers.CharField(required=False, allow_blank=True)
