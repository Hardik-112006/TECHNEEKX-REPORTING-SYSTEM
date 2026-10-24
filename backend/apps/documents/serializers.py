from rest_framework import serializers
# pyrefly: ignore [missing-import]
from apps.documents.models import (
    ResourceMaterial,
    MouDocument,
    EventProposal,
    SponsorshipProposal,
    CommunityPartner
)

class ResourceMaterialSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)

    class Meta:
        model = ResourceMaterial
        fields = [
            'id', 'title', 'category', 'description', 'file_url',
            'min_role_tier', 'download_count', 'uploaded_by', 'uploaded_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'download_count', 'uploaded_by', 'created_at', 'updated_at']


class MouDocumentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True)

    class Meta:
        model = MouDocument
        fields = [
            'id', 'organization_name', 'signatory_first_party', 'signatory_second_party',
            'scope_of_work', 'validity_start', 'validity_end', 'status', 'review_notes',
            'created_by', 'created_by_name', 'approved_by', 'approved_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'approved_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        start = attrs.get('validity_start')
        end = attrs.get('validity_end')
        if start and end and start >= end:
            raise serializers.ValidationError({"validity_end": "Validity end date must be after validity start date."})
        return attrs


class EventProposalSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.CharField(source='submitted_by.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True)

    class Meta:
        model = EventProposal
        fields = [
            'id', 'title', 'event_type', 'target_date', 'expected_attendees',
            'estimated_budget', 'venue_or_platform', 'description', 'status',
            'reviewer_feedback', 'submitted_by', 'submitted_by_name',
            'reviewed_by', 'reviewed_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'submitted_by', 'reviewed_by', 'created_at', 'updated_at']


class SponsorshipProposalSerializer(serializers.ModelSerializer):
    handled_by_name = serializers.CharField(source='handled_by.name', read_only=True)

    class Meta:
        model = SponsorshipProposal
        fields = [
            'id', 'sponsor_organization', 'sponsorship_tier', 'amount_requested',
            'contact_person', 'contact_email', 'deliverables_offered', 'status',
            'notes', 'handled_by', 'handled_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'handled_by', 'created_at', 'updated_at']


class CommunityPartnerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = CommunityPartner
        fields = [
            'id', 'organization_name', 'partner_type', 'website',
            'poc_name', 'poc_email', 'benefits_summary', 'status',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
