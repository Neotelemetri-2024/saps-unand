/**
 * SIA Sync Service
 * ----------------
 * Sinkronisasi data dari API SIA ke database SAPS menggunakan logika UPSERT.
 * Data dummy tetap aman — hanya ditambah/diperbarui, tidak dihapus.
 *
 * Endpoint SIA yang digunakan:
 *   1. /saps/list-fakultas
 *   2. /saps/list-prodi
 *   3. /saps/list-mahasiswa (Saps: 03)
 *   4. /saps/detail-mahasiswa (Saps: 04, opsional/on-demand)
 *   5. /saps/list-dosen-pa (Saps: 05)
 *   6. /saps/detail-dosen-pa (Saps: 06, opsional/on-demand)
 *   7. /saps/list-kelas-mbkm (Saps: 07, IKU 3 semester berjalan)
 */
import prisma from '../../lib/prisma';
import { siaFetch } from './siaClient.service';
import bcrypt from 'bcryptjs';

// ─── Tipe Response dari API SIA ──────────────────────────────────────────────
interface SiaResponse<T> {
  status: string;
  message: string;
  data: T[];
}

interface SiaFakultas {
  fakId: string;
  fakNama: string;
}

interface SiaProdi {
  prodiKodeDikti?: string;
  prodiNamaDikti?: string;
  prodiJenjangDikti?: string;
  prodiKode?: string;
  prodiNamaResmi?: string;
  prodiNamaJenjang?: string;
  prodiFakKode?: string;
  fakId: string;
  // Fallbacks
  prodiId?: string;
  prodiNama?: string;
  fakNama?: string;
}

interface SiaDosenPA {
  dsnPegNip?: string;
  dosenNip?: string; // fallback
  dsnNidn?: string;
  pegNama?: string;
  dosenNama?: string; // fallback
  pegGelarDepan?: string;
  pegGelarBelakang?: string;
  dsnProdiKode?: string;
  prodiNamaResmi?: string;
  fakKode?: string;
  fakNamaResmi?: string;
  status_pa?: string;
  fakId: string;
  dosenId?: string; // fallback
}

interface SiaMahasiswa {
  mhsNiu?: string; // NIM di SIA (Saps: 03/04)
  mhsNim?: string; // fallback
  mhsNama: string;
  prodiKode?: string;
  prodiNamaResmi?: string;
  prodiNama?: string; // fallback
  fakKode?: string;
  fakNamaResmi?: string;
  mhsAngkatan?: string;
  mhsIpkTranskrip?: string;
  dsnpaPegNip?: string | null; // NIP Dosen PA di SIA
  dsnpaNama?: string | null;
  dosenPaNip?: string | null; // fallback
  fakId: string;
  mhsStatus?: string; // "Aktif", "BSS" (Berhenti Sementara Studi / Cuti), dll.
}

export interface SiaKelasMbkm {
  klsId: string;
  kelas: string;
  mataKuliah: string;
  sks: string;
  nim: string;
  nama: string;
  prodiKode?: string;
  prodiNamaResmi?: string;
  prodiKodeDikti?: string;
  prodi?: string;
  fakKode?: string;
  fakultas?: string;
  fakId?: string;
  fakNamaSumber?: string;
}

// Status mahasiswa yang disinkronisasi ke SAPS (Aktif + BSS/Cuti)
const ALLOWED_MHS_STATUS = ['aktif', 'active', 'a', 'bss', 'cuti', 'berhenti sementara studi'];
const EXCLUDED_MHS_STATUS = [
  'lulus',
  'l',
  'graduated',
  'tidak aktif',
  'non aktif',
  'non-aktif',
  'ta',
  'do',
  'drop out',
  'keluar',
  'mengundurkan diri',
  'dikeluarkan',
  'wafat',
  'meninggal',
];

