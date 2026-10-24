from rest_framework import status, viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from django.utils import timezone

from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer, TaskCreateUpdateSerializer
from apps.accounts.permissions import (
    IsCoreLeadOrAbove,
    IsExecutiveOrLeader,
    user_has_tier
)
from apps.activity.services import log_activity

class TaskViewSet(viewsets.ModelViewSet):
    """
    CRUD for tasks with role-based visibility, server-side assignment validation,
    and workflow state machine transitions.
    """
    queryset = Task.objects.select_related('created_by', 'assigned_to', 'team').prefetch_related('proofs').all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        return TaskSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsCoreLeadOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Scope visibility based on role tier
        if user_has_tier(user, 2):
            # Tier 1 & 2: Full organization-wide task oversight
            pass
        elif user_has_tier(user, 4):
            # Tier 3 & 4 (Leads/Deputies): Created by user, assigned to user, or assigned to user's team
            q_filter = Q(created_by=user) | Q(assigned_to=user)
            if user.team_id:
                q_filter |= Q(team_id=user.team_id)
            queryset = queryset.filter(q_filter)
        else:
            # Tier 5 (Member): ONLY tasks assigned directly to member or their team
            q_filter = Q(assigned_to=user)
            if user.team_id:
                q_filter |= Q(team_id=user.team_id)
            queryset = queryset.filter(q_filter)

        # Query parameter filters
        status_filter = self.request.query_params.get('status')
        team_id = self.request.query_params.get('team_id')
        assigned_to_id = self.request.query_params.get('assigned_to')
        overdue = self.request.query_params.get('overdue')
        search = self.request.query_params.get('search')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        if assigned_to_id:
            queryset = queryset.filter(assigned_to_id=assigned_to_id)
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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = serializer.save(created_by=request.user)
        log_activity(
            user=request.user,
            action='TASK_CREATED',
            details=f"Created Task #{task.task_id}: '{task.title}'"
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)

    def check_modify_permission(self, task):
        user = self.request.user
        if not (user_has_tier(user, 2) or task.created_by_id == user.user_id):
            return False
        return True

    def update(self, request, *args, **kwargs):
        task = self.get_object()
        if not self.check_modify_permission(task):
            return Response({'error': 'You do not have permission to modify this task.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

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
        is_assigned = (task.assigned_to_id == user.user_id) or (task.team_id and user.team_id == task.team_id)
        if not (is_assigned or user_has_tier(user, 2)):
            return Response(
                {'error': 'Only the assigned member or team lead can start this task.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if task.status not in ('Assigned', 'Changes Requested'):
            return Response(
                {'error': f"Cannot start task: current status is '{task.status}' (expected 'Assigned' or 'Changes Requested')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        task.status = 'In Progress'
        task.save(update_fields=['status'])

        log_activity(
            user=user,
            action='TASK_STATUS_CHANGED',
            details=f"Task #{task.task_id} transitioned to In Progress by {user.name}"
        )

        return Response(TaskSerializer(task).data, status=status.HTTP_200_OK)

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
