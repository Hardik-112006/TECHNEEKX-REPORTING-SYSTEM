from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.scoring.models import Performance
from apps.submissions.models import Review
from apps.tasks.models import Task, TaskProgressNote
from apps.teams.models import Group, Team


class SecurityHardeningTests(APITestCase):
    """Regression tests for the access-control and integrity fixes from the PDF's 'Suggested Fixes'."""

    def setUp(self):
        roles = {name: Role.objects.get(name=name) for name in (
            'Founder', 'Official', 'Director of Core Operations', 'Core Team Lead', 'Member')}
        self.team = Team.objects.create(name='Hardening Team', type='Core')
        self.other_team = Team.objects.create(name='Other Team', type='Core')
        self.group = Group.objects.create(name='Hardening Group', team=self.team)
        self.other_group = Group.objects.create(name='Other Group', team=self.other_team)

        def make(email, role, team=None, group=None):
            user = User.objects.create(name=email.split('@')[0], email=email, role=roles[role],
                                       team=team, group=group, status='Active')
            user.set_password('Pass123!')
            user.save()
            return user

        self.founder = make('founder.h@example.com', 'Founder')
        self.official = make('official.h@example.com', 'Official')
        self.director = make('director.h@example.com', 'Director of Core Operations')
        self.lead = make('lead.h@example.com', 'Core Team Lead', self.team, self.group)
        self.member = make('member.h@example.com', 'Member', self.team, self.group)
        self.peer = make('peer.h@example.com', 'Member', self.team, self.group)
        self.outsider = make('outsider.h@example.com', 'Member', self.other_team, self.other_group)

    def _deadline(self):
        return (timezone.now() + timedelta(days=3)).isoformat()

    def _create_task(self, actor=None, **extra):
        self.client.force_authenticate(user=actor or self.lead)
        payload = {'title': 'Hardening task', 'description': 'desc', 'deadline': self._deadline(),
                   'assigned_to_id': self.member.user_id}
        payload.update(extra)
        res = self.client.post('/api/tasks/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data['task_id']

    # --- Registration -------------------------------------------------------

    def test_founder_self_registration_rejects_former_hardcoded_key(self):
        res = self.client.post('/api/auth/register/', {
            'name': 'Impostor', 'email': 'imp@example.com', 'password': 'Sup3r-Secret-99',
            'category': 'Founder', 'auth_key': 'TechNeekX@Founder2026'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(FOUNDER_SETUP_KEY='server-side-secret')
    def test_founder_self_registration_accepts_configured_key(self):
        res = self.client.post('/api/auth/register/', {
            'name': 'Real Founder', 'email': 'real@example.com', 'password': 'Sup3r-Secret-99',
            'category': 'Founder', 'auth_key': 'server-side-secret'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user']['status'], 'Active')

    @override_settings(DIRECTOR_SETUP_KEY='')
    def test_director_registration_stays_pending_without_configured_key(self):
        res = self.client.post('/api/auth/register/', {
            'name': 'Dir', 'email': 'dir@example.com', 'password': 'Sup3r-Secret-99',
            'category': 'Director', 'auth_key': 'TechNeekX@Director2026'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user']['status'], 'Pending')

    # --- Submissions & reviews ----------------------------------------------

    def test_only_assignee_can_submit_evidence(self):
        task_id = self._create_task()
        for intruder in (self.official, self.founder, self.director, self.peer):
            self.client.force_authenticate(user=intruder)
            res = self.client.post(f'/api/tasks/{task_id}/submit/', {'description': 'not mine'}, format='json')
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN, intruder.email)

        self.client.force_authenticate(user=self.member)
        res = self.client.post(f'/api/tasks/{task_id}/submit/', {'description': 'mine'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_team_assigned_task_is_visible_and_submittable_by_team_members(self):
        task_id = self._create_task(actor=self.official, assigned_to_id=None, team_id=self.team.team_id)
        self.client.force_authenticate(user=self.peer)
        listed = [t['task_id'] for t in self.client.get('/api/tasks/').data['results']]
        self.assertIn(task_id, listed)
        res = self.client.post(f'/api/tasks/{task_id}/submit/', {'description': 'team work'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.outsider)
        listed = [t['task_id'] for t in self.client.get('/api/tasks/').data['results']]
        self.assertNotIn(task_id, listed)

    def test_second_review_returns_conflict_and_points_award_once(self):
        task_id = self._create_task(points=25)
        self.client.force_authenticate(user=self.member)
        self.client.post(f'/api/tasks/{task_id}/submit/', {'github_link': 'https://github.com/a/b'}, format='json')

        self.client.force_authenticate(user=self.lead)
        first = self.client.post(f'/api/tasks/{task_id}/review/', {'decision': 'Approved'}, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first.data['points_awarded'], 25)

        self.client.force_authenticate(user=self.official)
        second = self.client.post(f'/api/tasks/{task_id}/review/', {'decision': 'Approved'}, format='json')
        self.assertIn(second.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT))
        self.assertEqual(Performance.objects.get(user=self.member).points, 25)
        self.assertEqual(Review.objects.filter(task_id=task_id, decision='Approved').count(), 1)

    # --- Task fields & modification ------------------------------------------

    def test_priority_and_points_persist_and_points_are_capped(self):
        task_id = self._create_task(priority='Critical', points=40)
        task = Task.objects.get(pk=task_id)
        self.assertEqual((task.priority, task.points), ('Critical', 40))

        self.client.force_authenticate(user=self.lead)
        res = self.client.post('/api/tasks/', {
            'title': 'Too many points', 'description': 'd', 'deadline': self._deadline(),
            'assigned_to_id': self.member.user_id, 'points': 500}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_core_lead_cannot_retarget_task_outside_group(self):
        task_id = self._create_task()
        self.client.force_authenticate(user=self.lead)
        res = self.client.patch(f'/api/tasks/{task_id}/', {'assigned_to_id': self.outsider.user_id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Task.objects.get(pk=task_id).assigned_to_id, self.member.user_id)

    def test_director_cannot_edit_or_delete_tasks(self):
        task_id = self._create_task()
        self.client.force_authenticate(user=self.director)
        self.assertEqual(self.client.patch(f'/api/tasks/{task_id}/', {'title': 'x'}, format='json').status_code,
                         status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(f'/api/tasks/{task_id}/').status_code, status.HTTP_403_FORBIDDEN)

    def test_progress_notes(self):
        task_id = self._create_task()
        self.client.force_authenticate(user=self.peer)
        res = self.client.post(f'/api/tasks/{task_id}/progress/', {'note': 'sneaky'}, format='json')
        # A group-mate cannot even see another member's task, so it is not found
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

        self.client.force_authenticate(user=self.member)
        res = self.client.post(f'/api/tasks/{task_id}/start/', {'note': 'Kicked off'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post(f'/api/tasks/{task_id}/progress/', {'note': 'Layout done'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(TaskProgressNote.objects.filter(task_id=task_id).count(), 2)

        self.client.force_authenticate(user=self.lead)
        notes = self.client.get(f'/api/tasks/{task_id}/progress/').data
        self.assertEqual([n['note'] for n in notes], ['Layout done', 'Kicked off'])

    # --- Role & roster management ---------------------------------------------

    def test_role_management_hierarchy_rules(self):
        official_role = Role.objects.get(name='Official')
        lead_role = Role.objects.get(name='Core Team Lead')

        self.client.force_authenticate(user=self.official)
        self.assertEqual(self.client.patch(f'/api/users/{self.official.user_id}/manage/',
                                           {'role_id': lead_role.role_id}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/users/{self.member.user_id}/manage/',
                                           {'role_id': official_role.role_id}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/users/{self.founder.user_id}/manage/',
                                           {'status': 'Inactive'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/users/{self.member.user_id}/manage/',
                                           {'role_id': lead_role.role_id}, format='json').status_code, 200)

        self.client.force_authenticate(user=self.founder)
        self.assertEqual(self.client.patch(f'/api/users/{self.peer.user_id}/manage/',
                                           {'role_id': official_role.role_id}, format='json').status_code, 200)

    def test_core_lead_roster_scope(self):
        self.client.force_authenticate(user=self.lead)
        res = self.client.post(f'/api/teams/{self.other_team.team_id}/add_member/', {'user_id': self.peer.user_id})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.post(f'/api/teams/{self.team.team_id}/add_member/', {'user_id': self.official.user_id})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.post(f'/api/teams/{self.team.team_id}/add_member/', {'user_id': self.outsider.user_id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.director)
        res = self.client.post(f'/api/teams/{self.team.team_id}/remove_member/', {'user_id': self.outsider.user_id})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # --- Announcements ----------------------------------------------------------

    def test_announcement_permission_flag(self):
        payload = {'title': 'Standup', 'content': 'Friday 5pm', 'category': 'Meeting'}
        self.client.force_authenticate(user=self.lead)
        self.assertEqual(self.client.post('/api/announcements/', payload, format='json').status_code, 403)

        self.client.force_authenticate(user=self.official)
        res = self.client.patch(f'/api/users/{self.lead.user_id}/manage/', {'can_post_announcements': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        official_post = self.client.post('/api/announcements/', payload, format='json')
        self.assertEqual(official_post.status_code, 201)

        self.lead.refresh_from_db()
        self.client.force_authenticate(user=self.lead)
        own = self.client.post('/api/announcements/', payload, format='json')
        self.assertEqual(own.status_code, 201)
        own_id = self.client.get('/api/announcements/').data['results'][0]['announcement_id']
        self.assertEqual(self.client.delete(f'/api/announcements/{own_id}/').status_code, 204)
        others = [a['announcement_id'] for a in self.client.get('/api/announcements/').data['results']]
        self.assertEqual(self.client.delete(f'/api/announcements/{others[0]}/').status_code, 403)

    # --- Search -------------------------------------------------------------------

    def test_member_search_is_scoped_like_task_list(self):
        self._create_task(title='Zebraconfidential', assigned_to_id=self.peer.user_id, group_id=self.group.group_id)
        self.client.force_authenticate(user=self.member)
        res = self.client.get('/api/search/?q=Zebraconfidential')
        self.assertEqual(res.data['results']['tasks'], [])
