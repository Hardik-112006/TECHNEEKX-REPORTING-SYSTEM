from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from django.http import HttpResponse
import csv
from apps.activity.models import HistoryLog
from apps.activity.serializers import HistoryLogSerializer
from apps.accounts.permissions import user_has_tier

class HistoryLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log views. Tier 1 & 2 view complete audit trails; Members view their own logs.
    """
    queryset = HistoryLog.objects.select_related('user', 'user__role').all().order_by('-created_at')
    serializer_class = HistoryLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if not user_has_tier(user, 2):
            queryset = queryset.filter(user=user)

        action_filter = self.request.query_params.get('action')
        user_id_filter = self.request.query_params.get('user_id')

        if action_filter:
            queryset = queryset.filter(action=action_filter)
        if user_id_filter and user_has_tier(user, 2):
            queryset = queryset.filter(user_id=user_id_filter)

        return queryset

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        queryset = self.get_queryset()
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="techneekx_audit_history.csv"'

        writer = csv.writer(response)
        writer.writerow(['Log ID', 'Timestamp (UTC)', 'Actor Name', 'Actor Email', 'Role', 'Action / Event', 'Details'])

        for log in queryset:
            actor_name = log.user.name if log.user else 'System'
            actor_email = log.user.email if log.user else 'system@techneekx.internal'
            role_name = log.user.role.name if (log.user and log.user.role) else 'N/A'
            timestamp_str = log.created_at.strftime('%Y-%m-%d %H:%M:%S') if log.created_at else ''
            writer.writerow([
                log.log_id,
                timestamp_str,
                actor_name,
                actor_email,
                role_name,
                log.action,
                log.details or ''
            ])

        return response

