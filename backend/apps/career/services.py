import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle

from apps.tasks.models import Task
from apps.career.models import CareerProfile, ContributionHighlight, ResumeConfiguration

def sync_approved_contributions(profile: CareerProfile) -> int:
    """
    Syncs approved TechNeekX deliverables for the user into ContributionHighlight records.
    By default, include_in_resume is False so the member explicitly opts in.
    """
    user = profile.user
    # Find approved tasks assigned to user or submitted by user
    approved_tasks = Task.objects.filter(
        status='Approved'
    ).filter(
        models_q_filter(user)
    ).distinct()

    created_count = 0
    for task in approved_tasks:
        if not ContributionHighlight.objects.filter(profile=profile, task=task).exists():
            ContributionHighlight.objects.create(
                profile=profile,
                task=task,
                title=f"TechNeekX: {task.title}",
                description=task.description or "Verified community deliverable completed and approved.",
                points_earned=10,
                include_in_resume=False
            )
            created_count += 1
    return created_count

def models_q_filter(user):
    from django.db.models import Q
    return Q(assigned_to=user) | Q(proofs__submitted_by=user)


def generate_ats_resume_pdf(profile: CareerProfile) -> bytes:
    """
    Generates an ATS-compliant, cleanly formatted PDF resume.
    Uses standard fonts, clear headings, bulleted achievements, and explicit sections.
    """
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
    
    # Custom ATS Paragraph Styles
    name_style = ParagraphStyle(
        'ATSName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor('#111827')
    )

    title_style = ParagraphStyle(
        'ATSTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=1,
        textColor=colors.HexColor('#4B5563')
    )

    contact_style = ParagraphStyle(
        'ATSContact',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor('#4B5563')
    )

    section_heading = ParagraphStyle(
        'ATSSection',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#111827'),
        spaceBefore=8,
        spaceAfter=2
    )

    item_title = ParagraphStyle(
        'ATSItemTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#1F2937')
    )

    item_meta = ParagraphStyle(
        'ATSItemMeta',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#6B7280'),
        alignment=2 # Right align
    )

    body_text = ParagraphStyle(
        'ATSBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#374151')
    )

    elements = []

    # 1. Header: Name & Target Role
    user_name = profile.user.name or "Candidate"
    elements.append(Paragraph(user_name.upper(), name_style))

    headline = (
        profile.resume_config.custom_headline
        if hasattr(profile, 'resume_config') and profile.resume_config.custom_headline
        else profile.target_role or profile.headline
    )
    if headline:
        elements.append(Spacer(1, 2))
        elements.append(Paragraph(headline, title_style))

    # 2. Contact Line
    contact_parts = []
    if profile.user.email:
        contact_parts.append(profile.user.email)
    if profile.phone:
        contact_parts.append(profile.phone)
    if profile.location:
        contact_parts.append(profile.location)
    if profile.linkedin_url:
        contact_parts.append(f"LinkedIn: {profile.linkedin_url.replace('https://www.linkedin.com/in/', '').replace('https://linkedin.com/in/', '')}")
    if profile.github_url:
        contact_parts.append(f"GitHub: {profile.github_url.replace('https://github.com/', '')}")
    if profile.portfolio_url:
        contact_parts.append(profile.portfolio_url)

    if contact_parts:
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(" | ".join(contact_parts), contact_style))

    # Resume config flags
    config = getattr(profile, 'resume_config', None)
    if not config:
        config, _ = ResumeConfiguration.objects.get_or_create(profile=profile)

    def add_section_divider(title_text):
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(title_text.upper(), section_heading))
        elements.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor('#111827'), spaceBefore=2, spaceAfter=6))

    # 3. Summary Section
    if config.include_summary and profile.bio:
        add_section_divider("Professional Summary")
        elements.append(Paragraph(profile.bio, body_text))

    # 4. Technical Skills
    if config.include_skills and profile.skills:
        add_section_divider("Technical Skills")
        skills_str = ", ".join(profile.skills) if isinstance(profile.skills, list) else str(profile.skills)
        elements.append(Paragraph(f"<b>Core Competencies:</b> {skills_str}", body_text))

    # 5. Education
    if config.include_education and profile.educations.exists():
        add_section_divider("Education")
        for edu in profile.educations.all():
            row_data = [
                [
                    Paragraph(f"<b>{edu.institution}</b> — {edu.degree} in {edu.field_of_study}", item_title),
                    Paragraph(f"{edu.graduation_year}{f' | Grade: {edu.grade}' if edu.grade else ''}", item_meta)
                ]
            ]
            t = Table(row_data, colWidths=[380, 160])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                ('TOPPADDING', (0,0), (-1,-1), 1),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            elements.append(t)
            if edu.description:
                elements.append(Paragraph(edu.description, body_text))
            elements.append(Spacer(1, 4))

    # 6. Projects Portfolio (Only items with include_in_resume=True)
    included_projects = profile.projects.filter(include_in_resume=True)
    if config.include_projects and included_projects.exists():
        add_section_divider("Technical Projects")
        for proj in included_projects:
            links = []
            if proj.github_link:
                links.append(f"<a href='{proj.github_link}' color='#635BFF'>GitHub</a>")
            if proj.live_url:
                links.append(f"<a href='{proj.live_url}' color='#635BFF'>Live Demo</a>")
            links_str = f" ({' | '.join(links)})" if links else ""

            row_data = [
                [
                    Paragraph(f"<b>{proj.title}</b>{links_str}", item_title),
                    Paragraph(proj.technologies, item_meta)
                ]
            ]
            t = Table(row_data, colWidths=[350, 190])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                ('TOPPADDING', (0,0), (-1,-1), 1),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            elements.append(t)
            elements.append(Paragraph(proj.description, body_text))
            elements.append(Spacer(1, 4))

    # 7. Achievements & Awards (Only items with include_in_resume=True)
    included_achievements = profile.achievements.filter(include_in_resume=True)
    if config.include_achievements and included_achievements.exists():
        add_section_divider("Achievements & Certifications")
        for ach in included_achievements:
            date_str = ach.issue_date.strftime('%b %Y') if ach.issue_date else ""
            row_data = [
                [
                    Paragraph(f"<b>{ach.title}</b> — {ach.issuer}", item_title),
                    Paragraph(date_str, item_meta)
                ]
            ]
            t = Table(row_data, colWidths=[420, 120])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                ('TOPPADDING', (0,0), (-1,-1), 1),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            elements.append(t)
            if ach.description:
                elements.append(Paragraph(ach.description, body_text))
            elements.append(Spacer(1, 4))

    # 8. Verified Community Contributions (Only items explicitly opted-in)
    included_contributions = profile.contributions.filter(include_in_resume=True)
    if config.include_community_contributions and included_contributions.exists():
        add_section_divider("Verified TechNeekX Contributions")
        for contrib in included_contributions:
            row_data = [
                [
                    Paragraph(f"<b>{contrib.title}</b>", item_title),
                    Paragraph(f"+{contrib.points_earned} Points (Verified)", item_meta)
                ]
            ]
            t = Table(row_data, colWidths=[400, 140])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                ('TOPPADDING', (0,0), (-1,-1), 1),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            elements.append(t)
            if contrib.description:
                elements.append(Paragraph(contrib.description, body_text))
            elements.append(Spacer(1, 4))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
