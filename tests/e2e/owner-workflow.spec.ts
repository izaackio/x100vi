import { test, expect, type Page } from '@playwright/test';
test.beforeAll(() => {
  if (!process.env.OWNER_EMAIL?.endsWith('@example.test') || !process.env.TEST_OWNER_PASSWORD)
    throw new Error('Use an isolated test database and an @example.test test owner. See README.');
});
async function login(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Owner email').fill(process.env.OWNER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page).toHaveURL(/\/$/);
}
test('owner creates a watch, imports and corrects evidence, inspects costs and rechecks', async ({
  page,
}) => {
  await login(page);
  await page.locator('.sidebar').getByRole('link', { name: 'Create a watch', exact: true }).click();
  await page.getByLabel('Watch name').fill('Browser test watch');
  await page.getByRole('button', { name: 'Create watch' }).click();
  await expect(
    page.getByRole('heading', { name: 'The right camera. The right price.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: '＋ Import listing', exact: true }).click();
  await page
    .getByLabel('Original listing URL')
    .fill('https://www.tradera.com/item/342564/888888888/synthetic-x100vi');
  await page.getByLabel('Listing title', { exact: true }).fill('Synthetic Fujifilm X100VI Silver');
  await page
    .getByLabel('Listing description')
    .fill('Synthetic browser fixture only. Fully working X100VI camera and case. Inga fel.');
  await page.getByLabel('Camera generation').selectOption('x100vi');
  await page.getByLabel('What is being offered?').selectOption('camera_sale');
  await page.getByLabel('Functionality stated').selectOption('working');
  await page.getByRole('combobox', { name: 'Availability', exact: true }).selectOption('active');
  await page.getByLabel('Price type').selectOption('asking');
  await page.getByLabel('Seller country').selectOption('SE');
  await page.getByRole('textbox', { name: 'Displayed amount', exact: true }).fill('14000');
  await page.getByLabel('Buyer protection · SEK').fill('499');
  await page.getByLabel('Other required fees · SEK').fill('0');
  await page.getByRole('button', { name: 'Import & validate' }).click();
  const card = page
    .locator('.listing-card')
    .filter({ hasText: 'Synthetic Fujifilm X100VI Silver' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Full cost needs checking')).toBeVisible();
  await expect(card.getByText('Unknown', { exact: true })).toBeVisible();
  await expect(card.getByText('Needs review', { exact: true })).toBeVisible();
  await card.getByRole('link', { name: 'Update evidence' }).click();
  await page.getByLabel('Shipping · SEK').fill('59');
  await page.getByRole('button', { name: 'Update evidence & validate' }).click();
  await expect(card.getByText('↘ Below your budget')).toBeVisible();
  await expect(card.locator('.listing-price strong')).toHaveText(/14\s*558/);
  await expect(card.locator('.pill')).toHaveText('Needs review');
  await expect(card.getByText('User-reported · manual import')).toBeVisible();
  await card.getByRole('button', { name: 'Re-evaluate', exact: true }).click();
  const latestRun = page.locator('.runs .run').first();
  await expect(latestRun.locator('strong')).toHaveText('Listing recheck · completed', {
    timeout: 15000,
  });
  await expect(latestRun.locator('p')).toContainText('Stored evidence re-evaluated.');
  await page.getByRole('button', { name: 'Search now' }).click();
  await expect(latestRun.locator('strong')).toHaveText('Watch search · completed', {
    timeout: 15000,
  });
  await page.getByRole('link', { name: 'Edit watch' }).click();
  await page.getByLabel('Total budget · SEK').fill('14 558');
  await page.getByRole('button', { name: 'Save watch' }).click();
  await expect(card.getByText('At or above your budget')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Your deal feed' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/import');
  await expect(page).toHaveURL(/\/login/);
});
test('invalid credentials cannot open the workspace', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Owner email').fill('intruder@example.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password-at-least-12');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.locator('p[role=alert]')).toContainText('Sign-in failed');
  await page.goto('/watches/new');
  await expect(page).toHaveURL(/\/login/);
});
