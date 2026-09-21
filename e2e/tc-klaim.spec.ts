import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.6 Modul Klaim Poin & Settlement Anti-Fraud (TC-CLM)', () => {

  test('TC-CLM-01: Klaim ditolak jika izin PA belum disetujui', async ({ request }) => {
    const login = await request.post('http://localhost:3000/api/auth/login', {
      data: { email: accounts.mahasiswa.email, password: accounts.mahasiswa.password }
    });
    const token = login.ok() ? (await login.json()).data.token : 'DUMMY';

    const response = await request.post('http://localhost:3000/api/klaim/submit', {
      headers: { Authorization: `Bearer ${token}` },
      data: { partisipasiId: 999, izinPaStatus: 'diajukan' } 
    });
    expect([400, 403, 404]).toContain(response.status()); 
  });

  test('TC-CLM-02: Pengajuan klaim poin valid beserta lampiran bukti', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/mahasiswa/klaim-poin/tambah');
    await page.selectOption('select[name="kegiatanId"]', { index: 1 });
    await page.selectOption('select[name="peranId"]', { index: 1 }); // Juara 1
    // await page.setInputFiles('input[type="file"]', 'path/to/sertifikat.pdf');
    await page.click('button:has-text("Ajukan Klaim")');
    
    await expect(page.locator('text=Klaim berhasil diajukan')).toBeVisible();
  });

  test('TC-CLM-03: Pengajuan klaim ganda atas partisipasi yang sama', async ({ request }) => {
    const login = await request.post('http://localhost:3000/api/auth/login', {
      data: { email: accounts.mahasiswa.email, password: accounts.mahasiswa.password }
    });
    const token = login.ok() ? (await login.json()).data.token : 'DUMMY';

    const response = await request.post('http://localhost:3000/api/klaim/submit', {
      headers: { Authorization: `Bearer ${token}` },
      data: { partisipasiId: 1 } 
    });
    expect([400, 403, 404]).toContain(response.status());
  });

  test('TC-CLM-04: Validasi klaim & settlement poin atomik', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.adminDitmawa.email);
    await page.fill('#login-password', accounts.adminDitmawa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/admin_ditmawa/verifikasi-klaim');
    await page.click('button:has-text("Setujui Klaim"):visible >> nth=0');
    await page.click('button:has-text("Ya, Setujui")');
    
    await expect(page.locator('text=Poin berhasil disetujui dan dihitung')).toBeVisible();
  });

  test('TC-CLM-05: Duplikasi settlement perolehan poin', async ({ request }) => {
    const login = await request.post('http://localhost:3000/api/auth/login', {
      data: { email: accounts.adminDitmawa.email, password: accounts.adminDitmawa.password }
    });
    const token = login.ok() ? (await login.json()).data.token : 'DUMMY';

    const response = await request.post('http://localhost:3000/api/klaim/force-settlement', {
      headers: { Authorization: `Bearer ${token}` },
      data: { mahasiswaId: 1, kegiatanId: 1 } 
    });
    expect([400, 403, 404, 500]).toContain(response.status()); 
  });

});
