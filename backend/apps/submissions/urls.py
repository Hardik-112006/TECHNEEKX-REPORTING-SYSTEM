from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.submissions.views import (
    SubmitProofView,
    ReviewTaskView,
    SubmissionViewSet,
    ReviewViewSet
)

router = DefaultRouter()
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'reviews', ReviewViewSet, basename='review')

urlpatterns = [
    # Dedicated workflow action endpoints
    path('tasks/<int:task_id>/submit/', SubmitProofView.as_view(), name='task-submit-proof'),
    path('tasks/<int:task_id>/review/', ReviewTaskView.as_view(), name='task-review'),

    # Read-only lists
    path('', include(router.urls)),
]
