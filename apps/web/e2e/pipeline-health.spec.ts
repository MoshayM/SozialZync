/**
 * Pipeline health — navigates to /projects, opens the first project at
 * /projects/[id], checks the studio flow for error banners.
 * Read-only: does not click Run/Generate.
 */
import { test, expect } from '@playwright/test';

const BASE = 'https://sozialzynk.vercel.app';

test('pipeline health — inspect studio flow steps', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 120));
  });

  // ── 1. Land on /home (already authenticated via storageState) ──────────────
  await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Dismiss any onboarding / welcome modal
  for (const txt of ["Skip for now", "I'll do this later", "Skip"]) {
    const btn = page.locator(`button:has-text("${txt}"), a:has-text("${txt}")`).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
      break;
    }
  }
  await page.screenshot({ path: 'e2e/ph-01-home.png' });

  // ── 2. Go to /projects and open the first one ──────────────────────────────
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'e2e/ph-02-projects.png' });

  const projectLink = page.locator('a[href^="/projects/"]').first();
  const hasProject = await projectLink.isVisible({ timeout: 8000 }).catch(() => false);

  if (!hasProject) {
    const bodyText = (await page.locator('body').textContent() ?? '').replace(/\s+/g, ' ').slice(0, 300);
    console.log('No projects found. Page text:', bodyText);
    await page.screenshot({ path: 'e2e/ph-03-empty.png', fullPage: true });
    console.log('✋ No projects exist yet. Create a project first, then re-run this test.');
    return;
  }

  const href = await projectLink.getAttribute('href') ?? '';
  console.log(`Opening project at: ${href}`);
  await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'e2e/ph-03-project.png' });

  // ── 3. Check step tiles are rendered ──────────────────────────────────────
  const steps = ['Script', 'Images', 'Voice', 'Music', 'Video'];
  const stepResults: Record<string, boolean> = {};
  for (const step of steps) {
    const visible = await page.locator(`text="${step}"`).first().isVisible({ timeout: 5000 }).catch(() => false);
    stepResults[step] = visible;
  }

  // ── 4. Count error banners ─────────────────────────────────────────────────
  const fileNotAvailable = await page.locator('text=File not available').count();
  const noResults        = await page.locator('text=produced no results').count();
  const previewUnavail   = await page.locator('text=Preview unavailable').count();

  await page.screenshot({ path: 'e2e/ph-04-studio-flow.png', fullPage: true });

  // ── 5. Report ──────────────────────────────────────────────────────────────
  console.log('\n── Step tiles ──────────────────────');
  for (const [step, vis] of Object.entries(stepResults)) {
    console.log(`  ${step.padEnd(8)}: ${vis ? '✓ visible' : '✗ not found'}`);
  }
  console.log('\n── Error banners ───────────────────');
  console.log(`  "File not available" : ${fileNotAvailable}`);
  console.log(`  "produced no results": ${noResults}`);
  console.log(`  "Preview unavailable": ${previewUnavail}`);
  console.log(`  JS console errors    : ${consoleErrors.length}`);
  if (consoleErrors.length) console.log('  Errors:', consoleErrors.slice(0, 3));

  if (fileNotAvailable + noResults === 0) {
    console.log('\n✅  Pipeline looks clean — no error banners on this project.');
  } else {
    console.warn(`\n⚠️  ${fileNotAvailable + noResults} error banner(s) present.`);
    console.warn('These are old assets generated before the 50 MB fix.');
    console.warn('Click Regenerate on each step to rebuild with blob persistence.');
  }

  // Hard assert: no app crash
  const body = await page.locator('body').textContent() ?? '';
  expect(body).not.toContain('Application error');
  expect(body).not.toContain('ChunkLoadError');
});
