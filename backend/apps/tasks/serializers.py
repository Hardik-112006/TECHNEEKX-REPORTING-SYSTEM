from rest_framework import serializers
from django.utils import timezone
from datetime import datetime, time, timedelta
from apps.tasks.models import Task, MAX_TASK_POINTS
from apps.accounts.models import User
from apps.teams.models import Team, Group
from apps.accounts.serializers import UserSummarySerializer

class TaskSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)
    assigned_to = UserSummarySerializer(read_only=True)
    assigned_to_id = serializers.IntegerField(source='assigned_to.user_id', read_only=True, default=None)
    team_id = serializers.IntegerField(source='team.team_id', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    group_id = serializers.IntegerField(source='group.group_id', read_only=True, default=None)
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)
    parent_task_title = serializers.CharField(source='parent_task.title', read_only=True, default=None)
    subtasks_count = serializers.SerializerMethodField()
    proofs_count = serializers.SerializerMethodField()
    proof_count = serializers.SerializerMethodField()
    latest_proof = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    deadline_display = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'task_id', 'title', 'description', 'created_by', 'assigned_to', 'assigned_to_id',
            'team', 'team_id', 'team_name', 'group', 'group_id', 'group_name',
            'parent_task', 'parent_task_title', 'subtasks_count',
            'status', 'priority', 'points', 'deadline', 'deadline_display', 'created_at',
            'proofs_count', 'proof_count', 'latest_proof', 'is_overdue'
        ]
        read_only_fields = [
            'task_id', 'created_by', 'created_at', 'proofs_count', 'proof_count', 'latest_proof',
            'is_overdue', 'subtasks_count', 'deadline_display', 'parent_task_title',
            'assigned_to_id', 'team_id', 'group_id', 'group_name'
        ]

    def get_subtasks_count(self, obj):
        return obj.subtasks.count()

    def get_proofs_count(self, obj):
        return obj.proofs.count()

    def get_proof_count(self, obj):
        return obj.proofs.count()

    def get_latest_proof(self, obj):
        # Read from the prefetch cache (TaskViewSet prefetches proofs + submitters) instead of
        # issuing one query per task in list responses.
        proofs = list(obj.proofs.all())
        proof = max(proofs, key=lambda p: p.submitted_at) if proofs else None
        if proof:
            return {
                'proof_id': proof.proof_id,
                'task_id': proof.task_id,
                'github_link': proof.github_link,
                'screenshots': proof.screenshots,
                'description': proof.description,
                'submitted_at': proof.submitted_at.isoformat() if proof.submitted_at else None,
                'submitted_by_name': proof.submitted_by.name if proof.submitted_by else None
            }
        return None

    def get_is_overdue(self, obj):
        if obj.deadline and obj.status not in ('Approved', 'Submitted'):
            return timezone.now() > obj.deadline
        return False

    def get_deadline_display(self, obj):
        if not obj.deadline:
            return "No deadline"
        
        now = timezone.now()
        task_date = obj.deadline.date()
        today = now.date()
        tomorrow = today + timedelta(days=1)

        is_completed = obj.status in ('Approved', 'Submitted')
        is_past = now > obj.deadline

        if not is_completed and is_past:
            return "Overdue"
        if task_date == today:
            return "Due today"
        if task_date == tomorrow:
            return "Due tomorrow"
        
        # Clean human-readable date: e.g. "Due 28 October 2026"
        return f"Due {task_date.strftime('%d %B %Y')}"


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
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source='group',
        allow_null=True,
        required=False
    )
    parent_task_id = serializers.PrimaryKeyRelatedField(
        queryset=Task.objects.all(),
        source='parent_task',
        allow_null=True,
        required=False
    )

    class Meta:
        model = Task
        fields = ['title', 'description', 'assigned_to_id', 'team_id', 'group_id', 'parent_task_id', 'priority', 'points', 'deadline']
        extra_kwargs = {
            'points': {'min_value': 1, 'max_value': MAX_TASK_POINTS},
        }

    def to_internal_value(self, data):
        data_copy = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'assigned_to' in data_copy and 'assigned_to_id' not in data_copy:
            data_copy['assigned_to_id'] = data_copy.pop('assigned_to')
        if 'team' in data_copy and 'team_id' not in data_copy:
            data_copy['team_id'] = data_copy.pop('team')
        if 'group' in data_copy and 'group_id' not in data_copy:
            data_copy['group_id'] = data_copy.pop('group')
        if 'parent_task' in data_copy and 'parent_task_id' not in data_copy:
            data_copy['parent_task_id'] = data_copy.pop('parent_task')
        return super().to_internal_value(data_copy)

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
        group = attrs.get('group', getattr(self.instance, 'group', None))
        parent_task = attrs.get('parent_task', getattr(self.instance, 'parent_task', None))

        # 1. At least one target assignment must be set
        if not assigned_to and not team and not group:
            raise serializers.ValidationError(
                "Task must be assigned to an individual user, a group, or a team."
            )

        # 2. Prevent contradictory assignments: if user and team are set, check match
        if assigned_to and team and assigned_to.team_id and assigned_to.team_id != team.team_id:
            raise serializers.ValidationError(
                f"Contradictory assignment: User '{assigned_to.name}' is not in team '{team.name}'."
            )

        # 3. If group is set, optionally sync team
        if group and not team:
            attrs['team'] = group.team

        # 4. Same-day & future date deadline validation:
        # User primarily selects a due date. If deadline date is >= today, accept!
        deadline = attrs.get('deadline')
        if deadline:
            now = timezone.now()
            # If time is 00:00:00 (date picker), set to end of that day 23:59:59
            if deadline.hour == 0 and deadline.minute == 0 and deadline.second == 0:
                deadline = timezone.make_aware(
                    datetime.combine(deadline.date(), time(23, 59, 59)),
                    timezone.get_current_timezone()
                )
                attrs['deadline'] = deadline

            # Check if deadline date is in the past
            if deadline.date() < now.date():
                raise serializers.ValidationError(
                    "Task deadline date cannot be in the past."
                )

        return attrs

