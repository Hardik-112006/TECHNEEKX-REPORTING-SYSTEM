from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Role, User
from apps.teams.models import Team
from apps.tasks.models import Task
from apps.submissions.models import TaskProof, Review
from apps.scoring.models import Performance
from apps.announcements.models import Announcement
from apps.activity.models import HistoryLog

class TasksAndWorkflowTests(APITestCase):
    def setUp(self):
        # Fetch standard roles
        self.founder_role = Role.objects.get(name='Founder')
        self.lead_role = Role.objects.get(name='Core Team Lead')
        self.member_role = Role.objects.get(name='Member')

        # Setup teams
        self.team_dev = Team.objects.create(name='Dev Team Beta', type='Core')
        self.team_design = Team.objects.create(name='Design Team Beta', type='Core')

        # Setup users
        self.founder = User.objects.create(
            name='Founder User',
            email='founder.workflow@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.founder.set_password('Pass123!')
        self.founder.save()

        self.lead = User.objects.create(
            name='Lead User',
            email='lead.workflow@example.com',
            role=self.lead_role,
            team=self.team_dev,
            status='Active'
        )
        self.lead.set_password('Pass123!')
        self.lead.save()

        self.member1 = User.objects.create(
            name='Member Dev',
            email='member.dev@example.com',
            role=self.member_role,
            team=self.team_dev,
            status='Active'
        )
        self.member1.set_password('Pass123!')
        self.member1.save()

        self.member2 = User.objects.create(
            name='Member Design',
            email='member.design@example.com',
            role=self.member_role,
            team=self.team_design,
            status='Active'
        )
        self.member2.set_password('Pass123!')
        self.member2.save()

    # 1. Task Creation & Assignment Validation
    def test_task_creation_by_lead_and_validation(self):
        self.client.force_authenticate(user=self.lead)
        deadline = timezone.now() + timedelta(days=5)

        # Successful creation
        payload = {
            'title': 'Build Auth API',
            'description': 'Implement JWT auth endpoints and tests',
            'assigned_to_id': self.member1.user_id,
            'team_id': self.team_dev.team_id,
            'deadline': deadline.isoformat()
        }
        res = self.client.post('/api/tasks/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'Assigned')

        # Contradictory assignment check: member2 is in Design team, not Dev team
        contradictory_payload = {
            'title': 'Invalid Assignment',
            'description': 'Contradictory team and member',
            'assigned_to_id': self.member2.user_id,
            'team_id': self.team_dev.team_id,
            'deadline': deadline.isoformat()
        }
        bad_res = self.client.post('/api/tasks/', contradictory_payload, format='json')
        self.assertEqual(bad_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Member cannot create tasks
        self.client.force_authenticate(user=self.member1)
        unauth_res = self.client.post('/api/tasks/', payload, format='json')
        self.assertEqual(unauth_res.status_code, status.HTTP_403_FORBIDDEN)

    # 2. Task Visibility & Isolation
    def test_task_visibility_isolation(self):
        # Create Task 1 for Dev team
        task_dev = Task.objects.create(
            title='Dev Task',
            description='Dev only',
            created_by=self.lead,
            assigned_to=self.member1,
            team=self.team_dev,
            status='Assigned'
        )
        # Create Task 2 for Design team
        task_design = Task.objects.create(
            title='Design Task',
            description='Design only',
            created_by=self.founder,
            assigned_to=self.member2,
            team=self.team_design,
            status='Assigned'
        )

        # Member 1 (Dev) sees Dev Task, but NOT Design Task
        self.client.force_authenticate(user=self.member1)
        res_m1 = self.client.get('/api/tasks/')
        self.assertEqual(res_m1.status_code, status.HTTP_200_OK)
        task_ids = [t['task_id'] for t in res_m1.data['results']]
        self.assertIn(task_dev.task_id, task_ids)
        self.assertNotIn(task_design.task_id, task_ids)

        # Founder (Tier 1) sees both tasks
        self.client.force_authenticate(user=self.founder)
        res_founder = self.client.get('/api/tasks/')
        founder_task_ids = [t['task_id'] for t in res_founder.data['results']]
        self.assertIn(task_dev.task_id, founder_task_ids)
        self.assertIn(task_design.task_id, founder_task_ids)

    # 3. Status Transition: Start Task
    def test_start_task_workflow(self):
        task = Task.objects.create(
            title='Startable Task',
            description='Test task starting',
            created_by=self.lead,
            assigned_to=self.member1,
            team=self.team_dev,
            status='Assigned'
        )
        # Member 1 starts task
        self.client.force_authenticate(user=self.member1)
        res = self.client.post(f'/api/tasks/{task.task_id}/start/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'In Progress')

        # Unrelated member cannot start task
        unrelated_task = Task.objects.create(
            title='Unrelated Task',
            description='Not for member 2',
            created_by=self.lead,
            assigned_to=self.member1,
            team=self.team_dev,
            status='Assigned'
        )
        self.client.force_authenticate(user=self.member2)
        bad_start = self.client.post(f'/api/tasks/{unrelated_task.task_id}/start/')
        self.assertIn(bad_start.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    # 4. Submission & Changes Requested Resubmission Loop
    def test_submission_and_resubmission_loop(self):
        task = Task.objects.create(
            title='Refactor Database Queries',
            description='Optimize queries',
            created_by=self.lead,
            assigned_to=self.member1,
            team=self.team_dev,
            status='In Progress'
        )
        # Step A: Member submits initial proof
        self.client.force_authenticate(user=self.member1)
        sub_payload = {
            'github_link': 'https://github.com/techneekx/pr-1',
            'description': 'Initial query optimization draft'
        }
        sub_res = self.client.post(f'/api/tasks/{task.task_id}/submit/', sub_payload, format='json')
        self.assertEqual(sub_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(sub_res.data['task_status'], 'Submitted')

        # Step B: Lead conducts review and requests changes
        self.client.force_authenticate(user=self.lead)
        review_payload = {
            'decision': 'Changes Requested',
            'feedback': 'Please add index on task_id and add test coverage.'
        }
        rev_res = self.client.post(f'/api/tasks/{task.task_id}/review/', review_payload, format='json')
        self.assertEqual(rev_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(rev_res.data['task_status'], 'Changes Requested')

        # Step C: Member resubmits corrected proof
        self.client.force_authenticate(user=self.member1)
        resub_payload = {
            'github_link': 'https://github.com/techneekx/pr-1-fix',
            'description': 'Added indexes and test cases as requested.'
        }
        resub_res = self.client.post(f'/api/tasks/{task.task_id}/submit/', resub_payload, format='json')
        self.assertEqual(resub_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resub_res.data['task_status'], 'Submitted')

        # Step D: Lead conducts final approval
        self.client.force_authenticate(user=self.lead)
        app_payload = {
            'decision': 'Approved',
            'feedback': 'Looks fantastic now. Approved!'
        }
        app_res = self.client.post(f'/api/tasks/{task.task_id}/review/', app_payload, format='json')
        self.assertEqual(app_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(app_res.data['task_status'], 'Approved')
        self.assertEqual(app_res.data['points_awarded'], 10)

    # 5. Self-Review Prevention
    def test_self_review_prevention(self):
        task = Task.objects.create(
            title='Core Lead Personal Task',
            description='Task assigned to lead',
            created_by=self.founder,
            assigned_to=self.lead,
            team=self.team_dev,
            status='In Progress'
        )
        # Lead submits proof for their own task
        self.client.force_authenticate(user=self.lead)
        self.client.post(f'/api/tasks/{task.task_id}/submit/', {
            'github_link': 'https://github.com/techneekx/lead-work',
            'description': 'Lead work completed'
        })
        task.refresh_from_db()
        self.assertEqual(task.status, 'Submitted')

        # Lead attempts to review/approve their own task
        self_rev_res = self.client.post(f'/api/tasks/{task.task_id}/review/', {
            'decision': 'Approved',
            'feedback': 'I approve myself'
        })
        self.assertEqual(self_rev_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Self-review is strictly forbidden', self_rev_res.data['error'])

    # 6. Scoring Idempotency & Leaderboard
    def test_scoring_idempotency_and_leaderboard(self):
        task = Task.objects.create(
            title='Scoring Resilience Task',
            description='Test points award',
            created_by=self.lead,
            assigned_to=self.member1,
            team=self.team_dev,
            status='In Progress'
        )
        # Submit proof
        self.client.force_authenticate(user=self.member1)
        self.client.post(f'/api/tasks/{task.task_id}/submit/', {
            'github_link': 'https://github.com/techneekx/scoring-test',
            'description': 'Scoring proof'
        })

        # Check initial points
        perf_before, _ = Performance.objects.get_or_create(user=self.member1)
        initial_points = perf_before.points

        # First Approval: +10 points awarded
        self.client.force_authenticate(user=self.lead)
        app1 = self.client.post(f'/api/tasks/{task.task_id}/review/', {
            'decision': 'Approved',
            'feedback': 'Approved first time'
        })
        self.assertEqual(app1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(app1.data['points_awarded'], 10)

        perf_after = Performance.objects.get(user=self.member1)
        self.assertEqual(perf_after.points, initial_points + 10)

        # Second Attempt to Review / Approve: Must NOT award points again!
        app2 = self.client.post(f'/api/tasks/{task.task_id}/review/', {
            'decision': 'Approved',
            'feedback': 'Attempted second approval'
        })
        # Should be rejected because task is already Approved (not Submitted)
        self.assertEqual(app2.status_code, status.HTTP_400_BAD_REQUEST)

        # Points MUST remain initial + 10
        perf_final = Performance.objects.get(user=self.member1)
        self.assertEqual(perf_final.points, initial_points + 10)

        # Verify Leaderboard API
        lb_res = self.client.get('/api/leaderboard/')
        self.assertEqual(lb_res.status_code, status.HTTP_200_OK)
        # Leaderboard should list member1 with updated points
        top_user_ids = [entry['user']['user_id'] for entry in lb_res.data['results']]
        self.assertIn(self.member1.user_id, top_user_ids)

    # 7. Announcements CRUD & Permissions
    def test_announcements_permissions(self):
        # Lead posts announcement
        self.client.force_authenticate(user=self.lead)
        ann_res = self.client.post('/api/announcements/', {
            'title': 'Sprint Review on Friday',
            'content': 'Please ensure all proofs are submitted by Thursday 5 PM.'
        })
        self.assertEqual(ann_res.status_code, status.HTTP_201_CREATED)

        # Member cannot post announcement
        self.client.force_authenticate(user=self.member1)
        bad_ann = self.client.post('/api/announcements/', {
            'title': 'Member Announcement',
            'content': 'Hello world'
        })
        self.assertEqual(bad_ann.status_code, status.HTTP_403_FORBIDDEN)

        # All authenticated users can view announcements
        list_res = self.client.get('/api/announcements/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)

    # 8. Activity Log Recording
    def test_activity_logging(self):
        self.client.force_authenticate(user=self.lead)
        # Perform action: post an announcement
        self.client.post('/api/announcements/', {
            'title': 'Test Activity Log Trigger',
            'content': 'This will log ANNOUNCEMENT_POSTED.'
        })

        self.client.force_authenticate(user=self.founder)
        # Query activity logs
        act_res = self.client.get('/api/activity/')
        self.assertEqual(act_res.status_code, status.HTTP_200_OK)
        actions = [log['action'] for log in act_res.data['results']]
        self.assertIn('ANNOUNCEMENT_POSTED', actions)
