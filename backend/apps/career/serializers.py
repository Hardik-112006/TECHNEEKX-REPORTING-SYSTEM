from rest_framework import serializers
from apps.career.models import (
    CareerProfile,
    Education,
    PortfolioProject,
    Achievement,
    ContributionHighlight,
    ResumeConfiguration
)

class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = [
            'id', 'institution', 'degree', 'field_of_study',
            'graduation_year', 'grade', 'description'
        ]

    def validate_graduation_year(self, value):
        if value < 1970 or value > 2040:
            raise serializers.ValidationError("Please provide a valid graduation year.")
        return value


class PortfolioProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioProject
        fields = [
            'id', 'title', 'description', 'technologies',
            'github_link', 'live_url', 'is_featured', 'include_in_resume', 'order'
        ]

    def validate_title(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Project title is required.")
        return val


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = [
            'id', 'title', 'issuer', 'issue_date',
            'credential_url', 'description', 'include_in_resume'
        ]

    def validate_title(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Achievement title is required.")
        return val


class ContributionHighlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionHighlight
        fields = [
            'id', 'task', 'title', 'description',
            'points_earned', 'verified_at', 'include_in_resume'
        ]
        read_only_fields = ['id', 'task', 'points_earned', 'verified_at']


class ResumeConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeConfiguration
        fields = [
            'id', 'template_style', 'custom_headline',
            'include_summary', 'include_education', 'include_projects',
            'include_skills', 'include_achievements', 'include_community_contributions'
        ]


class CareerProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.user_id', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    educations = EducationSerializer(many=True, read_only=True)
    projects = PortfolioProjectSerializer(many=True, read_only=True)
    achievements = AchievementSerializer(many=True, read_only=True)
    contributions = ContributionHighlightSerializer(many=True, read_only=True)
    resume_config = ResumeConfigurationSerializer(read_only=True)

    class Meta:
        model = CareerProfile
        fields = [
            'id', 'user_id', 'user_name', 'user_email',
            'headline', 'target_role', 'target_company', 'experience_years',
            'bio', 'skills', 'phone', 'linkedin_url', 'github_url', 'portfolio_url',
            'location', 'visibility', 'shareable_slug',
            'educations', 'projects', 'achievements', 'contributions', 'resume_config',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'user_name', 'user_email', 'shareable_slug', 'created_at', 'updated_at']


class CareerProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareerProfile
        fields = [
            'headline', 'target_role', 'target_company', 'experience_years',
            'bio', 'skills', 'phone', 'linkedin_url', 'github_url', 'portfolio_url',
            'location', 'visibility'
        ]

    def validate_skills(self, value):
        if isinstance(value, str):
            return [s.strip() for s in value.split(',') if s.strip()]
        elif isinstance(value, list):
            return [str(s).strip() for s in value if str(s).strip()]
        return []


class PublicCareerProfileSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    educations = EducationSerializer(many=True, read_only=True)
    projects = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()
    contributions = serializers.SerializerMethodField()

    class Meta:
        model = CareerProfile
        fields = [
            'user_name', 'headline', 'target_role', 'target_company',
            'bio', 'skills', 'linkedin_url', 'github_url', 'portfolio_url',
            'location', 'educations', 'projects', 'achievements', 'contributions'
        ]

    def get_projects(self, obj):
        projects = obj.projects.filter(is_featured=True)
        if not projects.exists():
            projects = obj.projects.all()[:6]
        return PortfolioProjectSerializer(projects, many=True).data

    def get_achievements(self, obj):
        return AchievementSerializer(obj.achievements.all(), many=True).data

    def get_contributions(self, obj):
        return ContributionHighlightSerializer(obj.contributions.filter(include_in_resume=True), many=True).data
