from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from apps.accounts.models import User

class Command(BaseCommand):
    help = 'Replaces seed placeholder passwords with valid Django password hashes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default='Techneekx@2026',
            help='Password to set for demo users (default: Techneekx@2026)'
        )

    def handle(self, *args, **options):
        raw_password = options['password']
        hashed = make_password(raw_password)
        updated_count = 0

        users = User.objects.filter(password='REPLACE_WITH_DJANGO_PASSWORD_HASH')
        for user in users:
            user.password = hashed
            user.save(update_fields=['password'])
            updated_count += 1
            self.stdout.write(self.style.SUCCESS(f"Updated password hash for {user.email}"))

        self.stdout.write(self.style.SUCCESS(
            f"Successfully updated {updated_count} user(s). Demo password is: '{raw_password}'"
        ))
