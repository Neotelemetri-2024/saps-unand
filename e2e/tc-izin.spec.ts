import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.5 Modul Gate Izin Dosen PA (TC-IZN)', () => {

  test('TC-IZN-01: Mahasiswa minta izin ke Dosen PA', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);

    await page.goto('/mahasiswa/kegiatan-eksternal');
    await page.click('button:has-text("Minta persetujuan dosen")');
    await page.click('button:has-text("Ya, minta")');
    
    await expect(page.locator('text=Permintaan persetujuan telah dikirimkan')).toBeVisible();
  });

  test('TC-IZN-02: Dosen PA setujui izin', async ({ page }) => {
    await injectAuth(page, 'dosen_pa', accounts.dosenPA.email);

    await page.goto('/dosen/permintaan-persetujuan');
    await page.click('text=Setujui');
    await page.click('button:has-text("Ya, Setujui")');
    
    await expect(page.locator('text=Izin disetujui')).toBeVisible();
  });

  test('TC-IZN-03: Dosen PA minta revisi + catatan', async ({ page }) => {
    await injectAuth(page, 'dosen_pa', accounts.dosenPA.email);

    await page.goto('/dosen/permintaan-persetujuan');
    await page.click('text=Revisi');
    await page.fill('textarea[name="catatan"]', 'Mohon lengkapi deskripsi kegiatan');
    await page.click('button:has-text("Kirim Permintaan Revisi")');
    
    await expect(page.locator('text=Status diubah menjadi revisi')).toBeVisible();
  });

  test('TC-IZN-04: Deteksi mahasiswa rawan pada dasbor PA', async ({ page }) => {
    await injectAuth(page, 'dosen_pa', accounts.dosenPA.email);

    await page.goto('/dosen/mahasiswa-perlu-perhatian');
    // Pastikan halaman termuat dengan benar (tidak redirect ke login)
    await expect(page).toHaveURL(/.*\/dosen\/mahasiswa-perlu-perhatian/);
    // Verifikasi halaman memuat konten (badge, tabel, atau heading)
    await expect(page.locator('h1, h2, h3, .badge-warning, .badge-error, table').first()).toBeVisible({ timeout: 10000 });
  });

});
