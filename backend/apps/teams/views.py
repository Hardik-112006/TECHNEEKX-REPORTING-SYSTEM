from rest_framework import status, viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.teams.models import Team, Group
from apps.accounts.models import User
from apps.accounts.serializers import UserSummarySerializer
from apps.teams.serializers import (
    TeamSerializer,
    TeamDetailSerializer,
    GroupSerializer,
    MemberActionSerializer
)
from apps.accounts.permissions import (
    IsFounderOrAdmin,
    IsExecutiveOrLeader,
    IsCoreLeadOrAbove,
    ReadOnlyOrExecutive
)

def team_roster_error(actor, team, target):
    """
    Officials manage any roster. Core Leads may only move Members in or out of their own
    team. Everyone else (including the inspection-only Director) is refused.
    """
    from apps.accounts.permissions import is_official, is_core_team, MEMBER_ROLES
    if is_official(actor):
        return None
    if not is_core_team(actor):
        return "Only Officials and Core Leads can manage team rosters."
    if actor.team_id != team.team_id:
        return "Core Leads can only manage the roster of their own team."
    if not target.role or target.role.name not in MEMBER_ROLES:
        return "Core Leads can only add or remove Members."
    return None


class TeamViewSet(viewsets.ModelViewSet):
    """
    CRUD for Teams, with hierarchical parent-team nesting and member assignment.
    """
    queryset = Team.objects.prefetch_related('members', 'groups', 'sub_teams').all().order_by('team_id')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TeamDetailSerializer
        return TeamSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [IsExecutiveOrLeader()]
        elif self.action == 'destroy':
            return [IsFounderOrAdmin()]
        elif self.action in ['add_member', 'remove_member']:
            return [IsCoreLeadOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        team_type = self.request.query_params.get('type')
        parent_id = self.request.query_params.get('parent_team_id')
        if team_type:
            queryset = queryset.filter(type=team_type)
        if parent_id is not None:
            if parent_id.lower() == 'null':
                queryset = queryset.filter(parent_team__isnull=True)
            else:
                queryset = queryset.filter(parent_team_id=parent_id)
        return queryset

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        team = self.get_object()
        members = team.members.all()
        serializer = UserSummarySerializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsCoreLeadOrAbove])
    def add_member(self, request, pk=None):
        team = self.get_object()
        serializer = MemberActionSerializer(data=request.data)
        if serializer.is_valid():
            user_id = serializer.validated_data['user_id']
            user = User.objects.select_related('role').get(user_id=user_id)
            error = team_roster_error(request.user, team, user)
            if error:
                return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)
            user.team = team
            user.save(update_fields=['team'])
            return Response({
                'message': f"User '{user.name}' successfully added to team '{team.name}'.",
                'team_id': team.team_id,
                'user_id': user.user_id
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsCoreLeadOrAbove])
    def remove_member(self, request, pk=None):
        team = self.get_object()
        serializer = MemberActionSerializer(data=request.data)
        if serializer.is_valid():
            user_id = serializer.validated_data['user_id']
            user = User.objects.select_related('role').get(user_id=user_id)
            error = team_roster_error(request.user, team, user)
            if error:
                return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)
            if user.team_id != team.team_id:
                return Response(
                    {'error': f"User '{user.name}' is not currently assigned to team '{team.name}'."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.team = None
            user.save(update_fields=['team'])
            return Response({
                'message': f"User '{user.name}' successfully removed from team '{team.name}'.",
                'team_id': team.team_id,
                'user_id': user.user_id
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from apps.accounts.permissions import (
    IsOfficialTeam,
    IsCoreTeamOrAbove,
    is_official,
    is_board,
    is_core_team
)

class GroupViewSet(viewsets.ModelViewSet):
    """
    CRUD for Groups within Teams.
    Creation, update, and deletion strictly restricted to Official Team (Founder, Chairman, MD, President, CTO, Official).
    Read access: All authenticated users within their permitted scope.
    """
    queryset = Group.objects.select_related('team').prefetch_related('group_members').all().order_by('group_id')
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'assign_member', 'remove_member']:
            return [IsOfficialTeam()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        team_id = self.request.query_params.get('team_id')
        if team_id:
            queryset = queryset.filter(team_id=team_id)

        # Core team members see their assigned group
        if not (is_official(user) or is_board(user)) and user.group_id:
            queryset = queryset.filter(group_id=user.group_id)

        return queryset

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        group = self.get_object()
        members = group.group_members.all()
        serializer = UserSummarySerializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsOfficialTeam])
    def assign_member(self, request, pk=None):
        group = self.get_object()
        serializer = MemberActionSerializer(data=request.data)
        if serializer.is_valid():
            user_id = serializer.validated_data['user_id']
            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

            user.group = group
            if not user.team_id:
                user.team = group.team
            user.save(update_fields=['group', 'team'])
            return Response({
                'message': f"User '{user.name}' assigned to group '{group.name}'.",
                'group_id': group.group_id,
                'user_id': user.user_id
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsOfficialTeam])
    def remove_member(self, request, pk=None):
        group = self.get_object()
        serializer = MemberActionSerializer(data=request.data)
        if serializer.is_valid():
            user_id = serializer.validated_data['user_id']
            try:
                user = User.objects.get(user_id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

            if user.group_id != group.group_id:
                return Response({'error': f"User '{user.name}' is not in group '{group.name}'."}, status=status.HTTP_400_BAD_REQUEST)

            user.group = None
            user.save(update_fields=['group'])
            return Response({
                'message': f"User '{user.name}' removed from group '{group.name}'.",
                'group_id': group.group_id,
                'user_id': user.user_id
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
