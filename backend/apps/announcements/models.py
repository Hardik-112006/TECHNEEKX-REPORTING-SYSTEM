from django.db import models
from django.utils import timezone

class Announcement(models.Model):
    CATEGORY_CHOICES = [
        ('General Announcement', 'General Announcement'),
        ('Event', 'Event'),
        ('Meeting', 'Meeting'),
        ('Deadline', 'Deadline'),
        ('Important Notice', 'Important Notice'),
        ('Documents & Resources', 'Documents & Resources'),
        ('Achievement', 'Achievement'),
        ('Other', 'Other'),
    ]

    announcement_id = models.AutoField(primary_key=True, db_column='announcement_id')
    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=60, default='General Announcement', choices=CATEGORY_CHOICES)
    attachment = models.FileField(upload_to='announcements/', null=True, blank=True)
    attachment_name = models.CharField(max_length=255, null=True, blank=True)
    attachment_type = models.CharField(max_length=50, null=True, blank=True)
    external_link = models.URLField(max_length=500, null=True, blank=True)
    drive_link = models.URLField(max_length=500, null=True, blank=True)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='created_by',
        related_name='announcements'
    )
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'announcements'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.category}] {self.title} (by {self.created_by.name})"
