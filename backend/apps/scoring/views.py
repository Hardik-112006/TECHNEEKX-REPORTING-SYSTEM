from rest_framework import generics, permissions
from apps.scoring.models import Performance
from apps.scoring.serializers import PerformanceSerializer

class LeaderboardView(generics.ListAPIView):
    """
    Returns live leaderboard ranked by points descending based on real database records.
    """
    queryset = Performance.objects.select_related('user', 'user__role', 'user__team').filter(user__status='Active').order_by('-points', 'rank', 'user_id')
    serializer_class = PerformanceSerializer
    permission_classes = [permissions.IsAuthenticated]
