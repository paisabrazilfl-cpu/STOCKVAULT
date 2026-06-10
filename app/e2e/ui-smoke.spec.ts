import { test, expect } from '@playwright/test';

test.describe('STOCKVAULT UI Smoke Tests', () => {
  test('MR.BOT page loads and displays Coming Soon', async ({ page }) => {
    await page.goto('/mr-bot');
    await expect(page.locator('text=Coming Soon')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=MR.BOT')).toBeVisible();
    await expect(page.locator('text=Development in progress')).toBeVisible();
  });

  test('Alpaca Docs page loads with core capabilities', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.locator('text=Alpaca CLI Integration')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Installation')).toBeVisible();
    await expect(page.locator('text=Authentication')).toBeVisible();
  });

  test('Navigation sidebar renders correctly', async ({ page }) => {
    await page.goto('/mr-bot');
    await expect(page.locator('text=STOCKVAULT')).toBeVisible();
    await expect(page.locator('a[href="/mr-bot"]')).toBeVisible();
    await expect(page.locator('a[href="/docs"]')).toBeVisible();
    await expect(page.locator('a[href="/"]')).toBeVisible();
  });
});
