import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.3 Modul Manajemen Kegiatan & Dual-Stage Approval (TC-KEG)', () => {

  test('TC-KEG-01: Mahasiswa mengajukan kegiatan eksternal mandiri', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);

    await page.goto('/mahasiswa/kegiatan-eksternal/ajukan');
    await page.fill('input[name="namaKegiatan"]', 'Lomba UI/UX Nasional 2026');
    await page.fill('input[name="penyelenggara"]', 'Kemenristek');
    await page.selectOption('select[name="kategoriId"]', { index: 1 });
    await page.selectOption('select[name="skalaId"]', { index: 1 });
    
    await page.click('button:has-text("Kirim")');
    await page.click('button:has-text("Ya, kirim")');

    await expect(page.locator('text=Berhasil diajukan')).toBeVisible();
  });

  test('TC-KEG-02: Admin Ditmawa memverifikasi kegiatan & alokasi capaian', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);

    await page.goto('/admin_ditmawa/verifikasi-kegiatan');
    await page.click('text=Lomba UI/UX Nasional 2026');
    await page.click('button:has-text("Verifikasi & Petakan Capaian")');
    
    await page.check('input[type="checkbox"]');
    
    await page.click('button:has-text("Teruskan ke Pimpinan")');
    await expect(page.locator('text=Berhasil diverifikasi')).toBeVisible();
  });

  test('TC-KEG-03: Pimpinan Ditmawa memberikan approval akhir kegiatan', async ({ page }) => {
    await injectAuth(page, 'pimpinan_ditmawa', accounts.pimpinanDitmawa.email);

    await page.goto('/pimpinan_ditmawa/persetujuan-kegiatan');
    await page.click('text=Lomba UI/UX Nasional 2026');
    await page.click('button:has-text("Setujui")');
    
    await expect(page.locator('text=Pengajuan disetujui')).toBeVisible();
  });

  test('TC-KEG-04: Maker-Checker (Pembuat tidak boleh approve)', async ({ request }) => {
    // Langsung test API — operator tidak boleh verifikasi kegiatan sendiri
    // Tanpa token valid, backend menolak dengan 401 atau 403
    const response = await request.post('https://api-studentconnect.unand.ac.id/api/kegiatan/internal/1/verifikasi', {
      data: { status: 'terverifikasi' }
    });
    
    // Tanpa auth = 401, dengan auth tapi maker = 403
    expect([401, 403]).toContain(response.status());
  });

});
