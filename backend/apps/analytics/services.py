import io
import csv
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, Avg, Sum
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

from apps.accounts.models import User
from apps.accounts.permissions import get_role_tier
from apps.teams.models import Team
from apps.tasks.models import Task
from apps.submissions.models import TaskProof, Review
from apps.scoring.models import Performance
from apps.hackathons.models import Hackathon, Participant, CertificateSubmission, CandidateShortlist

def get_analytics_date_bounds(days=30, start_date_str=None, end_date_str=None):
    now = timezone.now()
    if start_date_str and end_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
            end_dt = timezone.make_aware(datetime.combine(end_date, datetime.max.time()))
            return start_dt, end_dt
        except Exception:
            pass
    try:
        days = int(days)
    except (ValueError, TypeError):
        days = 30
    start_dt = now - timedelta(days=days)
    end_dt = now
    return start_dt, end_dt


def get_scoped_tasks_and_teams(user, team_id=None):
    """
    Returns (scoped_tasks, scoped_teams, user_tier) based on role tier.
    Tier 1-2: Org-wide.
    Tier 3: User's led/member team.
    Tier 5: User's assigned tasks & team tasks.
    """
    user_tier = get_role_tier(user.role.name) if (user.is_authenticated and user.role) else 5
    tasks_qs = Task.objects.select_related('created_by', 'assigned_to', 'team').all()
    teams_qs = Team.objects.prefetch_related('members').all()

    if user_tier <= 2:
        # Org-wide access
        if team_id:
            tasks_qs = tasks_qs.filter(team_id=team_id)
            teams_qs = teams_qs.filter(team_id=team_id)
    elif user_tier == 3:
        allowed_team_ids = [user.team_id] if user.team_id else []
        if team_id and int(team_id) in allowed_team_ids:
            tasks_qs = tasks_qs.filter(team_id=team_id)
            teams_qs = teams_qs.filter(team_id=team_id)
        else:
            tasks_qs = tasks_qs.filter(Q(team_id__in=allowed_team_ids) | Q(assigned_to=user) | Q(created_by=user))
            teams_qs = teams_qs.filter(team_id__in=allowed_team_ids)
    else:
        allowed_team_ids = [user.team_id] if user.team_id else []
        tasks_qs = tasks_qs.filter(Q(assigned_to=user) | Q(team_id__in=allowed_team_ids))
        teams_qs = teams_qs.filter(team_id__in=allowed_team_ids)

    return tasks_qs, teams_qs, user_tier


