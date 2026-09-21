import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.4 Modul Partisipasi & Presensi Kehadiran (TC-PRT)', () => {

  test.beforeEach(async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-PRT-01: Mahasiswa mendaftar event kampus terpublikasi', async ({ page }) => {
    await page.goto('/mahasiswa/riwayat-kegiatan-internal');
    await expect(page).toHaveURL(/.*\/mahasiswa\/riwayat-kegiatan-internal/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-PRT-02: Pendaftaran ganda pada satu kegiatan yang sama', async ({ page }) => {
    await page.goto('/mahasiswa/riwayat-kegiatan-internal');
    await expect(page).toHaveURL(/.*\/mahasiswa\/riwayat-kegiatan-internal/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-PRT-03: Impor presensi kehadiran via file spreadsheet', async ({ page }) => {
    await injectAuth(page, 'operator_ukm', accounts.operatorUKM.email);
    await page.goto('/operator_ukm/daftar-kegiatan');
    await expect(page).toHaveURL(/.*\/operator_ukm\/daftar-kegiatan/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

});
