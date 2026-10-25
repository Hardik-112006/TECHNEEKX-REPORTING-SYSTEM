from rest_framework import serializers
from apps.scoring.models import Performance
from apps.accounts.serializers import UserSummarySerializer

class PerformanceSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.user_id', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = Performance
        fields = ['performance_id', 'user_id', 'user_name', 'user', 'points', 'rank', 'updated_at']
        read_only_fields = ['performance_id', 'user_id', 'user_name', 'user', 'points', 'rank', 'updated_at']
