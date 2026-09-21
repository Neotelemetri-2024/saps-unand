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
 * IMPORTANT: Must call page.goto() AFTER this to trigger the app to read localStorage.
 */
export async function injectAuth(page: Page, role: string, email: string) {
  const dashboardPath = roleRoutes[role] || '/mahasiswa/dashboard';

  // Navigate to a page on the origin first so we can set localStorage
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Inject the auth session directly into localStorage
  await page.evaluate(
    ({ role, email }) => {
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
      localStorage.setItem('saps_current_user', JSON.stringify(user));
    },
    { role, email }
  );

  // Now navigate to the dashboard — the AuthGuard will read localStorage and allow access
  await page.goto(dashboardPath, { waitUntil: 'domcontentloaded' });
}

/**
 * Shortcut to inject auth and navigate to a specific page after login.
 */
export async function injectAuthAndGoto(page: Page, role: string, email: string, targetPath: string) {
  await injectAuth(page, role, email);
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
}
