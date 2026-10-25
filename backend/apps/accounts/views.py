from rest_framework import status, views, viewsets, permissions, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.db.models import Q

from apps.accounts.models import Role, User
from apps.accounts.serializers import (
    RoleSerializer,
    UserSummarySerializer,
    UserDetailSerializer,
    RegisterSerializer,
    LoginSerializer,
    UserSelfUpdateSerializer,
    UserAdminUpdateSerializer,
    UserAdminCreateSerializer,
    DemoAccountSerializer
)
from apps.accounts.permissions import (
    IsFounderOrAdmin,
    IsExecutiveOrLeader,
    IsSelfOrAdmin,
    get_role_tier,
    is_founder,
    is_official
)
from apps.activity.services import log_activity

class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            if user.status == 'Pending':
                msg = f"Registration submitted for {user.position or user.role.name}. Privileged roles require administrative approval before login."
            else:
                if user.role.name == 'Founder':
                    msg = "Registration successful. Welcome to TechNeekX as Founder."
                elif user.role.name == 'Director of Core Operations':
                    msg = "Registration successful. Welcome to TechNeekX as Director of Core Operations."
                else:
                    group_display = user.group.name if user.group else 'your group'
                    msg = f"Registration successful. Welcome to TechNeekX as a Member in {group_display}."
            return Response({
                'message': msg,
                'user': UserSummarySerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PublicGroupListView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.teams.models import Group
        groups = Group.objects.select_related('team').all().order_by('group_id')
        data = [
            {
                'group_id': g.group_id,
                'name': g.name,
                'team_id': g.team_id,
                'team_name': g.team.name if g.team else None,
                'description': g.description or ''
            }
            for g in groups
        ]
        return Response(data, status=status.HTTP_200_OK)


class PublicDemoAccountListView(views.APIView):
    """
    Public endpoint providing dynamically seeded demo accounts for rapid testing.
    Never exposes passwords, hashes, tokens, or inactive users.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        users = list(
            User.objects.filter(is_demo=True, status='Active')
            .select_related('role', 'team', 'group')
        )
        # Order by hierarchy level (1: Founder, 2: Officials, 3: Director, 4: Core Leads, 5: Members), then user_id
        users.sort(key=lambda u: (u.hierarchy_level, u.role.role_id if u.role else 99, u.user_id))
        serializer = DemoAccountSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except (AttributeError, TokenError):
                pass # If blacklisting is not configured or token expired, acknowledge logout
        return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)


class CurrentUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserSelfUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Profile updated successfully.',
                'user': UserDetailSerializer(user).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RoleListView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        roles = Role.objects.all().order_by('role_id')
        serializer = RoleSerializer(roles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve users with query filtering.
    Sensitive role/team updates require Tier 2 Executive Leadership permissions.
    """
    queryset = User.objects.select_related('role', 'team').all().order_by('user_id')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserDetailSerializer
        return UserSummarySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        role_id = self.request.query_params.get('role_id')
        team_id = self.request.query_params.get('team_id')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if role_id:
            queryset = queryset.filter(role_id=role_id)
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(email__icontains=search)
            )
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Allows Tier 1/2 leaders (Founder, Officials) to directly provision user accounts.
        """
        if not (is_founder(request.user) or is_official(request.user)):
            return Response(
                {'error': 'Only Founder or Officials can administratively create accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = UserAdminCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            log_activity(
                user=request.user,
                action='USER_CREATED',
                details=f"Administratively provisioned {user.email} as {user.role.name} ({user.position or 'N/A'})"
            )
            return Response({
                'message': f"User {user.email} provisioned successfully with role {user.role.name}.",
                'user': UserDetailSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'], permission_classes=[IsExecutiveOrLeader])
    def manage(self, request, pk=None):
        """
        Allows Tier 1/2 leaders to update another user's role, team assignment, or status.
        """
        user = self.get_object()
        serializer = UserAdminUpdateSerializer(
            user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            updated_user = serializer.save()
            return Response({
                'message': f'User {updated_user.email} updated successfully.',
                'user': UserDetailSerializer(updated_user).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
