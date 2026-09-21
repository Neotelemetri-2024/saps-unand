import { Page } from '@playwright/test';

/**
 * Mapping role -> dashboard path prefix
 */
const roleRoutes: Record<string, string> = {
  mahasiswa: '/mahasiswa/dashboard',
  dosen: '/dosen/dashboard',
  dosen_pa: '/dosen/dashboard',
  pimpinan_fakultas: '/pimpinan_fakultas/dashboard',
  pimpinan_ditmawa: '/pimpinan_ditmawa/dashboard',
  admin_ditmawa: '/admin_ditmawa/dashboard',
  admin_fakultas: '/admin_fakultas/dashboard',
  operator_ukm: '/operator_ukm/dashboard',
  operator_ukmf: '/operator_ukmf/dashboard',
  pimpinan_utama: '/pimpinan_utama/dashboard',
};

/**
 * Inject a fake authenticated session into localStorage so the frontend
 * thinks the user is logged in. This completely bypasses the backend login API,
 * which is unreliable in the Docker test environment.
 *
 * Using addInitScript ensures localStorage is injected on EVERY navigation,
 * which prevents WebKit from losing the state during fast redirects.
 */
export async function injectAuth(page: Page, role: string, email: string) {
  const dashboardPath = roleRoutes[role] || '/mahasiswa/dashboard';

  const user = {
    id: 999,
    email: email,
    nama: `Test User (${role})`,
    peran: role,
    jabatan: null,
    organisasiId: null,
    namaOrganisasi: null,
    tipeOrganisasi: null,
    kurikulumId: null,
    kurikulumNama: null,
    role: role,
    userRole: role,
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5LCJyb2xlIjoiJytyb2xlKyciLCJlbWFpbCI6IicrZW1haWwrJyJ9.fake-sig',
    authProvider: 'internal',
  };

  // 1. Inject into every future navigation on this page context
  await page.addInitScript((userData) => {
    window.localStorage.setItem('saps_current_user', userData);
  }, JSON.stringify(user));

  // 2. Also set it right now if we are already on a page (to be safe)
  try {
    await page.evaluate((userData) => {
      localStorage.setItem('saps_current_user', userData);
    }, JSON.stringify(user));
  } catch (e) {
    // Ignore if not on a page yet
  }

  // 3. Navigate to the target page directly
  await page.goto(dashboardPath);
}

/**
 * Shortcut to inject auth and navigate to a specific page after login.
 */
export async function injectAuthAndGoto(page: Page, role: string, email: string, targetPath: string) {
  await injectAuth(page, role, email);
  await page.goto(targetPath);
}
