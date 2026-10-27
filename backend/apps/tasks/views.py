from rest_framework import status, viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Prefetch, Q
from django.utils import timezone

from apps.tasks.models import Task, TaskProgressNote
from apps.tasks.serializers import TaskSerializer, TaskCreateUpdateSerializer
from apps.submissions.models import TaskProof
from apps.accounts.permissions import (
    CanCreateOrDelegateTask,
    is_official,
    is_board,
    is_core_team,
    is_task_assignee
)
from apps.activity.services import log_activity

MAX_PROGRESS_NOTE_LENGTH = 1000


def delegation_error(user, assigned_to, group):
    """
    Core Leads may only delegate within their own group. Returns an error message
    when the requested assignment falls outside the caller's scope, else None.
    """
    if not is_core_team(user) or is_official(user):
        return None
    if assigned_to and user.group_id and assigned_to.group_id != user.group_id:
        return (f"Core Leads can only delegate tasks to members of their own group. "
                f"'{assigned_to.name}' belongs to a different group.")
    if group and user.group_id and group.group_id != user.group_id:
        return "Core Leads can only assign tasks to their own authorized group."
    return None


def scope_tasks_for_user(queryset, user):
    """Role-based task visibility shared by the task API and global search."""
    # Officials and the Director of Core Operations: organization-wide scope
    if is_official(user) or is_board(user):
        return queryset
    if is_core_team(user):
        # Core Leads: tasks they created, tasks assigned to them, or work inside their group
        q_filter = Q(created_by=user) | Q(assigned_to=user)
        if user.group_id:
            q_filter |= Q(group_id=user.group_id) | Q(assigned_to__group_id=user.group_id)
        return queryset.filter(q_filter)
    # Members: their own tasks, plus shared group/team tasks with no individual assignee
    q_filter = Q(assigned_to=user)
    if user.group_id:
        q_filter |= Q(group_id=user.group_id, assigned_to__isnull=True)
    if user.team_id:
        q_filter |= Q(team_id=user.team_id, group__isnull=True, assigned_to__isnull=True)
    return queryset.filter(q_filter)


def clean_progress_note(request):
    note = request.data.get('note') or ''
    return str(note).strip()[:MAX_PROGRESS_NOTE_LENGTH]

