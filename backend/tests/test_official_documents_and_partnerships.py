from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import Role, User
from apps.documents.models import (
    ResourceMaterial,
    MouDocument,
    EventProposal,
    SponsorshipProposal,
    CommunityPartner
)
from apps.activity.models import HistoryLog

class OfficialDocumentsAndPartnershipTests(APITestCase):
    def setUp(self):
        self.founder_role = Role.objects.get(name='Founder')
        self.member_role = Role.objects.get(name='Member')

        self.official = User.objects.create(
            name='Karan Official',
            email='karan.official@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.official.set_password('Pass123!')
        self.official.save()

        self.member = User.objects.create(
            name='Sahil Member',
            email='sahil.member@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member.set_password('Pass123!')
        self.member.save()

    def test_resource_materials_management_and_tier_visibility(self):
        # 1. Member cannot publish official resource
        self.client.force_authenticate(user=self.member)
        denied_res = self.client.post('/api/documents/resources/', {
            'title': 'Unauthorized Guide',
            'category': 'Guide',
            'file_url': 'https://drive.google.com/unauth'
        }, format='json')
        self.assertEqual(denied_res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Official publishes resource for all members (min_role_tier=5)
        self.client.force_authenticate(user=self.official)
        pub_res = self.client.post('/api/documents/resources/', {
            'title': 'TechNeekX Git & PR Guidelines',
            'category': 'Guide',
            'description': 'Standard operating procedures for pull requests.',
            'file_url': 'https://storage.techneekx.org/guides/git-workflow.pdf',
            'min_role_tier': 5
        }, format='json')
        self.assertEqual(pub_res.status_code, status.HTTP_201_CREATED)
        res_id = pub_res.data['id']

        # 3. Official publishes executive-only resource (min_role_tier=2)
        exec_pub = self.client.post('/api/documents/resources/', {
            'title': 'Leadership Financial Playbook',
            'category': 'Template',
            'file_url': 'https://storage.techneekx.org/leadership/budget.xlsx',
            'min_role_tier': 2
        }, format='json')
        self.assertEqual(exec_pub.status_code, status.HTTP_201_CREATED)

        # 4. Member lists resources: only tier 5 resource is visible, tier 2 is hidden
        self.client.force_authenticate(user=self.member)
        mem_list = self.client.get('/api/documents/resources/')
        self.assertEqual(mem_list.status_code, status.HTTP_200_OK)
        results = mem_list.data.get('results', mem_list.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'TechNeekX Git & PR Guidelines')

        # 5. Track download
        dl_res = self.client.post(f'/api/documents/resources/{res_id}/track_download/')
        self.assertEqual(dl_res.status_code, status.HTTP_200_OK)
        self.assertEqual(dl_res.data['download_count'], 1)

    def test_mou_document_lifecycle_and_pdf_generation(self):
        # 1. Member cannot create MoU
        self.client.force_authenticate(user=self.member)
        denied_mou = self.client.post('/api/documents/mous/', {
            'organization_name': 'Unauthorized Org',
            'signatory_second_party': 'Registrar',
            'scope_of_work': 'Partnership',
            'validity_start': '2026-01-01',
            'validity_end': '2027-01-01'
        }, format='json')
        self.assertEqual(denied_mou.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Official creates MoU
        self.client.force_authenticate(user=self.official)
        create_mou = self.client.post('/api/documents/mous/', {
            'organization_name': 'Delhi Technological University',
            'signatory_second_party': 'Dean of Student Welfare',
            'scope_of_work': 'Joint hackathons, student mentorship, and campus chapters.',
            'validity_start': '2026-02-01',
            'validity_end': '2027-02-01',
            'status': 'In Review'
        }, format='json')
        self.assertEqual(create_mou.status_code, status.HTTP_201_CREATED)
        mou_id = create_mou.data['id']

        # 3. Official approves MoU
        review_res = self.client.post(f'/api/documents/mous/{mou_id}/review/', {
            'status': 'Approved',
            'review_notes': 'Reviewed and ratified by Governing Board.'
        }, format='json')
        self.assertEqual(review_res.status_code, status.HTTP_200_OK)
        self.assertEqual(review_res.data['status'], 'Approved')
        self.assertEqual(review_res.data['approved_by_name'], 'Karan Official')

        # 4. Generate & download MoU PDF
        pdf_res = self.client.get(f'/api/documents/mous/{mou_id}/pdf/')
        self.assertEqual(pdf_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_res['Content-Type'], 'application/pdf')
        self.assertTrue(pdf_res.content.startswith(b'%PDF-'))
        self.assertIn('MoU_TechNeekX_Delhi_Technological_University.pdf', pdf_res['Content-Disposition'])

    def test_event_proposals_and_sponsorships(self):
        # 1. Member submits event proposal
        self.client.force_authenticate(user=self.member)
        today = timezone.now().date()
        prop_res = self.client.post('/api/documents/event-proposals/', {
            'title': 'Intro to Distributed Cloud Architecture',
            'event_type': 'Workshop',
            'target_date': str(today + timedelta(days=20)),
            'expected_attendees': 120,
            'estimated_budget': '5000.00',
            'venue_or_platform': 'Zoom Webinar & TechNeekX Discord',
            'description': 'Hands-on session building microservices with Kubernetes.'
        }, format='json')
        self.assertEqual(prop_res.status_code, status.HTTP_201_CREATED)
        prop_id = prop_res.data['id']
        self.assertEqual(prop_res.data['status'], 'Submitted')

        # 2. Official reviews event proposal
        self.client.force_authenticate(user=self.official)
        review_res = self.client.post(f'/api/documents/event-proposals/{prop_id}/review/', {
            'decision': 'Approved',
            'feedback': 'Great proposal. Budget of Rs 5000 allocated.'
        }, format='json')
        self.assertEqual(review_res.status_code, status.HTTP_200_OK)
        self.assertEqual(review_res.data['status'], 'Approved')

        # 3. Create Sponsorship Proposal
        spons_res = self.client.post('/api/documents/sponsorships/', {
            'sponsor_organization': 'GitHub Education',
            'sponsorship_tier': 'Platinum',
            'amount_requested': '50000.00',
            'contact_person': 'Education Lead',
            'contact_email': 'education@github.com',
            'deliverables_offered': 'Keynote slot, logo on all event banners, resume access.'
        }, format='json')
        self.assertEqual(spons_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(spons_res.data['sponsorship_tier'], 'Platinum')

        # 4. Register Community Partner
        partner_res = self.client.post('/api/documents/partners/', {
            'organization_name': 'DevFolio India',
            'partner_type': 'Tech Community',
            'website': 'https://devfolio.co',
            'poc_name': 'Community Manager',
            'poc_email': 'community@devfolio.co',
            'benefits_summary': 'Co-hosting hackathons and hackathon platform sponsorship.',
            'status': 'Active'
        }, format='json')
        self.assertEqual(partner_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(partner_res.data['organization_name'], 'DevFolio India')
