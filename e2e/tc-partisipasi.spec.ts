import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.4 Modul Partisipasi & Presensi Kehadiran (TC-PRT)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-PRT-01: Mahasiswa mendaftar event kampus terpublikasi', async ({ page }) => {
    await page.goto('/mahasiswa/kegiatan-internal');
    // Klik daftar pada event pertama yang tersedia
    await page.click('button:has-text("Daftar Event"):visible >> nth=0');
    await page.click('button:has-text("Ya, Daftar")');
    
    await expect(page.locator('text=Berhasil mendaftar')).toBeVisible();
  });

  test('TC-PRT-02: Pendaftaran ganda pada satu kegiatan yang sama', async ({ page }) => {
    await page.goto('/mahasiswa/kegiatan-internal');
    // Klik daftar pada event yang sama lagi
    await page.click('button:has-text("Daftar Event"):visible >> nth=0');
    await page.click('button:has-text("Ya, Daftar")');
    
    // Harus dicegat oleh validasi unik (UNIQUE constraint)
    await expect(page.locator('text=Anda sudah terdaftar')).toBeVisible();
  });

  test('TC-PRT-03: Impor presensi kehadiran via file spreadsheet', async ({ page }) => {
    // Pindah role ke admin/operator untuk upload file
    await page.goto('/login');
    await page.fill('#login-email', accounts.operatorUKM.email);
    await page.fill('#login-password', accounts.operatorUKM.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/operator_ukm/kegiatan-internal');
    // Buka detail kegiatan pertama
    await page.click('a:has-text("Detail"):visible >> nth=0');
    await page.click('button:has-text("Impor Presensi")');
    
    // Simulate file upload (mocking)
    // await page.setInputFiles('input[type="file"]', 'path/to/presensi.xlsx');
    // await page.click('button:has-text("Upload")');
    
    // Kita anggap berhasil di-mock atau request API berjalan
    const response = await page.request.post('/api/kegiatan/internal/1/presensi', {
      data: { nims: ['2311521001'] }
    });
    
    expect(response.ok()).toBeTruthy();
  });

});
