from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from apps.board.models import Warning, WarningAuditLog, RemovalReview
from apps.board.serializers import (
    WarningSerializer,
    WarningCreateSerializer,
    RevisedDeadlineSerializer,
    WarningAuditLogSerializer,
    RemovalReviewSerializer,
    RemovalReviewCreateSerializer,
    RemovalReviewResolveSerializer
)
from apps.board.services import (
    issue_warning,
    check_and_generate_overdue_warnings,
    assign_revised_deadline,
    flag_for_removal,
    resolve_removal_review,
    get_board_monitoring_metrics
)
from apps.accounts.permissions import (
    IsBoardOrOfficial,
    IsOfficialTeam,
    is_official,
    is_board,
    is_core_team
)

class BoardMonitoringOverviewView(views.APIView):
    """
    Board & Official Monitoring Intelligence Overview:
    Aggregates real-time overdue tasks, missing reports, group stats, and active warnings.
    """
    permission_classes = [permissions.IsAuthenticated, IsBoardOrOfficial]

    def get(self, request):
        data = get_board_monitoring_metrics(request.user)
        return Response(data, status=status.HTTP_200_OK)


class WarningViewSet(viewsets.ModelViewSet):
    """
    Manage Director of Core Operations & Official warnings.
    Allowed: Director of Core Operations and Officials can issue warnings.
    Max 5 active warnings per target user.
    """
    queryset = Warning.objects.select_related(
        'target_user', 'target_group', 'issued_by', 'related_task', 'revised_deadline_by', 'resolved_by'
    ).prefetch_related('audit_logs').all().order_by('-created_at')
    serializer_class = WarningSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'revise_deadline', 'resolve']:
            return [IsBoardOrOfficial()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        
        # Trigger automated overdue check for monitors
        if is_official(user) or is_board(user):
            check_and_generate_overdue_warnings(actor=user)

        queryset = super().get_queryset()

        if is_official(user) or is_board(user):
            pass
        elif is_core_team(user):
            if user.group_id:
                queryset = queryset.filter(target_group_id=user.group_id)
            else:
                queryset = queryset.none()
        else:
            queryset = queryset.filter(target_user=user)

        target_user_id = self.request.query_params.get('target_user')
        status_filter = self.request.query_params.get('status')
        if target_user_id:
            queryset = queryset.filter(target_user_id=target_user_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = WarningCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        warning = issue_warning(
            issued_by=request.user,
            target_user=serializer.validated_data.get('target_user'),
            target_group=serializer.validated_data.get('target_group'),
            related_task=serializer.validated_data.get('related_task'),
            reason=serializer.validated_data.get('reason'),
            expiry_date=serializer.validated_data.get('expiry_date')
        )
        return Response(WarningSerializer(warning).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsBoardOrOfficial])
    def revise_deadline(self, request, pk=None):
        warning = self.get_object()
        serializer = RevisedDeadlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_warn = assign_revised_deadline(
            warning_id=warning.warning_id,
            revised_deadline=serializer.validated_data['revised_deadline'],
            actor=request.user
        )
        return Response(WarningSerializer(updated_warn).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def acknowledge(self, request, pk=None):
        warning = self.get_object()
        if request.user.user_id != warning.target_user_id and not (is_official(request.user) or is_board(request.user)):
            return Response({'error': 'Only the target user or Board/Official can acknowledge this warning.'}, status=status.HTTP_403_FORBIDDEN)
        warning.status = 'Acknowledged'
        warning.save(update_fields=['status'])
        
        WarningAuditLog.objects.create(
            warning=warning,
            action='Warning Acknowledged',
            actor=request.user,
            actor_name=request.user.name,
            details=f"Warning acknowledged by {request.user.name}."
        )
        return Response(WarningSerializer(warning).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsBoardOrOfficial])
    def resolve(self, request, pk=None):
        warning = self.get_object()
        warning.status = 'Resolved'
        warning.resolved_at = timezone.now()
        warning.resolved_by = request.user
        warning.save(update_fields=['status', 'resolved_at', 'resolved_by'])
        
        WarningAuditLog.objects.create(
            warning=warning,
            action='Warning Resolved',
            actor=request.user,
            actor_name=request.user.name,
            details=f"Warning manually marked as Resolved by {request.user.name}."
        )
        return Response(WarningSerializer(warning).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsBoardOrOfficial])
    def audit_logs(self, request):
        logs = WarningAuditLog.objects.select_related('warning', 'actor').all().order_by('-created_at')[:100]
        serializer = WarningAuditLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RemovalReviewViewSet(viewsets.ModelViewSet):
    """
    Board & Official Removal Reviews.
    Flagging: Board or Official Team.
    Final Approval / Deactivation: Strictly Official Team only.
    """
    queryset = RemovalReview.objects.select_related(
        'target_user', 'target_group', 'flagged_by', 'resolved_by'
    ).all().order_by('-created_at')
    serializer_class = RemovalReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsBoardOrOfficial()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if is_official(user) or is_board(user):
            pass
        elif is_core_team(user):
            if user.group_id:
                queryset = queryset.filter(target_group_id=user.group_id)
            else:
                queryset = queryset.none()
        else:
            queryset = queryset.filter(target_user=user)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = RemovalReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = flag_for_removal(
            flagged_by=request.user,
            target_user=serializer.validated_data.get('target_user'),
            target_group=serializer.validated_data.get('target_group'),
            reason=serializer.validated_data.get('reason')
        )
        return Response(RemovalReviewSerializer(review).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsOfficialTeam])
    def resolve_decision(self, request, pk=None):
        serializer = RemovalReviewResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = resolve_removal_review(
            resolved_by=request.user,
            review_id=pk,
            decision=serializer.validated_data['decision'],
            official_notes=serializer.validated_data.get('official_notes', '')
        )
        return Response(RemovalReviewSerializer(review).data, status=status.HTTP_200_OK)
