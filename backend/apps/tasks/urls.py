from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.tasks.views import TaskViewSet
from apps.tasks.search_views import GlobalSearchView, LiveEtaView

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')

urlpatterns = [
    path('search/', GlobalSearchView.as_view(), name='global-search'),
    path('tasks/live-eta/', LiveEtaView.as_view(), name='task-live-eta'),
    path('', include(router.urls)),
]

