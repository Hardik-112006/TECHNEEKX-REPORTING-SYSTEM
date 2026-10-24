from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import Role, User
from apps.teams.models import Team
from apps.tasks.models import Task
from apps.submissions.models import TaskProof
from apps.notifications.models import Notification, ReminderDispatchLog
from apps.notifications.services import process_reminders_and_escalations

class AutomatedRemindersAndEscalationsTests(APITestCase):
    def setUp(self):
        self.founder_role = Role.objects.get(name='Founder')
        self.lead_role = Role.objects.get(name='Core Team Lead')
        self.member_role = Role.objects.get(name='Member')

        self.official = User.objects.create(
            name='Karan Official',
            email='karan.notif@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.official.set_password('Pass123!')
        self.official.save()

        self.team = Team.objects.create(name='Dev Team', type='Technical')

        self.lead = User.objects.create(
            name='Rohit Lead',
            email='rohit.leadnotif@example.com',
            role=self.lead_role,
            team=self.team,
            status='Active'
        )
        self.lead.set_password('Pass123!')
        self.lead.save()

        self.member = User.objects.create(
            name='Sahil Member',
            email='sahil.membernotif@example.com',
            role=self.member_role,
            team=self.team,
            status='Active'
        )
        self.member.set_password('Pass123!')
        self.member.save()

    def test_upcoming_deadline_reminder_and_cooldown(self):
        now = timezone.now()
        task = Task.objects.create(
            title='Submit Sprint Demo Video',
            description='Demo recording',
            created_by=self.official,
            assigned_to=self.member,
            team=self.team,
            status='In Progress',
            deadline=now + timedelta(hours=8)  # Due in 8 hours!
        )

        # 1. Run engine
        summary = process_reminders_and_escalations()
        self.assertEqual(summary['deadline_reminders_sent'], 1)

        notif = Notification.objects.filter(recipient=self.member, notification_type='DEADLINE_APPROACHING').first()
        self.assertIsNotNone(notif)
        self.assertIn('Upcoming Deadline', notif.title)
        self.assertEqual(notif.is_read, False)

        # 2. Re-run immediately: cooldown should prevent duplicate
        summary2 = process_reminders_and_escalations()
        self.assertEqual(summary2['deadline_reminders_sent'], 0)
        self.assertGreaterEqual(summary2['skipped_cooldown'], 1)
        self.assertEqual(Notification.objects.filter(recipient=self.member, notification_type='DEADLINE_APPROACHING').count(), 1)

    def test_overdue_task_alert_and_leadership_escalation(self):
        now = timezone.now()
        task = Task.objects.create(
            title='Critical Bug Patch',
            description='Fix security issue',
            created_by=self.official,
            assigned_to=self.member,
            team=self.team,
            status='In Progress',
            deadline=now - timedelta(hours=50)  # Overdue by 50 hours!
        )

        summary = process_reminders_and_escalations()
        self.assertGreaterEqual(summary['overdue_alerts_sent'], 1)
        self.assertGreaterEqual(summary['escalations_sent'], 1)

        # Member gets overdue alert
        m_notif = Notification.objects.filter(recipient=self.member, notification_type='TASK_OVERDUE').first()
        self.assertIsNotNone(m_notif)
        self.assertEqual(m_notif.severity, 'warning')

        # Lead gets escalation alert
        l_notif = Notification.objects.filter(recipient=self.lead, notification_type='ESCALATION').first()
        self.assertIsNotNone(l_notif)
        self.assertEqual(l_notif.severity, 'critical')
        self.assertIn('[ESCALATION]', l_notif.title)

    def test_pending_review_reminder(self):
        now = timezone.now()
        task = Task.objects.create(
            title='Design Guidelines Docs',
            description='Write docs',
            created_by=self.official,
            assigned_to=self.member,
            team=self.team,
            status='Submitted',
            deadline=now + timedelta(days=5)
        )
        TaskProof.objects.create(
            task=task,
            submitted_by=self.member,
            github_link='https://github.com/techneekx/docs',
            submitted_at=now - timedelta(hours=30)  # Submitted 30 hours ago!
        )

        summary = process_reminders_and_escalations()
        self.assertGreaterEqual(summary['pending_reviews_reminded'], 1)

        lead_notif = Notification.objects.filter(recipient=self.lead, notification_type='PENDING_REVIEW').first()
        self.assertIsNotNone(lead_notif)
        self.assertIn('Review Pending', lead_notif.title)

    def test_notifications_api_lifecycle(self):
        # Create a notification for member
        notif = Notification.objects.create(
            recipient=self.member,
            title='Welcome to TechNeekX',
            message='Your onboarding task has been assigned.',
            notification_type='SYSTEM',
            severity='info'
        )

        # 1. Member views notifications
        self.client.force_authenticate(user=self.member)
        list_res = self.client.get('/api/notifications/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 1)

        # 2. Member views summary
        sum_res = self.client.get('/api/notifications/summary/')
        self.assertEqual(sum_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sum_res.data['unread_count'], 1)

        # 3. Member marks notification as read
        read_res = self.client.post(f'/api/notifications/{notif.notification_id}/read/')
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertEqual(notif.is_read, True)

        # 4. Trigger reminders permission check
        denied_sweep = self.client.post('/api/notifications/trigger-reminders/')
        self.assertEqual(denied_sweep.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Official triggers reminders sweep
        self.client.force_authenticate(user=self.official)
        sweep_res = self.client.post('/api/notifications/trigger-reminders/')
        self.assertEqual(sweep_res.status_code, status.HTTP_200_OK)
        self.assertIn('summary', sweep_res.data)
