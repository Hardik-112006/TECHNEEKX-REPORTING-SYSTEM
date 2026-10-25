from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import Role, User
from apps.accounts.permissions import get_role_tier, is_founder, is_official
from apps.teams.models import Team, Group

OFFICIAL_POSITIONS = (
    'Chairman',
    'President',
    'Managing Director',
    'Chief Technical Officer'
)

class RoleSerializer(serializers.ModelSerializer):
    tier = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['role_id', 'name', 'description', 'tier']
        read_only_fields = ['role_id', 'tier']

    def get_tier(self, obj):
        return get_role_tier(obj.name)


class UserSummarySerializer(serializers.ModelSerializer):
    role_id = serializers.IntegerField(source='role.role_id', read_only=True, default=None)
    role_name = serializers.CharField(source='role.name', read_only=True)
    team_id = serializers.IntegerField(source='team.team_id', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    group_id = serializers.IntegerField(source='group.group_id', read_only=True, default=None)
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)
    role_tier = serializers.SerializerMethodField()
    hierarchy_level = serializers.IntegerField(read_only=True)
    category = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'user_id', 'name', 'email', 'role_id', 'role_name',
            'team_id', 'team_name', 'group_id', 'group_name',
            'status', 'position', 'role_tier', 'hierarchy_level', 'category'
        ]
        read_only_fields = ['user_id', 'role_id', 'role_name', 'team_id', 'team_name', 'group_id', 'group_name', 'position', 'role_tier', 'hierarchy_level', 'category']

    def get_role_tier(self, obj):
        return get_role_tier(obj.role.name) if obj.role else 4