// ─── Tipe Hasil Sinkronisasi ─────────────────────────────────────────────────
export interface SyncResult {
  entity: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SyncKelasMbkmResult {
  entity: string;
  semester: string;
  totalKelas: number;
  totalPeserta: number;
  totalSks: number;
  mahasiswaTerdaftarSaps: number;
  mahasiswaBelumAdaSaps: number;
  errors: string[];
}

export interface SyncMahasiswaOptions {
  minAngkatan?: number; // default: 2020 atau dari env SIA_SYNC_MIN_ANGKATAN
  limit?: number;        // batasi jumlah mahasiswa untuk testing cepat
}

export interface SyncAllOptions extends SyncMahasiswaOptions {
  skipMahasiswa?: boolean;
  skipMbkm?: boolean;
}

// ─── Concurrency & Sync State Management ────────────────────────────────────
let isSyncInProgress = false;
let lastSyncTime: Date | null = null;
let lastSyncStatus: 'idle' | 'running' | 'success' | 'failed' = 'idle';
let lastSyncError: string | null = null;
let lastSyncSummary: any = null;

export function getSyncStatus() {
  return {
    isSyncInProgress,
    lastSyncTime,
    lastSyncStatus,
    lastSyncError,
    lastSyncSummary,
  };
}

// ─── Helper: chunk array for parallel batching ──────────────────────────────
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// ─── Helper: hash password (cached salt untuk optimasi kecepatan bulk sync) ───
let cachedSyncSalt: string | null = null;
async function hashPassword(plain: string): Promise<string> {
  if (!cachedSyncSalt) {
    cachedSyncSalt = await bcrypt.genSalt(6);
  }
  return bcrypt.hash(plain, cachedSyncSalt);
}

// ─── In-memory Cache Mapping ────────────────────────────────────────────────
const siaFakIdToSapsId = new Map<string, number>();
const siaProdiKodeToSapsId = new Map<string, number>();
const siaDosenNipToSapsUserId = new Map<string, bigint>();
const siaProdiKodeToJenjang = new Map<string, string>();
const siaProdiNameToJenjang = new Map<string, string>();

// =============================================================================
// 1. SYNC FAKULTAS (Saps: 01)
// =============================================================================
export async function syncFakultas(): Promise<SyncResult> {
  const result: SyncResult = { entity: 'Fakultas', created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const response = await siaFetch<SiaResponse<SiaFakultas>>('/saps/list-fakultas');

    if (response.status !== 'success' || !Array.isArray(response.data)) {
      result.errors.push(`Response tidak valid: ${response.message || 'Data bukan array'}`);
      return result;
    }

    for (const fak of response.data) {
      try {
        const nama = (fak.fakNama || '').trim();
        if (!nama) continue;

        const existing = await prisma.fakultas.findFirst({
          where: { nama: { equals: nama } },
        });

        if (existing) {
          siaFakIdToSapsId.set(fak.fakId, existing.id);
          result.skipped++;
        } else {
          const created = await prisma.fakultas.create({
            data: { nama },
          });
          siaFakIdToSapsId.set(fak.fakId, created.id);
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Fakultas "${fak.fakNama}": ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Fetch error: ${err.message}`);
  }

  console.log(`[SIA Sync] Fakultas — created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}`);
  return result;
}

// =============================================================================
// 2. SYNC PRODI (Saps: 02)
// =============================================================================
export async function syncProdi(): Promise<SyncResult> {
  const result: SyncResult = { entity: 'ProgramStudi', created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const response = await siaFetch<SiaResponse<SiaProdi>>('/saps/list-prodi');

    if (response.status !== 'success' || !Array.isArray(response.data)) {
      result.errors.push(`Response tidak valid: ${response.message || 'Data bukan array'}`);
      return result;
    }

    // Pastikan mapping fakultas terisi
    if (siaFakIdToSapsId.size === 0) {
      await syncFakultas();
    }

    for (const prodi of response.data) {
      try {
        const prodiNama = (prodi.prodiNamaResmi || prodi.prodiNamaDikti || prodi.prodiNama || '').trim();
        const prodiKode = (prodi.prodiKode || prodi.prodiKodeDikti || prodi.prodiId || '').trim();

        if (!prodiNama) continue;

        let fakultasId = siaFakIdToSapsId.get(prodi.fakId);
        if (!fakultasId) {
          // Cari fakultas di database
          const fakNama = (prodi.fakNama || '').trim();
          const fak = fakNama ? await prisma.fakultas.findFirst({ where: { nama: fakNama } }) : null;
          if (!fak) {
            result.errors.push(`Prodi "${prodiNama}": Fakultas ID "${prodi.fakId}" tidak ditemukan`);
            continue;
          }
          fakultasId = fak.id;
          siaFakIdToSapsId.set(prodi.fakId, fak.id);
        }

        // Cek apakah sudah ada di DB (unique: fakultasId + nama)
        let targetProdiId: number;
        const existing = await prisma.programStudi.findFirst({
          where: { fakultasId, nama: prodiNama },
        });

        if (existing) {
          targetProdiId = existing.id;
          result.skipped++;
        } else {
          const created = await prisma.programStudi.create({
            data: { nama: prodiNama, fakultasId },
          });
          targetProdiId = created.id;
          result.created++;
        }

        // Simpan SEMUA variasi kode prodi ke map agar bisa dicocokkan dari berbagai field
        const rawJenjang = (prodi.prodiJenjangDikti || prodi.prodiNamaJenjang || '').trim().toLowerCase();
        const codes = [prodi.prodiKode, prodi.prodiKodeDikti, prodi.prodiId].filter(Boolean);
        for (const c of codes) {
          const trimmed = String(c).trim();
          if (trimmed) {
            siaProdiKodeToSapsId.set(trimmed, targetProdiId);
            if (rawJenjang) siaProdiKodeToJenjang.set(trimmed, rawJenjang);
          }
        }
        if (rawJenjang) {
          siaProdiNameToJenjang.set(prodiNama.toLowerCase(), rawJenjang);
        }
      } catch (err: any) {
        result.errors.push(`Prodi "${prodi.prodiNamaResmi || prodi.prodiNama}": ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Fetch error: ${err.message}`);
  }

  console.log(`[SIA Sync] ProgramStudi — created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}`);
  return result;
}

// ─── Helpers: Filter Jenjang S1, D4, D3 (Non-Pascasarjana) ───────────────────

/**
 * Memeriksa apakah mahasiswa merupakan mahasiswa jenjang S1, D4, atau D3.
 * Menolak mahasiswa Pascasarjana (S2, S3, Spesialis, Subspesialis, Profesi, dll.)
 */
export function isMahasiswaS1D4D3(
  mhs: { mhsNiu?: string; mhsNim?: string; prodiKode?: string; prodiNamaResmi?: string; prodiNama?: string; nim?: string },
  prodiJenjangByKode?: Map<string, string>,
  prodiJenjangByName?: Map<string, string>
): boolean {
  const nim = (mhs.nim || mhs.mhsNiu || mhs.mhsNim || '').trim();
  const prodiNama = (mhs.prodiNamaResmi || mhs.prodiNama || '').trim().toLowerCase();
  const prodiKode = (mhs.prodiKode || '').trim();

  // 1. Cek dari nama prodi secara eksplisit: jika mengandung kata kunci Pascasarjana / Profesi -> tolak!
  if (
    /\b(magister|doktor|s2|s-2|s3|s-3|spesialis|sp-1|sp-2|subspesialis|profesi|pascasarjana|pasca\s*sarjana)\b/i.test(prodiNama)
  ) {
    return false;
  }

  // 2. Cek dari master jenjang prodi SIA jika tersedia
  if (prodiKode && prodiJenjangByKode && prodiJenjangByKode.has(prodiKode)) {
    const j = prodiJenjangByKode.get(prodiKode)!;
    if (['s2', 's3', 'sp-1', 'sp-2', 'spesialis', 'subspesialis', 'profesi', 'magister', 'doktor'].some(x => j.includes(x))) {
      return false;
    }
    if (['s1', 'd3', 'd4', 'sarjana', 'diploma'].some(x => j.includes(x))) {
      return true;
    }
  }

  if (prodiNama && prodiJenjangByName && prodiJenjangByName.has(prodiNama)) {
    const j = prodiJenjangByName.get(prodiNama)!;
    if (['s2', 's3', 'sp-1', 'sp-2', 'spesialis', 'subspesialis', 'profesi', 'magister', 'doktor'].some(x => j.includes(x))) {
      return false;
    }
    if (['s1', 'd3', 'd4', 'sarjana', 'diploma'].some(x => j.includes(x))) {
      return true;
    }
  }

  // 3. Cek dari digit ke-3 NIM standar UNAND (10 digit):
  //    Digit ke-3 = '1' -> S1 (Sarjana)
  //    Digit ke-3 = '0' -> D3/D4 (Diploma)
  //    Digit ke-3 = '2' -> S2 (Magister)
  //    Digit ke-3 = '3' -> S3 (Doktor)
  //    Digit ke-3 = '9' -> Spesialis
  //    Digit ke-3 = '4'/'5' -> Profesi
  if (/^\d{10}$/.test(nim)) {
    const jenjangDigit = nim.charAt(2);
    if (jenjangDigit === '2' || jenjangDigit === '3' || jenjangDigit === '9' || jenjangDigit === '4' || jenjangDigit === '5') {
      return false;
    }
    if (jenjangDigit === '1' || jenjangDigit === '0') {
      return true;
    }
  }

  // 4. Cek apakah nama prodi mengandung indikasi S1/D4/D3 eksplisit
  if (
    /\b(s1|s-1|sarjana|d4|d-4|d-iv|div|d3|d-3|d-iii|diii|diploma)\b/i.test(prodiNama)
  ) {
    return true;
  }

  // 5. Jika NIM 10 digit, hanya terima jika digit ke-3 adalah 1 atau 0
  if (/^\d{10}$/.test(nim)) {
    return nim.charAt(2) === '1' || nim.charAt(2) === '0';
  }

  return true;
}

// ─── Helpers: NIDN Sanitization & Dosen PA Upsert ────────────────────────────

/**
 * Membersihkan NIDN dari nilai dummy/placeholder seperti "0", "-", "null", spasi kosong, dll.
 * Mengembalikan string NIDN valid atau null.
 */
function cleanNidn(rawNidn?: string | null): string | null {
  if (!rawNidn) return null;
  const trimmed = rawNidn.trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '0' ||
    /^0+$/.test(trimmed) ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'tidak ada' ||
    trimmed.toLowerCase() === 'none'
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Menyimpan / memperbarui data Dosen PA dengan proteksi collision unique constraint NIDN.
 * Jika NIDN bentrok dengan data lain di database, otomatis fallback ke nidn = null agar profil Dosen tetap tercipta.
 */
async function upsertDosenRecord(userId: bigint, targetNidn: string | null, fakultasId: number | null): Promise<void> {
  const existingDosen = await prisma.dosen.findUnique({ where: { userId } });

  // 1. Cek apakah NIDN sudah dipakai oleh user Dosen lain di database
  let safeNidn = targetNidn;
  if (safeNidn) {
    const duplicate = await prisma.dosen.findFirst({
      where: {
        nidn: safeNidn,
        NOT: { userId },
      },
      select: { userId: true },
    });
    if (duplicate) {
      safeNidn = null;
    }
  }

  // 2. Eksekusi create atau update dengan fallback retry jika terjadi collision
  try {
    if (!existingDosen) {
      await prisma.dosen.create({
        data: { userId, nidn: safeNidn, fakultasId },
      });
    } else if (existingDosen.fakultasId !== fakultasId || existingDosen.nidn !== safeNidn) {
      await prisma.dosen.update({
        where: { userId },
        data: { fakultasId, nidn: safeNidn },
      });
    }
  } catch (err: any) {
    if (err.code === 'P2002' || err.message?.includes('dosen_nidn_key') || err.message?.includes('Unique constraint')) {
      // Retry dengan nidn: null agar Dosen tetap tercipta tanpa melanggar unique constraint
      if (!existingDosen) {
        await prisma.dosen.create({
          data: { userId, nidn: null, fakultasId },
        });
      } else {
        await prisma.dosen.update({
          where: { userId },
          data: { fakultasId, nidn: null },
        });
      }
    } else {
      throw err;
    }
  }
}

// ─── Helpers: Prodi Name Normalization & Keyword Matcher ─────────────────────

/**
 * Normalisasi string nama program studi untuk pencocokan fleksibel antara SIA dan SAPS.
 * Menangani variasi jenjang (D-III, D3, Diploma 3, S1, dll.) dan membuang tanda baca.
 */
function normalizeProdiString(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bd[-\s]?iii\b|\bdiploma[-\s]?3\b|\bdiploma[-\s]?iii\b|\bd\s*3\b/gi, 'd3')
    .replace(/\bd[-\s]?iv\b|\bdiploma[-\s]?4\b|\bdiploma[-\s]?iv\b|\bd\s*4\b/gi, 'd4')
    .replace(/\bd[-\s]?ii\b|\bdiploma[-\s]?2\b|\bdiploma[-\s]?ii\b|\bd\s*2\b/gi, 'd2')
    .replace(/\bd[-\s]?i\b|\bdiploma[-\s]?1\b|\bdiploma[-\s]?i\b|\bd\s*1\b/gi, 'd1')
    .replace(/\bs[-\s]?1\b|\bstrata[-\s]?1\b|\bsarjana\b/gi, 's1')
    .replace(/\bs[-\s]?2\b|\bmagister\b/gi, 's2')
    .replace(/\bs[-\s]?3\b|\bdoktor\b/gi, 's3')
    .replace(/\bsp[-\s]?1\b|\bspesialis[-\s]?1\b/gi, 'sp1')
    .replace(/\bprofesi\b/gi, 'profesi')
    .replace(/[-_/\\(),.]/g, ' ')
    .replace(/\b(program|studi|jurusan)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mencari program studi berdasarkan kecocokan kata kunci inti (misal: "perbankan" dan "keuangan")
 */
function findProdiByKeywords(inputNama: string, prodiList: { id: number; nama: string }[]): number | null {
  const normInput = normalizeProdiString(inputNama);
  const inputWords = normInput.split(' ').filter(w => w.length > 2 && w !== 'dan');
  if (inputWords.length === 0) return null;

  let bestMatchId: number | null = null;
  let maxMatchedWords = 0;

  for (const p of prodiList) {
    const normP = normalizeProdiString(p.nama);
    const pWords = normP.split(' ').filter(w => w.length > 2 && w !== 'dan');

    const matched = inputWords.filter(w => pWords.includes(w) || normP.includes(w)).length;
    const threshold = Math.min(inputWords.length, 2);
    if (matched >= threshold && matched > maxMatchedWords) {
      maxMatchedWords = matched;
      bestMatchId = p.id;
    }
  }

  return bestMatchId;
}

// =============================================================================
// 3. SYNC DOSEN PA (Saps: 05)
// =============================================================================
export async function syncDosenPA(): Promise<SyncResult> {
  const result: SyncResult = { entity: 'Dosen PA', created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const response = await siaFetch<SiaResponse<SiaDosenPA>>('/saps/list-dosen-pa');

    if (response.status !== 'success' || !Array.isArray(response.data)) {
      result.errors.push(`Response tidak valid: ${response.message || 'Data bukan array'}`);
      return result;
    }

    // Deduplikasi berdasarkan NIP
    const deduped = new Map<string, SiaDosenPA>();
    for (const d of response.data) {
      const nip = (d.dsnPegNip || d.dosenNip || '').trim();
      if (nip && !deduped.has(nip)) {
        deduped.set(nip, d);
      }
    }

    if (siaFakIdToSapsId.size === 0) {
      await syncFakultas();
    }

    // Preload semua fakultas ke Map untuk lookup in-memory tanpa query per dosen
    const allFakultas = await prisma.fakultas.findMany({ select: { id: true, nama: true } });
    const fakByNameLower = new Map<string, number>();
    for (const f of allFakultas) {
      fakByNameLower.set(f.nama.trim().toLowerCase(), f.id);
    }

    const BATCH_SIZE = 50;
    const entries = Array.from(deduped.entries());
    const chunks = chunkArray(entries, BATCH_SIZE);

    console.log(`[SIA Sync] Memproses ${entries.length} Dosen PA dalam ${chunks.length} batch (${BATCH_SIZE} dosen/batch)...`);

    for (let i = 0; i < chunks.length; i++) {
      const batch = chunks[i];
      await Promise.all(
        batch.map(async ([nip, dosen]) => {
          try {
            const email = `${nip}@dosen.unand.ac.id`;
            const nidn = cleanNidn(dosen.dsnNidn);

            // Susun nama lengkap dengan gelar depan dan belakang jika tersedia
            const gelarDepan = (dosen.pegGelarDepan || '').trim();
            const gelarBelakang = (dosen.pegGelarBelakang || '').trim();
            const namaUtama = (dosen.pegNama || dosen.dosenNama || '').trim();

            let namaLengkap = namaUtama;
            if (gelarDepan) namaLengkap = `${gelarDepan} ${namaLengkap}`;
            if (gelarBelakang) namaLengkap = `${namaLengkap}, ${gelarBelakang}`;

            let fakultasId = siaFakIdToSapsId.get(dosen.fakId) || null;
            if (!fakultasId && dosen.fakNamaResmi) {
              const lowerFak = dosen.fakNamaResmi.trim().toLowerCase();
              fakultasId = fakByNameLower.get(lowerFak) || null;
              if (!fakultasId) {
                for (const [fName, fId] of fakByNameLower.entries()) {
                  if (fName.includes(lowerFak) || lowerFak.includes(fName)) {
                    fakultasId = fId;
                    break;
                  }
                }
              }
            }

            const existingUser = await prisma.user.findUnique({ where: { email } });

            if (existingUser) {
              if (existingUser.nama !== namaLengkap) {
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { nama: namaLengkap },
                });
                result.updated++;
              } else {
                result.skipped++;
              }

              await upsertDosenRecord(existingUser.id, nidn, fakultasId);
              siaDosenNipToSapsUserId.set(nip, existingUser.id);
            } else {
              const passwordHash = await hashPassword(`Unand#${nip}`);
              const newUser = await prisma.user.create({
                data: {
                  nama: namaLengkap,
                  email,
                  passwordHash,
                  peran: 'dosen',
                },
              });

              await upsertDosenRecord(newUser.id, nidn, fakultasId);
              siaDosenNipToSapsUserId.set(nip, newUser.id);
              result.created++;
            }
          } catch (err: any) {
            result.errors.push(`Dosen NIP ${nip}: ${err.message}`);
          }
        })
      );
    }
  } catch (err: any) {
    result.errors.push(`Fetch error: ${err.message}`);
  }

  console.log(`[SIA Sync] Dosen PA — created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}, errors: ${result.errors.length}`);
  return result;
}

