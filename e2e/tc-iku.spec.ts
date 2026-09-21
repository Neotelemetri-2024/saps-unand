import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.7 Modul Monitoring IKU 3 Kemdiktisaintek (TC-IKU)', () => {

  test('TC-IKU-01: Agregasi KPI IKU 3 se-Universitas Andalas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.pimpinanUtama.email);
    await page.fill('#login-password', accounts.pimpinanUtama.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/pimpinan_utama\/dashboard/);

    await page.goto('/pimpinan_utama/iku3/dashboard');
    // Memastikan metrik KPI utama termuat dengan benar (BUG-04 Fixed)
    await expect(page.locator('text=Target IKU 3')).toBeVisible();
    await expect(page.locator('text=Capaian Saat Ini')).toBeVisible();
    await expect(page.locator('text=Gap Kontributor')).toBeVisible();
  });

  test('TC-IKU-02: Isolasi data tenancy fakultas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.adminFakultas.email);
    await page.fill('#login-password', accounts.adminFakultas.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/admin_fakultas/iku3/dashboard');
    // Hanya menampilkan data fakultas terkait
    await expect(page.locator('text=Fakultas TI').first()).toBeVisible();
    // Pastikan tidak ada data fakultas lain yang bocor (isolasi data aman)
    const isOtherFacultyVisible = await page.isVisible('text=Fakultas Hukum');
    expect(isOtherFacultyVisible).toBe(false);
  });

  test('TC-IKU-03: Pembaruan target tahunan/triwulan IKU 3', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.pimpinanDitmawa.email);
    await page.fill('#login-password', accounts.pimpinanDitmawa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/pimpinan_ditmawa/pengaturan-iku3');
    await page.fill('input[name="targetTahun"]', '50'); // 50%
    await page.click('button:has-text("Simpan Target")');
    
    await expect(page.locator('text=Target IKU 3 berhasil diperbarui')).toBeVisible();
  });

  test('TC-IKU-04: Ekspor laporan eksekutif spreadsheet Excel', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.pimpinanUtama.email);
    await page.fill('#login-password', accounts.pimpinanUtama.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/pimpinan_utama/laporan');
    
    // Test fitur download file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Ekspor Excel")')
    ]);
    
    // Pastikan file yang terunduh berekstensi .xlsx
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

});
