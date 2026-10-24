from django.db import models
# pyrefly: ignore [missing-import]
from apps.accounts.models import User

class ResourceMaterial(models.Model):
    CATEGORY_CHOICES = [
        ('Guide', 'Operational Guide'),
        ('Template', 'Document Template'),
        ('Cheatsheet', 'Technical Cheatsheet'),
        ('Brand Asset', 'Brand Asset / Logo Kit'),
        ('Tool', 'Automation Tool / Script'),
    ]

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='Guide')
    description = models.TextField(blank=True)
    file_url = models.URLField(help_text="Direct link or drive storage URL")
    min_role_tier = models.PositiveSmallIntegerField(
        default=5,
        help_text="Minimum role tier required to access (1=Executive, 5=All Members)"
    )
    download_count = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_resources')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_resource_materials'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.category})"


class MouDocument(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('In Review', 'In Review / Legal Check'),
        ('Approved', 'Approved'),
        ('Signed', 'Formally Executed / Signed'),
        ('Terminated', 'Terminated / Expired'),
    ]

    organization_name = models.CharField(max_length=200, help_text="Partnering College or Company")
    signatory_first_party = models.CharField(max_length=150, default='TechNeekX Community Operations')
    signatory_second_party = models.CharField(max_length=150, help_text="Designation and name of second party signatory")
    scope_of_work = models.TextField(help_text="Detailed partnership deliverables, milestones, and mutual commitments")
    validity_start = models.DateField()
    validity_end = models.DateField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Draft')
    review_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_mous')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_mous')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_mous'
        ordering = ['-created_at']

    def __str__(self):
        return f"MoU: TechNeekX <-> {self.organization_name} ({self.status})"


class EventProposal(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted for Review'),
        ('Under Review', 'Under Executive Review'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected / Revisions Needed'),
    ]

    title = models.CharField(max_length=200)
    event_type = models.CharField(max_length=100, default='Workshop', help_text="Workshop, Hackathon, Webinar, Bootcamp")
    target_date = models.DateField()
    expected_attendees = models.PositiveIntegerField(default=50)
    estimated_budget = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    venue_or_platform = models.CharField(max_length=200, help_text="Physical campus venue or online link/platform")
    description = models.TextField(help_text="Event agenda, speaker profiles, and expected outcomes")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Draft')
    reviewer_feedback = models.TextField(blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_event_proposals')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_event_proposals')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_event_proposals'
        ordering = ['-created_at']

    def __str__(self):
        return f"Event Proposal: {self.title} ({self.status})"


class SponsorshipProposal(models.Model):
    TIER_CHOICES = [
        ('Title', 'Title Sponsor (Exclusive)'),
        ('Platinum', 'Platinum Partner'),
        ('Gold', 'Gold Partner'),
        ('Silver', 'Silver Partner'),
        ('Community', 'Community & Gifting Partner'),
    ]

    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Proposed', 'Pitch Sent / Proposed'),
        ('Negotiating', 'Negotiation in Progress'),
        ('Signed', 'Contract Executed / Signed'),
        ('Declined', 'Declined'),
    ]

    sponsor_organization = models.CharField(max_length=200)
    sponsorship_tier = models.CharField(max_length=30, choices=TIER_CHOICES, default='Gold')
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2, default=15000.00)
    contact_person = models.CharField(max_length=150)
    contact_email = models.EmailField()
    deliverables_offered = models.TextField(help_text="Logo placement, keynote slot, resume database access, etc.")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Draft')
    notes = models.TextField(blank=True)
    handled_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sponsorship_proposals')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_sponsorship_proposals'
        ordering = ['-created_at']

    def __str__(self):
        return f"Sponsorship: {self.sponsor_organization} ({self.sponsorship_tier} - {self.status})"


class CommunityPartner(models.Model):
    PARTNER_TYPE_CHOICES = [
        ('College Club', 'College Technical Society / Club'),
        ('Tech Community', 'Developer Community / DAO'),
        ('Corporate', 'Corporate Industry Partner'),
        ('Media Partner', 'Media & Outreach Partner'),
        ('Incubator', 'Startup Incubator / E-Cell'),
    ]

    STATUS_CHOICES = [
        ('Active', 'Active Partner'),
        ('Pending', 'Agreement Pending'),
        ('Inactive', 'Inactive / Lapsed'),
    ]

    organization_name = models.CharField(max_length=200)
    partner_type = models.CharField(max_length=50, choices=PARTNER_TYPE_CHOICES, default='College Club')
    website = models.URLField(blank=True)
    poc_name = models.CharField(max_length=150, help_text="Point of Contact Full Name")
    poc_email = models.EmailField()
    benefits_summary = models.TextField(help_text="Mutual collaboration details, event co-hosting, cross-promotion")
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pending')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='registered_partners')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'document_community_partners'
        ordering = ['-created_at']

    def __str__(self):
        return f"Partner: {self.organization_name} ({self.partner_type})"
