from rest_framework import status, views, viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.db import transaction

# pyrefly: ignore [missing-import]
from apps.documents.models import (
    ResourceMaterial,
    MouDocument,
    EventProposal,
    SponsorshipProposal,
    CommunityPartner
)
# pyrefly: ignore [missing-import]
from apps.documents.serializers import (
    ResourceMaterialSerializer,
    MouDocumentSerializer,
    EventProposalSerializer,
    SponsorshipProposalSerializer,
    CommunityPartnerSerializer
)
# pyrefly: ignore [missing-import]
from apps.documents.services import generate_mou_pdf
# pyrefly: ignore [missing-import]
from apps.accounts.permissions import user_has_tier, get_role_tier
# pyrefly: ignore [missing-import]
from apps.activity.models import HistoryLog

class ResourceMaterialViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceMaterialSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_tier = get_role_tier(user.role.name) if (user.is_authenticated and user.role) else 5
        # Return materials that the user has sufficient tier privileges to access
        return ResourceMaterial.objects.filter(min_role_tier__gte=user_tier).select_related('uploaded_by')

    def perform_create(self, serializer):
        if not user_has_tier(self.request.user, 2):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only authorized Officials can publish new official resources.")
        resource = serializer.save(uploaded_by=self.request.user)
        HistoryLog.objects.create(
            user=self.request.user,
            action='RESOURCE_PUBLISHED',
            details=f"Published official resource material: {resource.title}"
        )

    @action(detail=True, methods=['post'])
    def track_download(self, request, pk=None):
        resource = self.get_object()
        resource.download_count += 1
        resource.save(update_fields=['download_count'])
        return Response({'message': 'Download tracked', 'download_count': resource.download_count}, status=status.HTTP_200_OK)


class MouDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = MouDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only Officials (Tier 1/2) can access formal MoUs
        if user_has_tier(self.request.user, 2):
            return MouDocument.objects.all().select_related('created_by', 'approved_by')
        return MouDocument.objects.filter(created_by=self.request.user).select_related('created_by', 'approved_by')

    def perform_create(self, serializer):
        if not user_has_tier(self.request.user, 2):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only authorized Officials can initialize formal MoUs.")
        mou = serializer.save(created_by=self.request.user)
        HistoryLog.objects.create(
            user=self.request.user,
            action='MOU_CREATED',
            details=f"Created MoU proposal for {mou.organization_name}"
        )

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        if not user_has_tier(request.user, 2):
            return Response({"error": "Only authorized Officials can review MoUs."}, status=status.HTTP_403_FORBIDDEN)

        mou = self.get_object()
        new_status = request.data.get('status')
        review_notes = request.data.get('review_notes', '')

        if new_status not in ['Approved', 'Signed', 'In Review', 'Terminated', 'Draft']:
            return Response({"error": "Invalid MoU status value."}, status=status.HTTP_400_BAD_REQUEST)

        mou.status = new_status
        mou.review_notes = review_notes
        if new_status in ['Approved', 'Signed']:
            mou.approved_by = request.user
        mou.save()

        HistoryLog.objects.create(
            user=request.user,
            action='MOU_STATUS_SHIFT',
            details=f"MoU for {mou.organization_name} moved to {new_status}."
        )

        return Response(MouDocumentSerializer(mou).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        mou = self.get_object()
        pdf_bytes = generate_mou_pdf(mou)
        clean_name = mou.organization_name.replace(' ', '_')
        filename = f"MoU_TechNeekX_{clean_name}.pdf"

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class EventProposalViewSet(viewsets.ModelViewSet):
    serializer_class = EventProposalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user_has_tier(user, 2):
            return EventProposal.objects.all().select_related('submitted_by', 'reviewed_by')
        return EventProposal.objects.filter(submitted_by=user).select_related('submitted_by', 'reviewed_by')

    def perform_create(self, serializer):
        proposal = serializer.save(submitted_by=self.request.user, status='Submitted')
        HistoryLog.objects.create(
            user=self.request.user,
            action='EVENT_PROPOSAL_SUBMITTED',
            details=f"Submitted event proposal: {proposal.title}"
        )

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        if not user_has_tier(request.user, 2):
            return Response({"error": "Only authorized Officials can review event proposals."}, status=status.HTTP_403_FORBIDDEN)

        proposal = self.get_object()
        decision = request.data.get('decision')
        feedback = request.data.get('feedback', '')

        if decision not in ['Approved', 'Rejected', 'Under Review']:
            return Response({"error": "Decision must be 'Approved', 'Rejected', or 'Under Review'."}, status=status.HTTP_400_BAD_REQUEST)

        proposal.status = decision
        proposal.reviewer_feedback = feedback
        proposal.reviewed_by = request.user
        proposal.save()

        HistoryLog.objects.create(
            user=request.user,
            action='EVENT_PROPOSAL_REVIEW',
            details=f"Event proposal '{proposal.title}' marked as {decision}."
        )

        return Response(EventProposalSerializer(proposal).data, status=status.HTTP_200_OK)


class SponsorshipProposalViewSet(viewsets.ModelViewSet):
    serializer_class = SponsorshipProposalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if user_has_tier(self.request.user, 2):
            return SponsorshipProposal.objects.all().select_related('handled_by')
        return SponsorshipProposal.objects.filter(handled_by=self.request.user).select_related('handled_by')

    def perform_create(self, serializer):
        sponsor = serializer.save(handled_by=self.request.user)
        HistoryLog.objects.create(
            user=self.request.user,
            action='SPONSORSHIP_PITCH_CREATED',
            details=f"Created sponsorship pitch for {sponsor.sponsor_organization} ({sponsor.sponsorship_tier})"
        )


class CommunityPartnerViewSet(viewsets.ModelViewSet):
    serializer_class = CommunityPartnerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CommunityPartner.objects.all().select_related('created_by')

    def perform_create(self, serializer):
        partner = serializer.save(created_by=self.request.user)
        HistoryLog.objects.create(
            user=self.request.user,
            action='PARTNER_REGISTERED',
            details=f"Registered community partner: {partner.organization_name} ({partner.partner_type})"
        )
