import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "RepoGuardian (PS-04) — Team Setup & AI Collaboration Guide")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 35, footer_text)
        self.drawString(54, 35, "Repository: github.com/richa866/RepoGuardiann")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0f172a')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0284c7')
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#0369a1'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'CodeBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#0f172a'),
        backColor=colors.HexColor('#f1f5f9'),
        borderColor=colors.HexColor('#cbd5e1'),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=4,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#334155'),
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    story = []

    # Title Block
    story.append(Paragraph("🛡️ RepoGuardian — Team & AI Setup Guide", title_style))
    story.append(Paragraph("Hackathon PS-04 • Multi-Branch Collaboration & Environment Setup", subtitle_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

    # Executive Overview
    story.append(Paragraph("1. Executive Overview & Repository Uplink", h1_style))
    story.append(Paragraph(
        "This guide provides exact, step-by-step instructions for each team member and their respective AI coding assistants "
        "(Claude, Gemini, Cursor, Copilot) to set up, build, and extend <b>RepoGuardian</b> without merge conflicts or code regressions.",
        body_style
    ))

    overview_table_data = [
        [Paragraph("<b>Parameter</b>", body_style), Paragraph("<b>Value / URL</b>", body_style)],
        [Paragraph("<b>GitHub Remote</b>", body_style), Paragraph("<code>https://github.com/richa866/RepoGuardiann.git</code>", body_style)],
        [Paragraph("<b>Primary Branch</b>", body_style), Paragraph("<code>main</code> (Production / Demo Ready)", body_style)],
        [Paragraph("<b>Backend Stack</b>", body_style), Paragraph("Python 3.10+, FastAPI, SQLite, ChromaDB, Sentence-Transformers", body_style)],
        [Paragraph("<b>Frontend Stack</b>", body_style), Paragraph("React 19, Vite, @react-three/fiber, Three.js, Tailwind CSS, Recharts", body_style)],
        [Paragraph("<b>Default Ports</b>", body_style), Paragraph("Backend: <code>8000</code> | Frontend: <code>5173</code>", body_style)],
    ]
    t_overview = Table(overview_table_data, colWidths=[130, 370])
    t_overview.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_overview)
    story.append(Spacer(1, 10))

    # Quick Start (Copy-Paste)
    story.append(Paragraph("2. Quick Start: Clone & Local Setup", h1_style))
    story.append(Paragraph("Run these commands in terminal to set up the full working platform locally:", body_style))
    
    cmd_setup = """# 1. Clone the repository
git clone https://github.com/richa866/RepoGuardiann.git
cd RepoGuardiann

# 2. Setup & Start Backend (Terminal 1)
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python seed_dummy_data.py
uvicorn app.main:app --reload --port 8000

# 3. Setup & Start Frontend (Terminal 2)
cd ../frontend
npm install
npm run dev"""
    story.append(Paragraph(cmd_setup.replace('\n', '<br/>'), code_style))
    story.append(Spacer(1, 6))

    # Branch Ownership & Team Roles
    story.append(Paragraph("3. Team Roles & Dedicated Branch Ownership", h1_style))
    story.append(Paragraph(
        "Each team member (and their AI assistant) should switch to their dedicated branch before writing code:",
        body_style
    ))

    roles_data = [
        [
            Paragraph("<b>Role & Branch</b>", body_style),
            Paragraph("<b>Assigned Files</b>", body_style),
            Paragraph("<b>Key Responsibilities & AI Guardrails</b>", body_style)
        ],
        [
            Paragraph("<b>Backend Dev</b><br/><code>feat/backend-pipeline</code>", body_style),
            Paragraph("<code>backend/app/sync.py</code><br/><code>backend/app/monitor.py</code><br/><code>backend/app/github_client.py</code>", body_style),
            Paragraph("• Manage GitHub API pagination and rate limits.<br/>• Ensure continuous monitoring loop enqueues subtasks.<br/>• Maintain <code>/health-metrics</code> and <code>/monitor/status</code>.", body_style)
        ],
        [
            Paragraph("<b>AIML #1 (RAG Lead)</b><br/><code>feat/rag-retrieval</code>", body_style),
            Paragraph("<code>backend/app/rag.py</code><br/><code>backend/app/tools.py</code>", body_style),
            Paragraph("• Tune Chroma embedding functions (all-MiniLM-L6-v2).<br/>• Ensure maintainer resolution context (e.g. <i>'Fixed in v2.1'</i>) is embedded alongside text.<br/>• Evaluate similarity search accuracy on real repos.", body_style)
        ],
        [
            Paragraph("<b>AIML #2 (Agent Lead)</b><br/><code>feat/agent-escalation</code>", body_style),
            Paragraph("<code>backend/app/agent.py</code><br/><code>backend/app/tools.py</code><br/><code>backend/app/llm.py</code>", body_style),
            Paragraph("• Refine 6 independent tool functions (duplicate, SLA, security, stale, missing info, contentious).<br/>• Calibrate synthesis prompts with evidence citations (similarity %, days unresponded).<br/>• Verify human override feedback flow.", body_style)
        ],
        [
            Paragraph("<b>AIML #3 / Frontend</b><br/><code>feat/frontend-hud</code>", body_style),
            Paragraph("<code>frontend/src/components/3d/</code><br/><code>frontend/src/components/hud/</code><br/><code>frontend/src/App.jsx</code>", body_style),
            Paragraph("• Polish 3D Git tree & clustered issue scene.<br/>• Enhance glassmorphism HUD, feedback buttons, and charts.<br/>• Test live repo connect modal (<code>httpie/cli</code>, <code>psf/black</code>).", body_style)
        ],
    ]
    t_roles = Table(roles_data, colWidths=[110, 130, 260])
    t_roles.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_roles)
    story.append(Spacer(1, 10))

    # Page Break for Clean Layout
    story.append(PageBreak())

    # Instructions for AI Assistants
    story.append(Paragraph("4. Specific Instructions for Teammates' AI Assistants", h1_style))
    story.append(Paragraph(
        "When prompting your AI assistant (e.g., in Cursor, Antigravity, Claude, or Copilot), provide the following guidelines:",
        body_style
    ))

    story.append(Paragraph("• <b>Documentation & Arch Integrity:</b> Do not rewrite or delete existing working endpoints or 3D components unless specifically instructed.", bullet_style))
    story.append(Paragraph("• <b>Dual Mode Resiliency (Gemini & Fallback):</b> The backend automatically supports both Google Gemini (<code>GEMINI_API_KEY</code>) and deterministic rule-based synthesis fallback. Never remove the fallback code path.", bullet_style))
    story.append(Paragraph("• <b>Multi-Step Tool Paradigm:</b> Maintain the architecture where <code>evaluate_issue()</code> executes 6 independent tool functions before calling LLM synthesis. Do not condense tool checks into a single generic prompt.", bullet_style))
    story.append(Paragraph("• <b>3D Asset Location:</b> All Blender 3D models reside in <code>frontend/public/models/</code> (<code>repoguardian_logo.glb</code>, <code>git_branch_node.glb</code>, <code>smooth_issue_orb.glb</code>, <code>commit_node.glb</code>).", bullet_style))
    story.append(Paragraph("• <b>Local Vector Store:</b> Chroma DB is local and persistent under <code>backend/data/chroma</code>. No external vector cloud API is required.", bullet_style))
    story.append(Spacer(1, 8))

    # Environment Variables Template
    story.append(Paragraph("5. Environment Configuration (.env Template)", h1_style))
    story.append(Paragraph("To connect real live GitHub repositories and Gemini API, create <code>backend/.env</code>:", body_style))

    env_template = """# Optional: Personal Access Token (raises rate limit to 5000/hr)
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Optional: Auto-connect repository on boot (e.g. httpie/cli, psf/black, pallets/flask)
GITHUB_REPO=httpie/cli

# Optional: Gemini API Key for LLM prose synthesis (free from aistudio.google.com)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash

# Background Scheduler Interval (seconds)
MONITOR_POLL_INTERVAL_SECONDS=300

# Storage Paths
DATABASE_PATH=./data/repoguardian.db
CHROMA_PATH=./data/chroma"""
    story.append(Paragraph(env_template.replace('\n', '<br/>'), code_style))
    story.append(Spacer(1, 8))

    # Git Collaboration Workflow
    story.append(Paragraph("6. Git Workflow & Merging Process", h1_style))
    story.append(Paragraph(
        "Follow these rules to prevent merge collisions and maintain code quality:",
        body_style
    ))
    story.append(Paragraph("1. <b>Checkout your branch:</b> <code>git checkout feat/your-feature-name</code>", bullet_style))
    story.append(Paragraph("2. <b>Stay updated with main:</b> Regularly run <code>git fetch origin && git merge origin/main</code>", bullet_style))
    story.append(Paragraph("3. <b>Test before pushing:</b> Run <code>npm run build</code> in <code>frontend</code> and verify backend responds on <code>/health</code>.", bullet_style))
    story.append(Paragraph("4. <b>Push to remote:</b> <code>git push origin feat/your-feature-name</code>", bullet_style))
    story.append(Paragraph("5. <b>Merge to main:</b> Open a Pull Request on GitHub or fast-forward merge once verified.", bullet_style))
    story.append(Spacer(1, 10))

    # Live Demo Repositories Cheat Sheet
    story.append(Paragraph("7. Verified Demo Repositories Cheat Sheet", h1_style))
    story.append(Paragraph("These public repositories are verified and pre-tested for live demoing:", body_style))

    demo_repos_data = [
        [Paragraph("<b>Repository</b>", body_style), Paragraph("<b>Key Demo Highlights</b>", body_style), Paragraph("<b>Flagged Issue Numbers</b>", body_style)],
        [
            Paragraph("<b>httpie/cli</b>", body_style),
            Paragraph("Rich security vulnerabilities, plaintext auth credentials, terminal escape injection.", body_style),
            Paragraph("• <code>#1812</code> (Escape injection)<br/>• <code>#1710</code> (Plaintext credentials)<br/>• <code>#1636</code> (Stale untriaged)", body_style)
        ],
        [
            Paragraph("<b>psf/black</b>", body_style),
            Paragraph("Well-labeled, regression-heavy, supply-chain security proposals.", body_style),
            Paragraph("• <code>#5029</code> (Zip Slip security)<br/>• <code>#3665</code> (Duplicate bug)<br/>• <code>#5120</code> (Stale immutable releases)", body_style)
        ],
        [
            Paragraph("<b>pallets/flask</b>", body_style),
            Paragraph("Mature historical decisions ('closed as duplicate of #X', 'fixed in v2.1'). Ideal for RAG.", body_style),
            Paragraph("• <code>#6114</code> (Duplicate resolution)<br/>• <code>#6044</code> (Teardown bug)", body_style)
        ],
    ]
    t_demo = Table(demo_repos_data, colWidths=[90, 250, 160])
    t_demo.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_demo)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"SUCCESS: Generated PDF at {filename}")

if __name__ == "__main__":
    out1 = "/Users/shridhartawate/Documents/Codeisance/RepoGuardian_Team_Setup_Guide.pdf"
    out2 = "/Users/shridhartawate/Downloads/RepoGuardian_Team_Setup_Guide.pdf"
    build_pdf(out1)
    build_pdf(out2)
