from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.http import HttpResponse

from apps.accounts.permissions import user_has_tier
from apps.analytics.services import (
    calculate_analytics_overview,
    export_tasks_csv,
    export_teams_csv,
    export_members_csv,
    generate_performance_pdf_report
)

class AnalyticsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        days = request.query_params.get('days', 30)
        start_date = request.query_params.get('start_date', None)
        end_date = request.query_params.get('end_date', None)
        team_id = request.query_params.get('team_id', None)

        data = calculate_analytics_overview(
            user=request.user,
            days=days,
            start_date=start_date,
            end_date=end_date,
            team_id=team_id
        )
        return Response(data, status=status.HTTP_200_OK)


class ExportTasksCsvView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        team_id = request.query_params.get('team_id', None)
        status_filter = request.query_params.get('status', None)

        csv_content = export_tasks_csv(request.user, team_id, status_filter)
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="techneekx_tasks_export.csv"'
        return response


class ExportTeamsCsvView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Lead or Official only
        if not user_has_tier(request.user, 3):
            return Response(
                {"error": "Only Core Leads and Officials can export team performance metrics."},
                status=status.HTTP_403_FORBIDDEN
            )

        csv_content = export_teams_csv(request.user)
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="techneekx_teams_performance.csv"'
        return response


class ExportMembersCsvView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        csv_content = export_members_csv(request.user)
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="techneekx_members_contributions.csv"'
        return response


class ExportPdfReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        days = request.query_params.get('days', 30)
        team_id = request.query_params.get('team_id', None)

        try:
            pdf_bytes = generate_performance_pdf_report(request.user, days=days, team_id=team_id)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="techneekx_performance_report.pdf"'
            return response
        except Exception as e:
            return Response(
                {"error": f"Failed to generate PDF report: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
