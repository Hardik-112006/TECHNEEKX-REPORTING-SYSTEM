from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.approvals.models import ApprovalWorkflow, ApprovalStageAudit

class MultiLevelApprovalWorkflowsTests(APITestCase):
    def setUp(self):
        self.founder_role = Role.objects.get(name='Founder')
        self.lead_role = Role.objects.get(name='Core Team Lead')
        self.member_role = Role.objects.get(name='Member')

        # 1. Official (Tier 1/2)
        self.official = User.objects.create(
            name='Karan Official',
            email='karan.approvals@example.com',
            role=self.founder_role,
            status='Active'
        )
        self.official.set_password('Pass123!')
        self.official.save()

        # 2. Core Lead (Tier 3)
        self.lead = User.objects.create(
            name='Rohit Lead',
            email='rohit.leadapp@example.com',
            role=self.lead_role,
            status='Active'
        )
        self.lead.set_password('Pass123!')
        self.lead.save()

        # 3. Member (Tier 5)
        self.member = User.objects.create(
            name='Sahil Member',
            email='sahil.memberapp@example.com',
            role=self.member_role,
            status='Active'
        )
        self.member.set_password('Pass123!')
        self.member.save()

        # 4. Another Member
        self.other_member = User.objects.create(
            name='Priya Member',
            email='priya.other@example.com',
            role=self.member_role,
            status='Active'
        )
        self.other_member.set_password('Pass123!')
        self.other_member.save()

    def test_sequential_two_stage_approval_flow(self):
        # 1. Member creates workflow
        self.client.force_authenticate(user=self.member)
        create_res = self.client.post('/api/approvals/', {
            'content_type': 'event_proposal',
            'object_id': 101,
            'title': 'HackNova 2027 National Hackathon',
            'description': 'Proposed 36-hour offline hackathon on campus.',
            'total_stages': 2
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        wf_id = create_res.data['workflow_id']
        self.assertEqual(create_res.data['current_stage'], 1)
        self.assertEqual(create_res.data['status'], 'Pending Stage 1')

        # 2. Stage 1: Core Lead reviews & approves
        self.client.force_authenticate(user=self.lead)
        stage1_res = self.client.post(f'/api/approvals/{wf_id}/decision/', {
            'decision': 'Approved',
            'feedback': 'Technical syllabus and venue feasibility verified.'
        }, format='json')
        self.assertEqual(stage1_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stage1_res.data['current_stage'], 2)
        self.assertEqual(stage1_res.data['status'], 'Pending Stage 2')

        # 3. Stage 2: Official ratifies final budget
        self.client.force_authenticate(user=self.official)
        stage2_res = self.client.post(f'/api/approvals/{wf_id}/decision/', {
            'decision': 'Approved',
            'feedback': 'Budget allocation of $10,000 officially ratified.'
        }, format='json')
        self.assertEqual(stage2_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stage2_res.data['status'], 'Approved')
        self.assertEqual(stage2_res.data['current_stage'], 2)

        # 4. Audit trail check
        history = stage2_res.data['stage_history']
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]['reviewer_name'], 'Rohit Lead')
        self.assertEqual(history[0]['decision'], 'Approved')
        self.assertEqual(history[1]['reviewer_name'], 'Karan Official')
        self.assertEqual(history[1]['decision'], 'Approved')

    def test_anti_self_approval_prevented(self):
        self.client.force_authenticate(user=self.lead)
        wf = ApprovalWorkflow.objects.create(
            content_type='sponsorship_proposal',
            object_id=202,
            title='Google Cloud Partnership',
            submitter=self.lead,
            current_stage=1,
            total_stages=2,
            status='Pending Stage 1'
        )

        # Lead attempts to approve their own workflow
        self.client.force_authenticate(user=self.lead)
        denied_res = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Approved',
            'feedback': 'Self approve'
        }, format='json')
        self.assertEqual(denied_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Anti-Self-Review Violation', str(denied_res.data))

    def test_stage_role_eligibility_enforced(self):
        wf = ApprovalWorkflow.objects.create(
            content_type='mou_document',
            object_id=303,
            title='College MoU Partnership',
            submitter=self.member,
            current_stage=1,
            total_stages=2,
            status='Pending Stage 1'
        )

        # 1. Regular Member cannot review Stage 1 (requires Tier <= 3)
        self.client.force_authenticate(user=self.other_member)
        res1 = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Approved'
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Advance to Stage 2
        self.client.force_authenticate(user=self.lead)
        self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Approved'
        }, format='json')
        wf.refresh_from_db()
        self.assertEqual(wf.status, 'Pending Stage 2')

        # 3. Core Lead (Tier 3) CANNOT review Stage 2 (requires Tier <= 2 Official)
        lead_stage2_res = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Approved'
        }, format='json')
        self.assertEqual(lead_stage2_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('requires Tier 2', str(lead_stage2_res.data))

    def test_changes_requested_and_resubmission_loop(self):
        wf = ApprovalWorkflow.objects.create(
            content_type='event_proposal',
            object_id=404,
            title='Cloud Architecture Bootcamp',
            submitter=self.member,
            current_stage=1,
            total_stages=2,
            status='Pending Stage 1'
        )

        # 1. Changes requested without feedback fails validation
        self.client.force_authenticate(user=self.lead)
        invalid_res = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Changes Requested',
            'feedback': ''
        }, format='json')
        self.assertEqual(invalid_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Changes requested with feedback
        req_res = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Changes Requested',
            'feedback': 'Please attach detailed slide deck and mentor credentials.'
        }, format='json')
        self.assertEqual(req_res.status_code, status.HTTP_200_OK)
        wf.refresh_from_db()
        self.assertEqual(wf.status, 'Changes Requested')

        # 3. Non-submitter cannot resubmit
        self.client.force_authenticate(user=self.other_member)
        denied_resubmit = self.client.post(f'/api/approvals/{wf.workflow_id}/resubmit/', {
            'notes': 'Hacked resubmit'
        }, format='json')
        self.assertEqual(denied_resubmit.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Submitter resubmits
        self.client.force_authenticate(user=self.member)
        resubmit_res = self.client.post(f'/api/approvals/{wf.workflow_id}/resubmit/', {
            'notes': 'Updated slide deck URL attached.'
        }, format='json')
        self.assertEqual(resubmit_res.status_code, status.HTTP_200_OK)
        wf.refresh_from_db()
        self.assertEqual(wf.status, 'Pending Stage 1')
        self.assertEqual(wf.current_stage, 1)

    def test_rejection_locks_workflow(self):
        wf = ApprovalWorkflow.objects.create(
            content_type='event_proposal',
            object_id=505,
            title='Infeasible Event',
            submitter=self.member,
            current_stage=1,
            total_stages=2,
            status='Pending Stage 1'
        )

        self.client.force_authenticate(user=self.lead)
        reject_res = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Rejected',
            'feedback': 'Venue unavailable and conflicts with exams.'
        }, format='json')
        self.assertEqual(reject_res.status_code, status.HTTP_200_OK)
        wf.refresh_from_db()
        self.assertEqual(wf.status, 'Rejected')

        # Subsequent attempt to approve rejected workflow fails
        self.client.force_authenticate(user=self.official)
        fail_res = self.client.post(f'/api/approvals/{wf.workflow_id}/decision/', {
            'decision': 'Approved'
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)
