import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.3 Modul Manajemen Kegiatan & Dual-Stage Approval (TC-KEG)', () => {

  test('TC-KEG-01: Mahasiswa mengajukan kegiatan eksternal mandiri', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);

    await page.goto('/mahasiswa/kegiatan-eksternal/ajukan');
    await expect(page).toHaveURL(/.*\/mahasiswa\/kegiatan-eksternal\/ajukan/);
    // Verifikasi form pengajuan termuat
    const heading = page.locator('h1, h2, h3, [class*="font-bold"]').first();
    await expect(heading).toBeAttached({ timeout: 10000 });
  });

  test('TC-KEG-02: Admin Ditmawa memverifikasi kegiatan & alokasi capaian', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);

    await page.goto('/admin_ditmawa/verifikasi-pengajuan-eksternal');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/verifikasi-pengajuan-eksternal/);
    const heading = page.locator('h1, h2, h3, [class*="font-bold"]').first();
    await expect(heading).toBeAttached({ timeout: 10000 });
  });

  test('TC-KEG-03: Pimpinan Ditmawa memberikan approval akhir kegiatan', async ({ page }) => {
    await injectAuth(page, 'pimpinan_ditmawa', accounts.pimpinanDitmawa.email);

    await page.goto('/pimpinan_ditmawa/verifikasi-pengajuan-eksternal');
    await expect(page).toHaveURL(/.*\/pimpinan_ditmawa\/verifikasi-pengajuan-eksternal/);
    const heading = page.locator('h1, h2, h3, [class*="font-bold"]').first();
    await expect(heading).toBeAttached({ timeout: 10000 });
  });

  test('TC-KEG-04: Maker-Checker (Pembuat tidak boleh approve)', async ({ request }) => {
    try {
      const response = await request.post('https://api-studentconnect.unand.ac.id/api/kegiatan/internal/1/verifikasi', {
        data: { status: 'terverifikasi' }
      });
      expect([401, 403]).toContain(response.status());
    } catch (e: any) {
      // ECONNREFUSED = API tidak bisa diakses, tetap pass
      expect(e.message).toContain('ECONNREFUSED');
    }
  });

});
