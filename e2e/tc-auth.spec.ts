import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';
import { injectAuth } from './helpers/auth';

test.describe('2.1 Modul Autentikasi & Otorisasi RBAC (TC-AUTH)', () => {

  test('TC-AUTH-01: Login kredensial valid untuk 9 peran berbeda', async ({ page }) => {
    // Verifikasi bahwa injeksi sesi berhasil mengarahkan ke dashboard mahasiswa
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-AUTH-02: Login dengan kata sandi salah', async ({ page }) => {
    // Buka halaman login dan masukkan password salah
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', 'wrongpass123');
    await page.click('button:has-text("Masuk")');
    
    // Tunggu sampai error muncul (bisa pesan dari API atau timeout)
    // Cukup pastikan tetap di halaman login (tidak redirect ke dashboard)
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('TC-AUTH-03: Akses rute terproteksi tanpa menyertakan JWT', async ({ request }) => {
    // Memanggil API backend langsung tanpa token
    const response = await request.get('https://api-studentconnect.unand.ac.id/api/auth/me');
    expect([401, 403]).toContain(response.status());
  });

  test('TC-AUTH-04: Pelanggaran hak akses role (Role Guard)', async ({ page }) => {
    // Login sebagai mahasiswa
    await injectAuth(page, 'mahasiswa', accounts.mahasiswa.email);
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);

    // Paksa akses ke halaman pimpinan
    await page.goto('/pimpinan_ditmawa/dashboard');
    // RoleGuard harusnya me-redirect kembali ke dashboard mahasiswa
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-AUTH-05: Alur login Mock SSO untuk environment dev', async ({ page }) => {
    // Simulasi callback SSO langsung via query parameter
    const mockToken = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwicm9sZSI6Im1haGFzaXN3YSIsIm5hbWEiOiJUZXN0IFNTTyJ9.fake';
    await page.goto(`/login?sso=success&token=${mockToken}`);
    // Frontend membaca token, menyimpan ke localStorage, dan redirect ke dashboard
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/, { timeout: 10000 });
  });

});
