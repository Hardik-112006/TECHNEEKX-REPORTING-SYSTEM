from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.accounts.permissions import user_has_tier
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import process_reminders_and_escalations

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        unread_only = self.request.query_params.get('unread_only', 'false').lower() == 'true'
        if unread_only:
            qs = qs.filter(is_read=False)
        return qs


class NotificationSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_notifs = Notification.objects.filter(recipient=request.user)
        unread_count = user_notifs.filter(is_read=False).count()
        recent = user_notifs[:5]
        serializer = NotificationSerializer(recent, many=True)
        return Response({
            'unread_count': unread_count,
            'recent': serializer.data
        }, status=status.HTTP_200_OK)


class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        notif = get_object_or_404(Notification, notification_id=notification_id, recipient=request.user)
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return Response({
            'message': 'Notification marked as read.',
            'notification_id': notif.notification_id
        }, status=status.HTTP_200_OK)


class MarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({
            'message': f'Marked {updated_count} notifications as read.',
            'updated_count': updated_count
        }, status=status.HTTP_200_OK)


class TriggerRemindersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not user_has_tier(request.user, 3):
            return Response(
                {"error": "Only Core Leads and Officials can trigger automated reminder sweeps."},
                status=status.HTTP_403_FORBIDDEN
            )
        summary = process_reminders_and_escalations()
        return Response({
            'message': 'Automated reminders and escalation cycle executed successfully.',
            'summary': summary
        }, status=status.HTTP_200_OK)
