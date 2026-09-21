import { test, expect } from '@playwright/test';
import { accounts } from './fixtures/accounts';

test.describe('2.1 Modul Autentikasi & Otorisasi RBAC (TC-AUTH)', () => {

  test('TC-AUTH-01: Login kredensial valid untuk 9 peran berbeda', async ({ page }) => {
    // Kita uji satu peran (Mahasiswa) sebagai perwakilan di sini untuk smoke test 
    // Di suite lengkap, kita bisa melooping Object.values(accounts)
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');
    
    // Pastikan di-redirect ke dashboard yang benar
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-AUTH-02: Login dengan kata sandi salah', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', 'wrongpass123');
    await page.click('button:has-text("Masuk")');
    
    // Pastikan muncul notifikasi / teks error
    await expect(page.locator('text=salah').first()).toBeVisible();
  });

  test('TC-AUTH-03: Akses rute terproteksi tanpa menyertakan JWT', async ({ request }) => {
    // Memanggil API backend langsung
    const response = await request.get('http://localhost:3000/api/auth/me');
    expect(response.status()).toBe(401);
  });

  test('TC-AUTH-04: Pelanggaran hak akses role (Role Guard)', async ({ page }) => {
    // Login sebagai mahasiswa
    await page.goto('/login');
    await page.fill('#login-email', accounts.mahasiswa.email);
    await page.fill('#login-password', accounts.mahasiswa.password);
    await page.click('button:has-text("Masuk")');
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);

    // Paksa akses ke halaman pimpinan
    await page.goto('/pimpinan_ditmawa/dashboard');
    // RoleGuard harusnya me-redirect kembali ke dashboard mahasiswa atau 403
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

  test('TC-AUTH-05: Alur login Mock SSO untuk environment dev', async ({ page }) => {
    // Simulasi callback SSO dari backend yang sukses
    const mockToken = 'e30=.eyJpZCI6MSwicm9sZSI6Im1haGFzaXN3YSIsIm5hbWEiOiJUZXN0In0=.sig';
    await page.goto(`/login?sso=success&token=${mockToken}`);
    // Karena ini redirect ke frontend dengan token, kita cek apakah mendarat di dashboard
    await expect(page).toHaveURL(/.*\/mahasiswa\/dashboard/);
  });

});
