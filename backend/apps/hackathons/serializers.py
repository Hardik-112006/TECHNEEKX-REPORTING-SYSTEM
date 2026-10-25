from rest_framework import serializers
from django.utils import timezone
# pyrefly: ignore [missing-import]
from apps.hackathons.models import (
    Hackathon,
    Participant,
    HackathonTeam,
    HackathonTeamMember,
    CertificateSubmission,
    HackathonRanking,
    CandidateShortlist
)

class HackathonSerializer(serializers.ModelSerializer):
    participants_count = serializers.IntegerField(source='participants.count', read_only=True)
    teams_count = serializers.IntegerField(source='teams.count', read_only=True)
    is_registration_open = serializers.SerializerMethodField()

    class Meta:
        model = Hackathon
        fields = [
            'id', 'title', 'slug', 'tagline', 'description', 'theme', 'banner_url',
            'registration_start', 'registration_end', 'start_date', 'end_date',
            'min_team_size', 'max_team_size', 'allow_external_participants',
            'is_active', 'scoring_rules', 'participants_count', 'teams_count',
            'is_registration_open', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'created_at']

    def get_is_registration_open(self, obj):
        now = timezone.now()
        return obj.is_active and (obj.registration_start <= now <= obj.registration_end)

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        reg_start = attrs.get('registration_start', getattr(self.instance, 'registration_start', None))
        reg_end = attrs.get('registration_end', getattr(self.instance, 'registration_end', None))

        if reg_start and reg_end and reg_start >= reg_end:
            raise serializers.ValidationError({"registration_end": "Registration end date must be after registration start date."})

        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError({"end_date": "Hackathon end date must be after start date."})

        return attrs


class ParticipantSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Participant
        fields = [
            'id', 'hackathon', 'user', 'user_name', 'user_email', 'full_name',
            'email', 'phone', 'college_or_org', 'is_external', 'status', 'registered_at'
        ]
        read_only_fields = ['id', 'status', 'registered_at']

    def validate(self, attrs):
        hackathon = attrs.get('hackathon')
        email = attrs.get('email', '').strip().lower()
        attrs['email'] = email

        if not hackathon:
            raise serializers.ValidationError({"hackathon": "Hackathon is required."})

        now = timezone.now()
        if not (hackathon.registration_start <= now <= hackathon.registration_end):
            raise serializers.ValidationError({"hackathon": "Registration for this hackathon is currently closed."})

        if Participant.objects.filter(hackathon=hackathon, email=email).exists():
            raise serializers.ValidationError({"email": "This participant is already registered for this hackathon."})

        return attrs


class HackathonTeamMemberSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)

    class Meta:
        model = HackathonTeamMember
        fields = ['id', 'participant', 'participant_name', 'participant_email', 'role_in_team', 'joined_at']


class HackathonTeamSerializer(serializers.ModelSerializer):
    leader_name = serializers.CharField(source='leader.full_name', read_only=True)
    leader_email = serializers.CharField(source='leader.email', read_only=True)
    members = HackathonTeamMemberSerializer(many=True, read_only=True)
    member_count = serializers.IntegerField(source='members.count', read_only=True)

    class Meta:
        model = HackathonTeam
        fields = [
            'id', 'hackathon', 'team_name', 'leader', 'leader_name', 'leader_email',
            'project_title', 'project_repo', 'project_demo', 'submission_notes',
            'members', 'member_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        hackathon = attrs.get('hackathon')
        team_name = attrs.get('team_name', '').strip()
        leader = attrs.get('leader')

        if not team_name:
            raise serializers.ValidationError({"team_name": "Team name is required."})

        if HackathonTeam.objects.filter(hackathon=hackathon, team_name__iexact=team_name).exists():
            raise serializers.ValidationError({"team_name": "A team with this name is already registered."})

        if leader and leader.hackathon_id != hackathon.id:
            raise serializers.ValidationError({"leader": "Team leader must be a registered participant of this hackathon."})

        # Check if leader is already part of another team in this hackathon
        if HackathonTeamMember.objects.filter(team__hackathon=hackathon, participant=leader).exists():
            raise serializers.ValidationError({"leader": "Leader is already a member of another team in this hackathon."})

        return attrs


class CertificateSubmissionSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    hackathon_title = serializers.CharField(source='hackathon.title', read_only=True)
    reviewer_name = serializers.CharField(source='reviewer.name', read_only=True)

    class Meta:
        model = CertificateSubmission
        fields = [
            'id', 'hackathon', 'hackathon_title', 'participant', 'participant_name',
            'participant_email', 'team', 'category', 'certificate_url', 'verification_status',
            'reviewer', 'reviewer_name', 'reviewed_at', 'reviewer_feedback',
            'points_awarded', 'is_reward_granted', 'submitted_at'
        ]
        read_only_fields = [
            'id', 'participant', 'verification_status', 'reviewer', 'reviewed_at',
            'points_awarded', 'is_reward_granted', 'submitted_at'
        ]

    def validate(self, attrs):
        hackathon = attrs.get('hackathon')
        request = self.context.get('request')
        participant = attrs.get('participant')

        if not participant and request and request.user.is_authenticated:
            participant = Participant.objects.filter(hackathon=hackathon, user=request.user).first()
            if not participant:
                raise serializers.ValidationError({"participant": "You must be registered for this hackathon before submitting a certificate."})
            attrs['participant'] = participant

        if not participant:
            raise serializers.ValidationError({"participant": "Participant could not be identified."})

        category = attrs.get('category')
        cert_url = attrs.get('certificate_url', '').strip()

        if not cert_url:
            raise serializers.ValidationError({"certificate_url": "Valid certificate URL / link is required."})

        if participant.hackathon_id != hackathon.id:
            raise serializers.ValidationError({"participant": "Participant is not registered for this hackathon."})

        # Prevent duplicate submissions for same achievement
        if CertificateSubmission.objects.filter(
            hackathon=hackathon,
            participant=participant,
            category=category
        ).exists():
            raise serializers.ValidationError({"category": f"A certificate submission for category '{category}' already exists for this participant."})

        return attrs


class CertificateReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['Approved', 'Rejected'])
    feedback = serializers.CharField(required=False, allow_blank=True)
    override_points = serializers.IntegerField(required=False, min_value=0)


class HackathonRankingSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    team_name = serializers.CharField(source='team.team_name', read_only=True)
    hackathon_title = serializers.CharField(source='hackathon.title', read_only=True)

    class Meta:
        model = HackathonRanking
        fields = [
            'id', 'hackathon', 'hackathon_title', 'participant', 'participant_name',
            'participant_email', 'team', 'team_name', 'rank_position', 'hackathon_points',
            'is_verified', 'tie_break_score', 'notes', 'created_at'
        ]


class CandidateShortlistSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.full_name', read_only=True)
    participant_email = serializers.CharField(source='participant.email', read_only=True)
    team_name = serializers.CharField(source='team.team_name', read_only=True)
    reviewer_name = serializers.CharField(source='reviewer.name', read_only=True)

    class Meta:
        model = CandidateShortlist
        fields = [
            'id', 'hackathon', 'participant', 'participant_name', 'participant_email',
            'team', 'team_name', 'decision', 'reviewer', 'reviewer_name',
            'decision_reason', 'offered_role', 'reviewed_at', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
