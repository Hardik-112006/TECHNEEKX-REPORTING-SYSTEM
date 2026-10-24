from django.urls import path
from apps.notifications.views import (
    NotificationListView,
    NotificationSummaryView,
    MarkNotificationReadView,
    MarkAllReadView,
    TriggerRemindersView
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notifications-list'),
    path('summary/', NotificationSummaryView.as_view(), name='notifications-summary'),
    path('<int:notification_id>/read/', MarkNotificationReadView.as_view(), name='notification-mark-read'),
    path('mark-all-read/', MarkAllReadView.as_view(), name='notifications-mark-all-read'),
    path('trigger-reminders/', TriggerRemindersView.as_view(), name='notifications-trigger-reminders'),
]