class UserDetailSerializer(serializers.ModelSerializer):
    role_id = serializers.IntegerField(source='role.role_id', read_only=True, default=None)
    role_name = serializers.CharField(source='role.name', read_only=True, default=None)
    role = RoleSerializer(read_only=True)
    team_id = serializers.IntegerField(source='team.team_id', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    group_id = serializers.IntegerField(source='group.group_id', read_only=True, default=None)
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)
    role_tier = serializers.SerializerMethodField()
    hierarchy_level = serializers.IntegerField(read_only=True)
    category = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'user_id', 'name', 'email', 'role_id', 'role_name', 'role', 'team_id', 'team_name',
            'group_id', 'group_name', 'status', 'position', 'created_at',
            'role_tier', 'hierarchy_level', 'category'
        ]
        read_only_fields = ['user_id', 'email', 'role_id', 'role_name', 'role', 'team_id', 'team_name', 'group_id', 'group_name', 'position', 'created_at', 'role_tier', 'hierarchy_level', 'category']

    def get_role_tier(self, obj):
        return get_role_tier(obj.role.name) if obj.role else 4


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6, style={'input_type': 'password'})
    category = serializers.CharField(write_only=True, required=False, default='Member')
    position = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    group_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    requested_role = serializers.CharField(write_only=True, required=False, default='')
    auth_key = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['name', 'email', 'password', 'category', 'position', 'group_id', 'requested_role', 'auth_key']

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def validate(self, attrs):
        init_data = getattr(self, 'initial_data', {}) or {}
        cat_explicit = init_data.get('category')
        category = attrs.get('category') or (cat_explicit.strip() if cat_explicit else 'Member')
        group_id = attrs.get('group_id')
        position = attrs.get('position', '')
        if position:
            position = position.strip()
        auth_key = attrs.get('auth_key', '').strip()

        cat_lower = category.lower() if category else 'member'
        if cat_lower in ('member', 'members', ''):
            attrs['normalized_category'] = 'Member'
            # If user explicitly specifies category in registration form, group_id is required
            if cat_explicit and not group_id:
                raise serializers.ValidationError({'group_id': 'Please select a group for your Member registration.'})

            if group_id:
                # pyrefly: ignore[missing-attribute]
                if not Group.objects.filter(group_id=group_id).exists():
                    raise serializers.ValidationError({'group_id': 'Selected group does not exist.'})
            else:
                # pyrefly: ignore[missing-attribute]
                first_group = Group.objects.first()
                if first_group:
                    attrs['group_id'] = first_group.group_id
            attrs['position'] = None

        elif cat_lower in ('official', 'officials'):
            attrs['normalized_category'] = 'Official'
            if not position or position not in OFFICIAL_POSITIONS:
                raise serializers.ValidationError({'position': f'Please select a valid Official position: {", ".join(OFFICIAL_POSITIONS)}.'})
            attrs['group_id'] = None

        elif cat_lower in ('core', 'core lead', 'core leads'):
            attrs['normalized_category'] = 'Core'
            if not group_id:
                raise serializers.ValidationError({'group_id': 'Please select an associated group for Core Lead registration.'})
            try:
                # pyrefly: ignore[missing-attribute]
                group_obj = Group.objects.get(group_id=group_id)
            # pyrefly: ignore[missing-attribute]
            except Group.DoesNotExist:
                raise serializers.ValidationError({'group_id': 'Selected group does not exist.'})
            if not position:
                attrs['position'] = f"{group_obj.name} Lead"

        elif cat_lower in ('director', 'director of core operations', 'director of operations'):
            attrs['normalized_category'] = 'Director of Core Operations'
            attrs['group_id'] = None
            attrs['position'] = 'Director of Operations'
            # Executive Director key verification or safe pending status
            if auth_key in ('TechNeekX@Director2026', 'TechNeekX@Founder2026', 'TechNeekX@Admin2026'):
                attrs['status'] = 'Active'
            else:
                attrs['status'] = 'Pending'

        elif cat_lower in ('founder',):
            attrs['normalized_category'] = 'Founder'
            attrs['group_id'] = None
            attrs['position'] = 'Founder'
            # Strict security invariant: public self-registration as Founder requires master setup key
            if auth_key not in ('TechNeekX@Founder2026', 'FOUNDER_SETUP_KEY'):
                raise serializers.ValidationError({
                    'auth_key': 'Unauthorized: Public self-registration as Founder is strictly restricted. Valid Administrative Setup Key required.'
                })
            attrs['status'] = 'Active'

        else:
            raise serializers.ValidationError({'category': 'Please select a valid category: Founder, Officials, Director of Core Operations, Core Leads, or Members.'})

        return attrs

    def create(self, validated_data):
        norm_cat = validated_data['normalized_category']
        position = validated_data.get('position')
        group_id = validated_data.get('group_id')
        name = validated_data['name'].strip()
        email = validated_data['email']
        password = validated_data['password']

        group_obj = None
        team_obj = None
        if group_id:
            try:
                group_obj = Group.objects.select_related('team').get(group_id=group_id)
                team_obj = group_obj.team
            # pyrefly: ignore[missing-attribute]
            except Group.DoesNotExist:
                pass

        if norm_cat == 'Member':
            role, _ = Role.objects.get_or_create(
                name='Member',
                defaults={'description': 'Completes assigned tasks and submits proof for review'}
            )
            user = User.objects.create(
                name=name,
                email=email,
                role=role,
                group=group_obj,
                team=team_obj,
                position=None,
                status='Active'
            )
        elif norm_cat == 'Official':
            # Preserve the Officials authorization category
            role, _ = Role.objects.get_or_create(
                name='Official',
                defaults={'description': 'Administrative authority and organization-wide governance'}
            )
            # SECURITY INVARIANT: Privileged roles cannot be self-assigned; created as Pending
            user = User.objects.create(
                name=name,
                email=email,
                role=role,
                group=None,
                team=None,
                position=position,
                status='Pending'
            )
        elif norm_cat == 'Core':
            role, _ = Role.objects.get_or_create(
                name='Core Team Lead',
                defaults={'description': 'Group management and member submission reviews'}
            )
            # SECURITY INVARIANT: Privileged roles cannot be self-assigned; created as Pending
            user = User.objects.create(
                name=name,
                email=email,
                role=role,
                group=group_obj,
                team=team_obj,
                position=position,
                status='Pending'
            )
        elif norm_cat == 'Director of Core Operations':
            role, _ = Role.objects.get_or_create(
                name='Director of Core Operations',
                defaults={'description': 'Inspection-only monitoring, overdue warnings, revised deadlines'}
            )
            user_status = validated_data.get('status', 'Pending')
            user = User.objects.create(
                name=name,
                email=email,
                role=role,
                group=None,
                team=team_obj,
                position='Director of Operations',
                status=user_status
            )
        elif norm_cat == 'Founder':
            role, _ = Role.objects.get_or_create(
                name='Founder',
                defaults={'description': 'Full platform oversight, group governance, user management, official announcements'}
            )
            user = User.objects.create(
                name=name,
                email=email,
                role=role,
                group=None,
                team=None,
                position='Founder',
                status='Active'
            )
        else:
            raise serializers.ValidationError({'category': f"Invalid category '{norm_cat}'."})

        user.set_password(password)
        user.save()
        return user


class UserAdminCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, default='Techneekx@2026', min_length=6)
    role_id = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), source='role', required=False, allow_null=True)
    role_name = serializers.CharField(write_only=True, required=False)
    team_id = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), source='team', required=False, allow_null=True)
    group_id = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all(), source='group', required=False, allow_null=True)
    position = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.ChoiceField(choices=User.STATUS_CHOICES, default='Active')

    class Meta:
        model = User
        fields = ['user_id', 'name', 'email', 'password', 'role_id', 'role_name', 'team_id', 'group_id', 'position', 'status']

    def to_internal_value(self, data):
        data_copy = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'role' in data_copy and 'role_id' not in data_copy and isinstance(data_copy['role'], int):
            data_copy['role_id'] = data_copy.pop('role')
        if 'team' in data_copy and 'team_id' not in data_copy:
            data_copy['team_id'] = data_copy.pop('team')
        if 'group' in data_copy and 'group_id' not in data_copy:
            data_copy['group_id'] = data_copy.pop('group')
        return super().to_internal_value(data_copy)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def validate(self, attrs):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        role = attrs.get('role')
        role_name = attrs.pop('role_name', None)

        if not role and role_name:
            # pyrefly: ignore[missing-attribute]
            role = Role.objects.filter(name__iexact=role_name.strip()).first()
            if not role:
                raise serializers.ValidationError({'role_name': f"Role '{role_name}' does not exist."})
            attrs['role'] = role

        if not attrs.get('role'):
            raise serializers.ValidationError({'role_id': "Either role_id or role_name is required."})

        # Only Founder can provision another Founder account
        if attrs['role'].name == 'Founder':
            if not request_user or not is_founder(request_user):
                raise serializers.ValidationError({'role_id': "Only a Founder can provision another Founder account."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password', 'Techneekx@2026')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email', '').strip().lower()
        password = attrs.get('password', '')

        try:
            user = User.objects.select_related('role', 'team', 'group').get(email__iexact=email)
        # pyrefly: ignore[missing-attribute]
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
        refresh['role_tier'] = get_role_tier(user.role.name) if user.role else 4
        refresh['hierarchy_level'] = user.hierarchy_level
        refresh['category'] = user.category
        refresh['position'] = user.position or ''
        refresh['team_id'] = user.team.team_id if user.team else None
        refresh['group_id'] = user.group.group_id if user.group else None

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
    group_id = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        source='group',
        allow_null=True,
        required=False
    )
    position = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ['name', 'role_id', 'team_id', 'group_id', 'position', 'status']

    def to_internal_value(self, data):
        data_copy = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'role' in data_copy and 'role_id' not in data_copy and isinstance(data_copy['role'], int):
            data_copy['role_id'] = data_copy.pop('role')
        if 'team' in data_copy and 'team_id' not in data_copy:
            data_copy['team_id'] = data_copy.pop('team')
        if 'group' in data_copy and 'group_id' not in data_copy:
            data_copy['group_id'] = data_copy.pop('group')
        return super().to_internal_value(data_copy)

    def validate_role_id(self, role):
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)

        # Only Tier 1 users (Founder, Chairman, MD) can assign Tier 1 roles
        if get_role_tier(role.name) == 1:
            if not request_user or get_role_tier(request_user.role.name) > 1:
                raise serializers.ValidationError("Only Founder or Executive Admin can assign Tier 1 roles.")
        return role


class DemoAccountSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()
    role = serializers.CharField(source='role.name', read_only=True)
    tier = serializers.SerializerMethodField()
    hierarchy_level = serializers.IntegerField(read_only=True)
    category = serializers.CharField(read_only=True)
    group_id = serializers.IntegerField(source='group.group_id', read_only=True, default=None)
    group_name = serializers.CharField(source='group.name', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    description = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'email',
            'name',
            'label',
            'role',
            'position',
            'group_id',
            'group_name',
            'team_name',
            'tier',
            'hierarchy_level',
            'category',
            'description'
        ]
        read_only_fields = fields

    def get_tier(self, obj):
        return obj.hierarchy_level

    def get_label(self, obj):
        group_part = f" - {obj.group.name}" if obj.group else ""
        title_part = obj.position or (obj.role.name if obj.role else "Member")
        return f"{obj.name} ({title_part}{group_part})"

    def get_description(self, obj):
        cat = obj.category
        if cat == 'Founder':
            return 'Full platform oversight, group governance, user management, official announcements'
        elif cat == 'Officials':
            return 'Org-wide review privileges, task assignment, official announcements'
        elif cat == 'Director of Core Operations':
            return 'Inspection-only monitoring, overdue warnings, revised deadlines'
        elif cat == 'Core Leads':
            return 'Delegate subtasks to group members, review submissions, group reporting'
        else:
            return 'View assigned tasks, submit GitHub links & proof screenshots, complete corrections'

