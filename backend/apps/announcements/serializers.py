from rest_framework import serializers
from apps.announcements.models import Announcement
from apps.accounts.serializers import UserSummarySerializer

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = Announcement
        fields = ['announcement_id', 'title', 'content', 'created_by', 'created_at']
        read_only_fields = ['announcement_id', 'created_by', 'created_at']


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['title', 'content']

    def validate_title(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Title cannot be empty.")
        return val

    def validate_content(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Content cannot be empty.")
        return val
