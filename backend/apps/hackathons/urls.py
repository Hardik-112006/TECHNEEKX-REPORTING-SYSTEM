from django.urls import path, include
from rest_framework.routers import DefaultRouter
# pyrefly: ignore [missing-import]
from apps.hackathons.views import (
    HackathonViewSet,
    CertificateSubmissionViewSet,
    HackathonLeaderboardView,
    CandidateShortlistView,
    RecruitmentAnalyticsView
)

router = DefaultRouter()
router.register(r'events', HackathonViewSet, basename='hackathon-events')
router.register(r'certificates', CertificateSubmissionViewSet, basename='hackathon-certificates')

urlpatterns = [
    # Router endpoints: /api/hackathons/events/, /api/hackathons/certificates/
    path('', include(router.urls)),

    # Hackathon Leaderboard: /api/hackathons/<id>/leaderboard/
    path('<int:hackathon_id>/leaderboard/', HackathonLeaderboardView.as_view(), name='hackathon-leaderboard'),

    # Recruitment Shortlist: /api/hackathons/<id>/shortlist/
    path('<int:hackathon_id>/shortlist/', CandidateShortlistView.as_view(), name='hackathon-shortlist'),

    # Recruitment Analytics: /api/hackathons/<id>/recruitment-analytics/
    path('<int:hackathon_id>/recruitment-analytics/', RecruitmentAnalyticsView.as_view(), name='hackathon-recruitment-analytics'),
]
