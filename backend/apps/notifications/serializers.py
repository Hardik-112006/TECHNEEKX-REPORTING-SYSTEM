from rest_framework import serializers
from apps.notifications.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'notification_id',
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
            'title',
            'message',
            'notification_type',
            'severity',
            'action_url',
            'related_task_id',
            'created_at'
        ]
