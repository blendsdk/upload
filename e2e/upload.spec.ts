import { expect, test } from '@playwright/test';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
  'base64',
);

test('selects a file, shows progress and reaches ready', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Drag files here, or browse')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: PNG,
  });

  await expect(page.getByText('portrait.png')).toBeVisible();
  await expect(page.getByText('Ready')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('1 file(s) ready to commit.')).toBeVisible();
});
