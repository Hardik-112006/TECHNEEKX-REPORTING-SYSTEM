import io
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Role, User
from apps.tasks.models import Task
from apps.career.models import (
    CareerProfile,
    Education,
    PortfolioProject,
    Achievement,
    ContributionHighlight,
    ResumeConfiguration
)

class CareerAndResumeTests(APITestCase):
    def setUp(self):
        self.founder_role = Role.objects.get(name='Founder')
        self.member_role = Role.objects.get(name='Member')

        self.member = User.objects.create(
            name='Aarav Sharma',
            email='aarav.sharma@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member.set_password('Pass123!')
        self.member.save()

        self.other_member = User.objects.create(
            name='Priya Patel',
            email='priya.patel@example.com',
            role=self.member_role,
            status='Active'
        )
        self.other_member.set_password('Pass123!')
        self.other_member.save()

        self.founder = User.objects.create(
            name='Founder Official',
            email='founder.career@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.founder.set_password('Pass123!')
        self.founder.save()

    def test_get_or_create_career_profile(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get('/api/career/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_name'], 'Aarav Sharma')
        self.assertIn('shareable_slug', response.data)
        self.assertTrue(CareerProfile.objects.filter(user=self.member).exists())
        self.assertTrue(ResumeConfiguration.objects.filter(profile__user=self.member).exists())

    def test_update_career_profile(self):
        self.client.force_authenticate(user=self.member)
        payload = {
            'headline': 'Full Stack Cloud Engineer',
            'target_role': 'Software Development Engineer 1',
            'target_company': 'TechNeekX Labs',
            'experience_years': 1.5,
            'bio': 'Passionate builder specializing in Python, Django, React, and distributed systems.',
            'skills': ['Python', 'Django', 'React', 'TypeScript', 'PostgreSQL'],
            'phone': '+91 9876543210',
            'linkedin_url': 'https://www.linkedin.com/in/aaravsharma',
            'github_url': 'https://github.com/aaravsharma',
            'location': 'Bengaluru, India',
            'visibility': 'Community'
        }
        response = self.client.patch('/api/career/me/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['target_role'], 'Software Development Engineer 1')
        self.assertEqual(response.data['skills'], ['Python', 'Django', 'React', 'TypeScript', 'PostgreSQL'])

    def test_education_crud(self):
        self.client.force_authenticate(user=self.member)
        edu_payload = {
            'institution': 'Delhi Technological University',
            'degree': 'Bachelor of Technology',
            'field_of_study': 'Computer Science',
            'graduation_year': 2026,
            'grade': '9.1 CGPA',
            'description': 'Dean list, Vice Lead of Open Source Club'
        }
        res = self.client.post('/api/career/educations/', edu_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        edu_id = res.data['id']

        list_res = self.client.get('/api/career/educations/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 1)

        # Cross-user isolation: other member cannot see this education
        self.client.force_authenticate(user=self.other_member)
        other_res = self.client.get('/api/career/educations/')
        other_results = other_res.data.get('results', other_res.data)
        self.assertEqual(len(other_results), 0)

    def test_portfolio_projects_and_achievements(self):
        self.client.force_authenticate(user=self.member)
        project_payload = {
            'title': 'AI Automated Code Reviewer',
            'description': 'Built an AST-based automated code analysis tool.',
            'technologies': 'Python, AST, Docker, FastAPI',
            'github_link': 'https://github.com/aaravsharma/ai-reviewer',
            'is_featured': True,
            'include_in_resume': True
        }
        res_proj = self.client.post('/api/career/projects/', project_payload, format='json')
        self.assertEqual(res_proj.status_code, status.HTTP_201_CREATED)

        ach_payload = {
            'title': 'National Smart Hackathon 1st Place',
            'issuer': 'Ministry of Education',
            'description': 'Won 1st prize out of 500+ teams nationwide.',
            'include_in_resume': True
        }
        res_ach = self.client.post('/api/career/achievements/', ach_payload, format='json')
        self.assertEqual(res_ach.status_code, status.HTTP_201_CREATED)

    def test_explicit_opt_in_for_approved_contributions(self):
        # Create an approved task for member
        approved_task = Task.objects.create(
            title='Build High-Performance DB Migration Pipeline',
            description='Designed automated migration runner with rollbacks.',
            deadline=timezone.now() + timedelta(days=2),
            assigned_to=self.member,
            created_by=self.founder,
            status='Approved'
        )

        self.client.force_authenticate(user=self.member)
        # Calling me endpoint triggers sync
        me_res = self.client.get('/api/career/me/')
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)

        # Contribution highlight should exist
        contributions = me_res.data['contributions']
        self.assertTrue(len(contributions) >= 1)
        target_contrib = next(c for c in contributions if 'Build High-Performance' in c['title'])
        # Crucial requirement: Member must explicitly opt-in!
        self.assertFalse(target_contrib['include_in_resume'])

        # Now member explicitly opts in
        toggle_res = self.client.patch(f"/api/career/contributions/{target_contrib['id']}/toggle/")
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)
        self.assertTrue(toggle_res.data['include_in_resume'])

    def test_ats_resume_pdf_download(self):
        self.client.force_authenticate(user=self.member)
        # Populate basic info
        self.client.patch('/api/career/me/', {
            'headline': 'Software Engineer',
            'target_role': 'Backend Developer',
            'bio': 'Passionate engineer.',
            'skills': ['Python', 'PostgreSQL'],
            'phone': '+91 9999988888',
            'location': 'India'
        }, format='json')

        self.client.post('/api/career/educations/', {
            'institution': 'Delhi Tech University',
            'degree': 'B.Tech CSE',
            'field_of_study': 'Computer Science',
            'graduation_year': 2026
        }, format='json')

        self.client.post('/api/career/projects/', {
            'title': 'Distributed Queue System',
            'description': 'Built fault-tolerant message broker.',
            'technologies': 'Python, ZeroMQ',
            'include_in_resume': True
        }, format='json')

        pdf_res = self.client.get('/api/career/resume/pdf/')
        self.assertEqual(pdf_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_res['Content-Type'], 'application/pdf')
        self.assertTrue(pdf_res.content.startswith(b'%PDF-'))
        self.assertIn('Aarav_Sharma_Resume.pdf', pdf_res['Content-Disposition'])

    def test_visibility_controls(self):
        self.client.force_authenticate(user=self.member)
        me_res = self.client.get('/api/career/me/')
        slug = me_res.data['shareable_slug']

        # 1. By default, visibility is 'Community'
        self.client.logout()
        unauth_res = self.client.get(f'/api/career/public/{slug}/')
        self.assertEqual(unauth_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated member can view Community profile
        self.client.force_authenticate(user=self.other_member)
        auth_res = self.client.get(f'/api/career/public/{slug}/')
        self.assertEqual(auth_res.status_code, status.HTTP_200_OK)
        self.assertEqual(auth_res.data['user_name'], 'Aarav Sharma')

        # 2. Member sets profile to 'Private'
        self.client.force_authenticate(user=self.member)
        self.client.patch('/api/career/me/', {'visibility': 'Private'}, format='json')

        # Other member cannot view Private profile
        self.client.force_authenticate(user=self.other_member)
        denied_res = self.client.get(f'/api/career/public/{slug}/')
        self.assertEqual(denied_res.status_code, status.HTTP_403_FORBIDDEN)

        # Authorized official (Founder) CAN view Private profile
        self.client.force_authenticate(user=self.founder)
        founder_res = self.client.get(f'/api/career/public/{slug}/')
        self.assertEqual(founder_res.status_code, status.HTTP_200_OK)

        # 3. Member sets profile to 'Public'
        self.client.force_authenticate(user=self.member)
        self.client.patch('/api/career/me/', {'visibility': 'Public'}, format='json')

        # Anyone (unauthenticated) can view Public profile
        self.client.logout()
        pub_res = self.client.get(f'/api/career/public/{slug}/')
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.data['user_name'], 'Aarav Sharma')
