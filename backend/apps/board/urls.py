from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.board.views import (
    BoardMonitoringOverviewView,
    WarningViewSet,
    RemovalReviewViewSet
)

router = DefaultRouter()
router.register(r'warnings', WarningViewSet, basename='board-warning')
router.register(r'removals', RemovalReviewViewSet, basename='board-removal')

urlpatterns = [
    path('overview/', BoardMonitoringOverviewView.as_view(), name='board-overview'),
    path('metrics/', BoardMonitoringOverviewView.as_view(), name='board-metrics'),
    path('', include(router.urls)),
]
