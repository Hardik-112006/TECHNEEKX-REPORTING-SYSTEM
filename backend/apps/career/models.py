import uuid
from django.db import models
from django.utils.text import slugify
from apps.accounts.models import User
from apps.tasks.models import Task

class CareerProfile(models.Model):
    VISIBILITY_CHOICES = [
        ('Public', 'Public (Anyone with link)'),
        ('Community', 'Community Only (TechNeekX Members)'),
        ('Private', 'Private (Only Me & Leadership)'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='career_profile')
    headline = models.CharField(max_length=200, blank=True, help_text="e.g. Full-Stack Developer & Open Source Contributor")
    target_role = models.CharField(max_length=150, blank=True, help_text="e.g. Software Development Engineer (SDE-1)")
    target_company = models.CharField(max_length=150, blank=True, help_text="e.g. TechNeekX, Google, Microsoft")
    experience_years = models.DecimalField(max_digits=4, decimal_places=1, default=0.0)
    bio = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True, help_text="List of technical skills")
    phone = models.CharField(max_length=30, blank=True)
    linkedin_url = models.URLField(blank=True)
    github_url = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    location = models.CharField(max_length=150, blank=True, help_text="e.g. New Delhi, India")
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='Community')
    shareable_slug = models.SlugField(max_length=150, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'career_profiles'
        verbose_name = 'Career Profile'
        verbose_name_plural = 'Career Profiles'

    def __str__(self):
        return f"Career Profile: {self.user.name} ({self.target_role or 'Candidate'})"

    def save(self, *args, **kwargs):
        if not self.shareable_slug:
            base_slug = slugify(self.user.name) or 'profile'
            unique_suffix = uuid.uuid4().hex[:8]
            self.shareable_slug = f"{base_slug}-{unique_suffix}"
        super().save(*args, **kwargs)


class Education(models.Model):
    profile = models.ForeignKey(CareerProfile, on_delete=models.CASCADE, related_name='educations')
    institution = models.CharField(max_length=200, help_text="College / University Name")
    degree = models.CharField(max_length=150, help_text="e.g. Bachelor of Technology (B.Tech)")
    field_of_study = models.CharField(max_length=150, help_text="e.g. Computer Science and Engineering")
    graduation_year = models.IntegerField(help_text="Year of graduation / passing (e.g. 2026)")
    grade = models.CharField(max_length=50, blank=True, help_text="CGPA or Percentage (e.g. 8.8 CGPA)")
    description = models.TextField(blank=True, help_text="Activities, societies, honors")

    class Meta:
        db_table = 'career_educations'
        ordering = ['-graduation_year', 'id']

    def __str__(self):
        return f"{self.degree} in {self.field_of_study} at {self.institution} ({self.graduation_year})"


class PortfolioProject(models.Model):
    profile = models.ForeignKey(CareerProfile, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=200)
    description = models.TextField(help_text="Project overview, problem solved, and key features")
    technologies = models.CharField(max_length=250, help_text="Comma-separated tech stack (e.g. React, Django, PostgreSQL)")
    github_link = models.URLField(blank=True)
    live_url = models.URLField(blank=True)
    is_featured = models.BooleanField(default=False)
    include_in_resume = models.BooleanField(default=True, help_text="Include in generated ATS resume")
    order = models.IntegerField(default=0)

    class Meta:
        db_table = 'career_portfolio_projects'
        ordering = ['order', '-id']

    def __str__(self):
        return f"{self.title} ({self.profile.user.name})"


class Achievement(models.Model):
    profile = models.ForeignKey(CareerProfile, on_delete=models.CASCADE, related_name='achievements')
    title = models.CharField(max_length=200, help_text="e.g. Smart India Hackathon Winner")
    issuer = models.CharField(max_length=150, help_text="Issuing authority / Organization")
    issue_date = models.DateField(null=True, blank=True)
    credential_url = models.URLField(blank=True, help_text="Verification link or certificate URL")
    description = models.TextField(blank=True)
    include_in_resume = models.BooleanField(default=True, help_text="Include in generated ATS resume")

    class Meta:
        db_table = 'career_achievements'
        ordering = ['-issue_date', '-id']

    def __str__(self):
        return f"{self.title} by {self.issuer}"


class ContributionHighlight(models.Model):
    profile = models.ForeignKey(CareerProfile, on_delete=models.CASCADE, related_name='contributions')
    task = models.ForeignKey(Task, null=True, blank=True, on_delete=models.SET_NULL, related_name='career_contributions')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    points_earned = models.IntegerField(default=10)
    verified_at = models.DateTimeField(auto_now_add=True)
    include_in_resume = models.BooleanField(default=False, help_text="Explicitly opt-in to display on resume")

    class Meta:
        db_table = 'career_contribution_highlights'
        ordering = ['-verified_at', '-id']

    def __str__(self):
        return f"{self.title} (+{self.points_earned} pts)"


class ResumeConfiguration(models.Model):
    profile = models.OneToOneField(CareerProfile, on_delete=models.CASCADE, related_name='resume_config')
    template_style = models.CharField(max_length=50, default='Modern ATS')
    custom_headline = models.CharField(max_length=200, blank=True)
    include_summary = models.BooleanField(default=True)
    include_education = models.BooleanField(default=True)
    include_projects = models.BooleanField(default=True)
    include_skills = models.BooleanField(default=True)
    include_achievements = models.BooleanField(default=True)
    include_community_contributions = models.BooleanField(default=True)

    class Meta:
        db_table = 'career_resume_configurations'

    def __str__(self):
        return f"Resume Config for {self.profile.user.name}"
