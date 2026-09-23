/**
 * SIA Background Scheduler Service
 * ---------------------------------
 * Mengelola cron job otomatis untuk sinkronisasi data dari API SIA secara berkala
 * di latar belakang tanpa memblokir server Express atau pengguna web SAPS.
 *
 * Konfigurasi via .env:
 *   SIA_SYNC_AUTO_ENABLED = "true" | "false" (default: "true")
 *   SIA_SYNC_CRON         = "0 2 * * *" (default: jam 02:00 WIB setiap hari)
 */
import cron, { ScheduledTask } from 'node-cron';
import { syncAll, getSyncStatus } from './siaSync.service';

let scheduledJob: ScheduledTask | null = null;
let configuredCron = process.env.SIA_SYNC_CRON || '0 2 * * *';
let isSchedulerActive = false;

/**
 * Inisialisasi background cron job untuk sinkronisasi otomatis.
 * Dipanggil sekali saat server startup di src/index.ts.
 */
export function initSiaScheduler(): void {
  const isEnabled = process.env.SIA_SYNC_AUTO_ENABLED !== 'false';

  if (!isEnabled) {
    console.log('[SIA Scheduler] Auto-sync dinonaktifkan (SIA_SYNC_AUTO_ENABLED=false).');
    return;
  }

  configuredCron = (process.env.SIA_SYNC_CRON || '0 2 * * *').trim();

  // Validasi format cron syntax
  if (!cron.validate(configuredCron)) {
    console.warn(`[SIA Scheduler Warning] Format cron "${configuredCron}" tidak valid. Fallback ke "0 2 * * *" (tiap jam 02:00 WIB).`);
    configuredCron = '0 2 * * *';
  }

  // Jika sudah ada job aktif sebelumnya, hentikan terlebih dahulu
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
  }

  scheduledJob = cron.schedule(configuredCron, async () => {
    const timestamp = new Date().toISOString();
    console.log(`[SIA Scheduler] [${timestamp}] Memulai auto-sync terjadwal (${configuredCron})...`);

    const currentStatus = getSyncStatus();
    if (currentStatus.isSyncInProgress) {
      console.warn(`[SIA Scheduler] Sinkronisasi dibatalkan karena proses sync lain sedang berjalan.`);
      return;
    }

    try {
      const results = await syncAll();
      console.log(`[SIA Scheduler] Auto-sync selesai sukses pada ${new Date().toISOString()}. Total entitas: ${results.length}`);

      // Bersihkan dan gabungkan akun Dosen PA yang ganda karena NIK SSO
      try {
        const { autoMergeDuplicateDosen } = await import('./dosenMerge.service');
        await autoMergeDuplicateDosen();
      } catch (mergeErr: any) {
        console.error(`[SIA Scheduler] Gagal menjalankan autoMergeDuplicateDosen: ${mergeErr.message}`);
      }
    } catch (err: any) {
      // Tangani timeout atau koneksi putus secara aman tanpa membuat server crash
      console.warn(`[SIA Scheduler] Auto-sync dilewati/gagal (jaringan kampus/API SIA offline): ${err.message}`);
    }
  });

  isSchedulerActive = true;
  console.log(`[SIA Scheduler] ✅ Background auto-sync aktif dengan jadwal: "${configuredCron}"`);
}

/**
 * Menghentikan scheduler jika diperlukan (misal saat graceful shutdown).
 */
export function stopSiaScheduler(): void {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    isSchedulerActive = false;
    console.log('[SIA Scheduler] Background auto-sync dihentikan.');
  }
}

/**
 * Mendapatkan informasi status scheduler saat ini untuk monitoring via API.
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  cronExpression: string;
  isActive: boolean;
  syncState: ReturnType<typeof getSyncStatus>;
} {
  return {
    enabled: process.env.SIA_SYNC_AUTO_ENABLED !== 'false',
    cronExpression: configuredCron,
    isActive: isSchedulerActive,
    syncState: getSyncStatus(),
  };
}
