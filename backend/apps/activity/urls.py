from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.activity.views import HistoryLogViewSet

router = DefaultRouter()
router.register(r'activity', HistoryLogViewSet, basename='activity')

urlpatterns = [
    path('', include(router.urls)),
]
