# -*- coding: utf-8 -*-
"""Playwright E2E Test Report -- Sozialzync / AI CreatorForce
Usage: python make_test_report.py [output.pdf]
"""
import sys

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_CENTER
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab"])
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_CENTER

# Colours
BRAND   = HexColor("#6D4AE0")
PASS_C  = HexColor("#065f46")
PASS_BG = HexColor("#ecfdf5")
FAIL_C  = HexColor("#b91c1c")
FAIL_BG = HexColor("#fef2f2")
FLK_C   = HexColor("#b45309")
FLK_BG  = HexColor("#fffbeb")
SKP_C   = HexColor("#374151")
SKP_BG  = HexColor("#f3f4f6")
DARK    = HexColor("#111827")
MID     = HexColor("#374151")
LITE    = HexColor("#9ca3af")
BORDER  = HexColor("#e5e7eb")
HDR_BG  = HexColor("#f9f8ff")

REPORT_DATE = "2026-08-04"
BRANCH      = "master"
COMMIT      = "03c7e8f"
TOTAL       = 152

PREV = dict(passed=116, failed=23, flaky=1, skipped=12,
            note="23 failures: UI-redesign selector mismatches + login-page load timeout")
CURR = dict(passed=138, failed=0,  flaky=1, skipped=13,
            note="All 23 previously failing tests now pass or are intentionally skipped")

# (spec, tests, fix) -- ASCII only to avoid ReportLab encoding bugs
FIXED = [
    ("fixtures/api-mock.ts",
     "setAuthToken -- affects all specs",
     "page.goto default 'load' event timed out (60s) on OAuth SDKs. "
     "Changed to waitUntil:'domcontentloaded' -- only localStorage access needed."),
    ("growth.spec.ts",
     "dismissing nudge POSTs dismiss endpoint",
     "aria-label mismatch: button renders aria-label='Dismiss', not 'Dismiss recommendation'. "
     "Updated getByRole selector."),
    ("growth.spec.ts",
     "Referrals tab (5 tests: code, share URL, leaderboard, redeem, 409)",
     "ReferralCenter only renders when tab==='referrals'. Wrapped in nested describe "
     "with beforeEach that clicks Referrals tab and awaits heading."),
    ("sessions.spec.ts",
     "beforeEach gate -- blocked all 8 tests",
     "'Sign-in &amp; Security' is a p element, not a heading. "
     "Changed getByRole('heading') to getByText(/Sign-in.*Security/i)."),
    ("sessions.spec.ts",
     "page navigation -- all 8 tests",
     "page.goto('/settings') default 'load' hangs on external scripts. "
     "Changed to waitUntil:'domcontentloaded'."),
    ("wallet.spec.ts",
     "page navigation -- all 11 tests",
     "page.goto('/wallet') default 'load' caused 60s timeout. "
     "Changed to waitUntil:'domcontentloaded'."),
    ("wallet.spec.ts",
     "renders bucket breakdown chips",
     "FinancialHero has no bucket chip elements. Replaced with balance '1,240' "
     "and 'Spent this month' stat strip label check."),
    ("wallet.spec.ts",
     "NONE budget shows 'No budget set'",
     "Text doesn't exist. NONE state shows a 'Set budget' dashed button. "
     "Changed to getByRole('button', { name: 'Set budget' })."),
    ("wallet.spec.ts",
     "editing budget / after saving budget",
     "'Edit' button doesn't exist -- renamed 'Set budget'. "
     "Progress check /% used/ wrong case; fixed to /spent/i + 'of monthly budget'."),
    ("wallet.spec.ts",
     "transaction table entryType badges",
     "Raw DB values used (TRIAL, PURCHASE, USAGE DEBIT). Component maps via "
     "TYPE_LABELS: Trial credits / Top-up / AI usage."),
    ("wallet.spec.ts",
     "expiry timeline",
     "getByRole('heading') failed -- 'Credit Expiry' is a span. Changed to getByText. "
     "BUCKET_LABELS: promotionalCredits maps to 'promo credits' not 'promotional credits'."),
    ("wallet.spec.ts",
     "marketplace packs + PROVIDER failure",
     "'Buy Credits' heading gone; changed to 'Top Up Credits' (exact:true). "
     "Pack text is 'Starter - 1,000 cr'. PROVIDER test fills custom amount first."),
    ("orgs.spec.ts",
     "copilot panel sends selected orgId",
     "Copilot redesign removed 'Open Copilot' button and 'Bill to' picker. "
     "Changed to test.skip."),
]

