from rest_framework import serializers
from apps.activity.models import HistoryLog, ExtraMaterial
from apps.accounts.serializers import UserSummarySerializer

class HistoryLogSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True, default='System')

    class Meta:
        model = HistoryLog
        fields = ['log_id', 'user', 'user_name', 'action', 'details', 'created_at']
        read_only_fields = ['log_id', 'user', 'user_name', 'action', 'details', 'created_at']


class ExtraMaterialSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, default=None)

    class Meta:
        model = ExtraMaterial
        fields = ['material_id', 'title', 'type', 'created_by', 'created_by_name', 'file_url', 'created_at']
        read_only_fields = ['material_id', 'created_by', 'created_by_name', 'created_at']
