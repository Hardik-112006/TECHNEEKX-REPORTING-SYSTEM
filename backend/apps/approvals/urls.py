from django.urls import path
from apps.approvals.views import (
    ApprovalWorkflowListView,
    ApprovalWorkflowDetailView,
    WorkflowDecisionView,
    WorkflowResubmitView
)

urlpatterns = [
    path('', ApprovalWorkflowListView.as_view(), name='approval-workflow-list'),
    path('<int:workflow_id>/', ApprovalWorkflowDetailView.as_view(), name='approval-workflow-detail'),
    path('<int:workflow_id>/decision/', WorkflowDecisionView.as_view(), name='approval-workflow-decision'),
    path('<int:workflow_id>/resubmit/', WorkflowResubmitView.as_view(), name='approval-workflow-resubmit'),
]
