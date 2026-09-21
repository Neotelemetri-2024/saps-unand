import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.5 Modul Gate Izin Dosen PA (TC-IZN)', () => {

  test('TC-IZN-01: Mahasiswa minta izin ke Dosen PA', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.mahasiswa.email);
    await page.fill('input[type="password"]', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);

    await page.goto('/mahasiswa/kegiatan-eksternal');
    // Asumsikan ini menekan tombol detail kegiatan yang sudah diajukan
    await page.click('button:has-text("Minta persetujuan dosen")');
    // Konfirmasi modal
    await page.click('button:has-text("Ya, minta")');
    
    await expect(page.locator('text=Permintaan persetujuan telah dikirimkan')).toBeVisible();
  });

  test('TC-IZN-02: Dosen PA setujui izin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.dosenPA.email);
    await page.fill('input[type="password"]', accounts.dosenPA.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/dosen/persetujuan');
    await page.click('text=Setujui');
    await page.click('button:has-text("Ya, Setujui")');
    
    await expect(page.locator('text=Izin disetujui')).toBeVisible();
  });

  test('TC-IZN-03: Dosen PA minta revisi + catatan', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.dosenPA.email);
    await page.fill('input[type="password"]', accounts.dosenPA.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/dosen/persetujuan');
    await page.click('text=Revisi');
    await page.fill('textarea[name="catatan"]', 'Mohon lengkapi deskripsi kegiatan');
    await page.click('button:has-text("Kirim Permintaan Revisi")');
    
    await expect(page.locator('text=Status diubah menjadi revisi')).toBeVisible();
  });

  test('TC-IZN-04: Deteksi mahasiswa rawan pada dasbor PA', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.dosenPA.email);
    await page.fill('input[type="password"]', accounts.dosenPA.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/dosen/mahasiswa-perlu-perhatian');
    // Asumsi badge lampu kuning/merah merender class .badge-warning atau .badge-error
    await expect(page.locator('.badge-warning, .badge-error').first()).toBeVisible();
  });

});