def calculate_analytics_overview(user, days=30, start_date=None, end_date=None, team_id=None):
    start_dt, end_dt = get_analytics_date_bounds(days, start_date, end_date)
    now = timezone.now()

    tasks_qs, teams_qs, user_tier = get_scoped_tasks_and_teams(user, team_id)
    date_filtered_tasks = tasks_qs.filter(created_at__gte=start_dt, created_at__lte=end_dt)

    total_tasks = tasks_qs.count()
    approved_tasks = tasks_qs.filter(status='Approved').count()
    in_progress_tasks = tasks_qs.filter(status='In Progress').count()
    submitted_tasks = tasks_qs.filter(status='Submitted').count()
    assigned_tasks = tasks_qs.filter(status='Assigned').count()
    changes_requested_tasks = tasks_qs.filter(status='Changes Requested').count()

    completion_rate = round((approved_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

    # Overdue tasks
    overdue_qs = tasks_qs.filter(
        deadline__lt=now,
        status__in=['Assigned', 'In Progress', 'Changes Requested']
    )
    overdue_count = overdue_qs.count()

    # Pending reviews analysis
    pending_submissions = tasks_qs.filter(status='Submitted')
    pending_count = pending_submissions.count()

    # Pending aging breakdown (<24h, 24-48h, >48h)
    recent_threshold = now - timedelta(hours=24)
    moderate_threshold = now - timedelta(hours=48)

    pending_under_24h = 0
    pending_24_to_48h = 0
    pending_over_48h = 0

    urgent_pending_items = []
    for task in pending_submissions.select_related('assigned_to', 'team')[:20]:
        latest_proof = task.proofs.order_by('-submitted_at').first()
        sub_time = latest_proof.submitted_at if latest_proof else task.created_at
        age_hours = (now - sub_time).total_seconds() / 3600.0

        if age_hours <= 24:
            pending_under_24h += 1
        elif age_hours <= 48:
            pending_24_to_48h += 1
        else:
            pending_over_48h += 1

        urgent_pending_items.append({
            'task_id': task.task_id,
            'title': task.title,
            'team_name': task.team.name if task.team else 'Unassigned Team',
            'assigned_name': task.assigned_to.name if task.assigned_to else 'Unassigned',
            'submitted_at': sub_time.isoformat(),
            'age_hours': round(age_hours, 1),
            'priority': 'Urgent' if age_hours > 48 else 'Normal'
        })

    # Task completion trends (daily aggregation for the period)
    # For chart rendering: group approved reviews by date
    trend_days = max(1, min((end_dt - start_dt).days + 1, 90))
    trend_map = {}
    cur_date = start_dt.date()
    end_date_only = end_dt.date()
    while cur_date <= end_date_only:
        trend_map[cur_date.strftime('%Y-%m-%d')] = {'date': cur_date.strftime('%d %b'), 'created': 0, 'completed': 0}
        cur_date += timedelta(days=1)

    for t in date_filtered_tasks.values('created_at', 'status'):
        d_str = t['created_at'].strftime('%Y-%m-%d')
        if d_str in trend_map:
            trend_map[d_str]['created'] += 1
            if t['status'] == 'Approved':
                trend_map[d_str]['completed'] += 1

    completion_trends = list(trend_map.values())

    # Team Performance Comparisons
    team_performance = []
    for tm in teams_qs[:20]:
        t_tasks = tasks_qs.filter(team=tm)
        t_total = t_tasks.count()
        t_approved = t_tasks.filter(status='Approved').count()
        t_overdue = t_tasks.filter(deadline__lt=now, status__in=['Assigned', 'In Progress', 'Changes Requested']).count()
        t_rate = round((t_approved / t_total * 100), 1) if t_total > 0 else 0.0

        team_performance.append({
            'team_id': tm.team_id,
            'name': tm.name,
            'team_name': tm.name,
            'total_tasks': t_total,
            'approved_tasks': t_approved,
            'overdue_tasks': t_overdue,
            'completion_rate_percent': t_rate,
            'members_count': tm.members.count()
        })

    # Member contribution analytics
    member_contributions = []
    user_scores_qs = Performance.objects.select_related('user', 'user__role').order_by('-points')[:15]
    for us in user_scores_qs:
        m_tasks = Task.objects.filter(assigned_to=us.user)
        m_total = m_tasks.count()
        m_approved = m_tasks.filter(status='Approved').count()
        m_rate = round((m_approved / m_total * 100), 1) if m_total > 0 else 0.0
        member_contributions.append({
            'user_id': us.user.user_id,
            'name': us.user.name,
            'email': us.user.email,
            'role': us.user.role.name if us.user.role else 'Member',
            'total_points': us.points,
            'tasks_assigned': m_total,
            'tasks_approved': m_approved,
            'approval_rate_percent': m_rate
        })

    # Hackathon & Recruitment Stats
    hackathon_count = Hackathon.objects.count()
    participant_count = Participant.objects.count()
    cert_submitted = CertificateSubmission.objects.count()
    cert_verified = CertificateSubmission.objects.filter(verification_status='Approved').count()
    cert_rejected = CertificateSubmission.objects.filter(verification_status='Rejected').count()
    cert_pending = CertificateSubmission.objects.filter(verification_status='Pending').count()

    shortlist_total = CandidateShortlist.objects.count()
    shortlist_accepted = CandidateShortlist.objects.filter(decision='Accepted').count()
    shortlist_rejected = CandidateShortlist.objects.filter(decision='Rejected').count()
    shortlist_under_review = CandidateShortlist.objects.filter(decision='Under Review').count()

    recruitment_conversion = round((shortlist_accepted / shortlist_total * 100), 1) if shortlist_total > 0 else 0.0

    return {
        'summary': {
            'total_tasks': total_tasks,
            'approved_tasks': approved_tasks,
            'in_progress_tasks': in_progress_tasks,
            'submitted_tasks': submitted_tasks,
            'assigned_tasks': assigned_tasks,
            'changes_requested_tasks': changes_requested_tasks,
            'completion_rate_percent': completion_rate,
            'overdue_tasks_count': overdue_count,
            'pending_reviews_count': pending_count,
            'date_range': {
                'start_date': start_dt.strftime('%Y-%m-%d'),
                'end_date': end_dt.strftime('%Y-%m-%d'),
                'days': days
            }
        },
        'trends': completion_trends,
        'team_performance': team_performance,
        'member_contributions': member_contributions,
        'pending_analysis': {
            'total_pending': pending_count,
            'under_24h': pending_under_24h,
            'from_24_to_48h': pending_24_to_48h,
            'over_48h': pending_over_48h,
            'urgent_items': urgent_pending_items
        },
        'hackathon_analytics': {
            'total_hackathons': hackathon_count,
            'total_participants': participant_count,
            'certificates': {
                'submitted': cert_submitted,
                'verified': cert_verified,
                'rejected': cert_rejected,
                'pending': cert_pending
            },
            'recruitment': {
                'total_shortlisted': shortlist_total,
                'accepted': shortlist_accepted,
                'rejected': shortlist_rejected,
                'under_review': shortlist_under_review,
                'conversion_rate_percent': recruitment_conversion
            }
        }
    }


def export_tasks_csv(user, team_id=None, status_filter=None):
    tasks_qs, _, _ = get_scoped_tasks_and_teams(user, team_id)
    if status_filter:
        tasks_qs = tasks_qs.filter(status=status_filter)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Task ID', 'Title', 'Status', 'Team', 'Assigned To Name',
        'Assigned To Email', 'Created By', 'Deadline', 'Created At'
    ])

    for t in tasks_qs.select_related('assigned_to', 'created_by', 'team'):
        writer.writerow([
            t.task_id,
            t.title,
            t.status,
            t.team.name if t.team else 'Unassigned',
            t.assigned_to.name if t.assigned_to else 'Unassigned',
            t.assigned_to.email if t.assigned_to else '',
            t.created_by.name if t.created_by else 'System',
            t.deadline.strftime('%Y-%m-%d %H:%M') if t.deadline else 'None',
            t.created_at.strftime('%Y-%m-%d %H:%M') if t.created_at else ''
        ])

    return output.getvalue()


