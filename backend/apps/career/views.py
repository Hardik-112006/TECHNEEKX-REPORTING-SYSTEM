from rest_framework import status, views, viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
from django.shortcuts import get_object_or_404

from apps.career.models import (
    CareerProfile,
    Education,
    PortfolioProject,
    Achievement,
    ContributionHighlight,
    ResumeConfiguration
)
from apps.career.serializers import (
    CareerProfileSerializer,
    CareerProfileUpdateSerializer,
    EducationSerializer,
    PortfolioProjectSerializer,
    AchievementSerializer,
    ContributionHighlightSerializer,
    ResumeConfigurationSerializer,
    PublicCareerProfileSerializer
)
from apps.career.services import generate_ats_resume_pdf, sync_approved_contributions
from apps.accounts.permissions import user_has_tier

class MyCareerProfileView(views.APIView):
    """
    Retrieve and update the authenticated member's career profile.
    Automatically initializes profile and resume configuration if not present.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_or_create_profile(self, user):
        profile, _ = CareerProfile.objects.get_or_create(user=user)
        ResumeConfiguration.objects.get_or_create(profile=profile)
        sync_approved_contributions(profile)
        return profile

    def get(self, request):
        profile = self.get_or_create_profile(request.user)
        serializer = CareerProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile = self.get_or_create_profile(request.user)
        serializer = CareerProfileUpdateSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(CareerProfileSerializer(profile).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EducationViewSet(viewsets.ModelViewSet):
    serializer_class = EducationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        return profile.educations.all()

    def perform_create(self, serializer):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class PortfolioProjectViewSet(viewsets.ModelViewSet):
    serializer_class = PortfolioProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        return profile.projects.all()

    def perform_create(self, serializer):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class AchievementViewSet(viewsets.ModelViewSet):
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        return profile.achievements.all()

    def perform_create(self, serializer):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class ContributionHighlightViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionHighlightSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'post']

    def get_queryset(self):
        profile, _ = CareerProfile.objects.get_or_create(user=self.request.user)
        return profile.contributions.all()

    @action(detail=False, methods=['post'])
    def sync(self, request):
        profile, _ = CareerProfile.objects.get_or_create(user=request.user)
        count = sync_approved_contributions(profile)
        return Response({
            'message': f"Synced {count} newly approved contribution(s).",
            'contributions': ContributionHighlightSerializer(profile.contributions.all(), many=True).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def toggle(self, request, pk=None):
        contribution = self.get_object()
        contribution.include_in_resume = not contribution.include_in_resume
        contribution.save(update_fields=['include_in_resume'])
        return Response(ContributionHighlightSerializer(contribution).data, status=status.HTTP_200_OK)


class ResumeConfigView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = CareerProfile.objects.get_or_create(user=request.user)
        config, _ = ResumeConfiguration.objects.get_or_create(profile=profile)
        return Response(ResumeConfigurationSerializer(config).data, status=status.HTTP_200_OK)

    def put(self, request):
        profile, _ = CareerProfile.objects.get_or_create(user=request.user)
        config, _ = ResumeConfiguration.objects.get_or_create(profile=profile)
        serializer = ResumeConfigurationSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResumePdfDownloadView(views.APIView):
    """
    Generates and returns an ATS-compliant PDF resume for the authenticated member.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = CareerProfile.objects.get_or_create(user=request.user)
        pdf_bytes = generate_ats_resume_pdf(profile)
        filename = f"{request.user.name.replace(' ', '_')}_Resume.pdf"

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class PublicProfileView(views.APIView):
    """
    Public / shared portfolio view respecting member privacy controls.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        profile = get_object_or_404(CareerProfile, shareable_slug=slug)

        # Privacy Enforcement
        if profile.visibility == 'Private':
            if not request.user.is_authenticated:
                return Response({'error': 'This career portfolio is private.'}, status=status.HTTP_403_FORBIDDEN)
            if profile.user_id != request.user.user_id and not user_has_tier(request.user, 2):
                return Response({'error': 'You do not have permission to view this private profile.'}, status=status.HTTP_403_FORBIDDEN)

        elif profile.visibility == 'Community':
            if not request.user.is_authenticated:
                return Response({'error': 'Authentication required. This profile is restricted to TechNeekX community members.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = PublicCareerProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)
