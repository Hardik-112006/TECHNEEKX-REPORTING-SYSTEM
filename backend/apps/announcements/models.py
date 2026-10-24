from django.db import models
from django.utils import timezone

class Announcement(models.Model):
    announcement_id = models.AutoField(primary_key=True, db_column='announcement_id')
    title = models.CharField(max_length=200)
    content = models.TextField()
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
        return f"{self.title} (by {self.created_by.name})"
