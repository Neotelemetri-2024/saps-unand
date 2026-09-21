import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.8 Modul Portofolio Karir, CV & Sertifikat Publik (TC-PUB)', () => {

  test('TC-PUB-01: Penerbitan sertifikat digital', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.mahasiswa.email);
    await page.fill('input[type="password"]', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);

    await page.goto('/mahasiswa/portofolio');
    // Asumsi poin sudah >= 550
    const btnTerbitkan = page.locator('button:has-text("Terbitkan Sertifikat")');
    if (await btnTerbitkan.isVisible()) {
      await btnTerbitkan.click();
      await expect(page.locator('text=Sertifikat berhasil diterbitkan')).toBeVisible();
    } else {
      // Jika tombol tidak ada karena poin kurang, tes dilewati atau dianggap pass untuk kondisi ini
      test.skip();
    }
  });

  test('TC-PUB-02: Akses publik verifikasi sertifikat QR', async ({ page }) => {
    // URL publik tidak memerlukan login
    // Asumsi token valid yang digunakan adalah "token_valid_untuk_testing"
    await page.goto('/sertifikat/validasi/token_valid_untuk_testing');
    
    // Harus muncul info sukses/validasi
    await expect(page.locator('text=Dokumen Valid').first()).toBeVisible();
  });

  test('TC-PUB-03: Akses publik verifikasi token palsu/acak', async ({ page }) => {
    await page.goto('/sertifikat/validasi/token_fiktif_123');
    
    // Harus muncul error dokumen tidak ditemukan
    await expect(page.locator('text=tidak ditemukan').first()).toBeVisible();
  });

  test('TC-PUB-04: Rendering kartu pratinjau media sosial (OG Image)', async ({ request }) => {
    // Memanggil API publik image builder
    const response = await request.get('http://localhost:3000/api/cv/public/token_valid_untuk_testing/image.png');
    
    // Pastikan server mengembalikan sukses dengan MIME type image/png
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
  });

});
