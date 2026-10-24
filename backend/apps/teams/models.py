from django.db import models

class Team(models.Model):
    team_id = models.AutoField(primary_key=True, db_column='team_id')
    name = models.CharField(max_length=100, unique=True)
    type = models.CharField(max_length=50)
    parent_team = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='parent_team_id',
        related_name='sub_teams'
    )
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'teams'
        ordering = ['team_id']

    def __str__(self):
        return f"{self.name} ({self.type})"

class Group(models.Model):
    group_id = models.AutoField(primary_key=True, db_column='group_id')
    name = models.CharField(max_length=100)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        db_column='team_id',
        related_name='groups'
    )
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'groups'
        unique_together = (('team', 'name'),)
        ordering = ['group_id']

    def __str__(self):
        return f"{self.name} - {self.team.name}"
