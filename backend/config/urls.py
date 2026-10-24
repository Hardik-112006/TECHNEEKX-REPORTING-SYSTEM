from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # Accounts, Auth, Roles & Users API
    path('api/', include('apps.accounts.urls')),
    # Teams & Groups API
    path('api/', include('apps.teams.urls')),
    # Tasks & Workflow API
    path('api/', include('apps.tasks.urls')),
    # Submissions & Reviews API
    path('api/', include('apps.submissions.urls')),
    # Scoring & Leaderboard API
    path('api/', include('apps.scoring.urls')),
    # Announcements API
    path('api/', include('apps.announcements.urls')),
    # Activity & Audit History API
    path('api/', include('apps.activity.urls')),
    # Career Profile & ATS Resume API
    path('api/career/', include('apps.career.urls')),
    # Hackathons, Certificates, Leaderboards & Recruitment API
    path('api/hackathons/', include('apps.hackathons.urls')),
]
