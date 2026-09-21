import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.3 Modul Manajemen Kegiatan & Dual-Stage Approval (TC-KEG)', () => {

  test('TC-KEG-01: Mahasiswa mengajukan kegiatan eksternal mandiri', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);

    await page.goto('/mahasiswa/kegiatan-eksternal/ajukan');
    await page.fill('input[name="namaKegiatan"]', 'Lomba UI/UX Nasional 2026');
    await page.fill('input[name="penyelenggara"]', 'Kemenristek');
    // Asumsikan ada dropdown untuk Kategori dan Skala
    await page.selectOption('select[name="kategoriId"]', { index: 1 });
    await page.selectOption('select[name="skalaId"]', { index: 1 });
    
    await page.click('button:has-text("Kirim")');
    await page.click('button:has-text("Ya, kirim")');

    await expect(page.locator('text=Berhasil diajukan')).toBeVisible();
  });

  test('TC-KEG-02: Admin Ditmawa memverifikasi kegiatan & alokasi capaian', async ({ page }) => {
    // Login Admin
    await page.goto('/login');
    await page.fill('#login-email', accounts.adminDitmawa.email);
    await page.fill('#login-password', accounts.adminDitmawa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/admin_ditmawa/verifikasi-kegiatan');
    // Klik kegiatan pertama yang statusnya diajukan
    await page.click('text=Lomba UI/UX Nasional 2026');
    await page.click('button:has-text("Verifikasi & Petakan Capaian")');
    
    // Asumsikan alokasi 100% ke sub-capaian pertama
    await page.check('input[type="checkbox"]');
    
    await page.click('button:has-text("Teruskan ke Pimpinan")');
    await expect(page.locator('text=Berhasil diverifikasi')).toBeVisible();
  });

  test('TC-KEG-03: Pimpinan Ditmawa memberikan approval akhir kegiatan', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.pimpinanDitmawa.email);
    await page.fill('#login-password', accounts.pimpinanDitmawa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/pimpinan_ditmawa/persetujuan-kegiatan');
    await page.click('text=Lomba UI/UX Nasional 2026');
    await page.click('button:has-text("Setujui")');
    
    await expect(page.locator('text=Pengajuan disetujui')).toBeVisible();
  });

  test('TC-KEG-04: Maker-Checker (Pembuat tidak boleh approve)', async ({ page }) => {
    // Skenario di mana operator membuat kegiatan internal lalu mencoba memverifikasinya sendiri
    // Backend akan menolak dengan 403 Forbidden
    await page.goto('/login');
    await page.fill('#login-email', accounts.operatorUKM.email);
    await page.fill('#login-password', accounts.operatorUKM.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/operator_ukm/kegiatan-internal');
    // Anggap mereka mencoba mengakses endpoint verifikasi lewat antarmuka
    // Ini seharusnya dihidden, atau API menolak
    // Sebagai simulasi E2E, kita panggil API via request context
    const response = await page.request.post('/api/kegiatan/internal/1/verifikasi', {
      data: { status: 'terverifikasi' }
    });
    
    // Status forbidden (maker!=checker)
    expect(response.status()).toBe(403);
  });

});
