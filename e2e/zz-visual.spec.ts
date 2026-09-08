import { test } from '@playwright/test';

import { loginAsAdmin } from './helpers';

const SHOT = 'C:/Users/DELL/AppData/Local/Temp/claude/c--Users-DELL-OneDrive-Desktop-bribar/c54f2f0a-b732-40a4-ad90-967094a48e7d/scratchpad';

test('header control strip alignment', async ({ page }) => {
  await loginAsAdmin(page);

  for (const path of ['/admin/routes', '/admin/services', '/admin/users']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const slug = path.replace(/\//g, '-');
    await page.locator('header').last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOT}/hdr${slug}.png`, clip: { x: 240, y: 100, width: 1200, height: 140 } });
  }
});
