import prisma from '../lib/prisma';
import { NotifikasiService } from './notifikasi.service';
import { buildSettlementDetails, resolveMatriksMahasiswa } from './kurikulumResolver.service';

export interface AutoClaimResult {
  claimed: boolean;
  poin?: number;
  reason?: string;
}

/**
 * Mencairkan poin otomatis untuk partisipasi kegiatan internal
 * 
 * 3 Syarat Wajib:
 * 1. Partisipasi hadir (kehadiran === true)
 * 2. Peran terverifikasi sudah ada (peranVerifId != null)
 * 3. Izin Dosen PA sudah disetujui (izinPA.status === 'disetujui')
 */
export async function cairkanPoinPartisipasi(
  partisipasiId: bigint,
  txPrisma?: any
): Promise<AutoClaimResult> {
  const db = txPrisma || prisma;

  const partisipasi = await db.partisipasi.findUnique({
    where: { id: partisipasiId },
    include: {
      kegiatan: {
        include: {
          kategori: true,
          skala: true,
          kegiatanCapaian: true,
        },
      },
      peranVerif: true,
      izinPA: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      klaimPoin: {
        include: {
          perolehanPoin: true,
        },
      },
      mahasiswa: {
        include: {
          user: { select: { id: true, nama: true } },
        },
      },
    },
  });

  if (!partisipasi) {
    return { claimed: false, reason: 'Partisipasi tidak ditemukan' };
  }

  // Cek apakah sudah pernah sah
  if (partisipasi.klaimPoin?.perolehanPoin && partisipasi.klaimPoin.perolehanPoin.status === 'sah') {
    return { 
      claimed: false, 
      reason: 'Poin sudah pernah dicairkan sebelumnya', 
      poin: partisipasi.klaimPoin.perolehanPoin.totalPoin 
    };
  }

  // 1. Cek Kehadiran
  if (partisipasi.kehadiran !== true) {
    return { claimed: false, reason: 'Peserta belum diverifikasi hadir' };
  }

  // 2. Cek Peran Terverifikasi
  if (!partisipasi.peranVerifId) {
    return { claimed: false, reason: 'Peran peserta belum ditentukan' };
  }

  // 3. Cek Izin Dosen PA, kecuali event global secara eksplisit melewatinya.
  const izinTerbaru = partisipasi.izinPA[0];
  if (!partisipasi.kegiatan.tanpaPersetujuanPa && (!izinTerbaru || izinTerbaru.status !== 'disetujui')) {
    return { claimed: false, reason: 'Izin Dosen PA belum disetujui' };
  }

  const kegiatan = partisipasi.kegiatan;

  const { kurikulum, matriks } = await resolveMatriksMahasiswa(
    partisipasi.mahasiswaId,
    {
      kategoriId: kegiatan.kategoriId,
      skalaId: kegiatan.skalaId,
      peranId: partisipasi.peranVerifId,
    },
    db,
    {
      preferredKurikulumId: kegiatan.kurikulumId,
      kegiatanId: kegiatan.id,
    },
  );

  if (!matriks) {
    return {
      claimed: false,
      reason: `Matriks poin tidak ditemukan untuk kombinasi: kategori=${kegiatan.kategoriId}, skala=${kegiatan.skalaId}, peran=${partisipasi.peranVerifId}`,
    };
  }

  let detailData;
  try {
    detailData = await buildSettlementDetails(kegiatan.id, kurikulum.id, matriks.poin, db);
  } catch (err: any) {
    return {
      claimed: false,
      reason: err?.message || 'Pemetaan capaian kegiatan tidak valid untuk pencairan poin',
    };
  }

  // Buat / Update KlaimPoin
  let klaimId: bigint;
  if (partisipasi.klaimPoin) {
    klaimId = partisipasi.klaimPoin.id;
    await db.klaimPoin.update({
      where: { id: klaimId },
      data: {
        status: 'disetujui',
        peranUsulanId: partisipasi.peranVerifId,
        alasan: 'Pencairan poin otomatis (kehadiran, peran & izin PA lengkap)',
      },
    });
  } else {
    const newKlaim = await db.klaimPoin.create({
      data: {
        partisipasiId: partisipasi.id,
        peranUsulanId: partisipasi.peranVerifId,
        status: 'disetujui',
        alasan: 'Pencairan poin otomatis (kehadiran, peran & izin PA lengkap)',
      },
    });
    klaimId = newKlaim.id;
  }

  // Hapus perolehan lama jika ada
  await db.perolehanPoin.deleteMany({
    where: { klaimPoinId: klaimId },
  });

  const perolehan = await db.perolehanPoin.create({
    data: {
      klaimPoinId: klaimId,
      mahasiswaId: partisipasi.mahasiswaId,
      kegiatanId: kegiatan.id,
      kurikulumId: kurikulum.id,
      totalPoin: matriks.poin,
      status: 'sah',
      detail: { create: detailData },
    },
  });

  // Update status partisipasi menjadi hadir
  await db.partisipasi.update({
    where: { id: partisipasi.id },
    data: { status: 'hadir' },
  });

  // Kirim notifikasi ke mahasiswa
  try {
    await NotifikasiService.kirim({
      userId: partisipasi.mahasiswaId,
      judul: 'Poin Otomatis Diperoleh! 🎉',
      isi: `Poin kegiatan internal "${kegiatan.nama}" sebesar ${matriks.poin} poin telah otomatis cair dan ditambahkan ke profil Anda.`,
      refType: 'perolehan_poin',
      refId: perolehan.id,
    });
  } catch (err) {
    console.error('[cairkanPoinPartisipasi] Notifikasi gagal:', err);
  }

  return { claimed: true, poin: matriks.poin };
}