class TaskViewSet(viewsets.ModelViewSet):
    """
    CRUD for tasks with role-based visibility, downward delegation,
    and server-side hierarchy validation.
    """
    queryset = Task.objects.select_related(
        'created_by__role', 'created_by__team', 'created_by__group',
        'assigned_to__role', 'assigned_to__team', 'assigned_to__group',
        'team', 'group', 'parent_task'
    ).prefetch_related(
        Prefetch('proofs', queryset=TaskProof.objects.select_related('submitted_by')),
        'subtasks'
    ).all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        return TaskSerializer

    def get_permissions(self):
        if self.action in ['create', 'delegate']:
            return [CanCreateOrDelegateTask()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = scope_tasks_for_user(super().get_queryset(), user)

        # Query parameter filters
        status_filter = self.request.query_params.get('status')
        team_id = self.request.query_params.get('team_id')
        group_id = self.request.query_params.get('group_id')
        assigned_to_id = self.request.query_params.get('assigned_to')
        parent_task_id = self.request.query_params.get('parent_task_id')
        overdue = self.request.query_params.get('overdue')
        search = self.request.query_params.get('search')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        if assigned_to_id:
            queryset = queryset.filter(assigned_to_id=assigned_to_id)
        if parent_task_id:
            queryset = queryset.filter(parent_task_id=parent_task_id)
        if overdue and overdue.lower() == 'true':
            queryset = queryset.filter(
                deadline__lt=timezone.now()
            ).exclude(status__in=['Approved', 'Submitted'])
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        return queryset

    def create(self, request, *args, **kwargs):
        user = request.user
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # DOWNWARD DELEGATION RULES: Core Leads can only delegate within their own group
        error = delegation_error(
            user,
            serializer.validated_data.get('assigned_to'),
            serializer.validated_data.get('group')
        )
        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        task = serializer.save(created_by=user)
        log_activity(
            user=user,
            action='TASK_CREATED',
            details=f"Created Task #{task.task_id}: '{task.title}' (Assigned: {task.assigned_to.name if task.assigned_to else 'Group'})"
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)

    def check_modify_permission(self, task):
        # Officials or the task's creator. The Director of Core Operations is inspection-only
        # and adjusts deadlines through board warnings, not by editing tasks directly.
        user = self.request.user
        return is_official(user) or task.created_by_id == user.user_id

    def update(self, request, *args, **kwargs):
        task = self.get_object()
        if not self.check_modify_permission(task):
            return Response({'error': 'You do not have permission to modify this task.'}, status=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(task, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        error = delegation_error(
            request.user,
            serializer.validated_data.get('assigned_to'),
            serializer.validated_data.get('group')
        )
        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        task = serializer.save()
        log_activity(
            user=request.user,
            action='TASK_UPDATED',
            details=f"Updated Task #{task.task_id}: '{task.title}'"
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        task = self.get_object()
        if not self.check_modify_permission(task):
            return Response({'error': 'You do not have permission to delete this task.'}, status=status.HTTP_403_FORBIDDEN)
        log_activity(
            user=self.request.user,
            action='TASK_DELETED',
            details=f"Deleted Task #{task.task_id}: '{task.title}'"
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='start')
    def start_task(self, request, pk=None):
        """
        Transition task from 'Assigned' to 'In Progress'.
        Callable by the assigned member or any member of the assigned team.
        """
        task = self.get_object()
        user = request.user

        # Validate caller assignment
        if not (is_task_assignee(task, user) or is_official(user)):
            return Response(
                {'error': 'Only the assigned member can start this task.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if task.status not in ('Assigned', 'Changes Requested'):
            return Response(
                {'error': f"Cannot start task: current status is '{task.status}' (expected 'Assigned' or 'Changes Requested')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        task.status = 'In Progress'
        task.save(update_fields=['status'])

        note = clean_progress_note(request)
        if note:
            TaskProgressNote.objects.create(task=task, author=user, note=note, task_status=task.status)
        log_activity(
            user=user,
            action='TASK_STATUS_CHANGED',
            details=f"Task #{task.task_id} transitioned to In Progress by {user.name}" + (f". Note: {note}" if note else '')
        )

        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='progress')
    def progress(self, request, pk=None):
        """
        GET lists progress notes on this task; POST lets the assignee add one without
        changing status, so leaders can follow work before the final submission.
        """
        task = self.get_object()
        if request.method == 'GET':
            notes = task.progress_notes.select_related('author').all()[:50]
            return Response([
                {
                    'note_id': n.note_id,
                    'author_name': n.author.name if n.author else 'Former member',
                    'note': n.note,
                    'task_status': n.task_status,
                    'created_at': n.created_at.isoformat(),
                }
                for n in notes
            ], status=status.HTTP_200_OK)

        user = request.user
        if not is_task_assignee(task, user):
            return Response({'error': 'Only the assigned member can post progress on this task.'}, status=status.HTTP_403_FORBIDDEN)
        if task.status == 'Approved':
            return Response({'error': 'This task is already approved.'}, status=status.HTTP_400_BAD_REQUEST)
        note = clean_progress_note(request)
        if not note:
            return Response({'note': ['A progress note is required.']}, status=status.HTTP_400_BAD_REQUEST)

        entry = TaskProgressNote.objects.create(task=task, author=user, note=note, task_status=task.status)
        log_activity(
            user=user,
            action='TASK_PROGRESS_NOTE',
            details=f"Progress on Task #{task.task_id} ({task.status}): {note}"
        )
        return Response({
            'note_id': entry.note_id,
            'author_name': user.name,
            'note': entry.note,
            'task_status': entry.task_status,
            'created_at': entry.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='submissions')
    def get_submissions(self, request, pk=None):
        task = self.get_object()
        from apps.submissions.serializers import TaskProofSerializer
        proofs = task.proofs.select_related('submitted_by').all().order_by('-submitted_at')
        return Response(TaskProofSerializer(proofs, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='reviews')
    def get_reviews(self, request, pk=None):
        task = self.get_object()
        from apps.submissions.serializers import ReviewSerializer
        reviews = task.reviews.select_related('reviewer', 'proof').all().order_by('-reviewed_at')
        return Response(ReviewSerializer(reviews, many=True).data, status=status.HTTP_200_OK)
