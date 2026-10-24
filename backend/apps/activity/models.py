from django.db import models
from django.utils import timezone

class HistoryLog(models.Model):
    log_id = models.AutoField(primary_key=True, db_column='log_id')
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='user_id',
        related_name='history_logs'
    )
    action = models.CharField(max_length=120)
    details = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'history_logs'
        indexes = [
            models.Index(fields=['-created_at'], name='idx_history_logs_created_at'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        user_str = self.user.name if self.user else "System"
        return f"[{self.action}] by {user_str} at {self.created_at}"

class ExtraMaterial(models.Model):
    material_id = models.AutoField(primary_key=True, db_column='material_id')
    title = models.CharField(max_length=200)
    type = models.CharField(max_length=60)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='created_by',
        related_name='extra_materials'
    )
    file_url = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    class Meta:
        db_table = 'extra_material'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.type})"
