"""
Sozialzync — Developer & SuperAdmin Pending Completion Guide
Generates a PDF using reportlab.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, ListFlowable, ListItem, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from datetime import date

OUTPUT = "Sozialzync-Pending-Completion-Guide.pdf"

# ── Colour palette ────────────────────────────────────────────────────────────
PURPLE   = colors.HexColor("#6D4AE0")
PURPLE_L = colors.HexColor("#f5f2fd")
PURPLE_D = colors.HexColor("#4c33a0")
GREEN    = colors.HexColor("#16a34a")
GREEN_L  = colors.HexColor("#f0fdf4")
AMBER    = colors.HexColor("#d97706")
AMBER_L  = colors.HexColor("#fffbeb")
RED      = colors.HexColor("#dc2626")
RED_L    = colors.HexColor("#fef2f2")
GRAY     = colors.HexColor("#6b7280")
GRAY_L   = colors.HexColor("#f9fafb")
DARK     = colors.HexColor("#111827")
WHITE    = colors.white

W, H = A4
MARGIN = 20 * mm

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

COVER_TITLE  = S("CoverTitle",  fontSize=34, textColor=WHITE,       leading=42, fontName="Helvetica-Bold",  alignment=TA_CENTER)
COVER_SUB    = S("CoverSub",    fontSize=16, textColor=WHITE,        leading=22, fontName="Helvetica",        alignment=TA_CENTER)
COVER_DATE   = S("CoverDate",   fontSize=11, textColor=colors.HexColor("#c4b5fd"), leading=18, fontName="Helvetica-Oblique", alignment=TA_CENTER)
H1           = S("H1",          fontSize=20, textColor=PURPLE_D,     leading=28, fontName="Helvetica-Bold",  spaceBefore=12, spaceAfter=4)
H2           = S("H2",          fontSize=14, textColor=DARK,         leading=20, fontName="Helvetica-Bold",  spaceBefore=10, spaceAfter=2)
H3           = S("H3",          fontSize=11, textColor=PURPLE_D,     leading=16, fontName="Helvetica-Bold",  spaceBefore=6, spaceAfter=1)
BODY         = S("Body",        fontSize=10, textColor=DARK,         leading=15, fontName="Helvetica")
BODY_SMALL   = S("BodySmall",   fontSize=8.5, textColor=GRAY,        leading=13, fontName="Helvetica")
CODE         = S("Code",        fontSize=8.5, textColor=DARK,        leading=13, fontName="Courier",          backColor=GRAY_L, borderPadding=(4,8,4,8))
TAG_GREEN    = S("TagGreen",    fontSize=9,  textColor=GREEN,        leading=13, fontName="Helvetica-Bold")
TAG_AMBER    = S("TagAmber",    fontSize=9,  textColor=AMBER,        leading=13, fontName="Helvetica-Bold")
TAG_RED      = S("TagRed",      fontSize=9,  textColor=RED,          leading=13, fontName="Helvetica-Bold")
CAPTION      = S("Caption",     fontSize=8,  textColor=GRAY,         leading=12, fontName="Helvetica-Oblique")

# ── Helper flowables ──────────────────────────────────────────────────────────

def sp(h=4):
    return Spacer(1, h * mm)

def hr(color=PURPLE_L, thickness=1):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=4)

def h1(text):
    return [sp(2), Paragraph(text, H1), hr(PURPLE, 2), sp(1)]

def h2(text, color=DARK):
    s = ParagraphStyle("h2x", parent=H2, textColor=color)
    return [sp(2), Paragraph(text, s)]

def h3(text):
    return [sp(1), Paragraph(text, H3)]

def body(text):
    return Paragraph(text, BODY)

def small(text):
    return Paragraph(text, BODY_SMALL)

def code(text):
    return Paragraph(text, CODE)

def bullet_list(items, bullet="•", indent=10):
    return [ListFlowable(
        [ListItem(Paragraph(i, BODY), leftIndent=indent, bullet=bullet) for i in items],
        bulletType="bullet", start=bullet,
    ), sp(1)]

def numbered_list(items, indent=10):
    return [ListFlowable(
        [ListItem(Paragraph(i, BODY), leftIndent=indent) for i in items],
        bulletType="1",
    ), sp(1)]

def env_table(rows, title=None):
    """rows: list of (VAR_NAME, required, source, description)"""
    data = [["Environment Variable", "Required", "Source", "Description"]]
    for var, req, src, desc in rows:
        data.append([
            Paragraph(f"<font name='Courier' size='8'>{var}</font>", BODY),
            Paragraph(f"<b>{'✓' if req else '–'}</b>", TAG_GREEN if req else TAG_AMBER),
            small(src),
            small(desc),
        ])
    t = Table(data, colWidths=[55*mm, 18*mm, 45*mm, 55*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), PURPLE),
        ("TEXTCOLOR",   (0,0), (-1,0), WHITE),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,0), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GRAY_L]),
        ("GRID",        (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
        ("VALIGN",      (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",  (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0), (-1,-1), 4),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
    ]))
    result = []
    if title:
        result += h3(title)
    result += [t, sp(2)]
    return result

def checklist_table(rows):
    """rows: list of (step, description, status='done'|'pending'|'optional')"""
    data = [["#", "Task", "Notes", "Status"]]
    for i, (step, desc, status) in enumerate(rows, 1):
        color = GREEN if status == "done" else (AMBER if status == "optional" else RED)
        label = "✓ Done" if status == "done" else ("Optional" if status == "optional" else "Pending")
        data.append([
            Paragraph(str(i), BODY),
            Paragraph(f"<b>{step}</b>", BODY),
            small(desc),
            Paragraph(f"<b>{label}</b>", ParagraphStyle("x", parent=BODY, textColor=color, fontSize=9, fontName="Helvetica-Bold")),
        ])
    t = Table(data, colWidths=[10*mm, 55*mm, 80*mm, 22*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), DARK),
        ("TEXTCOLOR",   (0,0), (-1,0), WHITE),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,0), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GRAY_L]),
        ("GRID",        (0,0), (-1,-1), 0.3, colors.HexColor("#e5e7eb")),
        ("VALIGN",      (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
    ]))
    return [t, sp(2)]

# ── Document builder ──────────────────────────────────────────────────────────

def on_first_page(canvas, doc):
    """Purple gradient cover"""
    canvas.saveState()
    canvas.setFillColor(PURPLE)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Lighter stripe top right
    canvas.setFillColor(PURPLE_D)
    canvas.rect(W*0.55, H*0.35, W*0.6, H*0.8, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#8b6fe8"))
    canvas.rect(0, H*0.82, W, H*0.18, fill=1, stroke=0)
    canvas.restoreState()

def on_later_pages(canvas, doc):
    canvas.saveState()
    # Top bar
    canvas.setFillColor(PURPLE)
    canvas.rect(0, H - 12*mm, W, 12*mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(MARGIN, H - 7.5*mm, "Sozialzync — Developer & SuperAdmin Guide")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(W - MARGIN, H - 7.5*mm, f"Page {doc.page}")
    # Bottom line
    canvas.setStrokeColor(PURPLE_L)
    canvas.setLineWidth(1)
    canvas.line(MARGIN, 12*mm, W - MARGIN, 12*mm)
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica-Oblique", 7.5)
    canvas.drawCentredString(W/2, 7*mm, f"Confidential — Sozialzync Internal Document — {date.today().strftime('%Y-%m-%d')}")
    canvas.restoreState()

# ── Build story ───────────────────────────────────────────────────────────────

def build():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=30*mm, bottomMargin=20*mm,
    )

    story = []

    # ══ Cover page ════════════════════════════════════════════════════════════
    story += [sp(30)]
    story.append(Paragraph("SOZIALZYNC", COVER_TITLE))
    story += [sp(3)]
    story.append(Paragraph("Developer &amp; SuperAdmin", COVER_SUB))
    story.append(Paragraph("Pending Completion Guide", COVER_SUB))
    story += [sp(6)]
    story.append(Paragraph("Everything required to go from dev build → production-ready SaaS", COVER_DATE))
    story += [sp(3)]
    story.append(Paragraph(f"Generated: {date.today().strftime('%B %d, %Y')}", COVER_DATE))
    story += [sp(40)]
    story.append(Paragraph("AI-Powered YouTube Content Operating System", COVER_DATE))
    story.append(PageBreak())

    # ══ TOC / Overview ════════════════════════════════════════════════════════
    story += h1("📋  Overview & Priority Order")
    story.append(body(
        "This guide lists every pending configuration, environment variable, OAuth integration, "
        "database migration, and feature wire-up required before Sozialzync is fully production-ready. "
        "Items are ordered from most-blocking to least-blocking."
    ))
    story += [sp(3)]

    story += checklist_table([
        ("Set up PostgreSQL database & run migrations", "Local Docker or hosted Postgres — all Prisma models need to be applied", "pending"),
        ("Configure all required env vars", "See Section 2 — 25+ variables across API and Web apps", "pending"),
        ("YouTube OAuth 2.0 setup", "Google Cloud Console — scopes: youtube.upload, youtube.readonly", "pending"),
        ("ElevenLabs API key", "Free tier: 10k chars/month. Used for voice synthesis & character voices", "pending"),
        ("OpenAI API key", "Required for TTS, DALL-E 3 thumbnails, AI script generation", "pending"),
        ("Jamendo client_id", "Free account at developer.jamendo.com — royalty-free music discovery", "pending"),
        ("Pixabay API key", "Free at pixabay.com/api — royalty-free images and music", "pending"),
        ("Pexels API key", "Free at pexels.com/api — royalty-free photo search", "pending"),
        ("Unsplash Access Key", "Free at unsplash.com/developers — royalty-free photo search", "pending"),
        ("Clerk Auth integration", "Add Clerk middleware and provider to replace custom JWT flow", "optional"),
        ("Sentry DSN configuration", "Error tracking & on-call alerts. Add to both web and API envs", "pending"),
        ("Vercel deployment env vars", "Mirror all API env vars in the Vercel dashboard for the web app", "pending"),
        ("Create first SuperAdmin user", "Run seed script or update user.role = 'SUPER_ADMIN' in DB", "pending"),
        ("Configure AI provider fallbacks", "Set primary + fallback providers in SuperAdmin → AI Providers page", "pending"),
        ("Set up Cloudflare R2 or local storage", "STORAGE_BACKEND=r2 needs R2 bucket + credentials", "optional"),
        ("BullMQ / Redis setup", "Required for background AI jobs — use Upstash Redis free tier", "pending"),
        ("SMTP / email provider", "For OTP emails, password reset, notifications", "pending"),
        ("Stripe payment setup", "For billing and wallet top-ups — webhook endpoint required", "optional"),
        ("Run full E2E test suite", "pnpm e2e — all navigation, orgs, copilot, publishing tests", "pending"),
        ("Lighthouse CI score ≥ 80", "Accessibility and performance gates in .lighthouserc.yml", "pending"),
        ("OWASP ZAP security scan", "Passive + active scan in CI — review and triage findings", "pending"),
    ])

    story.append(PageBreak())

    # ══ Section 1: Database ════════════════════════════════════════════════════
    story += h1("1  Database Setup")
    story += h2("1.1  Local Development (Docker)")
    story.append(body("Run a local PostgreSQL instance with Docker Compose:"))
    story += [sp(1)]
    story.append(code("docker run -d --name cf-postgres \\<br/>"
                      "  -e POSTGRES_USER=cfuser \\<br/>"
                      "  -e POSTGRES_PASSWORD=cfpass \\<br/>"
                      "  -e POSTGRES_DB=creatorforce \\<br/>"
                      "  -p 5432:5432 postgres:16-alpine"))
    story += [sp(2)]
    story.append(body("Then set DATABASE_URL in apps/api/.env:"))
    story.append(code("DATABASE_URL=postgresql://cfuser:cfpass@localhost:5432/creatorforce"))
    story += [sp(2)]

    story += h2("1.2  Apply All Migrations")
    story.append(body("From the apps/api directory, run:"))
    story.append(code("cd apps/api<br/>npx prisma migrate deploy<br/>npx prisma generate"))
    story += [sp(2)]

    story += h2("1.3  Migrations to Apply (in order)")
    story += bullet_list([
        "20260701000000_init — Base schema (User, Project, Channel, Video, etc.)",
        "20260710000000_copilot — Copilot conversation model",
        "20260722000000_optional_channel_platform — Channel platform field nullable",
        "20260729000001_user_provider_configs — AI provider config per user",
        "20260729000002_music_tracks — MusicTrack model for royalty-free library",
        "20260730000001_publishing_status — PublishingStatus enum + publishedAt",
        "20260805000001_add_character_model — Character Studio model (NEW)",
    ])
    story += [sp(2)]

    story += h2("1.4  Seed First SuperAdmin")
    story.append(body(
        "After migrations, create the first admin user. Either register via the UI "
        "at /register and then update the role in the DB:"
    ))
    story.append(code(
        "-- Run in psql after registering:<br/>"
        "UPDATE \"User\" SET role = 'SUPER_ADMIN'<br/>"
        "WHERE email = 'your-admin@email.com';"
    ))
    story.append(PageBreak())

    # ══ Section 2: Environment Variables ══════════════════════════════════════
    story += h1("2  Environment Variables")
    story.append(body(
        "Set these in apps/api/.env (backend) and apps/web/.env.local (frontend). "
        "Never commit .env files. In production, use Vercel environment variables dashboard or a secret manager."
    ))
    story += [sp(2)]

    story += env_table([
        ("DATABASE_URL",         True,  "Your Postgres provider",        "PostgreSQL connection string"),
        ("JWT_SECRET",           True,  "Generate: openssl rand -hex 32","Signs auth tokens — keep secret"),
        ("REFRESH_SECRET",       True,  "Generate: openssl rand -hex 32","Signs refresh tokens"),
        ("REDIS_URL",            True,  "Upstash Redis / local Redis",   "Required for BullMQ job queues"),
    ], title="Core Backend (apps/api/.env)")

    story += env_table([
        ("OPENAI_API_KEY",       True,  "platform.openai.com",           "TTS, DALL-E 3 thumbnails, GPT-4o scripts"),
        ("ANTHROPIC_API_KEY",    True,  "console.anthropic.com",          "Claude — primary AI for scripts, compliance"),
        ("GEMINI_API_KEY",       False, "aistudio.google.com",            "Fallback AI provider (optional)"),
        ("ELEVENLABS_API_KEY",   True,  "elevenlabs.io",                  "Voice synthesis — character voices, TTS"),
    ], title="AI Providers")

    story += env_table([
        ("YOUTUBE_CLIENT_ID",    True,  "Google Cloud Console",           "YouTube Data API v3 OAuth client"),
        ("YOUTUBE_CLIENT_SECRET",True,  "Google Cloud Console",           "YouTube OAuth secret"),
        ("YOUTUBE_REDIRECT_URI", True,  "e.g. http://localhost:4007/...", "Must match Google Console exactly"),
    ], title="YouTube OAuth (Google Cloud Console)")

    story += env_table([
        ("JAMENDO_CLIENT_ID",    True,  "developer.jamendo.com (free)",   "Royalty-free music discovery"),
        ("PIXABAY_API_KEY",      True,  "pixabay.com/api (free)",         "Royalty-free images + music"),
        ("PEXELS_API_KEY",       True,  "pexels.com/api (free)",          "Royalty-free photo search"),
        ("UNSPLASH_ACCESS_KEY",  True,  "unsplash.com/developers (free)", "Royalty-free photo search"),
    ], title="Royalty-Free Media APIs (all free tier)")

    story += env_table([
        ("SMTP_HOST",            True,  "e.g. smtp.sendgrid.net",         "Email delivery host"),
        ("SMTP_PORT",            True,  "Usually 587",                    "Email port (TLS)"),
        ("SMTP_USER",            True,  "From your email provider",       "SMTP auth username"),
        ("SMTP_PASS",            True,  "From your email provider",       "SMTP auth password"),
        ("EMAIL_FROM",           True,  "noreply@yourdomain.com",         "Sender address for system emails"),
    ], title="Email / SMTP")

    story += env_table([
        ("STORAGE_BACKEND",      False, "local or r2",                    "Default: local file storage"),
        ("R2_ACCOUNT_ID",        False, "Cloudflare dashboard",           "Required if STORAGE_BACKEND=r2"),
        ("R2_ACCESS_KEY_ID",     False, "Cloudflare dashboard",           "R2 credentials"),
        ("R2_SECRET_ACCESS_KEY", False, "Cloudflare dashboard",           "R2 credentials"),
        ("R2_BUCKET_NAME",       False, "Your R2 bucket name",            "Where media files are stored"),
    ], title="File Storage (Cloudflare R2 — optional)")

    story += env_table([
        ("STRIPE_SECRET_KEY",    False, "dashboard.stripe.com",           "Payment processing — wallet top-ups"),
        ("STRIPE_WEBHOOK_SECRET",False, "Stripe CLI / dashboard",         "Validates webhook events"),
    ], title="Payments (Stripe — optional)")

    story.append(PageBreak())

    story += env_table([
        ("NEXT_PUBLIC_API_URL",  True,  "e.g. http://localhost:4007",     "Backend API base URL"),
        ("NEXT_PUBLIC_APP_URL",  True,  "e.g. http://localhost:3007",     "Frontend base URL"),
        ("NEXT_PUBLIC_SENTRY_DSN",False,"sentry.io project DSN",          "Frontend error tracking"),
        ("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",False,"clerk.com dashboard",  "Clerk auth (optional overlay)"),
    ], title="Frontend (apps/web/.env.local)")

    story += env_table([
        ("SENTRY_DSN",           False, "sentry.io project DSN",          "Backend error tracking"),
        ("SENTRY_AUTH_TOKEN",    False, "sentry.io user token",            "For release tracking in CI"),
        ("CLERK_SECRET_KEY",     False, "clerk.com dashboard",             "Clerk backend validation"),
    ], title="Backend Monitoring & Auth")

    story.append(PageBreak())

    # ══ Section 3: YouTube OAuth ══════════════════════════════════════════════
    story += h1("3  YouTube OAuth 2.0 Setup")
    story.append(body(
        "Sozialzync publishes videos to YouTube on behalf of creators. "
        "This requires a Google Cloud project with the YouTube Data API v3 enabled."
    ))
    story += [sp(2)]

    story += h2("3.1  Google Cloud Console Steps", PURPLE_D)
    story += numbered_list([
        "Go to console.cloud.google.com → New Project → Name: \"Sozialzync\"",
        "APIs &amp; Services → Enable APIs → Search \"YouTube Data API v3\" → Enable",
        "APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0 Client ID",
        "Application type: Web application",
        "Authorised redirect URIs: add both:<br/>"
        "  • http://localhost:4007/api/v1/auth/youtube/callback (development)<br/>"
        "  • https://api.yourdomain.com/api/v1/auth/youtube/callback (production)",
        "Copy Client ID → YOUTUBE_CLIENT_ID env var",
        "Copy Client Secret → YOUTUBE_CLIENT_SECRET env var",
        "OAuth consent screen → Add scopes:<br/>"
        "  • .../auth/youtube.upload<br/>"
        "  • .../auth/youtube.readonly<br/>"
        "  • .../auth/youtube.force-ssl",
        "For production: submit OAuth app for Google verification (required to upload as non-test users)",
    ])
    story += [sp(3)]

    story += h2("3.2  Test the Flow", PURPLE_D)
    story.append(body("Once env vars are set, the OAuth flow is at:"))
    story.append(code("GET /api/v1/auth/youtube → redirects to Google<br/>"
                      "GET /api/v1/auth/youtube/callback → stores tokens + redirects to /publish"))
    story += [sp(2)]
    story.append(body(
        "Tokens are stored in the ChannelAccount table per user. "
        "The publishing flow automatically refreshes expired tokens."
    ))
    story.append(PageBreak())

    # ══ Section 4: Media APIs ══════════════════════════════════════════════════
    story += h1("4  Royalty-Free Media API Registration")

    story += h2("4.1  Jamendo (Free Music — 600k+ Creative Commons tracks)")
    story += numbered_list([
        "Go to developer.jamendo.com",
        "Click \"Register\" → create a free account",
        "Go to \"API Keys\" → \"Create new application\"",
        "Copy the client_id → set as JAMENDO_CLIENT_ID",
        "Rate limit: 3,000 requests/day (free tier)",
    ])
    story += [sp(2)]

    story += h2("4.2  Pixabay (Free Images + Music)")
    story += numbered_list([
        "Go to pixabay.com → sign up for free",
        "Go to pixabay.com/api/ → copy your API key",
        "Set as PIXABAY_API_KEY",
        "Rate limit: 5,000 requests/hour (free tier)",
    ])
    story += [sp(2)]

    story += h2("4.3  Pexels (Free Stock Photos)")
    story += numbered_list([
        "Go to pexels.com/api/ → sign up",
        "Click \"Your API Key\" → copy key",
        "Set as PEXELS_API_KEY",
        "Rate limit: 200 requests/hour, 20,000/month (free tier)",
    ])
    story += [sp(2)]

    story += h2("4.4  Unsplash (Free High-Quality Photos)")
    story += numbered_list([
        "Go to unsplash.com/developers → \"New Application\"",
        "Fill in application details → accept terms",
        "Copy \"Access Key\" → set as UNSPLASH_ACCESS_KEY",
        "Rate limit: 50 requests/hour (demo), unlimited after approval",
    ])
    story += [sp(2)]

    story += h2("4.5  ElevenLabs (Voice Synthesis — Character Voices)")
    story += numbered_list([
        "Go to elevenlabs.io → Sign up free",
        "Profile → API Key → copy key",
        "Set as ELEVENLABS_API_KEY",
        "Free tier: 10,000 characters/month",
        "Character presets use OpenAI TTS by default — ElevenLabs is optional but improves quality",
    ])
    story.append(PageBreak())

    # ══ Section 5: Redis / BullMQ ═════════════════════════════════════════════
    story += h1("5  Redis Setup (Required for Background Jobs)")
    story.append(body(
        "All AI generation tasks (scripts, thumbnails, video generation, TTS) run as BullMQ background jobs. "
        "Redis is required."
    ))
    story += [sp(2)]

    story += h2("5.1  Option A: Upstash Redis (Free Hosted)")
    story += numbered_list([
        "Go to console.upstash.com → Create Database",
        "Choose region closest to your API server",
        "Copy the Redis URL (format: redis://:password@host:port)",
        "Set as REDIS_URL in apps/api/.env",
        "Free tier: 10,000 commands/day",
    ])
    story += [sp(2)]

    story += h2("5.2  Option B: Local Redis (Docker)")
    story.append(code("docker run -d --name cf-redis -p 6379:6379 redis:7-alpine"))
    story.append(code("REDIS_URL=redis://localhost:6379"))
    story.append(PageBreak())

    # ══ Section 6: Character Studio Features ══════════════════════════════════
    story += h1("6  New Features Built — Character Studio")
    story.append(body(
        "The Character Studio was implemented in this session. Here is what was built "
        "and what still needs to be wired up post-deploy."
    ))
    story += [sp(2)]

    story += h2("6.1  What Was Built")
    story += bullet_list([
        "<b>Character voices with FFmpeg audio effects</b> — 8 effect presets: natural, cartoon, chipmunk, villain, giant, robot, whisper, echo. Each applies FFmpeg filter chains to pitch-shift and process TTS output.",
        "<b>8 built-in character presets</b> — Cartoon Hero, Evil Villain, Funny Robot, Wise Elder, Anime Star, Mysterious Voice, Chipmunk Charlie, Pixel Gamer. Each has a personality description, voice settings, and video style.",
        "<b>DiceBear avatar integration</b> — 12 avatar art styles (Avataaars, Bottts, Fun Emoji, Pixel Art, etc.) served free from api.dicebear.com — no API key needed.",
        "<b>Character Studio page</b> at /studio/characters — 3 tabs: My Characters (CRUD), Presets (browse &amp; add), Create Custom (full form).",
        "<b>Voice preview streaming</b> — POST /api/v1/characters/preview-voice returns MP3 with voice effect applied, playable inline.",
        "<b>6 video styles</b> — Realistic, Cartoon, Animation, Anime, Movie, Pixel Art — stored per character and used as generation prompts for future video AI.",
        "<b>Image &amp; Assets Studio</b> at /studio/assets — search Pexels, Unsplash, Pixabay, Openverse in parallel. Download and use in projects.",
        "<b>AI Thumbnail Generator</b> at /studio/assets (AI Thumbnail tab) — generates DALL-E 3 thumbnail images at YouTube's 16:9 ratio with style variations.",
    ])
    story += [sp(2)]

    story += h2("6.2  Post-Deploy Wiring Required")
    story += bullet_list([
        "Run migration 20260805000001_add_character_model against production DB",
        "Ensure OPENAI_API_KEY is set — required for voice preview (OpenAI TTS) and thumbnail generation (DALL-E 3)",
        "ELEVENLABS_API_KEY optional — for higher quality voices on ElevenLabs provider",
        "FFmpeg must be installed on the API server: sudo apt-get install ffmpeg (for voice effects)",
        "Add PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY for image search in assets studio",
    ])
    story.append(PageBreak())

    # ══ Section 7: Music & Voice Libraries ════════════════════════════════════
    story += h1("7  Music & Voice Libraries")
    story.append(body("Built in prior sessions. Requires env vars to activate."))
    story += [sp(2)]

    story += bullet_list([
        "<b>Music Library</b> at /studio/music — Browse tab searches Jamendo + Pixabay for royalty-free tracks. Requires JAMENDO_CLIENT_ID and PIXABAY_API_KEY.",
        "<b>AI Music Match</b> — analyzes project script and auto-selects best matching track via Claude AI. Requires ANTHROPIC_API_KEY.",
        "<b>Voice Library</b> at /studio/voices — fetches ElevenLabs premade voices + 6 OpenAI voices. Preview and import to projects.",
        "<b>AI Voice Select</b> — auto-picks voice based on script mood and content. Requires ANTHROPIC_API_KEY + ELEVENLABS_API_KEY.",
    ])
    story.append(PageBreak())

    # ══ Section 8: SuperAdmin Setup ═══════════════════════════════════════════
    story += h1("8  SuperAdmin Configuration")
    story.append(body(
        "After setting the first user to SUPER_ADMIN role, log in and complete these steps in the admin panel at /admin."
    ))
    story += [sp(2)]

    story += h2("8.1  Admin → AI Providers Tab")
    story += bullet_list([
        "Set Primary LLM Provider: Anthropic (Claude claude-sonnet-4-6 recommended)",
        "Set Fallback Provider: OpenAI (GPT-4o) — automatically used on Anthropic 429/5xx",
        "Configure per-provider rate limits and token budgets",
        "Enable/disable Gemini as secondary fallback",
    ])
    story += [sp(2)]

    story += h2("8.2  Admin → Platform Settings")
    story += bullet_list([
        "Set platform name, logo, support email",
        "Configure max video generation concurrency (default: 3 concurrent per user)",
        "Set compliance check strictness level (strict/standard/relaxed)",
        "Enable/disable beta features: Character Studio, AI Thumbnail, Auto-Publish",
    ])
    story += [sp(2)]

    story += h2("8.3  Admin → Users Tab")
    story += bullet_list([
        "Verify first user accounts manually if email verification is not set up",
        "Set role (MEMBER / ADMIN / SUPER_ADMIN) per user",
        "Monitor AI usage per user — visible in Admin → AI Usage tab",
    ])
    story.append(PageBreak())

    # ══ Section 9: Deployment ═════════════════════════════════════════════════
    story += h1("9  Deployment Checklist")

    story += h2("9.1  Frontend — Vercel")
    story += numbered_list([
        "Frontend is already deployed to Vercel (project: creatorforce-ai)",
        "Go to vercel.com → Project → Settings → Environment Variables",
        "Add ALL variables from Section 2 (Frontend + Backend monitoring)",
        "NEXT_PUBLIC_API_URL must point to your production API domain",
        "Trigger redeploy after adding env vars",
    ])
    story += [sp(2)]

    story += h2("9.2  Backend API — Docker / Railway / Render")
    story += numbered_list([
        "Build: docker build -f infra/Dockerfile.api -t sozialzync-api .",
        "Required: PostgreSQL, Redis URLs in environment",
        "Required: FFmpeg in the Docker image (add to Dockerfile: RUN apt-get install -y ffmpeg)",
        "Port: 4007 (configured in NestJS main.ts)",
        "Run migrations on deploy: npx prisma migrate deploy",
        "Health check endpoint: GET /health",
    ])
    story += [sp(2)]

    story += h2("9.3  CI/CD Secrets (GitHub Actions)")
    story += bullet_list([
        "CODECOV_TOKEN — from codecov.io (test coverage reports)",
        "SENTRY_AUTH_TOKEN — for release tracking in CI",
        "All standard env vars — set in GitHub → Settings → Secrets → Actions",
    ])
    story.append(PageBreak())

    # ══ Section 10: Quick Start Commands ══════════════════════════════════════
    story += h1("10  Quick Start Commands")
    story.append(body("Run these from the repository root after setting env vars:"))
    story += [sp(2)]

    story += h2("Install dependencies")
    story.append(code("pnpm install"))
    story += [sp(2)]

    story += h2("Start all services (API + Web)")
    story.append(code("pnpm dev"))
    story.append(small("API runs on :4007, Web on :3007"))
    story += [sp(2)]

    story += h2("Run database migrations")
    story.append(code("cd apps/api &amp;&amp; npx prisma migrate deploy &amp;&amp; npx prisma generate"))
    story += [sp(2)]

    story += h2("Run E2E tests")
    story.append(code("pnpm e2e"))
    story += [sp(2)]

    story += h2("Run unit tests with coverage")
    story.append(code("pnpm test -- --coverage"))
    story += [sp(2)]

    story += h2("Build for production")
    story.append(code("pnpm build"))
    story += [sp(2)]

    story += h2("Type-check all packages")
    story.append(code("pnpm typecheck"))
    story += [sp(2)]

    story += h2("Lint")
    story.append(code("pnpm lint"))
    story += [sp(2)]

    # ══ Footer note ════════════════════════════════════════════════════════════
    story += [sp(4)]
    story.append(hr())
    story.append(Paragraph(
        f"Sozialzync Platform — Internal Developer Guide — Generated {date.today().strftime('%Y-%m-%d')} — All information confidential.",
        CAPTION
    ))

    doc.build(
        story,
        onFirstPage=on_first_page,
        onLaterPages=on_later_pages,
    )
    print(f"PDF generated: {OUTPUT}")

if __name__ == "__main__":
    build()