def export_teams_csv(user):
    _, teams_qs, _ = get_scoped_tasks_and_teams(user)
    now = timezone.now()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Team ID', 'Team Name', 'Members Count', 'Total Tasks',
        'Approved Tasks', 'Overdue Tasks', 'Completion Rate (%)'
    ])

    for tm in teams_qs:
        t_tasks = Task.objects.filter(team=tm)
        total = t_tasks.count()
        approved = t_tasks.filter(status='Approved').count()
        overdue = t_tasks.filter(deadline__lt=now, status__in=['Assigned', 'In Progress', 'Changes Requested']).count()
        rate = round((approved / total * 100), 1) if total > 0 else 0.0

        writer.writerow([
            tm.team_id,
            tm.name,
            tm.members.count(),
            total,
            approved,
            overdue,
            rate
        ])

    return output.getvalue()


def export_members_csv(user):
    user_tier = get_role_tier(user.role.name) if (user.is_authenticated and user.role) else 5
    if user_tier > 3:
        # Non-leads can only view their own stats
        users_qs = User.objects.filter(user_id=user.user_id)
    else:
        users_qs = User.objects.select_related('role').all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'User ID', 'Name', 'Email', 'Role', 'Status',
        'Total Points', 'Assigned Tasks', 'Approved Tasks', 'Approval Rate (%)'
    ])

    scores = {us.user_id: us.points for us in Performance.objects.all()}

    for u in users_qs:
        m_tasks = Task.objects.filter(assigned_to=u)
        m_total = m_tasks.count()
        m_approved = m_tasks.filter(status='Approved').count()
        m_rate = round((m_approved / m_total * 100), 1) if m_total > 0 else 0.0
        points = scores.get(u.user_id, 0)

        writer.writerow([
            u.user_id,
            u.name,
            u.email,
            u.role.name if u.role else 'Member',
            u.status,
            points,
            m_total,
            m_approved,
            m_rate
        ])

    return output.getvalue()


