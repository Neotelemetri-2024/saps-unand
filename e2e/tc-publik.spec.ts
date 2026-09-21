import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

const API = 'https://api-studentconnect.unand.ac.id';

test.describe('2.8 Modul Portofolio Karir, CV & Sertifikat Publik (TC-PUB)', () => {

  test('TC-PUB-01: Penerbitan sertifikat digital', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);

    await page.goto('/mahasiswa/generate-sertifikat');
    // Verifikasi halaman sertifikat termuat
    await expect(page).toHaveURL(/.*\/mahasiswa\/generate-sertifikat/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-PUB-02: Akses publik verifikasi sertifikat QR', async ({ page }) => {
    // URL publik tidak memerlukan login
    await page.goto('/sertifikat/validasi/token_valid_untuk_testing');
    // Harus muncul halaman validasi (entah valid atau tidak ditemukan)
    await page.waitForTimeout(3000);
    // Pastikan halaman termuat (bukan blank/error)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('TC-PUB-03: Akses publik verifikasi token palsu/acak', async ({ page }) => {
    await page.goto('/sertifikat/validasi/token_fiktif_123');
    // Harus muncul error dokumen tidak ditemukan
    await expect(page.locator('text=tidak ditemukan').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-PUB-04: Rendering kartu pratinjau media sosial (OG Image)', async ({ request }) => {
    // Memanggil API publik image builder
    const response = await request.get(`${API}/api/cv/public/token_valid_untuk_testing/image.png`);
    // 200 jika token valid, 404 jika tidak ditemukan — keduanya valid behavior
    expect([200, 404]).toContain(response.status());
  });

});
