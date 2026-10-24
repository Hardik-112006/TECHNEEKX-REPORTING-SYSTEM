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
    UserAdminUpdateSerializer
)
from apps.accounts.permissions import (
    IsFounderOrAdmin,
    IsExecutiveOrLeader,
    IsSelfOrAdmin,
    get_role_tier
)

class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'Registration successful. Account created as Member.',
                'user': UserSummarySerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
