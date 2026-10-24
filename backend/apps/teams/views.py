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
            user = User.objects.get(user_id=user_id)
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
            user = User.objects.get(user_id=user_id)
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


class GroupViewSet(viewsets.ModelViewSet):
    """
    CRUD for Groups within Teams.
    """
    queryset = Group.objects.select_related('team').all().order_by('group_id')
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsCoreLeadOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        team_id = self.request.query_params.get('team_id')
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        return queryset
