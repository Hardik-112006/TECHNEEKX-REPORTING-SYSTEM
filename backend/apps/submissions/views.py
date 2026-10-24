from rest_framework import status, views, viewsets, permissions
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.tasks.models import Task
from apps.submissions.models import TaskProof, Review
from apps.submissions.serializers import (
    TaskProofSerializer,
    TaskProofCreateSerializer,
    ReviewSerializer,
    ReviewCreateSerializer
)
from apps.accounts.permissions import user_has_tier
from apps.scoring.services import award_task_points
from apps.activity.services import log_activity

class SubmitProofView(views.APIView):
    """
    Submits evidence proof for a task and transitions task status to 'Submitted'.
    Supports initial submission and resubmission after 'Changes Requested'.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        user = request.user

        # 1. Verify caller assignment authorization
        is_assigned = (task.assigned_to_id == user.user_id) or (task.team_id and user.team_id == task.team_id)
        if not is_assigned and not user_has_tier(user, 2):
            return Response(
                {'error': 'You are not assigned to this task or its assigned team.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Verify task status
        if task.status == 'Approved':
            return Response(
                {'error': 'This task is already Approved and completed. Submissions are closed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = TaskProofCreateSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                proof = serializer.save(task=task, submitted_by=user)
                task.status = 'Submitted'
                task.save(update_fields=['status'])

                log_activity(
                    user=user,
                    action='PROOF_SUBMITTED',
                    details=f"Proof #{proof.proof_id} submitted for Task #{task.task_id} by {user.name}"
                )

            return Response({
                'message': 'Proof submitted successfully. Task is now Submitted for review.',
                'proof': TaskProofSerializer(proof).data,
                'task_status': task.status
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReviewTaskView(views.APIView):
    """
    Conducts review on a submitted task. Decisions: 'Approved' or 'Changes Requested'.
    Prevents unauthorized reviewers and self-review.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, task_id):
        task = get_object_or_404(Task, pk=task_id)
        reviewer = request.user

        # 1. Reviewer role authorization (Tier 1, 2, 3, or 4 required)
        if not user_has_tier(reviewer, 4):
            return Response(
                {'error': 'You do not have reviewer permissions. Only leads and officials can conduct reviews.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Strict Self-Review Prevention
        # Reviewer cannot review their own work
        latest_proof = task.proofs.order_by('-submitted_at').first()
        if latest_proof and latest_proof.submitted_by_id == reviewer.user_id:
            return Response(
                {'error': 'Self-review is strictly forbidden. You cannot review your own submission.'},
                status=status.HTTP_403_FORBIDDEN
            )
        if task.assigned_to_id == reviewer.user_id:
            return Response(
                {'error': 'Self-review is strictly forbidden. You cannot review a task assigned to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 3. Verify task status is 'Submitted'
        if task.status != 'Submitted':
            return Response(
                {'error': f"Cannot review task: current status is '{task.status}' (expected 'Submitted')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ReviewCreateSerializer(data=request.data)
        if serializer.is_valid():
            decision = serializer.validated_data['decision']
            feedback = serializer.validated_data.get('feedback', '')

            with transaction.atomic():
                points_awarded = 0
                points_message = ""
                if decision == 'Approved':
                    submitter = latest_proof.submitted_by if latest_proof else task.assigned_to
                    if submitter:
                        success, pts, points_message = award_task_points(task, submitter, reviewer)
                        if success:
                            points_awarded = pts

                review = Review.objects.create(
                    task=task,
                    proof=latest_proof,
                    reviewer=reviewer,
                    decision=decision,
                    feedback=feedback
                )

                task.status = decision
                task.save(update_fields=['status'])

                if decision == 'Approved':
                    log_activity(
                        user=reviewer,
                        action='TASK_APPROVED',
                        details=f"Task #{task.task_id} approved by {reviewer.name}. Feedback: {feedback}"
                    )
                else:
                    log_activity(
                        user=reviewer,
                        action='CHANGES_REQUESTED',
                        details=f"Changes requested on Task #{task.task_id} by {reviewer.name}. Feedback: {feedback}"
                    )

            return Response({
                'message': f"Review completed with decision '{decision}'.",
                'review': ReviewSerializer(review).data,
                'task_status': task.status,
                'points_awarded': points_awarded,
                'scoring_info': points_message
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve task proofs.
    """
    queryset = TaskProof.objects.select_related('task', 'submitted_by').all().order_by('-submitted_at')
    serializer_class = TaskProofSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        task_id = self.request.query_params.get('task_id')
        user_id = self.request.query_params.get('submitted_by')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        if user_id:
            queryset = queryset.filter(submitted_by_id=user_id)
        return queryset


class ReviewViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve task reviews.
    """
    queryset = Review.objects.select_related('task', 'proof', 'reviewer').all().order_by('-reviewed_at')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        task_id = self.request.query_params.get('task_id')
        reviewer_id = self.request.query_params.get('reviewer_id')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        if reviewer_id:
            queryset = queryset.filter(reviewer_id=reviewer_id)
        return queryset
