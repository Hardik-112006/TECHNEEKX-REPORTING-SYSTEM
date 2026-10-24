from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q

from apps.accounts.permissions import get_role_tier
from apps.approvals.models import ApprovalWorkflow
from apps.approvals.serializers import (
    ApprovalWorkflowSerializer,
    WorkflowDecisionInputSerializer,
    WorkflowResubmitInputSerializer
)
from apps.approvals.services import submit_stage_decision, resubmit_workflow, can_user_review_stage

class ApprovalWorkflowListView(generics.ListCreateAPIView):
    serializer_class = ApprovalWorkflowSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ApprovalWorkflow.objects.prefetch_related('stage_history__reviewer').select_related('submitter').all()

        # Filters
        status_param = self.request.query_params.get('status', None)
        stage_param = self.request.query_params.get('stage', None)
        my_queue = self.request.query_params.get('my_queue', 'false').lower() == 'true'
        submitted_by_me = self.request.query_params.get('submitted_by_me', 'false').lower() == 'true'

        if status_param:
            qs = qs.filter(status=status_param)
        if stage_param:
            qs = qs.filter(current_stage=int(stage_param))
        if submitted_by_me:
            qs = qs.filter(submitter=user)

        if my_queue:
            # Show items in this user's review queue:
            # 1. Not submitted by user (anti-self review)
            # 2. Status in 'Pending Stage 1' or 'Pending Stage 2' where user is eligible
            user_tier = get_role_tier(user.role.name) if user.role else 5
            if user_tier <= 2:
                # Official can review both Stage 1 and Stage 2
                qs = qs.filter(
                    ~Q(submitter=user),
                    status__in=['Pending Stage 1', 'Pending Stage 2']
                )
            elif user_tier == 3:
                # Core Lead can review Stage 1 only
                qs = qs.filter(
                    ~Q(submitter=user),
                    status='Pending Stage 1'
                )
            else:
                # Regular members have no review queue
                qs = qs.none()

        return qs

    def perform_create(self, serializer):
        serializer.save(
            submitter=self.request.user,
            current_stage=1,
            status='Pending Stage 1'
        )


class ApprovalWorkflowDetailView(generics.RetrieveAPIView):
    serializer_class = ApprovalWorkflowSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ApprovalWorkflow.objects.prefetch_related('stage_history__reviewer').all()
    lookup_field = 'workflow_id'


class WorkflowDecisionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, workflow_id):
        workflow = get_object_or_404(ApprovalWorkflow, workflow_id=workflow_id)
        input_serializer = WorkflowDecisionInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        decision = input_serializer.validated_data['decision']
        feedback = input_serializer.validated_data.get('feedback', '')

        updated_workflow = submit_stage_decision(
            workflow=workflow,
            reviewer=request.user,
            decision=decision,
            feedback=feedback
        )

        return Response(
            ApprovalWorkflowSerializer(updated_workflow).data,
            status=status.HTTP_200_OK
        )


class WorkflowResubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, workflow_id):
        workflow = get_object_or_404(ApprovalWorkflow, workflow_id=workflow_id)
        input_serializer = WorkflowResubmitInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)

        notes = input_serializer.validated_data.get('notes', '')

        updated_workflow = resubmit_workflow(
            workflow=workflow,
            user=request.user,
            notes=notes
        )

        return Response(
            ApprovalWorkflowSerializer(updated_workflow).data,
            status=status.HTTP_200_OK
        )
