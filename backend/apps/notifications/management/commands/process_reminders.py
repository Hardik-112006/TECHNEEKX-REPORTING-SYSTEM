from django.core.management.base import BaseCommand
from apps.notifications.services import process_reminders_and_escalations

class Command(BaseCommand):
    help = 'Executes workload reminder sweeps and leadership escalations.'

    def handle(self, *args, **options):
        self.stdout.write("Running automated workload reminder and escalation sweep...")
        summary = process_reminders_and_escalations()
        self.stdout.write(self.style.SUCCESS(
            f"Sweep complete: {summary['deadline_reminders_sent']} deadline reminders, "
            f"{summary['overdue_alerts_sent']} overdue alerts, "
            f"{summary['escalations_sent']} escalations, "
            f"{summary['pending_reviews_reminded']} pending review reminders, "
            f"{summary['skipped_cooldown']} skipped by cooldown lock."
        ))
