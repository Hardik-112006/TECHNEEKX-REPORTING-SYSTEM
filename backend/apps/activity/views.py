from rest_framework import viewsets, permissions
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
