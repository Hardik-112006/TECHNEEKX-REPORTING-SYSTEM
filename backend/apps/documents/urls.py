from django.urls import path, include
from rest_framework.routers import DefaultRouter
# pyrefly: ignore [missing-import]
from apps.documents.views import (
    ResourceMaterialViewSet,
    MouDocumentViewSet,
    EventProposalViewSet,
    SponsorshipProposalViewSet,
    CommunityPartnerViewSet
)

router = DefaultRouter()
router.register(r'resources', ResourceMaterialViewSet, basename='document-resources')
router.register(r'mous', MouDocumentViewSet, basename='document-mous')
router.register(r'event-proposals', EventProposalViewSet, basename='document-event-proposals')
router.register(r'sponsorships', SponsorshipProposalViewSet, basename='document-sponsorships')
router.register(r'partners', CommunityPartnerViewSet, basename='document-partners')

urlpatterns = [
    path('', include(router.urls)),
]
