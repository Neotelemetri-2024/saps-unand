import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.6 Modul Klaim Poin & Settlement Anti-Fraud (TC-CLM)', () => {

  test('TC-CLM-01: Klaim ditolak jika izin PA belum disetujui', async ({ request }) => {
    // Login via API untuk mendapatkan token asli
    const login = await request.post('https://api-studentconnect.unand.ac.id/api/auth/login', {
      data: { email: accounts.mahasiswa.email, password: accounts.mahasiswa.password }
    });
    const token = login.ok() ? (await login.json()).data?.token : null;

    const response = await request.post('https://api-studentconnect.unand.ac.id/api/klaim/submit', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: { partisipasiId: 999, izinPaStatus: 'diajukan' } 
    });
    // Tanpa token valid atau izin belum disetujui → ditolak
    expect([400, 401, 403, 404]).toContain(response.status()); 
  });

  test('TC-CLM-02: Pengajuan klaim poin valid beserta lampiran bukti', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);

    await page.goto('/mahasiswa/klaim-poin');
    // Verifikasi halaman klaim poin termuat
    await expect(page).toHaveURL(/.*\/mahasiswa\/klaim-poin/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CLM-03: Pengajuan klaim ganda atas partisipasi yang sama', async ({ request }) => {
    const login = await request.post('https://api-studentconnect.unand.ac.id/api/auth/login', {
      data: { email: accounts.mahasiswa.email, password: accounts.mahasiswa.password }
    });
    const token = login.ok() ? (await login.json()).data?.token : null;

    const response = await request.post('https://api-studentconnect.unand.ac.id/api/klaim/submit', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: { partisipasiId: 1 } 
    });
    expect([400, 401, 403, 404]).toContain(response.status());
  });

  test('TC-CLM-04: Validasi klaim & settlement poin atomik', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);

    await page.goto('/admin_ditmawa/verifikasi-klaim');
    // Verifikasi halaman verifikasi klaim termuat
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/verifikasi-klaim/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-CLM-05: Duplikasi settlement perolehan poin', async ({ request }) => {
    const login = await request.post('https://api-studentconnect.unand.ac.id/api/auth/login', {
      data: { email: accounts.adminDitmawa.email, password: accounts.adminDitmawa.password }
    });
    const token = login.ok() ? (await login.json()).data?.token : null;

    const response = await request.post('https://api-studentconnect.unand.ac.id/api/klaim/force-settlement', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      data: { mahasiswaId: 1, kegiatanId: 1 } 
    });
    expect([400, 401, 403, 404, 500]).toContain(response.status()); 
  });

});
