from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Role, User
from apps.teams.models import Team
from apps.tasks.models import Task
from apps.submissions.models import TaskProof
from apps.scoring.models import Performance

class AnalyticsAndReportExportsTests(APITestCase):
    def setUp(self):
        self.founder_role = Role.objects.get(name='Founder')
        self.lead_role = Role.objects.get(name='Core Team Lead')
        self.member_role = Role.objects.get(name='Member')

        # 1. Official
        self.official = User.objects.create(
            name='Karan Official',
            email='karan.analytics@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.official.set_password('Pass123!')
        self.official.save()

        # 2. Core Lead
        self.lead = User.objects.create(
            name='Rohit Lead',
            email='rohit.lead@example.com',
            role=self.lead_role,
            status='Active'
        )
        self.lead.set_password('Pass123!')
        self.lead.save()

        # 3. Members
        self.member1 = User.objects.create(
            name='Sahil Member',
            email='sahil.m1@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member1.set_password('Pass123!')
        self.member1.save()

        self.member2 = User.objects.create(
            name='Priya Member',
            email='priya.m2@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member2.set_password('Pass123!')
        self.member2.save()

        # Teams
        self.team_dev = Team.objects.create(
            name='Frontend Engineers',
            type='Technical'
        )
        self.member1.team = self.team_dev
        self.member1.save()
        self.lead.team = self.team_dev
        self.lead.save()

        self.team_design = Team.objects.create(
            name='UI/UX Designers',
            type='Creative'
        )
        self.member2.team = self.team_design
        self.member2.save()

        # Tasks
        now = timezone.now()
        # Approved task
        self.task1 = Task.objects.create(
            title='Implement Navigation Bar',
            description='Build responsive navbar',
            created_by=self.official,
            assigned_to=self.member1,
            team=self.team_dev,
            status='Approved',
            deadline=now + timedelta(days=2)
        )

        # Overdue In Progress task
        self.task2 = Task.objects.create(
            title='Fix Mobile Viewport Bug',
            description='CSS fix on modal',
            created_by=self.lead,
            assigned_to=self.member1,
            team=self.team_dev,
            status='In Progress',
            deadline=now - timedelta(days=3)  # Overdue!
        )

        # Submitted pending task (30 hours old)
        self.task3 = Task.objects.create(
            title='Design Figma Tokens',
            description='Setup design tokens',
            created_by=self.official,
            assigned_to=self.member2,
            team=self.team_design,
            status='Submitted',
            deadline=now + timedelta(days=5)
        )
        TaskProof.objects.create(
            task=self.task3,
            submitted_by=self.member2,
            github_link='https://github.com/techneekx/design',
            description='Tokens exported',
            submitted_at=now - timedelta(hours=30)
        )

        # Scores
        Performance.objects.create(user=self.member1, points=50, rank=1)
        Performance.objects.create(user=self.member2, points=20, rank=2)

    def test_analytics_overview_unauthenticated_blocked(self):
        res = self.client.get('/api/analytics/overview/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_analytics_overview_for_official(self):
        self.client.force_authenticate(user=self.official)
        res = self.client.get('/api/analytics/overview/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        summary = data['summary']
        self.assertEqual(summary['total_tasks'], 3)
        self.assertEqual(summary['approved_tasks'], 1)
        self.assertEqual(summary['in_progress_tasks'], 1)
        self.assertEqual(summary['submitted_tasks'], 1)
        self.assertEqual(summary['overdue_tasks_count'], 1)
        self.assertEqual(summary['pending_reviews_count'], 1)

        # Pending aging check: task3 is 30 hours old, should fall in 24_to_48h
        pending_analysis = data['pending_analysis']
        self.assertEqual(pending_analysis['from_24_to_48h'], 1)
        self.assertEqual(pending_analysis['under_24h'], 0)

        # Team performance check
        team_perf = data['team_performance']
        self.assertGreaterEqual(len(team_perf), 2)

    def test_role_scoped_analytics_isolation(self):
        # Member 1 only sees their team/tasks (2 tasks, not task 3)
        self.client.force_authenticate(user=self.member1)
        res = self.client.get('/api/analytics/overview/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['summary']['total_tasks'], 2)

    def test_csv_exports(self):
        # 1. Member blocked from exporting teams CSV
        self.client.force_authenticate(user=self.member1)
        denied_res = self.client.get('/api/analytics/export/teams/')
        self.assertEqual(denied_res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Official can export tasks CSV
        self.client.force_authenticate(user=self.official)
        csv_res = self.client.get('/api/analytics/export/tasks/')
        self.assertEqual(csv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_res['Content-Type'], 'text/csv')
        self.assertIn('Implement Navigation Bar', csv_res.content.decode('utf-8'))

        # 3. Official can export teams CSV
        teams_csv = self.client.get('/api/analytics/export/teams/')
        self.assertEqual(teams_csv.status_code, status.HTTP_200_OK)
        self.assertIn('Frontend Engineers', teams_csv.content.decode('utf-8'))

        # 4. Official can export members CSV
        members_csv = self.client.get('/api/analytics/export/members/')
        self.assertEqual(members_csv.status_code, status.HTTP_200_OK)
        self.assertIn('Sahil Member', members_csv.content.decode('utf-8'))

    def test_pdf_report_export(self):
        self.client.force_authenticate(user=self.official)
        pdf_res = self.client.get('/api/analytics/export/pdf/?days=30')
        self.assertEqual(pdf_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_res['Content-Type'], 'application/pdf')
        self.assertTrue(pdf_res.content.startswith(b'%PDF-'))
        self.assertIn('techneekx_performance_report.pdf', pdf_res['Content-Disposition'])
