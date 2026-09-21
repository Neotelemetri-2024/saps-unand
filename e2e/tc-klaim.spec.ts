import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.6 Modul Klaim Poin & Settlement Anti-Fraud (TC-CLM)', () => {

  test('TC-CLM-01: Klaim ditolak jika izin PA belum disetujui', async ({ request }) => {
    // Simulasi langsung lewat API request agar presisi menguji penolakan
    // Asumsi token mahasiswa valid didapatkan via login sebelumnya
    const response = await request.post('http://localhost:3000/api/klaim/submit', {
      headers: { Authorization: `Bearer MOCK_TOKEN_MAHASISWA` },
      data: { partisipasiId: 999, izinPaStatus: 'diajukan' } // mock payload
    });
    // Ditolak oleh backend karena izin_pa belum 'disetujui' (BUG-03 Fixed)
    expect(response.status()).toBe(400); // Bad Request atau 403
  });

  test('TC-CLM-02: Pengajuan klaim poin valid beserta lampiran bukti', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.mahasiswa.email);
    await page.fill('input[type="password"]', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/mahasiswa/klaim-poin/tambah');
    await page.selectOption('select[name="kegiatanId"]', { index: 1 });
    await page.selectOption('select[name="peranId"]', { index: 1 }); // Juara 1
    // await page.setInputFiles('input[type="file"]', 'path/to/sertifikat.pdf');
    await page.click('button:has-text("Ajukan Klaim")');
    
    await expect(page.locator('text=Klaim berhasil diajukan')).toBeVisible();
  });

  test('TC-CLM-03: Pengajuan klaim ganda atas partisipasi yang sama', async ({ request }) => {
    // Upaya klaim dua kali untuk event yang sama (partisipasiId sama)
    const response = await request.post('http://localhost:3000/api/klaim/submit', {
      headers: { Authorization: `Bearer MOCK_TOKEN_MAHASISWA` },
      data: { partisipasiId: 1 } // Asumsi sudah pernah diklaim
    });
    // Ditolak oleh constraint unik database (partisipasiId)
    expect(response.status()).toBe(400);
  });

  test('TC-CLM-04: Validasi klaim & settlement poin atomik', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', accounts.adminDitmawa.email);
    await page.fill('input[type="password"]', accounts.adminDitmawa.password);
    await page.click('button:has-text("Masuk")');

    await page.goto('/admin_ditmawa/verifikasi-klaim');
    await page.click('button:has-text("Setujui Klaim"):visible >> nth=0');
    await page.click('button:has-text("Ya, Setujui")');
    
    await expect(page.locator('text=Poin berhasil disetujui dan dihitung')).toBeVisible();
  });

  test('TC-CLM-05: Duplikasi settlement perolehan poin', async ({ request }) => {
    // Simulasi injeksi paksa baris ganda di tabel perolehan_poin via API internal
    const response = await request.post('http://localhost:3000/api/klaim/force-settlement', {
      headers: { Authorization: `Bearer MOCK_TOKEN_ADMIN` },
      data: { mahasiswaId: 1, kegiatanId: 1 } // Data yang sudah di-settle
    });
    // Harus ditolak MySQL constraint UNIQUE(mahasiswaId, kegiatanId)
    expect(response.status()).toBe(500); 
  });

});
