from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

# pyrefly: ignore [missing-import]
from apps.accounts.models import User, Role
# pyrefly: ignore [missing-import]
from apps.teams.models import Team
# pyrefly: ignore [missing-import]
from apps.tasks.models import Task
# pyrefly: ignore [missing-import]
from apps.scoring.models import Performance


class AdvancedAnalyticsApiTests(APITestCase):
    def setUp(self):
        # Roles (seeded or created)
        self.role_official = Role.objects.get_or_create(name='Director of Core Operations')[0]
        self.role_lead = Role.objects.get_or_create(name='Core Team Lead')[0]
        self.role_member = Role.objects.get_or_create(name='Member')[0]

        # Teams
        self.team_alpha = Team.objects.get_or_create(name='Alpha Engineering', defaults={'type': 'Engineering'})[0]
        self.team_beta = Team.objects.get_or_create(name='Beta Design', defaults={'type': 'Design'})[0]

        # Create Users
        self.official = User.objects.create_user(
            email='analytics_official@techneekx.org',
            password='Password123!',
            name='Analytics Director',
            role=self.role_official
        )

        self.lead = User.objects.create_user(
            email='lead_alpha@techneekx.org',
            password='Password123!',
            name='Alpha Lead',
            role=self.role_lead,
            team=self.team_alpha
        )

        self.member = User.objects.create_user(
            email='member_alpha@techneekx.org',
            password='Password123!',
            name='Alpha Member',
            role=self.role_member,
            team=self.team_alpha
        )

        # Performance records
        Performance.objects.create(user=self.member, points=150, rank=1)
        Performance.objects.create(user=self.lead, points=80, rank=2)

        # Create Tasks
        now = timezone.now()
        # Task 1: Approved
        Task.objects.create(
            title='Implement Cache Layer',
            description='Redis caching implementation',
            team=self.team_alpha,
            assigned_to=self.member,
            created_by=self.official,
            deadline=now + timedelta(days=5),
            status='Approved'
        )

        # Task 2: Overdue In Progress
        Task.objects.create(
            title='Fix Critical Memory Leak',
            description='Profile workers and patch leak',
            team=self.team_alpha,
            assigned_to=self.member,
            created_by=self.official,
            deadline=now - timedelta(days=2),
            status='In Progress'
        )

        # Task 3: In Beta team
        Task.objects.create(
            title='Design System Upgrade',
            description='Token revamp for mobile',
            team=self.team_beta,
            created_by=self.official,
            deadline=now + timedelta(days=3),
            status='Assigned'
        )

    def test_analytics_overview_unauthenticated_rejected(self):
        url = '/api/analytics/overview/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_analytics_overview_official_metrics(self):
        self.client.force_authenticate(user=self.official)
        url = '/api/analytics/overview/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn('summary', data)
        self.assertIn('team_performance', data)
        self.assertIn('member_contributions', data)
        self.assertIn('hackathon_analytics', data)

        summary = data['summary']
        self.assertEqual(summary['total_tasks'], 3)
        self.assertEqual(summary['approved_tasks'], 1)
        self.assertEqual(summary['overdue_tasks_count'], 1)
        self.assertEqual(summary['in_progress_tasks'], 1)

    def test_analytics_team_filtering(self):
        self.client.force_authenticate(user=self.official)
        url = f'/api/analytics/overview/?team_id={self.team_beta.team_id}'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['summary']['total_tasks'], 1)
        self.assertEqual(data['summary']['overdue_tasks_count'], 0)
        self.assertEqual(len(data['team_performance']), 1)
        self.assertEqual(data['team_performance'][0]['team_name'], 'Beta Design')

    def test_analytics_csv_export_teams(self):
        self.client.force_authenticate(user=self.official)
        url = '/api/analytics/export/teams/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename="techneekx_teams_performance.csv"', response['Content-Disposition'])
        content = response.content.decode('utf-8')
        self.assertIn('Team Name', content)
        self.assertIn('Alpha Engineering', content)

    def test_analytics_csv_export_tasks(self):
        self.client.force_authenticate(user=self.official)
        url = '/api/analytics/export/tasks/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename="techneekx_tasks_export.csv"', response['Content-Disposition'])
        content = response.content.decode('utf-8')
        self.assertIn('Task ID', content)
        self.assertIn('Implement Cache Layer', content)

    def test_analytics_pdf_export(self):
        self.client.force_authenticate(user=self.official)
        url = '/api/analytics/export/pdf/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment; filename="techneekx_performance_report.pdf"', response['Content-Disposition'])
        self.assertGreater(len(response.content), 500)