COMMITS = [
    ("fix(e2e)", "03c7e8f",
     "Repair growth, sessions, wallet, orgs -- 23 failing tests fixed. "
     "setAuthToken waitUntil fix; tab-navigation pattern for referrals; "
     "selector updates (TYPE_LABELS, BUCKET_LABELS, span vs heading, "
     "Set budget, Top Up Credits, pack button names, /spent/i)."),
    ("fix(e2e)", "a641673",
     "library.spec.ts 7/8 to 8/8: subscriberCount fixture, /projects?tab=channels "
     "navigation, strict-mode .first() / exact:true, API intercept pattern. "
     "autonomy.spec.ts: LIFO route ordering, localStorage key, hydration gate."),
    ("fix(e2e)", "1769856",
     "autonomy.spec.ts: restore waitUntil:networkidle for 6 interactive-action tests. "
     "api-mock.ts: added publishing/wallet/channel fixture fields; regex anchor fixes."),
    ("fix(a11y)", "8ef0fbd",
     "text-gray-400 to text-gray-600 (3.7:1 to 5.9:1 contrast) across 17 pages; "
     "aria-label on user-menu; role=img on star ratings."),
    ("feat(media)", "3d7595b",
     "GET /system/media-providers probes all adapter availability; "
     "Kling v2 API rewrite; A1111/ComfyUI/Runway adapter guards."),
]

STILL_FAILING = [
    ("navigation.spec.ts:80",
     "root path / shows landing page",
     "Flaky (pre-existing). SSR/hydration timing on first visit. Passes on retry."),
]

OUTSTANDING = [
    ("HIGH", "Full-suite cascade risk",
     "All 23 failures confirmed fixed in isolated per-spec runs. A full 152-test "
     "sequential run can still hit dev-server memory pressure after 90+ min. "
     "Fix: --workers=4 or add server restart between suites in CI."),
    ("HIGH", "navigation.spec.ts:80 flaky",
     "Root path / fails on first attempt, passes on retry. Add waitForSelector "
     "hydration gate (same pattern as autonomy scheduler fix)."),
    ("MED", "CI Playwright workflow",
     "No GitHub Actions workflow runs the E2E suite. Add .github/workflows/e2e.yml "
     "that builds Next.js, starts the server, and runs npx playwright test."),
    ("MED", "Vercel deploy verification",
     "Commit 03c7e8f pushed to master. Verify Vercel auto-deploy completed."),
    ("LOW", "orgs.spec.ts copilot billing test",
     "test.skip added because feature was removed in redesign. "
     "Replace with a test that covers the current billing UI."),
]


def make_style(name, **kw):
    base = {"fontName": "Helvetica"}
    base.update(kw)
    return ParagraphStyle(name, **base)


def make_table(rows, widths, row_bgs=None):
    bgs = row_bgs or [white, HDR_BG]
    t = Table(rows, colWidths=widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), HDR_BG),
        ("LINEBELOW",     (0, 0), (-1, 0), 1, BORDER),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), bgs),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    return t


