from rest_framework import serializers
from django.utils import timezone
from apps.tasks.models import Task
from apps.accounts.models import User
from apps.teams.models import Team
from apps.accounts.serializers import UserSummarySerializer

class TaskSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)
    assigned_to = UserSummarySerializer(read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    proofs_count = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'task_id', 'title', 'description', 'created_by', 'assigned_to',
            'team', 'team_name', 'status', 'deadline', 'created_at',
            'proofs_count', 'is_overdue'
        ]
        read_only_fields = ['task_id', 'created_by', 'created_at', 'proofs_count', 'is_overdue']

    def get_proofs_count(self, obj):
        return obj.proofs.count()

    def get_is_overdue(self, obj):
        if obj.deadline and obj.status not in ('Approved', 'Submitted'):
            return obj.deadline < timezone.now()
        return False


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='assigned_to',
        allow_null=True,
        required=False
    )
    team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        source='team',
        allow_null=True,
        required=False
    )

    class Meta:
        model = Task
        fields = ['title', 'description', 'assigned_to_id', 'team_id', 'deadline']

    def validate_title(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Task title cannot be empty.")
        return val

    def validate_description(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Task description cannot be empty.")
        return val

    def validate(self, attrs):
        assigned_to = attrs.get('assigned_to', getattr(self.instance, 'assigned_to', None))
        team = attrs.get('team', getattr(self.instance, 'team', None))

        # 1. At least one target assignment must be set
        if not assigned_to and not team:
            raise serializers.ValidationError(
                "Task must be assigned to an individual user, a team, or both."
            )

        # 2. Prevent contradictory assignments: if both are set, assignee must belong to the team
        if assigned_to and team:
            if assigned_to.team_id != team.team_id:
                raise serializers.ValidationError(
                    f"Contradictory assignment: User '{assigned_to.name}' is not a member of team '{team.name}'."
                )

        # 3. Validate deadline (only on creation)
        deadline = attrs.get('deadline')
        if not self.instance and deadline:
            if deadline <= timezone.now():
                raise serializers.ValidationError("Task deadline must be set to a future timestamp.")

        return attrs
