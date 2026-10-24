import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle

# pyrefly: ignore [missing-import]
from apps.documents.models import MouDocument 

def generate_mou_pdf(mou: MouDocument) -> bytes:
    """
    Generates a formal, printable Memorandum of Understanding (MoU) document PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        'MouHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        alignment=1,
        textColor=colors.HexColor('#111827')
    )

    sub_header = ParagraphStyle(
        'MouSubHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        alignment=1,
        textColor=colors.HexColor('#635BFF')
    )

    body_style = ParagraphStyle(
        'MouBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#374151'),
        spaceAfter=8
    )

    clause_title = ParagraphStyle(
        'MouClauseTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#111827'),
        spaceBefore=10,
        spaceAfter=4
    )

    elements = []

    elements.append(Paragraph("MEMORANDUM OF UNDERSTANDING (MoU)", header_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("TECHNEEKX COMMUNITY OPERATIONS & ACADEMIC PARTNERSHIPS", sub_header))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#111827'), spaceAfter=12))

    elements.append(Paragraph(
        f"This Memorandum of Understanding (hereinafter referred to as 'MoU') is formally entered into by and between <b>{mou.signatory_first_party}</b> and <b>{mou.organization_name}</b>, represented by <b>{mou.signatory_second_party}</b>.",
        body_style
    ))

    elements.append(Paragraph("1. PURPOSE & SCOPE OF ENGAGEMENT", clause_title))
    elements.append(Paragraph(mou.scope_of_work, body_style))

    elements.append(Paragraph("2. VALIDITY AND EFFECTIVE DURATION", clause_title))
    elements.append(Paragraph(
        f"This MoU is effective from <b>{mou.validity_start.strftime('%d %B %Y')}</b> and shall remain in full force until <b>{mou.validity_end.strftime('%d %B %Y')}</b>, subject to mutual extension and review.",
        body_style
    ))

    elements.append(Paragraph("3. STATUS & GOVERNANCE", clause_title))
    status_note = (
        f"Current Execution Status: <b>{mou.status.upper()}</b>."
        if mou.status in ['Approved', 'Signed']
        else f"Current Status: <b>{mou.status.upper()}</b> (Non-binding draft subject to final administrative approval)."
    )
    elements.append(Paragraph(status_note, body_style))
    if mou.review_notes:
        elements.append(Paragraph(f"<b>Administrative Notes:</b> {mou.review_notes}", body_style))

    elements.append(Spacer(1, 20))

    # Signatory Table
    sign_data = [
        [
            Paragraph(f"<b>For First Party:</b><br/>{mou.signatory_first_party}<br/><br/>_______________________<br/>Authorized Signatory", body_style),
            Paragraph(f"<b>For Second Party:</b><br/>{mou.organization_name}<br/><br/>_______________________<br/>{mou.signatory_second_party}", body_style)
        ]
    ]
    t = Table(sign_data, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    elements.append(t)

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
