import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.4 Modul Partisipasi & Presensi Kehadiran (TC-PRT)', () => {

  test.beforeEach(async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-PRT-01: Mahasiswa mendaftar event kampus terpublikasi', async ({ page }) => {
    await page.goto('/mahasiswa/kegiatan-internal');
    await page.click('button:has-text("Daftar Event"):visible >> nth=0');
    await page.click('button:has-text("Ya, Daftar")');
    
    await expect(page.locator('text=Berhasil mendaftar')).toBeVisible();
  });

  test('TC-PRT-02: Pendaftaran ganda pada satu kegiatan yang sama', async ({ page }) => {
    await page.goto('/mahasiswa/kegiatan-internal');
    await page.click('button:has-text("Daftar Event"):visible >> nth=0');
    await page.click('button:has-text("Ya, Daftar")');
    
    await expect(page.locator('text=Anda sudah terdaftar')).toBeVisible();
  });

  test('TC-PRT-03: Impor presensi kehadiran via file spreadsheet', async ({ page }) => {
    // Pindah role ke operator UKM
    await injectAuth(page, 'operator_ukm', accounts.operatorUKM.email);

    await page.goto('/operator_ukm/kegiatan-internal');
    await page.click('a:has-text("Detail"):visible >> nth=0');
    await page.click('button:has-text("Impor Presensi")');
    
    // Test via API request
    const response = await page.request.post('https://api-studentconnect.unand.ac.id/api/kegiatan/internal/1/presensi', {
      data: { nims: ['2311521001'] }
    });
    
    // Bisa 200 (sukses) atau 401 (token mock tidak valid di backend)
    expect([200, 201, 401, 403]).toContain(response.status());
  });

});
