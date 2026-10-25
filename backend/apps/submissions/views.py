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
from apps.accounts.permissions import user_has_tier, can_review_submissions, is_director_of_operations
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
        is_assigned = (task.assigned_to_id == user.user_id) or (task.group_id and user.group_id == task.group_id and not task.assigned_to_id)
        if not is_assigned and not user_has_tier(user, 2):
            return Response(
                {'error': 'You are not assigned to this task.'},
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

        # 1. Reviewer role authorization (Founder, Officials, Core Leads only — Director has inspection-only oversight)
        if not can_review_submissions(reviewer):
            if is_director_of_operations(reviewer):
                return Response(
                    {'error': 'Director of Core Operations has monitoring oversight only and cannot approve or reject submissions.'},
                    status=status.HTTP_403_FORBIDDEN
                )
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

        # 3. Core Lead Group Isolation: Core Leads can only review tasks within their own group
        from apps.accounts.permissions import is_core_team, is_official
        if is_core_team(reviewer) and not is_official(reviewer):
            task_group_id = task.group_id or (task.assigned_to.group_id if task.assigned_to else None)
            is_creator = task.created_by_id == reviewer.user_id
            if not is_creator and (not reviewer.group_id or task_group_id != reviewer.group_id):
                return Response(
                    {'error': 'Core Leads can only review submissions for tasks within their own group.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 4. Verify task status is 'Submitted'
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
                    from apps.board.services import resolve_task_warnings
                    resolve_task_warnings(task=task, actor=reviewer)
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
    List and retrieve task proofs with strict role-based data isolation.
    """
    queryset = TaskProof.objects.select_related('task', 'submitted_by').all().order_by('-submitted_at')
    serializer_class = TaskProofSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        from apps.accounts.permissions import is_official, is_board, is_core_team
        from django.db.models import Q

        # Level 1 (Official) & Level 2 (Board): Org-wide / Monitoring scope
        if is_official(user) or is_board(user):
            pass
        elif is_core_team(user):
            # Level 3 (Core Team): Submissions for tasks in their group or submitted by them
            q = Q(submitted_by=user) | Q(task__created_by=user)
            if user.group_id:
                q |= Q(task__group_id=user.group_id) | Q(task__assigned_to__group_id=user.group_id)
            queryset = queryset.filter(q)
        else:
            # Level 4 (Members): ONLY their own submissions
            queryset = queryset.filter(submitted_by=user)

        task_id = self.request.query_params.get('task_id')
        user_id = self.request.query_params.get('submitted_by')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        if user_id:
            # Prevent members from querying another user's submissions
            if not (is_official(user) or is_board(user) or is_core_team(user)) and int(user_id) != user.user_id:
                return queryset.none()
            queryset = queryset.filter(submitted_by_id=user_id)
        return queryset


class ReviewViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve task reviews with strict role-based data isolation.
    """
    queryset = Review.objects.select_related('task', 'proof', 'reviewer').all().order_by('-reviewed_at')
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        from apps.accounts.permissions import is_official, is_board, is_core_team
        from django.db.models import Q

        if is_official(user) or is_board(user):
            pass
        elif is_core_team(user):
            q = Q(reviewer=user) | Q(task__created_by=user)
            if user.group_id:
                q |= Q(task__group_id=user.group_id) | Q(task__assigned_to__group_id=user.group_id)
            queryset = queryset.filter(q)
        else:
            # Members only see reviews on their own tasks or proofs
            queryset = queryset.filter(
                Q(task__assigned_to=user) | Q(proof__submitted_by=user)
            )

        task_id = self.request.query_params.get('task_id')
        reviewer_id = self.request.query_params.get('reviewer_id')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        if reviewer_id:
            queryset = queryset.filter(reviewer_id=reviewer_id)
        return queryset
