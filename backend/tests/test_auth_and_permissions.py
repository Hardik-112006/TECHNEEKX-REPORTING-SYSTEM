from rest_framework.test import APITestCase
from rest_framework import status
from apps.accounts.models import Role, User
from apps.teams.models import Team, Group

class AuthAndPermissionsTests(APITestCase):
    def setUp(self):
        # Fetch or ensure roles exist
        self.founder_role = Role.objects.get(name='Founder')
        self.official_role = Role.objects.get(name='Official')
        self.lead_role = Role.objects.get(name='Core Team Lead')
        self.member_role = Role.objects.get(name='Member')

        # Setup base users
        self.founder = User.objects.create(
            name='Test Founder',
            email='founder.test@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.founder.set_password('FounderPass123!')
        self.founder.save()

        self.lead = User.objects.create(
            name='Test Lead',
            email='lead.test@example.com',
            role=self.lead_role,
            status='Active'
        )
        self.lead.set_password('LeadPass123!')
        self.lead.save()

        self.member = User.objects.create(
            name='Test Member',
            email='member.test@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member.set_password('MemberPass123!')
        self.member.save()

        # Setup test team
        self.team = Team.objects.create(
            name='Alpha Core Team',
            type='Core',
            description='Test Core Team'
        )

    # 1. Registration Tests
    def test_registration_success_safe_default_role(self):
        payload = {
            'name': 'New Student',
            'email': 'student@example.com',
            'password': 'StudentPassword123'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['role_name'], 'Member')

        # Verify DB directly
        created_user = User.objects.get(email='student@example.com')
        self.assertEqual(created_user.role.name, 'Member')
        self.assertTrue(created_user.check_password('StudentPassword123'))
        self.assertEqual(created_user.status, 'Active')

    def test_registration_privilege_escalation_blocked(self):
        # Attempt to inject elevated role parameters
        payload = {
            'name': 'Hacker Wannabe',
            'email': 'hacker@example.com',
            'password': 'HackerPassword123',
            'role': 'Founder',
            'role_id': self.founder_role.role_id,
            'is_staff': True,
            'status': 'Founder'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Invariant check: MUST still be Member
        hacker_user = User.objects.get(email='hacker@example.com')
        self.assertEqual(hacker_user.role.name, 'Member')
        self.assertNotEqual(hacker_user.role.name, 'Founder')
        self.assertFalse(hacker_user.is_staff)

    def test_registration_duplicate_email_rejected(self):
        payload = {
            'name': 'Duplicate Person',
            'email': 'founder.test@example.com',
            'password': 'SomePassword123'
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    # 2. Login & JWT Token Tests
    def test_login_success_and_jwt_tokens(self):
        payload = {
            'email': 'founder.test@example.com',
            'password': 'FounderPass123!'
        }
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
        self.assertEqual(response.data['user']['role']['name'], 'Founder')
        self.assertEqual(response.data['user']['role_tier'], 1)

    def test_login_invalid_password_rejected(self):
        payload = {
            'email': 'founder.test@example.com',
            'password': 'WrongPassword!'
        }
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_refresh(self):
        login_res = self.client.post('/api/auth/login/', {
            'email': 'member.test@example.com',
            'password': 'MemberPass123!'
        })
        refresh_token = login_res.data['tokens']['refresh']

        refresh_res = self.client.post('/api/auth/refresh/', {'refresh': refresh_token})
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_res.data)

    # 3. Unauthenticated Access Protection
    def test_unauthenticated_endpoints_blocked(self):
        endpoints = ['/api/auth/me/', '/api/users/', '/api/teams/', '/api/roles/']
        for url in endpoints:
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED, f"URL {url} should require auth!")

    # 4. Current User Profile & Self-Update
    def test_current_user_profile_and_safe_update(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['email'], 'member.test@example.com')
        self.assertEqual(res.data['role']['name'], 'Member')

        # Self-update name
        patch_res = self.client.patch('/api/auth/me/', {'name': 'Updated Member Name'})
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['user']['name'], 'Updated Member Name')

        # Attempt to escalate own role via /api/auth/me/
        escalate_res = self.client.patch('/api/auth/me/', {'role_id': self.founder_role.role_id})
        self.assertEqual(escalate_res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role.name, 'Member') # Unchanged!

    # 5. Role Matrix & Permission Enforcement
    def test_team_creation_permissions(self):
        # A. Member cannot create a team
        self.client.force_authenticate(user=self.member)
        res = self.client.post('/api/teams/', {'name': 'Member Team', 'type': 'Core'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # B. Core Team Lead cannot create a top-level team (Only Tier 1 & 2)
        self.client.force_authenticate(user=self.lead)
        res = self.client.post('/api/teams/', {'name': 'Lead Team', 'type': 'Core'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # C. Founder (Tier 1) can create team
        self.client.force_authenticate(user=self.founder)
        res = self.client.post('/api/teams/', {'name': 'Executive Team', 'type': 'Core'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_user_management_permissions(self):
        # A. Member cannot manage other users
        self.client.force_authenticate(user=self.member)
        res = self.client.patch(f'/api/users/{self.lead.user_id}/manage/', {
            'role_id': self.founder_role.role_id
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # B. Founder can promote member to Core Team Lead
        self.client.force_authenticate(user=self.founder)
        res = self.client.patch(f'/api/users/{self.member.user_id}/manage/', {
            'role_id': self.lead_role.role_id,
            'team_id': self.team.team_id
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.role.name, 'Core Team Lead')
        self.assertEqual(self.member.team_id, self.team.team_id)

    # 6. Team Membership Management
    def test_team_member_add_and_remove(self):
        # Core Lead assigns member to team
        self.client.force_authenticate(user=self.lead)
        add_res = self.client.post(f'/api/teams/{self.team.team_id}/add_member/', {
            'user_id': self.member.user_id
        })
        self.assertEqual(add_res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertEqual(self.member.team_id, self.team.team_id)

        # Core Lead removes member from team
        remove_res = self.client.post(f'/api/teams/{self.team.team_id}/remove_member/', {
            'user_id': self.member.user_id
        })
        self.assertEqual(remove_res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.team_id)

        # Member cannot add people to team
        self.client.force_authenticate(user=self.member)
        unauth_add = self.client.post(f'/api/teams/{self.team.team_id}/add_member/', {
            'user_id': self.founder.user_id
        })
        self.assertEqual(unauth_add.status_code, status.HTTP_403_FORBIDDEN)

    # 7. Hierarchical Teams & Groups
    def test_hierarchical_teams_and_groups(self):
        self.client.force_authenticate(user=self.founder)
        # Create sub-team
        sub_res = self.client.post('/api/teams/', {
            'name': 'Alpha Sub Team',
            'type': 'Group',
            'parent_team': self.team.team_id
        })
        self.assertEqual(sub_res.status_code, status.HTTP_201_CREATED)
        sub_team_id = sub_res.data['team_id']

        # Create group
        group_res = self.client.post('/api/groups/', {
            'name': 'Sub Group 1',
            'team': sub_team_id,
            'description': 'Working on frontend'
        })
        self.assertEqual(group_res.status_code, status.HTTP_201_CREATED)

        # Retrieve parent team and check sub-teams
        get_res = self.client.get(f'/api/teams/{self.team.team_id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        sub_team_names = [t['name'] for t in get_res.data['sub_teams']]
        self.assertIn('Alpha Sub Team', sub_team_names)
