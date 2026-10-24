import re
from rest_framework import serializers
from apps.submissions.models import TaskProof, Review
from apps.accounts.serializers import UserSummarySerializer

URL_REGEX = re.compile(r'^https?://[^\s/$.?#].[^\s]*$', re.IGNORECASE)

class TaskProofSerializer(serializers.ModelSerializer):
    submitted_by = UserSummarySerializer(read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)

    class Meta:
        model = TaskProof
        fields = [
            'proof_id', 'task_id', 'task_title', 'submitted_by',
            'github_link', 'screenshots', 'description', 'submitted_at'
        ]
        read_only_fields = ['proof_id', 'task_id', 'task_title', 'submitted_by', 'submitted_at']


class TaskProofCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskProof
        fields = ['github_link', 'screenshots', 'description']

    def validate_github_link(self, value):
        if value:
            val = value.strip()
            if not URL_REGEX.match(val):
                raise serializers.ValidationError("GitHub link must be a valid HTTP or HTTPS URL.")
            return val
        return value

    def validate_screenshots(self, value):
        if value:
            val = value.strip()
            # If comma-separated or single URL, validate scheme
            for url_part in [u.strip() for u in val.split(',') if u.strip()]:
                if not URL_REGEX.match(url_part):
                    raise serializers.ValidationError(f"Screenshot URL '{url_part}' must be a valid HTTP or HTTPS URL.")
            return val
        return value

    def validate(self, attrs):
        github = attrs.get('github_link')
        screenshots = attrs.get('screenshots')
        desc = attrs.get('description')

        if not any([github and github.strip(), screenshots and screenshots.strip(), desc and desc.strip()]):
            raise serializers.ValidationError(
                "You must provide at least one evidence field: GitHub URL, screenshot link(s), or a detailed description."
            )
        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSummarySerializer(read_only=True)
    task_title = serializers.CharField(source='task.title', read_only=True)

    class Meta:
        model = Review
        fields = [
            'review_id', 'task_id', 'task_title', 'proof_id',
            'reviewer', 'decision', 'feedback', 'reviewed_at'
        ]
        read_only_fields = ['review_id', 'task_id', 'task_title', 'reviewer', 'reviewed_at']


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['decision', 'feedback']

    def validate_decision(self, value):
        if value not in ('Approved', 'Changes Requested'):
            raise serializers.ValidationError("Decision must be either 'Approved' or 'Changes Requested'.")
        return value

    def validate(self, attrs):
        decision = attrs.get('decision')
        feedback = attrs.get('feedback', '')

        if decision == 'Changes Requested' and (not feedback or not feedback.strip()):
            raise serializers.ValidationError(
                {"feedback": "Feedback is required when requesting changes to explain what needs correction."}
            )
        return attrs
