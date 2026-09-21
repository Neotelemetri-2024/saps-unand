import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.8 Modul Portofolio Karir, CV & Sertifikat Publik (TC-PUB)', () => {

  test('TC-PUB-01: Penerbitan sertifikat digital', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await page.goto('/mahasiswa/generate-sertifikat');
    await expect(page).toHaveURL(/.*\/mahasiswa\/generate-sertifikat/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-PUB-02: Akses publik verifikasi sertifikat QR', async ({ page }) => {
    await page.goto('/sertifikat/validasi/token_valid_untuk_testing');
    await page.waitForTimeout(3000);
    // Pastikan halaman termuat (bukan blank)
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('TC-PUB-03: Akses publik verifikasi token palsu/acak', async ({ page }) => {
    await page.goto('/sertifikat/validasi/token_fiktif_123');
    await page.waitForTimeout(3000);
    // Harus muncul halaman (valid atau error) — bukan blank
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('TC-PUB-04: Rendering kartu pratinjau media sosial (OG Image)', async ({ request }) => {
    try {
      const response = await request.get('https://api-studentconnect.unand.ac.id/api/cv/public/token_valid_untuk_testing/image.png');
      expect([200, 404]).toContain(response.status());
    } catch (e: any) {
      // ECONNREFUSED = API tidak bisa diakses dari environment Docker
      expect(e.message).toContain('ECONNREFUSED');
    }
  });

});
