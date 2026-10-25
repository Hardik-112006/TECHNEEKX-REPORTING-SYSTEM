from rest_framework import serializers
from apps.announcements.models import Announcement
from apps.accounts.serializers import UserSummarySerializer

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by = UserSummarySerializer(read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'announcement_id', 'title', 'content', 'category',
            'attachment', 'attachment_url', 'attachment_name', 'attachment_type',
            'external_link', 'drive_link',
            'created_by', 'created_at'
        ]
        read_only_fields = ['announcement_id', 'attachment_url', 'created_by', 'created_at']

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    external_link = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    drive_link = serializers.URLField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Announcement
        fields = [
            'title', 'content', 'category',
            'attachment', 'attachment_name', 'attachment_type',
            'external_link', 'drive_link'
        ]

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

    def validate_attachment(self, value):
        if value:
            # Max 10MB limit
            if value.size > 10 * 1024 * 1024:
                raise serializers.ValidationError("Attachment file size cannot exceed 10 MB.")
            # Allowed extensions
            allowed_exts = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'doc', 'zip', 'txt']
            ext = value.name.split('.')[-1].lower() if '.' in value.name else ''
            if ext not in allowed_exts:
                raise serializers.ValidationError(f"File extension '.{ext}' is not supported. Supported: {', '.join(allowed_exts)}")
        return value

    def create(self, validated_data):
        attachment = validated_data.get('attachment')
        if attachment and not validated_data.get('attachment_name'):
            validated_data['attachment_name'] = attachment.name
            ext = attachment.name.split('.')[-1].lower() if '.' in attachment.name else ''
            validated_data['attachment_type'] = ext.upper()
        return super().create(validated_data)
