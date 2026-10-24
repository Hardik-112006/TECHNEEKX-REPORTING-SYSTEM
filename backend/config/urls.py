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
    # Official Documents, MoUs & Partnerships API
    path('api/documents/', include('apps.documents.urls')),
    # Advanced Analytics & Report Exports API
    path('api/analytics/', include('apps.analytics.urls')),
    # Automated Reminders & Escalations API
    path('api/notifications/', include('apps.notifications.urls')),
    # Multi-Level Approval Workflows API
    path('api/approvals/', include('apps.approvals.urls')),
]
