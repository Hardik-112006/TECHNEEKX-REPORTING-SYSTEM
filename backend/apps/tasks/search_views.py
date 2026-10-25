from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone

from apps.tasks.models import Task
from apps.teams.models import Team, Group
from apps.accounts.models import User
from apps.announcements.models import Announcement
from apps.submissions.models import TaskProof
from apps.accounts.permissions import is_official, is_board, is_core_team

class GlobalSearchView(APIView):
    """
    Unified global search endpoint across Tasks, Teams, Groups, Members,
    Announcements, and Submissions with strict role-based data isolation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 2:
            return Response({
                'query': query,
                'total_results': 0,
                'results': {
                    'tasks': [],
                    'teams': [],
                    'members': [],
                    'announcements': [],
                    'submissions': []
                }
            }, status=status.HTTP_200_OK)

        user = request.user
        results = {
            'tasks': [],
            'teams': [],
            'members': [],
            'announcements': [],
            'submissions': []
        }

        # 1. TASKS SEARCH (Role-authorized)
        task_qs = Task.objects.select_related('assigned_to', 'team').all()
        if is_official(user) or is_board(user):
            pass
        elif is_core_team(user):
            q_filter = Q(created_by=user) | Q(assigned_to=user)
            if user.group_id:
                q_filter |= Q(group_id=user.group_id)
            if user.team_id:
                q_filter |= Q(team_id=user.team_id)
            task_qs = task_qs.filter(q_filter)
        else:
            q_filter = Q(assigned_to=user)
            if user.group_id:
                q_filter |= Q(group_id=user.group_id)
            task_qs = task_qs.filter(q_filter)

        task_matches = task_qs.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        )[:8]

        for t in task_matches:
            results['tasks'].append({
                'id': t.task_id,
                'title': t.title,
                'subtitle': f"Status: {t.status} • Assigned: {t.assigned_to.name if t.assigned_to else 'Unassigned'}",
                'status': t.status,
                'target_nav': 'tasks'
            })

        # 2. TEAMS & GROUPS SEARCH
        team_matches = Team.objects.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )[:5]
        for tm in team_matches:
            results['teams'].append({
                'id': tm.team_id,
                'title': tm.name,
                'subtitle': f"Team ({tm.type or 'Standard'})",
                'type': 'team',
                'target_nav': 'teams'
            })

        group_matches = Group.objects.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )[:5]
        for g in group_matches:
            results['teams'].append({
                'id': g.group_id,
                'title': g.name,
                'subtitle': f"Group • {g.description or 'Specialized'}",
                'type': 'group',
                'target_nav': 'teams'
            })

        # 3. MEMBERS SEARCH (Public safe fields only)
        user_matches = User.objects.select_related('role', 'team').filter(
            Q(name__icontains=query) | Q(email__icontains=query)
        ).exclude(status='Inactive')[:8]
        for u in user_matches:
            results['members'].append({
                'id': u.user_id,
                'title': u.name,
                'subtitle': f"{u.role.name if u.role else 'Member'} • {u.team.name if u.team else 'TechNeekX'}",
                'email': u.email,
                'target_nav': 'teams'
            })

        # 4. ANNOUNCEMENTS SEARCH
        ann_matches = Announcement.objects.select_related('created_by').filter(
            Q(title__icontains=query) | Q(content__icontains=query)
        )[:5]
        for a in ann_matches:
            results['announcements'].append({
                'id': a.announcement_id,
                'title': a.title,
                'subtitle': f"By {a.created_by.name if a.created_by else 'Official'} • {a.created_at.strftime('%b %d, %Y')}",
                'target_nav': 'announcements'
            })

        # 5. SUBMISSIONS SEARCH (Role-authorized)
        sub_qs = TaskProof.objects.select_related('task', 'submitted_by').all()
        if is_official(user) or is_board(user):
            pass
        elif is_core_team(user):
            q_filter = Q(submitted_by=user) | Q(task__created_by=user)
            if user.group_id:
                q_filter |= Q(task__group_id=user.group_id)
            if user.team_id:
                q_filter |= Q(task__team_id=user.team_id)
            sub_qs = sub_qs.filter(q_filter)
        else:
            sub_qs = sub_qs.filter(submitted_by=user)

        sub_matches = sub_qs.filter(
            Q(task__title__icontains=query) | Q(description__icontains=query)
        )[:6]
        for s in sub_matches:
            results['submissions'].append({
                'id': s.proof_id,
                'task_id': s.task_id,
                'title': s.task.title,
                'subtitle': f"Submitted by {s.submitted_by.name} • Task #{s.task_id}",
                'target_nav': 'submissions'
            })

        total = sum(len(items) for items in results.values())
        return Response({
            'query': query,
            'total_results': total,
            'results': results
        }, status=status.HTTP_200_OK)


class LiveEtaView(APIView):
    """
    Calculates live ETA for the current user's deliverables or pending reviews based on
    actual database task deadlines and timestamps.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()

        # Query user's assigned active tasks with deadlines
        user_tasks = Task.objects.filter(
            assigned_to=user,
            status__in=['Assigned', 'In Progress', 'Changes Requested']
        ).exclude(deadline__isnull=True).order_by('deadline')

        target_task = user_tasks.first()
        context = "Assigned task deliverable"

        # If user has no assigned task with deadline and is a reviewer (Official/Board/Core Lead),
        # check pending submissions waiting for review
        if not target_task and (is_official(user) or is_board(user) or is_core_team(user)):
            review_tasks = Task.objects.filter(
                status='Submitted'
            ).exclude(deadline__isnull=True).order_by('deadline')
            if review_tasks.exists():
                target_task = review_tasks.first()
                context = "Pending submission awaiting review"

        if not target_task:
            return Response({
                'has_eta': False,
                'formatted_eta': 'ETA unavailable',
                'message': 'No active deliverables with scheduled deadlines.',
                'last_updated': now.isoformat(),
                'upcoming': []
            }, status=status.HTTP_200_OK)

        def format_delta(deadline):
            diff = deadline - now
            seconds = int(diff.total_seconds())
            if seconds >= 86400 * 2:
                days = int(diff.days)
                return f"{days} days remaining", False
            elif seconds >= 86400:
                hours = int((seconds - 86400) // 3600)
                return f"1 day {hours}h remaining", False
            elif seconds > 0:
                hours = int(seconds // 3600)
                mins = int((seconds % 3600) // 60)
                if hours > 0:
                    return f"{hours}h {mins}m remaining", False
                return f"{mins}m remaining", False
            else:
                overdue_seconds = abs(seconds)
                if overdue_seconds >= 86400:
                    days = int(overdue_seconds // 86400)
                    return f"{days}d overdue", True
                hours = int(overdue_seconds // 3600)
                mins = int((overdue_seconds % 3600) // 60)
                if hours > 0:
                    return f"{hours}h {mins}m overdue", True
                return f"{mins}m overdue", True

        eta_text, is_overdue = format_delta(target_task.deadline)

        upcoming_list = []
        for t in user_tasks[:5]:
            t_eta, t_overdue = format_delta(t.deadline)
            upcoming_list.append({
                'task_id': t.task_id,
                'title': t.title,
                'status': t.status,
                'deadline': t.deadline.isoformat(),
                'formatted_eta': t_eta,
                'is_overdue': t_overdue
            })

        return Response({
            'has_eta': True,
            'task_id': target_task.task_id,
            'task_title': target_task.title,
            'status': target_task.status,
            'deadline': target_task.deadline.isoformat(),
            'formatted_eta': eta_text,
            'is_overdue': is_overdue,
            'context': context,
            'last_updated': target_task.created_at.isoformat(),
            'upcoming': upcoming_list
        }, status=status.HTTP_200_OK)
