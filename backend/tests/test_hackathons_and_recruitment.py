from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Role, User
from apps.hackathons.models import (
    Hackathon,
    Participant,
    HackathonTeam,
    HackathonTeamMember,
    CertificateSubmission,
    HackathonRanking,
    CandidateShortlist
)
from apps.activity.models import HistoryLog

class HackathonsAndRecruitmentTests(APITestCase):
    def setUp(self):
        self.founder_role = Role.objects.get(name='Founder')
        self.member_role = Role.objects.get(name='Member')

        self.official = User.objects.create(
            name='Tanmay Official',
            email='official.hackathon@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.official.set_password('Pass123!')
        self.official.save()

        self.member1 = User.objects.create(
            name='Rohan Verma',
            email='rohan.member@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member1.set_password('Pass123!')
        self.member1.save()

        self.member2 = User.objects.create(
            name='Ananya Sen',
            email='ananya.member@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member2.set_password('Pass123!')
        self.member2.save()

        now = timezone.now()
        self.hackathon = Hackathon.objects.create(
            title='TechNeekX National Innovation Hackathon 2026',
            description='Build real-world developer tools and AI systems.',
            theme='AI & Developer Platforms',
            registration_start=now - timedelta(days=2),
            registration_end=now + timedelta(days=5),
            start_date=now + timedelta(days=6),
            end_date=now + timedelta(days=8),
            min_team_size=1,
            max_team_size=3,
            allow_external_participants=True,
            scoring_rules={
                '1st': 100,
                '2nd': 75,
                '3rd': 50,
                'Top 10': 30,
                'Participation': 10
            },
            created_by=self.official
        )

    def test_hackathon_creation_permissions(self):
        # Members cannot create hackathons
        self.client.force_authenticate(user=self.member1)
        res_denied = self.client.post('/api/hackathons/events/', {
            'title': 'Unauthorized Hackathon',
            'description': 'Test',
            'theme': 'Web',
            'registration_start': timezone.now(),
            'registration_end': timezone.now() + timedelta(days=1),
            'start_date': timezone.now() + timedelta(days=2),
            'end_date': timezone.now() + timedelta(days=3)
        }, format='json')
        self.assertEqual(res_denied.status_code, status.HTTP_403_FORBIDDEN)

        # Officials can list hackathons publicly
        self.client.logout()
        res_list = self.client.get('/api/hackathons/events/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)

    def test_participant_and_team_registration(self):
        # Authenticated member registration
        self.client.force_authenticate(user=self.member1)
        reg_res = self.client.post(f'/api/hackathons/events/{self.hackathon.id}/register/', {
            'phone': '+91 9123456789',
            'college_or_org': 'IIT Delhi'
        }, format='json')
        self.assertEqual(reg_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reg_res.data['full_name'], 'Rohan Verma')
        self.assertFalse(reg_res.data['is_external'])

        # Duplicate registration prevented
        dup_res = self.client.post(f'/api/hackathons/events/{self.hackathon.id}/register/', {
            'phone': '+91 9123456789'
        }, format='json')
        self.assertEqual(dup_res.status_code, status.HTTP_400_BAD_REQUEST)

        # External guest registration
        self.client.logout()
        ext_res = self.client.post(f'/api/hackathons/events/{self.hackathon.id}/register/', {
            'full_name': 'External Hacker',
            'email': 'hacker@external.org',
            'phone': '+91 9888877777',
            'college_or_org': 'BITS Pilani'
        }, format='json')
        self.assertEqual(ext_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ext_res.data['is_external'])

        # Create a team
        self.client.force_authenticate(user=self.member1)
        team_res = self.client.post(f'/api/hackathons/events/{self.hackathon.id}/create_team/', {
            'team_name': 'Neural Coders',
            'project_title': 'Decentralized Vector Search'
        }, format='json')
        self.assertEqual(team_res.status_code, status.HTTP_201_CREATED)
        team_id = team_res.data['id']
        self.assertEqual(team_res.data['member_count'], 1)

        # Second member registers and joins team
        self.client.force_authenticate(user=self.member2)
        self.client.post(f'/api/hackathons/events/{self.hackathon.id}/register/', {}, format='json')
        join_res = self.client.post(f'/api/hackathons/events/{self.hackathon.id}/join_team/', {
            'team_id': team_id,
            'role_in_team': 'Frontend Lead'
        }, format='json')
        self.assertEqual(join_res.status_code, status.HTTP_200_OK)
        self.assertEqual(join_res.data['member_count'], 2)

    def test_certificate_submission_and_review(self):
        # Register member1
        self.client.force_authenticate(user=self.member1)
        self.client.post(f'/api/hackathons/events/{self.hackathon.id}/register/', {}, format='json')
        part = Participant.objects.get(hackathon=self.hackathon, user=self.member1)

        # Submit certificate
        sub_res = self.client.post('/api/hackathons/certificates/', {
            'hackathon': self.hackathon.id,
            'category': '1st',
            'certificate_url': 'https://techneekx.org/certs/winner-rohan-2026.pdf'
        }, format='json')
        self.assertEqual(sub_res.status_code, status.HTTP_201_CREATED)
        cert_id = sub_res.data['id']
        self.assertEqual(sub_res.data['verification_status'], 'Pending')
        self.assertEqual(sub_res.data['points_awarded'], 0)

        # Duplicate submission in same category rejected
        dup_sub = self.client.post('/api/hackathons/certificates/', {
            'hackathon': self.hackathon.id,
            'category': '1st',
            'certificate_url': 'https://techneekx.org/certs/winner-dup.pdf'
        }, format='json')
        self.assertEqual(dup_sub.status_code, status.HTTP_400_BAD_REQUEST)

        # Anti-Self-Review: Member cannot review own certificate
        self_rev = self.client.post(f'/api/hackathons/certificates/{cert_id}/review/', {
            'decision': 'Approved'
        }, format='json')
        self.assertEqual(self_rev.status_code, status.HTTP_403_FORBIDDEN)

        # Official reviewer approves certificate
        self.client.force_authenticate(user=self.official)
        app_res = self.client.post(f'/api/hackathons/certificates/{cert_id}/review/', {
            'decision': 'Approved',
            'feedback': 'Verified 1st place champion in National Hackathon.'
        }, format='json')
        self.assertEqual(app_res.status_code, status.HTTP_200_OK)
        self.assertEqual(app_res.data['verification_status'], 'Approved')
        self.assertEqual(app_res.data['points_awarded'], 100) # From scoring_rules['1st']
        self.assertTrue(app_res.data['is_reward_granted'])

        # Ranking generated in Phase 3 ranking model
        ranking = HackathonRanking.objects.get(hackathon=self.hackathon, participant=part)
        self.assertEqual(ranking.rank_position, 1)
        self.assertEqual(ranking.hackathon_points, 100)

    def test_hackathon_leaderboard_and_recruitment(self):
        # Create participants and rankings
        part1 = Participant.objects.create(
            hackathon=self.hackathon,
            user=self.member1,
            full_name='Rohan Verma',
            email='rohan.member@example.com'
        )
        part2 = Participant.objects.create(
            hackathon=self.hackathon,
            user=self.member2,
            full_name='Ananya Sen',
            email='ananya.member@example.com'
        )

        HackathonRanking.objects.create(
            hackathon=self.hackathon,
            participant=part1,
            rank_position=1,
            hackathon_points=100,
            tie_break_score=98.5
        )
        HackathonRanking.objects.create(
            hackathon=self.hackathon,
            participant=part2,
            rank_position=2,
            hackathon_points=75,
            tie_break_score=94.0
        )

        # Public leaderboard query
        lb_res = self.client.get(f'/api/hackathons/{self.hackathon.id}/leaderboard/')
        self.assertEqual(lb_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(lb_res.data['individual_rankings']), 2)
        self.assertEqual(lb_res.data['individual_rankings'][0]['rank_position'], 1)

        # Recruitment shortlist query (Unauthorized member gets 403)
        self.client.force_authenticate(user=self.member1)
        denied_shortlist = self.client.get(f'/api/hackathons/{self.hackathon.id}/shortlist/')
        self.assertEqual(denied_shortlist.status_code, status.HTTP_403_FORBIDDEN)

        # Official reviewer views shortlist
        self.client.force_authenticate(user=self.official)
        shortlist_res = self.client.get(f'/api/hackathons/{self.hackathon.id}/shortlist/?limit=5')
        self.assertEqual(shortlist_res.status_code, status.HTTP_200_OK)
        self.assertEqual(shortlist_res.data['shortlist_count'], 2)
        cand_id = shortlist_res.data['candidates'][0]['id']

        # Official records recruitment selection
        dec_res = self.client.patch(f'/api/hackathons/{self.hackathon.id}/shortlist/', {
            'candidate_id': cand_id,
            'decision': 'Accepted',
            'offered_role': 'Core Operations Trainee',
            'decision_reason': 'Demonstrated outstanding distributed systems mastery.'
        }, format='json')
        self.assertEqual(dec_res.status_code, status.HTTP_200_OK)
        self.assertEqual(dec_res.data['decision'], 'Accepted')
        self.assertEqual(dec_res.data['offered_role'], 'Core Operations Trainee')

        # Recruitment analytics
        analytics_res = self.client.get(f'/api/hackathons/{self.hackathon.id}/recruitment-analytics/')
        self.assertEqual(analytics_res.status_code, status.HTTP_200_OK)
        self.assertEqual(analytics_res.data['total_shortlisted'], 2)
        self.assertEqual(analytics_res.data['total_accepted'], 1)
        self.assertEqual(analytics_res.data['conversion_rate_percent'], 50.0)