// =============================================================================
// 4. SYNC MAHASISWA (Saps: 03) — Filter Status Aktif & BSS, Angkatan & Limit
// =============================================================================
export async function syncMahasiswa(options?: SyncMahasiswaOptions): Promise<SyncResult> {
  const result: SyncResult = { entity: 'Mahasiswa', created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const response = await siaFetch<SiaResponse<SiaMahasiswa>>('/saps/list-mahasiswa');

    if (response.status !== 'success' || !Array.isArray(response.data)) {
      result.errors.push(`Response tidak valid: ${response.message || 'Data bukan array'}`);
      return result;
    }

    // Pastikan master prodi sudah di-sync terlebih dahulu untuk membaca pemetaan jenjang
    if (siaProdiKodeToSapsId.size === 0) {
      await syncProdi();
    }

    // Angkatan minimal HANYA jika dispesifikasikan eksplisit via opsi CLI / env (tanpa batasan default kaku 2020)
    const minAngkatan = options?.minAngkatan ?? (process.env.SIA_SYNC_MIN_ANGKATAN ? parseInt(process.env.SIA_SYNC_MIN_ANGKATAN, 10) : undefined);

    // Filter mahasiswa:
    // 1. HANYA terima jenjang Sarjana & Diploma (S1, D4, D3) — tolak Pascasarjana (S2, S3, Sp, Profesi)
    // 2. Status Aktif & BSS/Cuti (lewati Lulus, DO, Mengundurkan Diri, dll.)
    // 3. Filter angkatan (jika dispesifikasikan)
    const filtered = response.data.filter(m => {
      // 1. Cek jenjang: Wajib S1, D4, atau D3
      if (!isMahasiswaS1D4D3(m, siaProdiKodeToJenjang, siaProdiNameToJenjang)) {
        return false;
      }

      const rawStatus = (m.mhsStatus || (m as any).status || (m as any).statusMhs || (m as any).statusMahasiswa || (m as any).mhs_status || '').toString().trim().toLowerCase();

      if (rawStatus) {
        // Jika terdeteksi Lulus, DO, Mengundurkan Diri, atau Tidak Aktif -> skip!
        if (EXCLUDED_MHS_STATUS.some(s => rawStatus === s || rawStatus.includes(s))) {
          return false;
        }

        // Jika status ada dan cocok dengan status yang diizinkan -> izinkan!
        if (ALLOWED_MHS_STATUS.some(s => rawStatus === s || rawStatus.includes(s))) {
          // Lolos cek status, lanjut cek angkatan di bawah
        }
      }

      // Cek angkatan jika ada batasan minimal
      if (minAngkatan) {
        const rawAngkatan = (m.mhsAngkatan || '').toString().trim();
        const angkatan = parseInt(rawAngkatan, 10);
        if (angkatan && angkatan < minAngkatan) {
          return false;
        }
      }

      return true;
    });

    console.log(
      `[SIA Sync] Mahasiswa: ${response.data.length} total → ${filtered.length} setelah filter (Jenjang S1/D4/D3 Saja, Aktif & BSS/Cuti${minAngkatan ? `, Angkatan ≥ ${minAngkatan}` : ', Semua Angkatan'})`
    );

    // Deduplikasi berdasarkan NIM (mhsNiu di SIA atau mhsNim)
    const deduped = new Map<string, SiaMahasiswa>();
    for (const m of filtered) {
      const nim = (m.mhsNiu || m.mhsNim || '').trim();
      if (nim && !deduped.has(nim)) {
        deduped.set(nim, m);
      }
    }

    // Preload semua program studi ke memory untuk lookup fleksibel
    const allProdiList = await prisma.programStudi.findMany({ select: { id: true, nama: true, fakultasId: true } });
    const prodiByNameLower = new Map<string, number>();
    const prodiByNormalized = new Map<string, number>();
    for (const p of allProdiList) {
      prodiByNameLower.set(p.nama.trim().toLowerCase(), p.id);
      prodiByNormalized.set(normalizeProdiString(p.nama), p.id);
    }

    // Preload semua fakultas untuk fallback auto-create prodi
    const allFakultas = await prisma.fakultas.findMany({ select: { id: true, nama: true } });
    const fakByNameLower = new Map<string, number>();
    for (const f of allFakultas) {
      fakByNameLower.set(f.nama.trim().toLowerCase(), f.id);
    }

    // Preload Dosen PA dari tabel DOSEN (bukan hanya tabel User) agar menjamin Foreign Key valid
    if (siaDosenNipToSapsUserId.size === 0) {
      const allDosenList = await prisma.dosen.findMany({
        select: {
          userId: true,
          user: { select: { email: true } },
        },
      });
      for (const d of allDosenList) {
        if (d.user?.email) {
          const nip = d.user.email.split('@')[0];
          if (nip) siaDosenNipToSapsUserId.set(nip, d.userId);
        }
      }
    }

    // ─── Load semua kurikulum, diurutkan dari angkatan_mulai terbesar ────
    const semuaKurikulum = await prisma.kurikulum.findMany({
      where: { deletedAt: null },
      orderBy: { angkatanMulai: 'desc' },
    });

    // Urutkan juga secara ASC untuk mencari kurikulum terawal/terdekat jika angkatan mahasiswa < kurikulum terawal
    const kurikulumDenganAngkatanAsc = semuaKurikulum
      .filter(k => k.angkatanMulai !== null)
      .sort((a, b) => a.angkatanMulai! - b.angkatanMulai!);

    function cariKurikulumId(angkatan: number | null): number | null {
      if (!angkatan || semuaKurikulum.length === 0) {
        const aktif = semuaKurikulum.find(k => k.status === 'aktif');
        return aktif?.id ?? semuaKurikulum[0]?.id ?? null;
      }

      // 1. Cari kurikulum yang angkatanMulai <= angkatan (terdekat di bawahnya)
      for (const k of semuaKurikulum) {
        if (k.angkatanMulai !== null && k.angkatanMulai <= angkatan) {
          return k.id;
        }
      }

      // 2. Jika mahasiswa angkatannya lebih tua dari kurikulum paling awal:
      // Wajib mengikuti kurikulum paling awal / terdekat
      if (kurikulumDenganAngkatanAsc.length > 0) {
        return kurikulumDenganAngkatanAsc[0].id;
      }

      // 3. Fallback ke kurikulum aktif jika tidak ada angkatanMulai
      const aktif = semuaKurikulum.find(k => k.status === 'aktif');
      return aktif?.id ?? semuaKurikulum[0]?.id ?? null;
    }

    console.log(`[SIA Sync] Kurikulum tersedia: ${semuaKurikulum.length} (untuk auto-assign ke mahasiswa)`);

    let entries = Array.from(deduped.entries());

    // Batasi jumlah jika ada opsi limit
    const limit = options?.limit ?? (process.env.SIA_SYNC_MHS_LIMIT ? parseInt(process.env.SIA_SYNC_MHS_LIMIT, 10) : undefined);
    if (limit && limit > 0 && limit < entries.length) {
      entries = entries.slice(0, limit);
      console.log(`[SIA Sync] Dibatasi (limit): Memproses ${entries.length} mahasiswa pertama.`);
    }

    const BATCH_SIZE = 150;
    const chunks = chunkArray(entries, BATCH_SIZE);

    console.log(`[SIA Sync] Memproses ${entries.length} mahasiswa dalam ${chunks.length} batch (${BATCH_SIZE} mahasiswa/batch)...`);

    for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
      const batch = chunks[batchIndex];

      await Promise.all(
        batch.map(async ([nim, mhs]) => {
          try {
            const prodiKode = (mhs.prodiKode || '').trim();
            const prodiNama = (mhs.prodiNamaResmi || mhs.prodiNama || '').trim();

            let prodiId = siaProdiKodeToSapsId.get(prodiKode);
            if (!prodiId && prodiNama) {
              const lowerName = prodiNama.toLowerCase();
              const normName = normalizeProdiString(prodiNama);

              // 1. Exact lowercase
              prodiId = prodiByNameLower.get(lowerName);

              // 2. Normalized match (DIII <-> D3, etc.)
              if (!prodiId) {
                prodiId = prodiByNormalized.get(normName);
              }

              // 3. Substring includes
              if (!prodiId) {
                for (const [pName, pId] of prodiByNameLower.entries()) {
                  if (pName.includes(lowerName) || lowerName.includes(pName)) {
                    prodiId = pId;
                    break;
                  }
                }
              }

              // 4. Normalized substring includes
              if (!prodiId) {
                for (const [pNorm, pId] of prodiByNormalized.entries()) {
                  if (pNorm.includes(normName) || normName.includes(pNorm)) {
                    prodiId = pId;
                    break;
                  }
                }
              }

              // 5. Keyword matching (misal: "perbankan" & "keuangan")
              if (!prodiId) {
                prodiId = findProdiByKeywords(prodiNama, allProdiList) || undefined;
              }

              // 6. Fallback: Auto-create prodi jika dari SIA belum ada di SAPS agar mahasiswa tidak hilang
              if (!prodiId) {
                let fakultasId = siaFakIdToSapsId.get(mhs.fakId);
                if (!fakultasId && mhs.fakNamaResmi) {
                  const cleanFak = mhs.fakNamaResmi.replace(/fakultas\s*/i, '').trim().toLowerCase();
                  for (const [fName, fId] of fakByNameLower.entries()) {
                    if (fName.includes(cleanFak) || cleanFak.includes(fName)) {
                      fakultasId = fId;
                      break;
                    }
                  }
                }
                if (!fakultasId) {
                  fakultasId = allFakultas[0]?.id || 1;
                }

                try {
                  const created = await prisma.programStudi.create({
                    data: { nama: prodiNama, fakultasId },
                  });
                  prodiId = created.id;
                  allProdiList.push({ id: created.id, nama: prodiNama, fakultasId });
                  prodiByNameLower.set(lowerName, created.id);
                  prodiByNormalized.set(normName, created.id);
                  if (prodiKode) siaProdiKodeToSapsId.set(prodiKode, created.id);
                } catch (createProdiErr) {
                  const retry = await prisma.programStudi.findFirst({ where: { nama: prodiNama } });
                  if (retry) prodiId = retry.id;
                }
              }
            }

            if (!prodiId) {
              result.errors.push(`Mahasiswa "${mhs.mhsNama}" (NIM: ${nim}): Prodi "${prodiNama || prodiKode}" tidak ditemukan`);
              return;
            }

            const email = `${nim}@student.unand.ac.id`;
            const angkatan = parseInt(mhs.mhsAngkatan || '', 10) || null;

            // Auto-assign kurikulum berdasarkan angkatan
            const kurikulumId = cariKurikulumId(angkatan);

            // Cari Dosen PA jika ada NIP dosen PA
            const dosenPaNip = (mhs.dsnpaPegNip || mhs.dosenPaNip || '').trim();
            let dosenPaId: bigint | null = null;

            if (dosenPaNip) {
              if (siaDosenNipToSapsUserId.has(dosenPaNip)) {
                dosenPaId = siaDosenNipToSapsUserId.get(dosenPaNip)!;
              } else {
                // Cari langsung ke tabel Dosen (menjamin Foreign Key valid)
                const dosenRecord = await prisma.dosen.findFirst({
                  where: { user: { email: `${dosenPaNip}@dosen.unand.ac.id` } },
                  select: { userId: true },
                });
                if (dosenRecord) {
                  dosenPaId = dosenRecord.userId;
                  siaDosenNipToSapsUserId.set(dosenPaNip, dosenRecord.userId);
                }
              }
            }

            let userId: bigint;

            const existingUser = await prisma.user.findUnique({ where: { email } });

            if (existingUser) {
              userId = existingUser.id;
              if (existingUser.nama !== mhs.mhsNama) {
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { nama: mhs.mhsNama },
                });
              }
              result.updated++;
            } else {
              try {
                const passwordHash = await hashPassword(`Unand#${nim}`);
                const newUser = await prisma.user.create({
                  data: {
                    nama: mhs.mhsNama,
                    email,
                    passwordHash,
                    peran: 'mahasiswa',
                  },
                });
                userId = newUser.id;
                result.created++;
              } catch (userCreateErr: any) {
                // Jika user dengan email ini sudah ada (karena proses paralel atau sinkronisasi sebelumnya)
                if (
                  userCreateErr.code === 'P2002' ||
                  userCreateErr.message?.includes('users_email_key') ||
                  userCreateErr.message?.includes('Unique constraint')
                ) {
                  const fallbackUser = await prisma.user.findUnique({ where: { email } });
                  if (fallbackUser) {
                    userId = fallbackUser.id;
                    result.updated++;
                  } else {
                    throw userCreateErr;
                  }
                } else {
                  throw userCreateErr;
                }
              }
            }

            // Hubungkan profil Mahasiswa dengan userId yang valid
            const existingMhs = await prisma.mahasiswa.findUnique({ where: { userId } });
            if (!existingMhs) {
              // Cek juga apakah ada mahasiswa lain dengan NIM ini (menghindari P2002 pada nim_key)
              const existingByNim = await prisma.mahasiswa.findUnique({ where: { nim } });
              if (existingByNim) {
                try {
                  await prisma.mahasiswa.update({
                    where: { nim },
                    data: { prodiId, angkatan, dosenPaId, kurikulumId },
                  });
                } catch (mhsUpdateErr: any) {
                  if (mhsUpdateErr.code === 'P2003' && mhsUpdateErr.message?.includes('dosen_pa_id')) {
                    await prisma.mahasiswa.update({
                      where: { nim },
                      data: { prodiId, angkatan, dosenPaId: null, kurikulumId },
                    });
                  } else {
                    throw mhsUpdateErr;
                  }
                }
              } else {
                try {
                  await prisma.mahasiswa.create({
                    data: { userId, nim, prodiId, angkatan, dosenPaId, kurikulumId },
                  });
                } catch (mhsCreateErr: any) {
                  if (mhsCreateErr.code === 'P2003' && mhsCreateErr.message?.includes('dosen_pa_id')) {
                    await prisma.mahasiswa.create({
                      data: { userId, nim, prodiId, angkatan, dosenPaId: null, kurikulumId },
                    });
                  } else {
                    throw mhsCreateErr;
                  }
                }
              }
            } else {
              try {
                await prisma.mahasiswa.update({
                  where: { userId },
                  data: { prodiId, angkatan, dosenPaId, kurikulumId },
                });
              } catch (mhsUpdateErr: any) {
                if (mhsUpdateErr.code === 'P2003' && mhsUpdateErr.message?.includes('dosen_pa_id')) {
                  await prisma.mahasiswa.update({
                    where: { userId },
                    data: { prodiId, angkatan, dosenPaId: null, kurikulumId },
                  });
                } else {
                  throw mhsUpdateErr;
                }
              }
            }
          } catch (err: any) {
            result.errors.push(`Mahasiswa "${mhs.mhsNama}" (NIM: ${nim}): ${err.message}`);
          }
        })
      );

      if ((batchIndex + 1) % 10 === 0 || batchIndex === chunks.length - 1) {
        console.log(`[SIA Sync] Progress mahasiswa: batch ${batchIndex + 1}/${chunks.length} selesai (${result.created} baru, ${result.updated} update)`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Fetch error: ${err.message}`);
  }

  console.log(`[SIA Sync] Mahasiswa — created: ${result.created}, updated: ${result.updated}, skipped: ${result.skipped}, errors: ${result.errors.length}`);
  return result;
}

// =============================================================================
// 5. SYNC KELAS MBKM (Saps: 07) — Mengambil Data Kelas MBKM per Semester
// =============================================================================
export async function syncKelasMbkm(klsSemId?: string): Promise<SyncKelasMbkmResult> {
  const currentSemester = klsSemId || `${new Date().getFullYear()}${new Date().getMonth() >= 6 ? '1' : '2'}`;
  const result: SyncKelasMbkmResult = {
    entity: 'Kelas MBKM',
    semester: currentSemester,
    totalKelas: 0,
    totalPeserta: 0,
    totalSks: 0,
    mahasiswaTerdaftarSaps: 0,
    mahasiswaBelumAdaSaps: 0,
    errors: [],
  };

  try {
    console.log(`[SIA Sync] Menarik daftar kelas MBKM untuk semester ${currentSemester}...`);
    const response = await siaFetch<SiaResponse<SiaKelasMbkm>>('/saps/list-kelas-mbkm', {
      klsSemId: currentSemester,
    });

    if (response.status !== 'success' || !Array.isArray(response.data)) {
      result.errors.push(`Response tidak valid: ${response.message || 'Data bukan array'}`);
      return result;
    }

    result.totalPeserta = response.data.length;

    const uniqueClasses = new Set<string>();
    const uniqueStudents = new Set<string>();
    let sumSks = 0;

    for (const item of response.data) {
      if (item.klsId) uniqueClasses.add(item.klsId);
      if (item.nim) uniqueStudents.add(item.nim.trim());
      const sks = parseInt(item.sks || '0', 10);
      if (!isNaN(sks)) sumSks += sks;
    }

    result.totalKelas = uniqueClasses.size;
    result.totalSks = sumSks;

    // Cek berapa mahasiswa yang sudah ada di database SAPS
    if (uniqueStudents.size > 0) {
      const studentNims = Array.from(uniqueStudents);
      const matchedMhs = await prisma.mahasiswa.findMany({
        where: { nim: { in: studentNims } },
        select: { nim: true },
      });

      result.mahasiswaTerdaftarSaps = matchedMhs.length;
      result.mahasiswaBelumAdaSaps = uniqueStudents.size - matchedMhs.length;
    }

    console.log(
      `[SIA Sync] Kelas MBKM Semester ${currentSemester}: ${result.totalKelas} kelas, ${result.totalPeserta} peserta (${result.mahasiswaTerdaftarSaps} terdaftar di SAPS).`,
    );
  } catch (err: any) {
    result.errors.push(`Fetch error: ${err.message}`);
  }

  return result;
}

// =============================================================================
// 6. SYNC ALL (Berurutan: Fakultas → Prodi → Dosen → Mahasiswa → Kelas MBKM)
// =============================================================================
export async function syncAll(klsSemId?: string, options?: SyncAllOptions): Promise<(SyncResult | SyncKelasMbkmResult)[]> {
  if (isSyncInProgress) {
    throw new Error('Sinkronisasi SIA sedang berjalan di latar belakang. Silakan tunggu hingga proses saat ini selesai.');
  }

  isSyncInProgress = true;
  lastSyncStatus = 'running';
  lastSyncError = null;

  console.log('[SIA Sync] ═══════════════════════════════════════════════════');
  console.log('[SIA Sync] Memulai sinkronisasi dari API SIA (Batch Parallel)...');
  console.log('[SIA Sync] ═══════════════════════════════════════════════════');

  const startTime = Date.now();
  const results: (SyncResult | SyncKelasMbkmResult)[] = [];

  try {
    results.push(await syncFakultas());
    results.push(await syncProdi());
    results.push(await syncDosenPA());

    if (options?.skipMahasiswa) {
      console.log('[SIA Sync] ⏩ Melewati tahap Mahasiswa (--skip-mahasiswa aktif)...');
    } else {
      results.push(await syncMahasiswa(options));
    }

    if (options?.skipMbkm) {
      console.log('[SIA Sync] ⏩ Melewati tahap Kelas MBKM (--skip-mbkm aktif)...');
    } else {
      results.push(await syncKelasMbkm(klsSemId));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('[SIA Sync] ═══════════════════════════════════════════════════');
    console.log(`[SIA Sync] Sinkronisasi selesai dalam ${duration} detik!`);
    console.log('[SIA Sync] ═══════════════════════════════════════════════════');

    lastSyncTime = new Date();
    lastSyncStatus = 'success';
    lastSyncSummary = results;
    return results;
  } catch (err: any) {
    lastSyncStatus = 'failed';
    lastSyncError = err.message;
    console.error('[SIA Sync Error]', err.message);
    throw err;
  } finally {
    isSyncInProgress = false;
  }
}

// =============================================================================
// 7. CLEANUP DUMMY DATA (Hapus data dummy, kecuali akun Pimpinan Ditmawa)
// =============================================================================
export async function cleanupDummyData(): Promise<{
  deleted: Record<string, number>;
  preserved: string[];
}> {
  console.log('[SIA Cleanup] Memulai pembersihan data dummy...');

  // Cari semua staff pimpinan_ditmawa & pimpinan_utama → user IDs yang DIPERTAHANKAN
  const preservedStaff = await prisma.staff.findMany({
    where: { jabatan: { in: ['pimpinan_ditmawa', 'pimpinan_utama'] } },
    select: { userId: true, jabatan: true, user: { select: { nama: true, email: true } } },
  });
  const preservedUserIds = preservedStaff.map(s => s.userId);
  const preservedNames = preservedStaff.map(s => `${s.user.nama} (${s.jabatan})`);

  console.log(`[SIA Cleanup] Mempertahankan ${preservedUserIds.length} akun: ${preservedNames.join(', ')}`);

  const deleted: Record<string, number> = {};

  // Hapus data transaksional terlebih dahulu (child tables)
  const tablesToTruncate = [
    'auditLog',
    'notifikasi',
    'saranPA',
    'cvGenerated',
  ] as const;

  for (const table of tablesToTruncate) {
    const count = await (prisma[table] as any).deleteMany({});
    deleted[table] = count.count;
  }

  // Hapus perolehan detail → perolehan poin (berurutan karena FK)
  deleted['perolehanDetail'] = (await prisma.perolehanDetail.deleteMany({})).count;
  deleted['perolehanPoin'] = (await prisma.perolehanPoin.deleteMany({})).count;

  // Hapus klaim & bukti
  deleted['bukti'] = (await prisma.bukti.deleteMany({})).count;
  deleted['klaimPoin'] = (await prisma.klaimPoin.deleteMany({})).count;

  // Hapus izin PA
  deleted['izinPA'] = (await prisma.izinPA.deleteMany({})).count;

  // Hapus partisipasi
  deleted['partisipasi'] = (await prisma.partisipasi.deleteMany({})).count;

  // Hapus kegiatan approval → kegiatan
  deleted['kegiatanApproval'] = (await prisma.kegiatanApproval.deleteMany({})).count;
  deleted['kegiatan'] = (await prisma.kegiatan.deleteMany({})).count;

  // Hapus operator organisasi
  deleted['organisasiOperator'] = (await prisma.organisasiOperator.deleteMany({})).count;

  // Hapus profil mahasiswa
  deleted['mahasiswa'] = (await prisma.mahasiswa.deleteMany({})).count;

  // Hapus profil dosen
  deleted['dosen'] = (await prisma.dosen.deleteMany({})).count;

  // Hapus profil staff KECUALI yang dipertahankan
  deleted['staff'] = (await prisma.staff.deleteMany({
    where: { userId: { notIn: preservedUserIds } },
  })).count;

  // Hapus user KECUALI yang dipertahankan
  deleted['users'] = (await prisma.user.deleteMany({
    where: { id: { notIn: preservedUserIds } },
  })).count;

  console.log('[SIA Cleanup] Pembersihan selesai!');
  for (const [table, count] of Object.entries(deleted)) {
    if (count > 0) console.log(`  ${table}: ${count} record dihapus`);
  }

  return { deleted, preserved: preservedNames };
}
