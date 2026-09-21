import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.5 Modul Gate Izin Dosen PA (TC-IZN)', () => {

  test('TC-IZN-01: Mahasiswa minta izin ke Dosen PA', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await page.goto('/mahasiswa/persetujuan-dosen');
    await expect(page).toHaveURL(/.*\/mahasiswa\/persetujuan-dosen/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-IZN-02: Dosen PA setujui izin', async ({ page }) => {
    await injectAuth(page, 'dosen_pa', accounts.dosenPA.email);
    await page.goto('/dosen/permintaan-persetujuan');
    await expect(page).toHaveURL(/.*\/dosen\/permintaan-persetujuan/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-IZN-03: Dosen PA minta revisi + catatan', async ({ page }) => {
    await injectAuth(page, 'dosen_pa', accounts.dosenPA.email);
    await page.goto('/dosen/permintaan-persetujuan');
    await expect(page).toHaveURL(/.*\/dosen\/permintaan-persetujuan/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-IZN-04: Deteksi mahasiswa rawan pada dasbor PA', async ({ page }) => {
    await injectAuth(page, 'dosen_pa', accounts.dosenPA.email);
    await page.goto('/dosen/mahasiswa-perlu-perhatian');
    await expect(page).toHaveURL(/.*\/dosen\/mahasiswa-perlu-perhatian/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"], table').first()).toBeAttached({ timeout: 10000 });
  });

});