def generate_performance_pdf_report(user, days=30, team_id=None) -> bytes:
    """
    Generates a formal TechNeekX Operations Executive PDF Report.
    """
    data = calculate_analytics_overview(user, days=days, team_id=team_id)
    summary = data['summary']

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'RepTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )

    sub_style = ParagraphStyle(
        'RepSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#635BFF'),
        alignment=1
    )

    section_heading = ParagraphStyle(
        'SecHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=14,
        spaceAfter=6
    )

    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    bold_cell_style = ParagraphStyle(
        'BoldCellText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A')
    )

    elements = []

    elements.append(Paragraph("TECHNEEKX OPERATIONS EXECUTIVE PERFORMANCE REPORT", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        f"Generated on {timezone.now().strftime('%d %B %Y %H:%M UTC')} | Requested by {user.name} ({user.role.name if user.role else 'Member'})",
        sub_style
    ))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#635BFF'), spaceAfter=14))

    # Executive KPI Summary Table
    elements.append(Paragraph("1. EXECUTIVE KPI SUMMARY", section_heading))
    kpi_data = [
        [
            Paragraph("<b>Total Tasks Tracked</b>", cell_style), Paragraph(str(summary['total_tasks']), bold_cell_style),
            Paragraph("<b>Approved & Verified</b>", cell_style), Paragraph(str(summary['approved_tasks']), bold_cell_style)
        ],
        [
            Paragraph("<b>Completion Rate</b>", cell_style), Paragraph(f"{summary['completion_rate_percent']}%", bold_cell_style),
            Paragraph("<b>Overdue Tasks</b>", cell_style), Paragraph(str(summary['overdue_tasks_count']), bold_cell_style)
        ],
        [
            Paragraph("<b>Pending Reviews</b>", cell_style), Paragraph(str(summary['pending_reviews_count']), bold_cell_style),
            Paragraph("<b>Tasks In Progress</b>", cell_style), Paragraph(str(summary['in_progress_tasks']), bold_cell_style)
        ]
    ]

    t_kpi = Table(kpi_data, colWidths=[130, 140, 130, 140])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_kpi)

    # Team Breakdown Table
    elements.append(Paragraph("2. TEAM PERFORMANCE BREAKDOWN", section_heading))
    team_rows = [
        [
            Paragraph("<b>Team Name</b>", bold_cell_style),
            Paragraph("<b>Members</b>", bold_cell_style),
            Paragraph("<b>Tasks</b>", bold_cell_style),
            Paragraph("<b>Approved</b>", bold_cell_style),
            Paragraph("<b>Overdue</b>", bold_cell_style),
            Paragraph("<b>Completion %</b>", bold_cell_style)
        ]
    ]

    for tm in data['team_performance'][:10]:
        team_rows.append([
            Paragraph(tm['name'], cell_style),
            Paragraph(str(tm['members_count']), cell_style),
            Paragraph(str(tm['total_tasks']), cell_style),
            Paragraph(str(tm['approved_tasks']), cell_style),
            Paragraph(str(tm['overdue_tasks']), cell_style),
            Paragraph(f"{tm['completion_rate_percent']}%", cell_style)
        ])

    if len(team_rows) == 1:
        team_rows.append([Paragraph("No teams configured", cell_style)] + [Paragraph("-", cell_style)] * 5)

    t_teams = Table(team_rows, colWidths=[150, 70, 70, 70, 80, 100])
    t_teams.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EEF2FF')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_teams)

    # Pending Review Bottleneck Table
    elements.append(Paragraph("3. PENDING REVIEW AGING & BOTTLENECK ANALYSIS", section_heading))
    pending_info = data['pending_analysis']
    p_aging_data = [
        [
            Paragraph("<b>Aging Window</b>", bold_cell_style),
            Paragraph("<b>Submissions Count</b>", bold_cell_style),
            Paragraph("<b>Action Recommended</b>", bold_cell_style)
        ],
        [
            Paragraph("< 24 Hours (Fresh)", cell_style),
            Paragraph(str(pending_info['under_24h']), cell_style),
            Paragraph("Normal queue processing", cell_style)
        ],
        [
            Paragraph("24 - 48 Hours (Attention)", cell_style),
            Paragraph(str(pending_info['from_24_to_48h']), cell_style),
            Paragraph("Notify assigned reviewer leads", cell_style)
        ],
        [
            Paragraph("> 48 Hours (Critical Backlog)", cell_style),
            Paragraph(str(pending_info['over_48h']), cell_style),
            Paragraph("Immediate executive escalation", cell_style)
        ]
    ]
    t_aging = Table(p_aging_data, colWidths=[160, 140, 240])
    t_aging.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#FEF2F2')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t_aging)

    # Footer note
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        "<i>This official document is generated automatically by the TechNeekX Reporting & Operations System. Confidential and intended for internal leadership use only.</i>",
        sub_style
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
