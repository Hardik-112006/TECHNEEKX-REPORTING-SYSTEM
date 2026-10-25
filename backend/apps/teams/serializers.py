from rest_framework import serializers
from apps.teams.models import Team, Group
from apps.accounts.models import User
from apps.accounts.serializers import UserSummarySerializer

class GroupSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['group_id', 'name', 'team', 'team_name', 'description', 'members_count']
        read_only_fields = ['group_id', 'team_name', 'members_count']

    def get_members_count(self, obj):
        return obj.group_members.count()


class TeamSerializer(serializers.ModelSerializer):
    parent_team_name = serializers.CharField(source='parent_team.name', read_only=True, default=None)
    members_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    groups_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            'team_id', 'name', 'type', 'parent_team', 'parent_team_name',
            'description', 'members_count', 'member_count', 'groups_count'
        ]
        read_only_fields = ['team_id', 'parent_team_name', 'members_count', 'member_count', 'groups_count']

    def get_members_count(self, obj):
        return obj.members.count()

    def get_member_count(self, obj):
        return obj.members.count()

    def get_groups_count(self, obj):
        return obj.groups.count()


class TeamDetailSerializer(serializers.ModelSerializer):
    parent_team_name = serializers.CharField(source='parent_team.name', read_only=True, default=None)
    members = UserSummarySerializer(many=True, read_only=True)
    groups = GroupSerializer(many=True, read_only=True)
    sub_teams = TeamSerializer(many=True, read_only=True)
    members_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            'team_id', 'name', 'type', 'parent_team', 'parent_team_name',
            'description', 'members', 'groups', 'sub_teams',
            'members_count', 'member_count'
        ]
        read_only_fields = ['team_id', 'parent_team_name', 'members', 'groups', 'sub_teams', 'members_count', 'member_count']

    def get_members_count(self, obj):
        return obj.members.count()

    def get_member_count(self, obj):
        return obj.members.count()


class MemberActionSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        try:
            user = User.objects.get(user_id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError(f"User with user_id={value} does not exist.")
        return value
