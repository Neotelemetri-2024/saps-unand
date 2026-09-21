import { test, expect, Locator, Page } from '@playwright/test';
import { ACCOUNTS_BY_ROLE } from './fixtures/accounts';
import { loginAs } from './helpers/auth';

/**
 * Core cross-role flow (iteration 1 scope):
 *   1. Mahasiswa submits "Ajukan Kegiatan Eksternal".
 *   2. Admin Ditmawa verifies it (maps capaian) and forwards to Pimpinan.
 *   3. Pimpinan Ditmawa gives final approval.
 *
 * Runs as 3 sequential tests sharing a unique `kegiatanName` (module-level
 * variable), since each run must create fresh data against the shared dev DB.
 */

const kegiatanName = `E2E Test Kegiatan ${Date.now()}`;
const penyelenggara = 'Panitia E2E Test';

async function selectFirstRealOption(select: Locator) {
  await expect.poll(async () => select.locator('option').count()).toBeGreaterThan(1);
  const value = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(value ?? '');
}

async function searchAndOpenDetail(page: Page, query: string, detailLabel: string) {
  await page.getByPlaceholder('Cari mahasiswa atau kegiatan...').fill(query);
  const row = page.locator('tbody tr', { hasText: query });
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByTitle('Aksi').click();
  await page.getByRole('button', { name: detailLabel, exact: true }).click();
}

test.describe.serial('Kegiatan eksternal — mahasiswa ajukan -> admin verifikasi -> pimpinan approve', () => {
  test('1. Mahasiswa submits kegiatan eksternal', async ({ page }) => {
    const acc = ACCOUNTS_BY_ROLE['mahasiswa'];
    await loginAs(page, acc.email, acc.password, acc.expectedPathPrefix);

    await page.goto('/mahasiswa/kegiatan-eksternal/ajukan');

    await selectFirstRealOption(page.locator('select[name="kategoriId"]'));
    await page.locator('input[name="namaKegiatan"]').fill(kegiatanName);
    await page.locator('input[name="penyelenggara"]').fill(penyelenggara);
    await selectFirstRealOption(page.locator('select[name="skalaId"]'));

    // Tanggal Pelaksanaan wajib diisi di backend (react-datepicker, bukan <input type=date>).
    await page.getByPlaceholder('Pilih tanggal').click();
    await page.locator('.react-datepicker__day--today').click();

    await page.getByRole('button', { name: 'Ajukan Sekarang' }).click();
    await page.getByRole('button', { name: 'Ya, kirim' }).click();

    await page.waitForURL(/\/mahasiswa\/kegiatan-eksternal$/, { timeout: 15000 });
    await expect(page.locator('tbody tr', { hasText: kegiatanName })).toBeVisible({ timeout: 10000 });
  });

  test('2. Admin Ditmawa verifies and forwards to Pimpinan', async ({ page }) => {
    const acc = ACCOUNTS_BY_ROLE['admin_ditmawa'];
    await loginAs(page, acc.email, acc.password, acc.expectedPathPrefix);

    await page.goto('/admin_ditmawa/verifikasi-pengajuan-eksternal');
    await searchAndOpenDetail(page, kegiatanName, 'Detail');

    await page.waitForURL(/\/admin_ditmawa\/verifikasi-pengajuan-eksternal\/\d+$/);
    await expect(page.getByText('Detail Pengajuan Eksternal')).toBeVisible();

    await page.getByRole('button', { name: 'Teruskan ke Pimpinan' }).click();

    // Pemetaan capaian: buka dropdown dan centang capaian pertama.
    const capaianToggle = page.getByRole('button', { name: /Pilih capaian|capaian dipilih/ });
    await expect(capaianToggle).toBeVisible({ timeout: 10000 });
    await capaianToggle.click();
    const capaianDropdown = page.locator('div.absolute.z-10');
    await expect(capaianDropdown).toBeVisible();
    await capaianDropdown.locator('input[type="checkbox"]').first().check();
    // Tutup dropdown (toggle tombol lagi) agar checkbox sub-capaian di bawahnya tidak tertutup.
    await capaianToggle.click();
    await expect(capaianDropdown).toBeHidden();

    // Pilih sub-capaian pertama (bobot default 100%).
    const subCapaianCheckbox = page.locator('div.grid.grid-cols-1.gap-2 input[type="checkbox"]').first();
    await expect(subCapaianCheckbox).toBeVisible({ timeout: 10000 });
    await subCapaianCheckbox.check();

    await expect(page.getByText(/Total bobot: 100%/)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Teruskan ke Pimpinan' }).click();
    await page.waitForURL(/\/admin_ditmawa\/verifikasi-pengajuan-eksternal$/, { timeout: 15000 });
  });

  test('3. Pimpinan Ditmawa gives final approval', async ({ page }) => {
    const acc = ACCOUNTS_BY_ROLE['pimpinan_ditmawa'];
    await loginAs(page, acc.email, acc.password, acc.expectedPathPrefix);

    await page.goto('/pimpinan_ditmawa/verifikasi-pengajuan-eksternal');
    await searchAndOpenDetail(page, kegiatanName, 'Detail & Verifikasi');

    await page.waitForURL(/\/pimpinan_ditmawa\/verifikasi-pengajuan-eksternal\/\d+$/);
    await expect(page.getByText('Detail Pengajuan Eksternal')).toBeVisible();

    await page.getByRole('button', { name: 'Setujui', exact: true }).click();
    await page.getByRole('button', { name: 'SETUJUI', exact: true }).click();

    await page.waitForURL(/\/pimpinan_ditmawa\/verifikasi-pengajuan-eksternal$/, { timeout: 15000 });
    await expect(page.getByText('Pengajuan disetujui!')).toBeVisible({ timeout: 10000 });
  });
});
