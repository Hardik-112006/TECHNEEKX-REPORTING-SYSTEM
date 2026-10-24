from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.teams.views import TeamViewSet, GroupViewSet

router = DefaultRouter()
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'groups', GroupViewSet, basename='group')

urlpatterns = [
    path('', include(router.urls)),
]
