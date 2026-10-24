from django.contrib.auth.base_user import BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        extra_fields.setdefault('status', 'Active')

        from apps.accounts.models import Role
        if 'role' not in extra_fields and 'role_id' not in extra_fields:
            default_role, _ = Role.objects.get_or_create(
                name='Member',
                defaults={'description': 'Completes assigned tasks and submits proof'}
            )
            extra_fields['role'] = default_role

        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_superuser', True)
        from apps.accounts.models import Role
        founder_role, _ = Role.objects.get_or_create(
            name='Founder',
            defaults={'description': 'System founder with overall access'}
        )
        extra_fields['role'] = founder_role
        return self.create_user(email, password, **extra_fields)
