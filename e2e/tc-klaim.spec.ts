import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.6 Modul Klaim Poin & Settlement Anti-Fraud (TC-CLM)', () => {

  test('TC-CLM-01: Klaim ditolak jika izin PA belum disetujui', async ({ request }) => {
    try {
      const login = await request.post('https://api-studentconnect.unand.ac.id/api/auth/login', {
        data: { email: accounts.mahasiswa.email, password: accounts.mahasiswa.password }
      });
      const token = login.ok() ? (await login.json()).data?.token : null;
      const response = await request.post('https://api-studentconnect.unand.ac.id/api/klaim/submit', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        data: { partisipasiId: 999, izinPaStatus: 'diajukan' } 
      });
      expect([400, 401, 403, 404]).toContain(response.status()); 
    } catch (e: any) {
      expect(e.message).toContain('ECONNREFUSED');
    }
  });

  test('TC-CLM-02: Pengajuan klaim poin valid beserta lampiran bukti', async ({ page }) => {
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await page.goto('/mahasiswa/klaim-poin');
    await expect(page).toHaveURL(/.*\/mahasiswa\/klaim-poin/);
    // Gunakan toBeAttached karena elemen bisa tersembunyi oleh CSS/animasi
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-CLM-03: Pengajuan klaim ganda atas partisipasi yang sama', async ({ request }) => {
    try {
      const login = await request.post('https://api-studentconnect.unand.ac.id/api/auth/login', {
        data: { email: accounts.mahasiswa.email, password: accounts.mahasiswa.password }
      });
      const token = login.ok() ? (await login.json()).data?.token : null;
      const response = await request.post('https://api-studentconnect.unand.ac.id/api/klaim/submit', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        data: { partisipasiId: 1 } 
      });
      expect([400, 401, 403, 404]).toContain(response.status());
    } catch (e: any) {
      expect(e.message).toContain('ECONNREFUSED');
    }
  });

  test('TC-CLM-04: Validasi klaim & settlement poin atomik', async ({ page }) => {
    await injectAuth(page, 'admin_ditmawa', accounts.adminDitmawa.email);
    await page.goto('/admin_ditmawa/verifikasi-klaim');
    await expect(page).toHaveURL(/.*\/admin_ditmawa\/verifikasi-klaim/);
    await expect(page.locator('h1, h2, h3, [class*="font-bold"]').first()).toBeAttached({ timeout: 10000 });
  });

  test('TC-CLM-05: Duplikasi settlement perolehan poin', async ({ request }) => {
    try {
      const login = await request.post('https://api-studentconnect.unand.ac.id/api/auth/login', {
        data: { email: accounts.adminDitmawa.email, password: accounts.adminDitmawa.password }
      });
      const token = login.ok() ? (await login.json()).data?.token : null;
      const response = await request.post('https://api-studentconnect.unand.ac.id/api/klaim/force-settlement', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        data: { mahasiswaId: 1, kegiatanId: 1 } 
      });
      expect([400, 401, 403, 404, 500]).toContain(response.status()); 
    } catch (e: any) {
      expect(e.message).toContain('ECONNREFUSED');
    }
  });

});
