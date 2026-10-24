from django.db import models
from django.utils import timezone

class Performance(models.Model):
    performance_id = models.AutoField(primary_key=True, db_column='performance_id')
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        db_column='user_id',
        related_name='performance'
    )
    points = models.IntegerField(default=0)
    rank = models.IntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(default=timezone.now, db_column='updated_at')

    class Meta:
        db_table = 'performance'
        ordering = ['-points', 'rank']

    def __str__(self):
        return f"{self.user.name}: {self.points} pts (Rank #{self.rank})"
