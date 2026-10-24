from rest_framework import serializers
from apps.activity.models import HistoryLog
from apps.accounts.serializers import UserSummarySerializer

class HistoryLogSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = HistoryLog
        fields = ['log_id', 'user', 'action', 'details', 'created_at']
        read_only_fields = ['log_id', 'user', 'action', 'details', 'created_at']
