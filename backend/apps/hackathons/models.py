import uuid
from django.db import models
from django.utils.text import slugify
from apps.accounts.models import User

class Hackathon(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    tagline = models.CharField(max_length=250, blank=True)
    description = models.TextField()
    theme = models.CharField(max_length=150, help_text="e.g. AI & Automation, Web3, Climate Tech")
    banner_url = models.URLField(blank=True)
    registration_start = models.DateTimeField()
    registration_end = models.DateTimeField()
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    min_team_size = models.PositiveIntegerField(default=1)
    max_team_size = models.PositiveIntegerField(default=4)
    allow_external_participants = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    scoring_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configurable position-to-points mapping, e.g. {'1st': 100, '2nd': 75, '3rd': 50, 'Top 10': 30, 'Participation': 10}"
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_hackathons')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hackathons'
        ordering = ['-start_date', '-id']

    def __str__(self):
        return f"{self.title} ({self.theme})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or 'hackathon'
            unique_suffix = uuid.uuid4().hex[:6]
            self.slug = f"{base_slug}-{unique_suffix}"
        if not self.scoring_rules:
            self.scoring_rules = {
                '1st': 100,
                '2nd': 75,
                '3rd': 50,
                'Top 10': 30,
                'Participation': 10
            }
        super().save(*args, **kwargs)


class Participant(models.Model):
    STATUS_CHOICES = [
        ('Registered', 'Registered'),
        ('Confirmed', 'Confirmed / Checked In'),
        ('Submitted', 'Project Submitted'),
        ('Disqualified', 'Disqualified'),
        ('Completed', 'Completed'),
    ]

    hackathon = models.ForeignKey(Hackathon, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hackathon_participations')
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    college_or_org = models.CharField(max_length=200, blank=True)
    is_external = models.BooleanField(default=False)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Registered')
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hackathon_participants'
        unique_together = ('hackathon', 'email')
        ordering = ['-registered_at']

    def __str__(self):
        ext_tag = " [External]" if self.is_external else ""
        return f"{self.full_name} ({self.email}){ext_tag} - {self.hackathon.title}"


class HackathonTeam(models.Model):
    hackathon = models.ForeignKey(Hackathon, on_delete=models.CASCADE, related_name='teams')
    team_name = models.CharField(max_length=150)
    leader = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='led_teams')
    project_title = models.CharField(max_length=200, blank=True)
    project_repo = models.URLField(blank=True)
    project_demo = models.URLField(blank=True)
    submission_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hackathon_teams'
        unique_together = ('hackathon', 'team_name')
        ordering = ['-created_at']

    def __str__(self):
        return f"Team '{self.team_name}' in {self.hackathon.title}"


class HackathonTeamMember(models.Model):
    team = models.ForeignKey(HackathonTeam, on_delete=models.CASCADE, related_name='members')
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='team_memberships')
    role_in_team = models.CharField(max_length=50, default='Member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hackathon_team_members'
        unique_together = ('team', 'participant')

    def __str__(self):
        return f"{self.participant.full_name} ({self.role_in_team}) in {self.team.team_name}"


class CertificateSubmission(models.Model):
    CATEGORY_CHOICES = [
        ('1st', 'Winner (1st Place)'),
        ('2nd', 'First Runner-Up (2nd Place)'),
        ('3rd', 'Second Runner-Up (3rd Place)'),
        ('Top 10', 'Top 10 Finalist'),
        ('Special Mention', 'Special Mention / Category Award'),
        ('Participation', 'Participation Certificate'),
    ]

    VERIFICATION_CHOICES = [
        ('Pending', 'Pending Review'),
        ('Approved', 'Approved / Verified'),
        ('Rejected', 'Rejected'),
    ]

    hackathon = models.ForeignKey(Hackathon, on_delete=models.CASCADE, related_name='certificates')
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='certificates')
    team = models.ForeignKey(HackathonTeam, on_delete=models.SET_NULL, null=True, blank=True, related_name='certificates')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    certificate_url = models.URLField(help_text="Verification link or document URL")
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='Pending')
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_certificates')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewer_feedback = models.TextField(blank=True)
    points_awarded = models.PositiveIntegerField(default=0)
    is_reward_granted = models.BooleanField(default=False, help_text="Prevents duplicate reward distribution")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hackathon_certificate_submissions'
        unique_together = ('hackathon', 'participant', 'category')
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.category} Cert: {self.participant.full_name} ({self.verification_status})"


# -------------------------------------------------------------------------
# Phase 3 Models: Hackathon Leaderboard & Recruitment Review
# -------------------------------------------------------------------------

class HackathonRanking(models.Model):
    hackathon = models.ForeignKey(Hackathon, on_delete=models.CASCADE, related_name='rankings')
    team = models.ForeignKey(HackathonTeam, on_delete=models.SET_NULL, null=True, blank=True, related_name='rankings')
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='rankings')
    rank_position = models.PositiveIntegerField()
    hackathon_points = models.PositiveIntegerField(default=0)
    is_verified = models.BooleanField(default=True)
    tie_break_score = models.DecimalField(max_digits=6, decimal_places=2, default=0.0)
    notes = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hackathon_rankings'
        unique_together = ('hackathon', 'participant')
        ordering = ['rank_position', '-hackathon_points', '-tie_break_score']

    def __str__(self):
        return f"Rank #{self.rank_position}: {self.participant.full_name} ({self.hackathon_points} pts)"


class CandidateShortlist(models.Model):
    STATUS_CHOICES = [
        ('Under Review', 'Under Review'),
        ('Accepted', 'Accepted / Selected for Core / Intern Offer'),
        ('Rejected', 'Rejected / Not Selected'),
        ('On Hold', 'On Hold'),
    ]

    hackathon = models.ForeignKey(Hackathon, on_delete=models.CASCADE, related_name='shortlists')
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='shortlist_records')
    team = models.ForeignKey(HackathonTeam, on_delete=models.SET_NULL, null=True, blank=True, related_name='shortlist_records')
    decision = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Under Review')
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recruitment_reviews')
    decision_reason = models.TextField(blank=True)
    offered_role = models.CharField(max_length=150, blank=True, help_text="e.g. Core Operations Member, Backend Trainee")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hackathon_candidate_shortlists'
        unique_together = ('hackathon', 'participant')
        ordering = ['-created_at']

    def __str__(self):
        return f"Recruitment: {self.participant.full_name} - {self.decision}"
