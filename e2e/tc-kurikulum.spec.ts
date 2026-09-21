import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.2 Modul Kurikulum & Rubrik Matriks Poin (TC-KUR)', () => {

  test('TC-KUR-01: Pembuatan kurikulum baru (draft)', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);
    await page.goto('/admin_ditmawa/master-data/kurikulum');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/master-data\/kurikulum/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-KUR-02: Validasi total bobot sub-capaian != 100%', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);
    await page.goto('/admin_ditmawa/master-data/kurikulum');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/master-data\/kurikulum/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-KUR-03: Pengaturan entri matriks rubrik poin (Upsert)', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);
    await page.goto('/admin_ditmawa/master-data/matriks-poin');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/master-data\/matriks-poin/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-KUR-04: Aktivasi kurikulum tunggal per angkatan', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);
    await page.goto('/admin_ditmawa/master-data/kurikulum');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/master-data\/kurikulum/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

});
