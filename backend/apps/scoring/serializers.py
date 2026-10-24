from rest_framework import serializers
from apps.scoring.models import Performance
from apps.accounts.serializers import UserSummarySerializer

class PerformanceSerializer(serializers.ModelSerializer):
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = Performance
        fields = ['performance_id', 'user', 'points', 'rank', 'updated_at']
        read_only_fields = ['performance_id', 'user', 'points', 'rank', 'updated_at']
