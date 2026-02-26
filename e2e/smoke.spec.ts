import { test, expect } from '@playwright/test';

test('home loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mobile Chat MVP' })).toBeVisible();
});
