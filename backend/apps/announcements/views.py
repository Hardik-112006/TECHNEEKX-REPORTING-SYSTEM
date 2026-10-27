from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from apps.announcements.models import Announcement
from apps.announcements.serializers import AnnouncementSerializer, AnnouncementCreateSerializer
from apps.accounts.permissions import CanPostAnnouncements, can_post_announcements, is_official
from apps.activity.services import log_activity

class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    Official TechNeekX Announcements.
    Read: all authenticated users.
    Create: Official Team, or users explicitly granted `can_post_announcements`.
    Update/delete: Official Team, or the original author while they still hold the flag.
    """
    queryset = Announcement.objects.select_related('created_by', 'created_by__role').all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AnnouncementCreateSerializer
        return AnnouncementSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [CanPostAnnouncements()]
        return [permissions.IsAuthenticated()]

    def _can_modify(self, announcement):
        user = self.request.user
        return is_official(user) or (
            announcement.created_by_id == user.user_id and can_post_announcements(user)
        )

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        log_activity(
            user=self.request.user,
            action='ANNOUNCEMENT_POSTED',
            details=f"Posted official announcement: '{announcement.title}'"
        )

    def update(self, request, *args, **kwargs):
        if not self._can_modify(self.get_object()):
            return Response({'error': 'Only the Official Team or the announcement author can edit it.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        announcement = self.get_object()
        if not self._can_modify(announcement):
            return Response({'error': 'Only the Official Team or the announcement author can delete it.'}, status=status.HTTP_403_FORBIDDEN)
        log_activity(
            user=request.user,
            action='ANNOUNCEMENT_DELETED',
            details=f"Deleted announcement: '{announcement.title}'"
        )
        return super().destroy(request, *args, **kwargs)
