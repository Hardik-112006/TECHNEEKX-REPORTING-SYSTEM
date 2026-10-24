from django.urls import path
from apps.scoring.views import LeaderboardView

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
]
