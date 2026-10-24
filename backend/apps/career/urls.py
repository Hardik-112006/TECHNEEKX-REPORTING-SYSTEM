from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.career.views import (
    MyCareerProfileView,
    EducationViewSet,
    PortfolioProjectViewSet,
    AchievementViewSet,
    ContributionHighlightViewSet,
    ResumeConfigView,
    ResumePdfDownloadView,
    PublicProfileView
)

router = DefaultRouter()
router.register(r'educations', EducationViewSet, basename='career-education')
router.register(r'projects', PortfolioProjectViewSet, basename='career-project')
router.register(r'achievements', AchievementViewSet, basename='career-achievement')
router.register(r'contributions', ContributionHighlightViewSet, basename='career-contribution')

urlpatterns = [
    # Authenticated member career profile
    path('me/', MyCareerProfileView.as_view(), name='career-me'),

    # ATS Resume configuration and download
    path('resume/config/', ResumeConfigView.as_view(), name='career-resume-config'),
    path('resume/pdf/', ResumePdfDownloadView.as_view(), name='career-resume-pdf'),

    # Public portfolio sharing
    path('public/<slug:slug>/', PublicProfileView.as_view(), name='career-public-profile'),

    # Nested routers
    path('', include(router.urls)),
]
