from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import Role, User
from apps.accounts.permissions import get_role_tier
from apps.teams.models import Team

class RoleSerializer(serializers.ModelSerializer):
    tier = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['role_id', 'name', 'description', 'tier']
        read_only_fields = ['role_id', 'tier']

    def get_tier(self, obj):
        return get_role_tier(obj.name)


class UserSummarySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    role_tier = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['user_id', 'name', 'email', 'role_id', 'role_name', 'team_id', 'team_name', 'status', 'role_tier']
        read_only_fields = ['user_id', 'role_name', 'team_name', 'role_tier']

    def get_role_tier(self, obj):
        return get_role_tier(obj.role.name) if obj.role else 5


class UserDetailSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    team_id = serializers.IntegerField(source='team.team_id', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    role_tier = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'user_id', 'name', 'email', 'role', 'team_id', 'team_name',
            'status', 'created_at', 'role_tier'
        ]
        read_only_fields = ['user_id', 'email', 'role', 'team_id', 'team_name', 'created_at', 'role_tier']

    def get_role_tier(self, obj):
        return get_role_tier(obj.role.name) if obj.role else 5


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['name', 'email', 'password']

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def create(self, validated_data):
        # SECURITY INVARIANT: Public registration ALWAYS defaults strictly to 'Member'
        # Ignores any attempt to inject role, role_id, or status
        member_role, _ = Role.objects.get_or_create(
            name='Member',
            defaults={'description': 'Completes assigned tasks and submits proof for review'}
        )

        user = User.objects.create(
            name=validated_data['name'].strip(),
            email=validated_data['email'],
            role=member_role,
            status='Active'
        )
        user.set_password(validated_data['password'])
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email', '').strip().lower()
        password = attrs.get('password', '')

        try:
            user = User.objects.select_related('role', 'team').get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")

        if user.status != 'Active':
            raise serializers.ValidationError(f"Your account status is currently '{user.status}'. Contact an administrator.")

        refresh = RefreshToken.for_user(user)
        # Custom claims in JWT token
        refresh['name'] = user.name
        refresh['email'] = user.email
        refresh['role'] = user.role.name if user.role else 'Member'
        refresh['role_tier'] = get_role_tier(user.role.name) if user.role else 5
        refresh['team_id'] = user.team.team_id if user.team else None

        return {
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }
        }


class UserSelfUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['name']

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name cannot be empty.")
        return name


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source='role',
        required=False
    )
    team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(),
        source='team',
        allow_null=True,
        required=False
    )

    class Meta:
        model = User
        fields = ['name', 'role_id', 'team_id', 'status']

    def validate_role_id(self, role):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)

        # Only Tier 1 users (Founder, Chairman, MD) can assign Tier 1 roles
        if get_role_tier(role.name) == 1:
            if not request_user or get_role_tier(request_user.role.name) > 1:
                raise serializers.ValidationError("Only Founder or Executive Admin can assign Tier 1 roles.")
        return role
