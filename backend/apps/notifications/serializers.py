from rest_framework import serializers
from apps.notifications.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    recipient_id = serializers.IntegerField(source='recipient.user_id', read_only=True)
    recipient_name = serializers.CharField(source='recipient.name', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'notification_id',
            'recipient_id',
            'recipient_name',
            'title',
            'message',
            'notification_type',
            'severity',
            'is_read',
            'action_url',
            'related_task_id',
            'created_at'
        ]
        read_only_fields = [
            'notification_id',
            'recipient_id',
            'recipient_name',
            'title',
            'message',
            'notification_type',
            'severity',
            'action_url',
            'related_task_id',
            'created_at'
        ]
