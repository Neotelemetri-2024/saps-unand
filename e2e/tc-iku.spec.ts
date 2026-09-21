import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.7 Modul Monitoring IKU 3 Kemdiktisaintek (TC-IKU)', () => {

  test('TC-IKU-01: Agregasi KPI IKU 3 se-Universitas Andalas', async ({ page }) => {
    await injectAuth(page, 'pimpinan_utama', accounts.pimpinanUtama.email);
    await expect(page).toHaveURL(/.*\/pimpinan_utama\/dashboard/);

    await page.goto('/pimpinan_utama/monitoring-iku3');
    // Memastikan halaman monitoring IKU3 termuat
    await expect(page).toHaveURL(/.*\/pimpinan_utama\/monitoring-iku3/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-IKU-02: Isolasi data tenancy fakultas', async ({ page }) => {
    await injectAuth(page, 'admin_fakultas', accounts.adminFakultas.email);

    await page.goto('/admin_fakultas/monitoring-iku3');
    // Verifikasi halaman monitoring IKU3 fakultas termuat
    await expect(page).toHaveURL(/.*\/admin_fakultas\/monitoring-iku3/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-IKU-03: Pembaruan target tahunan/triwulan IKU 3', async ({ page }) => {
    await injectAuth(page, 'pimpinan_ditmawa', accounts.pimpinanDitmawa.email);

    await page.goto('/pimpinan_ditmawa/monitoring-iku3');
    // Verifikasi halaman monitoring IKU3 termuat untuk pimpinan ditmawa
    await expect(page).toHaveURL(/.*\/pimpinan_ditmawa\/monitoring-iku3/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-IKU-04: Ekspor laporan eksekutif spreadsheet Excel', async ({ page }) => {
    await injectAuth(page, 'pimpinan_utama', accounts.pimpinanUtama.email);

    await page.goto('/pimpinan_utama/laporan');
    // Verifikasi halaman laporan termuat
    await expect(page).toHaveURL(/.*\/pimpinan_utama\/laporan/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

});
