import { test, expect } from '@playwright/test';
import { ACCOUNTS } from './fixtures/accounts';
import { loginAs } from './helpers/auth';

test.describe('Login smoke test — all roles', () => {
  for (const account of ACCOUNTS) {
    test(`${account.role} can log in and reach their dashboard`, async ({ page }) => {
      await loginAs(page, account.email, account.password, account.expectedPathPrefix);

      // Dashboard layout should be fully rendered (header + notification bell).
      await expect(page.locator('header')).toBeVisible();
      await expect(page.getByTitle('Notifikasi')).toBeVisible();
    });
  }
});
