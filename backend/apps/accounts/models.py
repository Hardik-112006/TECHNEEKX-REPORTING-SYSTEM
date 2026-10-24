from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser
from django.utils import timezone
from apps.accounts.managers import UserManager

class Role(models.Model):
    role_id = models.AutoField(primary_key=True, db_column='role_id')
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'roles'
        ordering = ['role_id']

    def __str__(self):
        return self.name

class User(AbstractBaseUser):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Pending', 'Pending'),
    ]

    user_id = models.AutoField(primary_key=True, db_column='user_id')
    name = models.CharField(max_length=120)
    email = models.EmailField(max_length=255, unique=True)
    password = models.TextField(db_column='password')
    role = models.ForeignKey(Role, on_delete=models.PROTECT, db_column='role_id', related_name='users')
    team = models.ForeignKey('teams.Team', on_delete=models.SET_NULL, null=True, blank=True, db_column='team_id', related_name='members')
    status = models.CharField(max_length=20, default='Active', choices=STATUS_CHOICES)
    created_at = models.DateTimeField(default=timezone.now, db_column='created_at')

    # Exclude last_login since it is not part of the source SQL schema
    last_login = None

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    objects = UserManager()

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['role'], name='idx_users_role_id'),
            models.Index(fields=['team'], name='idx_users_team_id'),
        ]

    def __str__(self):
        return f"{self.name} ({self.email})"

    @property
    def is_staff(self):
        return self.role and self.role.name in ('Founder', 'Official')

    @property
    def is_superuser(self):
        return self.role and self.role.name == 'Founder'

    @property
    def is_active(self):
        return self.status == 'Active'

    def has_perm(self, perm, obj=None):
        return self.is_superuser or self.is_staff

    def has_module_perms(self, app_label):
        return self.is_superuser or self.is_staff