def make_pdf(path):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        topMargin=16*mm, bottomMargin=16*mm,
        leftMargin=16*mm, rightMargin=16*mm,
    )

    H1    = make_style("H1",  fontSize=21, leading=27, textColor=DARK,
                       fontName="Helvetica-Bold", spaceBefore=0, spaceAfter=4)
    H2    = make_style("H2",  fontSize=12, leading=17, textColor=BRAND,
                       fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=3)
    BODY  = make_style("BODY",fontSize=9,  leading=13, textColor=MID)
    TINY  = make_style("TINY",fontSize=8,  leading=11, textColor=LITE)
    MONO  = make_style("MONO",fontSize=8,  leading=11, textColor=DARK, fontName="Courier")
    TH    = make_style("TH",  fontSize=8,  leading=11, fontName="Helvetica-Bold", textColor=MID)
    TD    = make_style("TD",  fontSize=8,  leading=12, textColor=DARK)
    TDS   = make_style("TDS", fontSize=8,  leading=12, textColor=MID)
    EL    = make_style("EL",  fontSize=9,  fontName="Helvetica-Bold", textColor=DARK,
                       spaceBefore=4, spaceAfter=1)
    EB    = make_style("EB",  fontSize=8,  leading=12, textColor=MID, leftIndent=8)

    story = []

    # Header
    story.append(Paragraph("Sozialzync / AI CreatorForce", TINY))
    story.append(Paragraph("Playwright E2E Test Report", H1))
    story.append(Paragraph(
        "Date: <b>" + REPORT_DATE + "</b>  Branch: <b>" + BRANCH +
        "</b>  Commit: <b>" + COMMIT + "</b>  Tests: <b>" + str(TOTAL) + "</b>", TINY))
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width="100%", color=BORDER))
    story.append(Spacer(1, 3*mm))

    # 1. Scorecard
    story.append(Paragraph("1. Summary", H2))

    def score_row(label, prev, curr, col):
        delta = curr - prev
        sign  = "+" if delta > 0 else ""
        dcol  = PASS_C if delta > 0 else (FAIL_C if delta < 0 else LITE)
        return [
            Paragraph(label, make_style("SL", fontSize=9, fontName="Helvetica-Bold", textColor=MID)),
            Paragraph(str(prev), make_style("PV", fontSize=14, fontName="Helvetica-Bold",
                       textColor=LITE, alignment=TA_CENTER)),
            Paragraph(str(curr), make_style("CV", fontSize=14, fontName="Helvetica-Bold",
                       textColor=col, alignment=TA_CENTER)),
            Paragraph(sign + str(delta), make_style("DV", fontSize=11, fontName="Helvetica-Bold",
                       textColor=dcol, alignment=TA_CENTER)),
        ]

    def hdr_para(text, align=None):
        kw = dict(fontSize=8, fontName="Helvetica-Bold", textColor=MID)
        if align:
            kw["alignment"] = align
        return Paragraph(text, make_style("SH", **kw))

    sc = [
        [hdr_para("Metric"), hdr_para("Before (a641673)", TA_CENTER),
         hdr_para("After (03c7e8f)", TA_CENTER), hdr_para("Delta", TA_CENTER)],
        score_row("Passed",  PREV["passed"],  CURR["passed"],  PASS_C),
        score_row("Failed",  PREV["failed"],  CURR["failed"],  FAIL_C),
        score_row("Flaky",   PREV["flaky"],   CURR["flaky"],   FLK_C),
        score_row("Skipped", PREV["skipped"], CURR["skipped"], SKP_C),
    ]
    story.append(make_table(sc, [65*mm, 37*mm, 37*mm, 37*mm]))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("<b>Before:</b> " + PREV["note"], TINY))
    story.append(Paragraph("<b>After:</b>  " + CURR["note"], TINY))
    story.append(Spacer(1, 3*mm))

    # 2. Tests fixed
    story.append(HRFlowable(width="100%", color=BORDER))
    story.append(Paragraph("2. Tests Fixed This Session", H2))
    story.append(Paragraph(
        str(len(FIXED)) + " fixes across 5 files. 22 previously failing tests now pass; "
        "1 intentionally skipped (feature removed in redesign).", BODY))
    story.append(Spacer(1, 2*mm))

    for spec, tests, fix in FIXED:
        label_text = '<font color="#6D4AE0">[' + spec + ']</font>  ' + tests
        story.append(Paragraph(label_text, EL))
        story.append(Paragraph(fix, EB))
    story.append(Spacer(1, 3*mm))

    # 3. Commits
    story.append(HRFlowable(width="100%", color=BORDER))
    story.append(Paragraph("3. Commits on master", H2))

    cm_rows = [[Paragraph(h, TH) for h in ["Type", "SHA", "Description"]]]
    for tag, sha, desc in COMMITS:
        cm_rows.append([
            Paragraph("<b>" + tag + "</b>", make_style("CT", fontSize=8,
                       fontName="Helvetica-Bold", textColor=BRAND)),
            Paragraph(sha[:7], MONO),
            Paragraph(desc, TDS),
        ])
    story.append(make_table(cm_rows, [22*mm, 18*mm, 138*mm]))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        "All commits pushed to <b>master -> GitHub -> Vercel</b> (auto-deploy on push).", TINY))
    story.append(Spacer(1, 3*mm))

    # 4. Still failing
    story.append(HRFlowable(width="100%", color=BORDER))
    story.append(Paragraph("4. Still Failing / Flaky", H2))
    story.append(Paragraph(
        "After this session, <b>0 tests fail</b> in isolated per-spec runs. "
        "One pre-existing flaky test remains (passes on retry).", BODY))
    story.append(Spacer(1, 2*mm))

    sf_rows = [[Paragraph(h, TH) for h in ["Location", "Test Name", "Status"]]]
    for loc, name, reason in STILL_FAILING:
        sf_rows.append([
            Paragraph(loc, MONO),
            Paragraph(name, TD),
            Paragraph(reason, make_style("SR", fontSize=8, leading=12, textColor=FLK_C)),
        ])
    story.append(make_table(sf_rows, [42*mm, 66*mm, 70*mm], [white, FLK_BG]))
    story.append(Spacer(1, 3*mm))

    # 5. Outstanding
    story.append(HRFlowable(width="100%", color=BORDER))
    story.append(Paragraph("5. Outstanding Items", H2))

    pri_c  = {"HIGH": FAIL_C, "MED": FLK_C, "LOW": LITE}
    pri_bg = {"HIGH": FAIL_BG, "MED": FLK_BG, "LOW": SKP_BG}

    for pri, title, detail in OUTSTANDING:
        row = [[
            Paragraph("<b>" + pri + "</b>", make_style("PR", fontSize=8,
                       fontName="Helvetica-Bold", textColor=pri_c[pri], alignment=TA_CENTER)),
            Paragraph("<b>" + title + "</b>", make_style("PT", fontSize=9,
                       fontName="Helvetica-Bold", textColor=DARK)),
            Paragraph(detail, TDS),
        ]]
        nt = Table(row, colWidths=[14*mm, 46*mm, 118*mm])
        nt.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, -1), pri_bg[pri]),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("BOX",           (0, 0), (-1, -1), 1, BORDER),
            ("LINEBELOW",     (0, 0), (-1, -1), 0.5, BORDER),
        ]))
        story.append(nt)
        story.append(Spacer(1, 1*mm))

    story.append(Spacer(1, 5*mm))

    # Footer
    story.append(HRFlowable(width="100%", color=BORDER))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Sozialzync / AI CreatorForce  |  Playwright E2E Report  |  " +
        REPORT_DATE + "  |  Generated by Claude Code (Sonnet 4.6)", TINY))

    doc.build(story)
    print("Saved: " + path)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "E2E-Test-Report-" + REPORT_DATE + ".pdf"
    make_pdf(out)
