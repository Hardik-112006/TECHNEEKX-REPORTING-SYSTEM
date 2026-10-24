from rest_framework import status, views, viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q

from apps.hackathons.models import (
    Hackathon,
    Participant,
    HackathonTeam,
    HackathonTeamMember,
    CertificateSubmission,
    HackathonRanking,
    CandidateShortlist
)
from apps.hackathons.serializers import (
    HackathonSerializer,
    ParticipantSerializer,
    HackathonTeamSerializer,
    CertificateSubmissionSerializer,
    CertificateReviewSerializer,
    HackathonRankingSerializer,
    CandidateShortlistSerializer
)
from apps.accounts.permissions import user_has_tier
from apps.activity.models import HistoryLog

class HackathonViewSet(viewsets.ModelViewSet):
    serializer_class = HackathonSerializer
    lookup_field = 'id'

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'leaderboard', 'register']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Hackathon.objects.all().prefetch_related('participants', 'teams')

    def perform_create(self, serializer):
        if not user_has_tier(self.request.user, 2):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only authorized Officials can publish new Hackathons.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if not user_has_tier(self.request.user, 2):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only authorized Officials can update Hackathons.")
        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny])
    def register(self, request, id=None):
        hackathon = self.get_object()

        # Check if external registration is allowed
        is_user_auth = request.user and request.user.is_authenticated
        if not is_user_auth and not hackathon.allow_external_participants:
            return Response(
                {"error": "This hackathon is strictly restricted to TechNeekX community members."},
                status=status.HTTP_403_FORBIDDEN
            )

        full_name = request.data.get('full_name') or (request.user.name if is_user_auth else '')
        email = (request.data.get('email') or (request.user.email if is_user_auth else '')).strip().lower()
        phone = request.data.get('phone', '')
        college_or_org = request.data.get('college_or_org', '')

        if not full_name or not email:
            return Response({"error": "Full name and email are required for registration."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if not (hackathon.registration_start <= now <= hackathon.registration_end):
            return Response({"error": "Registration is currently closed for this hackathon."}, status=status.HTTP_400_BAD_REQUEST)

        if Participant.objects.filter(hackathon=hackathon, email=email).exists():
            return Response({"error": "A participant with this email is already registered."}, status=status.HTTP_400_BAD_REQUEST)

        participant = Participant.objects.create(
            hackathon=hackathon,
            user=request.user if is_user_auth else None,
            full_name=full_name,
            email=email,
            phone=phone,
            college_or_org=college_or_org,
            is_external=not is_user_auth,
            status='Registered'
        )

        if is_user_auth:
            HistoryLog.objects.create(
                user=request.user,
                action='HACKATHON_REGISTER',
                details=f"Registered for hackathon: {hackathon.title}"
            )

        return Response(ParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def create_team(self, request, id=None):
        hackathon = self.get_object()
        participant = get_object_or_404(Participant, hackathon=hackathon, user=request.user)

        team_name = request.data.get('team_name', '').strip()
        project_title = request.data.get('project_title', '').strip()

        if not team_name:
            return Response({"error": "Team name is required."}, status=status.HTTP_400_BAD_REQUEST)

        if HackathonTeam.objects.filter(hackathon=hackathon, team_name__iexact=team_name).exists():
            return Response({"error": "A team with this name already exists in this hackathon."}, status=status.HTTP_400_BAD_REQUEST)

        if HackathonTeamMember.objects.filter(team__hackathon=hackathon, participant=participant).exists():
            return Response({"error": "You are already a member of a team in this hackathon."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            team = HackathonTeam.objects.create(
                hackathon=hackathon,
                team_name=team_name,
                leader=participant,
                project_title=project_title,
                project_repo=request.data.get('project_repo', ''),
                project_demo=request.data.get('project_demo', ''),
                submission_notes=request.data.get('submission_notes', '')
            )
            HackathonTeamMember.objects.create(
                team=team,
                participant=participant,
                role_in_team='Leader'
            )

        return Response(HackathonTeamSerializer(team).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join_team(self, request, id=None):
        hackathon = self.get_object()
        participant = get_object_or_404(Participant, hackathon=hackathon, user=request.user)

        team_id = request.data.get('team_id')
        if not team_id:
            return Response({"error": "team_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        team = get_object_or_404(HackathonTeam, id=team_id, hackathon=hackathon)

        if team.members.count() >= hackathon.max_team_size:
            return Response({"error": f"Team is already at maximum capacity ({hackathon.max_team_size} members)."}, status=status.HTTP_400_BAD_REQUEST)

        if HackathonTeamMember.objects.filter(team__hackathon=hackathon, participant=participant).exists():
            return Response({"error": "You are already a member of a team in this hackathon."}, status=status.HTTP_400_BAD_REQUEST)

        member = HackathonTeamMember.objects.create(
            team=team,
            participant=participant,
            role_in_team=request.data.get('role_in_team', 'Member')
        )
        return Response(HackathonTeamSerializer(team).data, status=status.HTTP_200_OK)


class CertificateSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = CertificateSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Officials (Tier <= 3) see all submissions
        if user_has_tier(user, 3):
            return CertificateSubmission.objects.all().select_related('hackathon', 'participant', 'reviewer')
        # Regular members only see their own certificates
        return CertificateSubmission.objects.filter(participant__user=user).select_related('hackathon', 'participant', 'reviewer')

    def perform_create(self, serializer):
        participant = serializer.validated_data.get('participant')
        if not participant:
            participant = get_object_or_404(
                Participant,
                hackathon=serializer.validated_data['hackathon'],
                user=self.request.user
            )
        serializer.save(participant=participant)

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        submission = self.get_object()

        # Authorization Check: Reviewer must have Tier 1/2/3 official rights
        if not user_has_tier(request.user, 3):
            return Response({"error": "Permission denied. Only authorized officials can review certificates."}, status=status.HTTP_403_FORBIDDEN)

        # Anti-self-review check: Cannot review own certificate
        if submission.participant.user_id == request.user.user_id:
            return Response({"error": "Self-review policy: You cannot approve or verify your own certificate submission."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CertificateReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        decision = serializer.validated_data['decision']
        feedback = serializer.validated_data.get('feedback', '')
        override_points = serializer.validated_data.get('override_points')

        with transaction.atomic():
            if decision == 'Approved':
                # Determine points from hackathon scoring rules or override
                rules = submission.hackathon.scoring_rules or {}
                default_points = rules.get(submission.category, 10)
                points_to_award = override_points if override_points is not None else default_points

                submission.verification_status = 'Approved'
                submission.reviewer = request.user
                submission.reviewed_at = timezone.now()
                submission.reviewer_feedback = feedback
                submission.points_awarded = points_to_award
                submission.is_reward_granted = True
                submission.save()

                # If this is a placement achievement (1st, 2nd, 3rd, Top 10), register ranking
                rank_map = {'1st': 1, '2nd': 2, '3rd': 3, 'Top 10': 10}
                if submission.category in rank_map:
                    HackathonRanking.objects.update_or_create(
                        hackathon=submission.hackathon,
                        participant=submission.participant,
                        defaults={
                            'team': submission.team,
                            'rank_position': rank_map[submission.category],
                            'hackathon_points': points_to_award,
                            'is_verified': True
                        }
                    )

                HistoryLog.objects.create(
                    user=request.user,
                    action='CERTIFICATE_APPROVED',
                    details=f"Approved {submission.category} certificate for {submission.participant.full_name} (+{points_to_award} pts)."
                )

            elif decision == 'Rejected':
                submission.verification_status = 'Rejected'
                submission.reviewer = request.user
                submission.reviewed_at = timezone.now()
                submission.reviewer_feedback = feedback
                submission.points_awarded = 0
                submission.is_reward_granted = False
                submission.save()

                HistoryLog.objects.create(
                    user=request.user,
                    action='CERTIFICATE_REJECTED',
                    details=f"Rejected certificate for {submission.participant.full_name}: {feedback}"
                )

        return Response(CertificateSubmissionSerializer(submission).data, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Phase 3 Views: Hackathon Leaderboards, Shortlisting & Recruitment
# -------------------------------------------------------------------------

class HackathonLeaderboardView(views.APIView):
    """
    Returns verified individual and team rankings for a hackathon.
    Deterministic tie handling: rank_position ASC, hackathon_points DESC, tie_break_score DESC.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, hackathon_id):
        hackathon = get_object_or_404(Hackathon, id=hackathon_id)
        rankings = HackathonRanking.objects.filter(
            hackathon=hackathon,
            is_verified=True
        ).select_related('participant', 'team').order_by('rank_position', '-hackathon_points', '-tie_break_score')

        serializer = HackathonRankingSerializer(rankings, many=True)

        # Team rankings aggregation
        team_leaderboard = HackathonTeam.objects.filter(
            hackathon=hackathon
        ).annotate(
            total_points=Count('members__participant__rankings__hackathon_points')
        ).order_by('-total_points', 'id')

        return Response({
            'hackathon': HackathonSerializer(hackathon).data,
            'individual_rankings': serializer.data,
            'team_rankings': HackathonTeamSerializer(team_leaderboard, many=True).data
        }, status=status.HTTP_200_OK)


class CandidateShortlistView(views.APIView):
    """
    Recruitment shortlisting and candidate review endpoint for authorized Officials.
    Supports ?limit=5 or ?limit=10 for configurable top candidates.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, hackathon_id):
        if not user_has_tier(request.user, 2):
            return Response({"error": "Permission denied. Restricted to authorized officials."}, status=status.HTTP_403_FORBIDDEN)

        hackathon = get_object_or_404(Hackathon, id=hackathon_id)
        limit = int(request.query_params.get('limit', 10))

        # Fetch or initialize shortlist records from top rankings
        top_rankings = HackathonRanking.objects.filter(
            hackathon=hackathon,
            is_verified=True
        ).order_by('rank_position')[:limit]

        for rank in top_rankings:
            CandidateShortlist.objects.get_or_create(
                hackathon=hackathon,
                participant=rank.participant,
                defaults={'team': rank.team, 'decision': 'Under Review'}
            )

        shortlists = CandidateShortlist.objects.filter(
            hackathon=hackathon
        ).select_related('participant', 'team', 'reviewer').order_by('created_at')

        serializer = CandidateShortlistSerializer(shortlists, many=True)
        return Response({
            'hackathon_id': hackathon.id,
            'shortlist_count': shortlists.count(),
            'candidates': serializer.data
        }, status=status.HTTP_200_OK)

    def patch(self, request, hackathon_id):
        if not user_has_tier(request.user, 2):
            return Response({"error": "Permission denied. Restricted to authorized officials."}, status=status.HTTP_403_FORBIDDEN)

        candidate_id = request.data.get('candidate_id')
        decision = request.data.get('decision')
        decision_reason = request.data.get('decision_reason', '')
        offered_role = request.data.get('offered_role', '')

        if not candidate_id or decision not in ['Accepted', 'Rejected', 'On Hold', 'Under Review']:
            return Response({"error": "Valid candidate_id and decision are required."}, status=status.HTTP_400_BAD_REQUEST)

        shortlist = get_object_or_404(CandidateShortlist, id=candidate_id, hackathon_id=hackathon_id)
        shortlist.decision = decision
        shortlist.decision_reason = decision_reason
        shortlist.offered_role = offered_role
        shortlist.reviewer = request.user
        shortlist.reviewed_at = timezone.now()
        shortlist.save()

        HistoryLog.objects.create(
            user=request.user,
            action='RECRUITMENT_DECISION',
            details=f"Recruitment {decision} for {shortlist.participant.full_name} ({offered_role or 'No role specified'})."
        )

        return Response(CandidateShortlistSerializer(shortlist).data, status=status.HTTP_200_OK)


class RecruitmentAnalyticsView(views.APIView):
    """
    Recruitment statistics and analytics for hackathons.
    Calculates actual database metrics without hardcoded numbers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, hackathon_id):
        if not user_has_tier(request.user, 2):
            return Response({"error": "Permission denied. Restricted to authorized officials."}, status=status.HTTP_403_FORBIDDEN)

        hackathon = get_object_or_404(Hackathon, id=hackathon_id)
        total_participants = hackathon.participants.count()
        total_teams = hackathon.teams.count()
        certificates_submitted = hackathon.certificates.count()
        certificates_verified = hackathon.certificates.filter(verification_status='Approved').count()

        shortlists = hackathon.shortlists.all()
        total_shortlisted = shortlists.count()
        total_accepted = shortlists.filter(decision='Accepted').count()
        total_rejected = shortlists.filter(decision='Rejected').count()
        total_under_review = shortlists.filter(decision='Under Review').count()

        conversion_rate = (
            round((total_accepted / total_shortlisted) * 100, 2)
            if total_shortlisted > 0 else 0.0
        )

        return Response({
            'hackathon_title': hackathon.title,
            'total_participants': total_participants,
            'total_teams': total_teams,
            'certificates_submitted': certificates_submitted,
            'certificates_verified': certificates_verified,
            'total_shortlisted': total_shortlisted,
            'total_accepted': total_accepted,
            'total_rejected': total_rejected,
            'total_under_review': total_under_review,
            'conversion_rate_percent': conversion_rate
        }, status=status.HTTP_200_OK)
