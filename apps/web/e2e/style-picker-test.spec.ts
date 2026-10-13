import { test, expect } from '@playwright/test';

// Verifies the visual style picker inside the Images step detail panel.
// Requires: a project with script done (Images tile unlocked).
test('style picker — grouped layout (5 groups, 25 styles), Cinematic selection + generation', async ({ page }) => {
  await page.goto('/home');
  await page.waitForURL(/\/(home|projects|dashboard)/, { timeout: 30000 });
  await page.screenshot({ path: 'e2e/sp-01-home.png' });

  // Open the first project card
  const projectLink = page.locator('a[href*="/projects/"]').first();
  await projectLink.waitFor({ timeout: 15000 });
  const href = await projectLink.getAttribute('href');
  console.log('Opening project:', href);
  await projectLink.click();
  await page.waitForURL(/projects\//, { timeout: 20000 });
  await page.waitForTimeout(2000); // let pipeline state load
  await page.screenshot({ path: 'e2e/sp-02-project.png' });

  // Check if Images tile is expandable (script must be done first).
  // Use exact aria-label to avoid matching the outer card's role=button.
  const chevron = page.locator('[aria-label="Expand Images"]');
  const isExpandable = await chevron.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isExpandable) {
    console.log('⚠ Images tile is locked (script not yet complete) — skipping style picker check');
    await page.screenshot({ path: 'e2e/sp-03-locked.png' });
    return; // not a failure; pipeline just hasn't reached this step
  }

  // Click the chevron (not the outer card div which has role=button) to expand.
  await chevron.click();
  // Wait for the "Visual Style" heading that appears in the detail panel — proof it opened.
  await page.locator('text=Visual Style').waitFor({ timeout: 10000 });
  await page.screenshot({ path: 'e2e/sp-03-images-expanded.png', fullPage: true });
  console.log('✓ Images panel expanded — Visual Style section confirmed');

  // ── Verify grouped style layout (25 styles across 5 groups) ─────────────
  // Check all 5 group labels are present
  const groups = ['Auto', 'Realistic & Cinematic', 'Animation & 3D', 'Artistic & Illustrated', 'Stylized & Creative'];
  for (const group of groups) {
    const label = page.locator(`text="${group}"`).first();
    const visible = await label.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`${visible ? '✓' : '✗'} Group label: ${group}`);
    expect(visible, `Expected group label "${group}" to be visible`).toBe(true);
  }

  // Check representative styles from each group (not legacy aliases animation/minimal)
  const styleLabels = [
    'AI Picks',             // Auto
    'Realistic', 'Cinematic', 'Documentary',  // Realistic & Cinematic
    'Cartoon', 'Anime', 'Pixel Art',          // Animation & 3D
    'Watercolor', 'Sketch', 'Comic',          // Artistic & Illustrated
    'Cyberpunk', 'Surreal', 'Minimalist',     // Stylized & Creative
  ];
  const found: string[] = [];
  const missing: string[] = [];

  for (const label of styleLabels) {
    const btn = page.locator(`button:has-text("${label}")`).first();
    const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    (visible ? found : missing).push(label);
    console.log(`${visible ? '✓' : '✗'} Style button: ${label}`);
  }

  console.log(`Visible: ${found.length}/${styleLabels.length}`);
  if (missing.length) console.log('Missing:', missing.join(', '));

  expect(found.length, `Expected all style buttons visible, missing: ${missing.join(', ')}`).toBe(styleLabels.length);

  // ── Select Cinematic ──────────────────────────────────────────────────────
  const cinematicBtn = page.locator('button:has-text("Cinematic")').first();
  await cinematicBtn.scrollIntoViewIfNeeded();
  await cinematicBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'e2e/sp-04-cinematic-selected.png', fullPage: true });
  console.log('✓ Cinematic selected');

  // ── Trigger image generation and check for errors ─────────────────────────
  const runBtn = page.locator('button:has-text("Regenerate"), button:has-text("Run")').first();
  const runVisible = await runBtn.isVisible({ timeout: 3000 }).catch(() => false);

  if (runVisible) {
    await runBtn.click();
    console.log('✓ Clicked generate button');
    await page.screenshot({ path: 'e2e/sp-05-generating.png' });

    // Wait up to 2 min for completion badge or any scene image appearing
    await page.waitForSelector('[data-state="done"], text=/scene.*ready/i', { timeout: 120000 })
      .catch(() => null);
    await page.screenshot({ path: 'e2e/sp-06-result.png', fullPage: true });

    const hasError = await page.locator('text=File not available, text=produced no results').isVisible().catch(() => false);
    console.log(hasError ? '✗ Error visible after generation' : '✓ No errors after generation');
  } else {
    console.log('ℹ No generate button available — Images step may already be completed');
  }

  await page.screenshot({ path: 'e2e/sp-07-final.png', fullPage: true });
});
