import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.2 Modul Kurikulum & Rubrik Matriks Poin (TC-KUR)', () => {

  test.beforeEach(async ({ page }) => {
    // Login sebagai pimpinan utama/admin ditmawa yang berhak kelola kurikulum
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.adminDitmawa.email);
    await page.fill('input[type="password"]', accounts.adminDitmawa.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/dashboard/);
  });

  test('TC-KUR-01: Pembuatan kurikulum baru (draft)', async ({ page }) => {
    await page.goto('/admin_ditmawa/master-data/kurikulum');
    await page.click('button:has-text("Tambah Kurikulum")');
    await page.fill('input[name="nama"]', 'Kurikulum 2026 Test');
    await page.fill('input[name="angkatan"]', '2026');
    await page.click('button:has-text("Simpan")');

    await expect(page.locator('text=Kurikulum 2026 Test')).toBeVisible();
    await expect(page.locator('text=Draft').first()).toBeVisible();
  });

  test('TC-KUR-02: Validasi total bobot sub-capaian != 100%', async ({ page }) => {
    await page.goto('/admin_ditmawa/master-data/kurikulum');
    // Asumsikan ada fitur edit bobot
    // Ini disesuaikan dengan UI yang ada
    await page.click('button[title="Edit Bobot Capaian"]');
    // Set bobot ke 30, 30, 30
    const inputs = await page.$$('input[type="number"]');
    for(let i=0; i<3; i++) {
      if(inputs[i]) await inputs[i].fill('30');
    }
    await page.click('button:has-text("Simpan")');
    
    // Harus muncul error
    await expect(page.locator('text=Total bobot harus tepat 100%')).toBeVisible();
  });

  test('TC-KUR-03: Pengaturan entri matriks rubrik poin (Upsert)', async ({ page }) => {
    await page.goto('/admin_ditmawa/master-data/matriks-poin');
    await page.click('button:has-text("Edit Poin")');
    await page.fill('input[name="poin"]', '80');
    await page.click('button:has-text("Simpan")');
    
    await expect(page.locator('text=Berhasil menyimpan matriks')).toBeVisible();
  });

  test('TC-KUR-04: Aktivasi kurikulum tunggal per angkatan', async ({ page }) => {
    await page.goto('/admin_ditmawa/master-data/kurikulum');
    await page.click('button:has-text("Aktifkan")');
    await page.click('button:has-text("Ya, Aktifkan")');
    
    await expect(page.locator('text=aktif').first()).toBeVisible();
  });

});
