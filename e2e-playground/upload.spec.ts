import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const png = readFileSync(new URL('./fixtures/portrait.png', import.meta.url));
const pdf = readFileSync(new URL('./fixtures/letter.pdf', import.meta.url));

test('uploads an image, commits it, and finalizes a document', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BlendSDK Upload Playground' })).toBeVisible();

  const images = page.locator('section').nth(0);
  const documents = page.locator('section').nth(1);

  await images.locator('input[type=file]').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(images.getByText('portrait.png')).toBeVisible();
  await expect(images.getByRole('button', { name: 'Commit images' })).toBeEnabled({
    timeout: 30_000,
  });

  await images.getByRole('button', { name: 'Commit images' }).click();
  await expect(page.getByText('Committed 1 image session(s).')).toBeVisible({ timeout: 30_000 });

  const imageHref = await images.locator('.file-links a').first().getAttribute('href');
  expect(imageHref).toBeTruthy();
  const imageResponse = await page.request.get(new URL(imageHref!, page.url()).toString());
  expect(imageResponse.status()).toBe(200);

  await documents.locator('input[type=file]').setInputFiles({
    name: 'letter.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  });
  await expect(documents.getByText('letter.pdf')).toBeVisible();
  await expect(documents.locator('.file-links a').first()).toBeVisible({ timeout: 30_000 });

  const documentHref = await documents.locator('.file-links a').first().getAttribute('href');
  expect(documentHref).toBeTruthy();
  const documentResponse = await page.request.get(new URL(documentHref!, page.url()).toString());
  expect(documentResponse.status()).toBe(200);
  expect(documentResponse.headers()['content-type']).toContain('application/pdf');
});
