from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from apps.announcements.models import Announcement
from apps.announcements.serializers import AnnouncementSerializer, AnnouncementCreateSerializer
from apps.accounts.permissions import IsCoreLeadOrAbove, user_has_tier
from apps.activity.services import log_activity

class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    CRUD for Announcements. All authenticated users can read; Core Leads and above can post.
    """
    queryset = Announcement.objects.select_related('created_by', 'created_by__role').all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AnnouncementCreateSerializer
        return AnnouncementSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsCoreLeadOrAbove()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        log_activity(
            user=self.request.user,
            action='ANNOUNCEMENT_POSTED',
            details=f"Posted announcement: '{announcement.title}'"
        )

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        user = request.user
        if not (user_has_tier(user, 2) or obj.created_by_id == user.user_id):
            return Response({'error': 'You do not have permission to edit this announcement.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        user = request.user
        if not (user_has_tier(user, 2) or obj.created_by_id == user.user_id):
            return Response({'error': 'You do not have permission to delete this announcement.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
