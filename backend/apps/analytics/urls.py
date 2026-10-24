from django.urls import path
from apps.analytics.views import (
    AnalyticsOverviewView,
    ExportTasksCsvView,
    ExportTeamsCsvView,
    ExportMembersCsvView,
    ExportPdfReportView
)

urlpatterns = [
    path('overview/', AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('export/tasks/', ExportTasksCsvView.as_view(), name='analytics-export-tasks'),
    path('export/teams/', ExportTeamsCsvView.as_view(), name='analytics-export-teams'),
    path('export/members/', ExportMembersCsvView.as_view(), name='analytics-export-members'),
    path('export/pdf/', ExportPdfReportView.as_view(), name='analytics-export-pdf'),
]
