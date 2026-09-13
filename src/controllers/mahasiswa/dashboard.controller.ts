import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { perolehanUntukKurikulum, resolveKurikulumMahasiswa } from '../../services/kurikulumResolver.service';

// ==================== DASHBOARD MAHASISWA ====================

// Helper untuk menghitung progres kurikulum mahasiswa dengan capping poin
export function hitungProgresKurikulumMahasiswa(kurikulum: any, perolehanPoin: any[]) {
  const capaianMapById: Record<number, number> = {};
  const capaianMapByName: Record<string, number> = {};
  const subCapaianMapById: Record<number, number> = {};
  const subCapaianMapByName: Record<string, number> = {};

  for (const p of perolehanPoin) {
    if (p.detail && p.detail.length > 0) {
      let detailSum = 0;
      for (const d of p.detail) {
        const scId = d.subCapaianId;
        const scNama = d.subCapaian?.nama?.toLowerCase().trim();
        const capaianId = d.subCapaian?.capaianId;
        const capaianNama = d.subCapaian?.capaian?.nama?.toLowerCase().trim();

        if (scId) {
          subCapaianMapById[scId] = (subCapaianMapById[scId] || 0) + d.poin;
        }
        if (scNama) {
          subCapaianMapByName[scNama] = (subCapaianMapByName[scNama] || 0) + d.poin;
        }
        if (capaianId) {
          capaianMapById[capaianId] = (capaianMapById[capaianId] || 0) + d.poin;
        }
        if (capaianNama) {
          capaianMapByName[capaianNama] = (capaianMapByName[capaianNama] || 0) + d.poin;
        }
        detailSum += d.poin;
      }
      const selisih = p.totalPoin - detailSum;
      if (selisih > 0 && kurikulum.capaian[0]?.id) {
        const defaultId = kurikulum.capaian[0].id;
        capaianMapById[defaultId] = (capaianMapById[defaultId] || 0) + selisih;
      }
    } else {
      const defaultId = kurikulum.capaian[0]?.id;
      if (defaultId) {
        capaianMapById[defaultId] = (capaianMapById[defaultId] || 0) + p.totalPoin;
      }
    }
  }

  // Hitung progres per capaian (dengan capping agar kelebihan tidak masuk ke progres)
  const progresTahunan = kurikulum.capaian.map((c: any) => {
    const targetPoin = c.jumlahPoin;
    const cNama = c.nama?.toLowerCase().trim();
    const poinAktual = capaianMapById[c.id] ?? (capaianMapByName[cNama] || 0);

    let sumSubProgres = 0;
    const hasSub = Array.isArray(c.subCapaian) && c.subCapaian.length > 0;
    let hasSubWithBobot = false;

    const subCapaianProgres = hasSub
      ? c.subCapaian.map((sc: any) => {
          const bobot = Number(sc.bobotPersen || 0);
          const targetSub = bobot > 0 ? Math.round((bobot / 100) * targetPoin) : 0;
          if (targetSub > 0) hasSubWithBobot = true;
          const scNama = sc.nama?.toLowerCase().trim();
          const poinSubAktual = subCapaianMapById[sc.id] ?? (subCapaianMapByName[scNama] || 0);
          const poinSubProgres = targetSub > 0 ? Math.min(poinSubAktual, targetSub) : poinSubAktual;
          sumSubProgres += poinSubProgres;
          return {
            id: sc.id,
            nama: sc.nama,
            bobotPersen: bobot,
            targetPoin: targetSub,
            poinTerkumpul: poinSubAktual,
            poinProgres: poinSubProgres,
            poinLebih: targetSub > 0 ? Math.max(0, poinSubAktual - targetSub) : 0,
            isTuntas: targetSub > 0 && poinSubAktual >= targetSub,
          };
        })
      : [];

    // Poin yang masuk ke progres:
    // Jika ada sub capaian berbobot dan terisi, gunakan sumSubProgres
    // Jika tidak, gunakan poinAktual (dibatasi targetPoin)
    const poinProgres = (hasSubWithBobot && sumSubProgres > 0)
      ? Math.min(sumSubProgres, targetPoin)
      : Math.min(poinAktual, targetPoin);

    const persentase = targetPoin > 0
      ? Math.min(100, Math.round((poinProgres / targetPoin) * 100))
      : 0;

    const poinLebih = Math.max(0, poinAktual - targetPoin);

    return {
      id: c.id,
      nama: c.nama,
      urutan: c.urutan,
      targetPoin,
      poinTerkumpul: poinAktual,       // Poin riil aktual di capaian ini
      poinProgres,                     // Poin yang masuk ke progres (maksimal targetPoin)
      poinLebih,                        // Kelebihan poin di capaian ini (tidak masuk progres)
      persentase,                      // Persentase progres (0 - 100%)
      status: poinProgres >= targetPoin ? 'tuntas' : 'berjalan',
      subCapaian: subCapaianProgres,
    };
  });

  // Total poin riil (seluruh perolehan poin sah mahasiswa)
  const totalPoin = perolehanPoin.reduce((sum, p) => sum + p.totalPoin, 0);

  // Total target kurikulum
  const totalTarget = kurikulum.capaian.reduce((sum: number, c: any) => sum + c.jumlahPoin, 0);

  // Total poin yang masuk ke progres (akumulasi poinProgres yang di-cap)
  const totalPoinProgres = progresTahunan.reduce((sum: number, item: any) => sum + item.poinProgres, 0);

  // Persentase total progres kurikulum (maksimal 100%)
  const persentaseTotal = totalTarget > 0
    ? Math.min(100, Math.round((totalPoinProgres / totalTarget) * 100))
    : 0;

  // Radar chart: persentase per capaian (0-100%)
  const radarData = kurikulum.capaian.map((c: any) => {
    const prog = progresTahunan.find((p: any) => p.id === c.id);
    return {
      label: c.nama,
      value: prog ? prog.persentase : 0,
    };
  });

  // Status kelulusan: HANYA jika seluruh capaian target kurikulum terpenuhi (totalPoinProgres >= totalTarget)
  const isLulus = totalTarget > 0 && totalPoinProgres >= totalTarget && progresTahunan.every((c: any) => c.poinProgres >= c.targetPoin);
  const statusKelulusan = isLulus ? 'Memenuhi Syarat Kelulusan' : 'Belum Memenuhi Syarat Kelulusan';

  return {
    kurikulumNama: kurikulum.nama,
    totalPoin,            // Total riil mahasiswa (untuk riwayat)
    totalPoinProgres,     // Poin masuk progres target kelulusan (capped)
    totalTarget,          // Target kurikulum untuk kelulusan
    persentaseTotal,      // Persentase progres (0 - 100%)
    isLulus,
    statusKelulusan,
    progresTahunan,
    radarData,
  };
}

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: BigInt(userId) },
      include: {
        user: { select: { nama: true } },
        prodi: { select: { nama: true } }
      }
    });

    if (!mahasiswa) {
      return res.status(200).json({
        success: true,
        data: {
          nama: req.user?.nama || 'Mahasiswa',
          prodi: '-',
          nim: '-',
          angkatan: new Date().getFullYear(),
          kurikulumNama: 'Belum ada kurikulum',
          totalPoin: 0,
          totalPoinProgres: 0,
          totalTarget: 0,
          persentaseTotal: 0,
          isLulus: false,
          statusKelulusan: 'Belum Memenuhi Syarat Kelulusan',
          tahap: 'Tahap I: Dasar',
          progresTahunan: [],
          progressTahun: [],
          radarData: [
            { label: 'Fondasi', value: 0 },
            { label: 'Penguatan', value: 0 },
            { label: 'Pemantapan', value: 0 },
            { label: 'Aktualisasi', value: 0 },
          ],
          riwayatIzinPA: [],
          riwayatEksternal: [],
        },
      });
    }

    const kurikulumAktif = await resolveKurikulumMahasiswa(mahasiswa);
    if (!kurikulumAktif) {
      return res.status(200).json({
        success: true,
        data: {
          nama: mahasiswa.user?.nama || req.user?.nama || 'Mahasiswa',
          prodi: mahasiswa.prodi?.nama || '-',
          nim: mahasiswa.nim,
          angkatan: mahasiswa.angkatan || new Date().getFullYear(),
          kurikulumNama: 'Belum ada kurikulum',
          totalPoin: 0,
          totalPoinProgres: 0,
          totalTarget: 0,
          persentaseTotal: 0,
          isLulus: false,
          statusKelulusan: 'Belum Memenuhi Syarat Kelulusan',
          tahap: 'Tahap I: Dasar',
          progresTahunan: [],
          progressTahun: [],
          radarData: [
            { label: 'Fondasi', value: 0 },
            { label: 'Penguatan', value: 0 },
            { label: 'Pemantapan', value: 0 },
            { label: 'Aktualisasi', value: 0 },
          ],
          riwayatIzinPA: [],
          riwayatEksternal: [],
        },
      });
    }

    // Ambil perolehan poin mahasiswa ini
    const perolehanPoin = await prisma.perolehanPoin.findMany({
      where: { mahasiswaId: BigInt(userId), status: 'sah' },
      include: {
        detail: {
          include: { subCapaian: { include: { capaian: true } } }
        }
      }
    });

    const poinKurikulum = perolehanUntukKurikulum(perolehanPoin, kurikulumAktif.id);
    const progresResult = hitungProgresKurikulumMahasiswa(kurikulumAktif, poinKurikulum);

    // Riwayat Kegiatan Persetujuan Dosen PA (5 terbaru)
    const riwayatIzinPA = await prisma.izinPA.findMany({
      where: {
        partisipasi: { mahasiswaId: BigInt(userId) }
      },
      include: {
        partisipasi: {
          include: {
            kegiatan: {
              include: {
                kategori: { select: { nama: true } }
              }
            },
            peranVerif: { select: { nama: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const tabelIzinPA = riwayatIzinPA.map((izin, i) => ({
      no: i + 1,
      namaKegiatan: izin.partisipasi.kegiatan.nama,
      jenisKegiatan: izin.partisipasi.kegiatan.kategori?.nama,
      peran: izin.partisipasi.peranVerif?.nama || '-',
      penyelenggara: izin.partisipasi.kegiatan.penyelenggaraExt || '-',
      tanggal: izin.partisipasi.kegiatan.tanggalMulai,
      status: izin.status,
      alasan: izin.alasan
    }));

    // Riwayat Kegiatan Pengajuan Eksternal (5 terbaru)
    const riwayatEksternal = await prisma.kegiatan.findMany({
      where: {
        dibuatOleh: BigInt(userId),
        asal: 'eksternal'
      },
      include: {
        kategori: { select: { nama: true } },
        skala: { select: { nama: true } },
        kegiatanApproval: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const tabelEksternal = riwayatEksternal.map((k, i) => {
      let statusStr = 'Pending';
      if (k.status === 'disetujui' || k.status === 'terpublikasi') statusStr = 'Disetujui';
      else if (k.status === 'ditolak') statusStr = 'Ditolak';

      return {
        no: i + 1,
        namaKegiatan: k.nama,
        jenisKegiatan: k.kategori?.nama,
        peran: '-',
        penyelenggara: k.penyelenggaraExt,
        tanggal: k.tanggalMulai,
        skala: k.skala?.nama,
        status: statusStr,
        alasan: k.kegiatanApproval[0]?.alasan || null
      };
    });

    // Hitung persentase dan tahap
    const persentaseTotal = progresResult.persentaseTotal;
    let tahap = 'Tahap I: Dasar';
    if (persentaseTotal >= 75) tahap = 'Tahap IV: Akhir';
    else if (persentaseTotal >= 50) tahap = 'Tahap III: Mahir';
    else if (persentaseTotal >= 25) tahap = 'Tahap II: Menengah';

    res.status(200).json({
      success: true,
      data: {
        nama: mahasiswa.user.nama,
        prodi: mahasiswa.prodi.nama,
        nim: mahasiswa.nim,
        angkatan: mahasiswa.angkatan,
        kurikulumNama: progresResult.kurikulumNama,
        totalPoin: progresResult.totalPoin,                   // Total riil mahasiswa (untuk riwayat)
        totalPoinProgres: progresResult.totalPoinProgres,     // Poin masuk progres (capped)
        totalTarget: progresResult.totalTarget,
        persentaseTotal,
        isLulus: progresResult.isLulus,
        statusKelulusan: progresResult.statusKelulusan,
        tahap,
        progresTahunan: progresResult.progresTahunan,
        progressTahun: progresResult.progresTahunan,
        radarData: progresResult.radarData,
        riwayatIzinPA: tabelIzinPA,
        riwayatEksternal: tabelEksternal
      }
    });

  } catch (error: any) {
    next(error);
  }
};

// ==================== RIWAYAT POIN ====================

export const getRiwayatPoin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: BigInt(userId) },
      select: { angkatan: true, kurikulumId: true }
    });

    if (!mahasiswa) {
      return res.status(404).json({ success: false, message: 'Profil mahasiswa tidak ditemukan' });
    }
    const kurikulumAktif = await resolveKurikulumMahasiswa(mahasiswa);
    if (!kurikulumAktif) {
      return res.status(400).json({ success: false, message: 'Kurikulum mahasiswa tidak ditemukan' });
    }

    // Ambil semua perolehan poin mahasiswa
    const perolehanPoin = await prisma.perolehanPoin.findMany({
      where: { mahasiswaId: BigInt(userId), status: 'sah' },
      include: {
        detail: {
          include: { subCapaian: { include: { capaian: true } } }
        }
      }
    });

    const poinKurikulum = perolehanUntukKurikulum(perolehanPoin, kurikulumAktif.id);
    const progresResult = hitungProgresKurikulumMahasiswa(kurikulumAktif, poinKurikulum);

    // Filter query params
    const { kategoriId, peranId, status, penyelenggara, tahun, search } = req.query;

    // Ambil seluruh klaim poin mahasiswa ini (tabel riwayat) — exclude draft
    const whereKlaim: any = {
      status: { not: 'draft' },
      partisipasi: {
        mahasiswaId: BigInt(userId)
      }
    };

    if (status && status !== 'semua') {
      whereKlaim.status = status as string;
    }

    if (kategoriId) {
      whereKlaim.partisipasi.kegiatan = {
        ...whereKlaim.partisipasi.kegiatan,
        kategoriId: parseInt(kategoriId as string)
      };
    }

    if (penyelenggara) {
      whereKlaim.partisipasi.kegiatan = {
        ...whereKlaim.partisipasi.kegiatan,
        penyelenggaraExt: { contains: penyelenggara as string }
      };
    }

    if (tahun) {
      const yearStart = new Date(`${tahun}-01-01`);
      const yearEnd = new Date(`${parseInt(tahun as string) + 1}-01-01`);
      whereKlaim.partisipasi.kegiatan = {
        ...whereKlaim.partisipasi.kegiatan,
        tanggalMulai: { gte: yearStart, lt: yearEnd }
      };
    }

    if (peranId) {
      whereKlaim.peranUsulanId = parseInt(peranId as string);
    }

    if (search) {
      whereKlaim.partisipasi.kegiatan = {
        ...whereKlaim.partisipasi.kegiatan,
        nama: { contains: search as string }
      };
    }

    const klaimData = await prisma.klaimPoin.findMany({
      where: whereKlaim,
      include: {
        partisipasi: {
          include: {
            kegiatan: {
              include: {
                kategori: { select: { nama: true } },
                skala: { select: { nama: true } },
                organisasi: { select: { nama: true } }
              }
            }
          }
        },
        peranUsulan: { select: { nama: true } },
        bukti: { select: { url: true, tipe: true }, take: 1 },
        perolehanPoin: { select: { totalPoin: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    const tabelRiwayat = klaimData
      .filter((k) => k.partisipasi && k.partisipasi.kegiatan)
      .map((k, i) => {
        let statusStr = 'Pending';
        if (k.status === 'disetujui') statusStr = 'Disetujui';
        else if (k.status === 'ditolak') statusStr = 'Ditolak';

        return {
          no: i + 1,
          namaKegiatan: k.partisipasi.kegiatan.nama,
          jenisKegiatan: k.partisipasi.kegiatan.kategori?.nama,
          peran: k.peranUsulan?.nama || '-',
          skala: k.partisipasi.kegiatan.skala?.nama || '-',
          penyelenggara: k.partisipasi.kegiatan.organisasi?.nama || k.partisipasi.kegiatan.penyelenggaraExt || 'Ditmawa/Universitas',
          tanggal: k.partisipasi.kegiatan.tanggalMulai,
          tanggalKlaim: k.createdAt,
          bukti: k.bukti[0]?.url || null,
          poin: k.perolehanPoin?.totalPoin || '-',
          status: statusStr
        };
      });

    // Hitung persentase dan tahap
    const persentaseTotal = progresResult.persentaseTotal;
    let tahap = 'Tahap I: Dasar';
    if (persentaseTotal >= 75) tahap = 'Tahap IV: Akhir';
    else if (persentaseTotal >= 50) tahap = 'Tahap III: Mahir';
    else if (persentaseTotal >= 25) tahap = 'Tahap II: Menengah';

    res.status(200).json({
      success: true,
      data: {
        kurikulumNama: progresResult.kurikulumNama,
        totalPoin: progresResult.totalPoin,                   // Total riil mahasiswa (untuk riwayat)
        totalPoinProgres: progresResult.totalPoinProgres,     // Poin masuk progres (capped)
        totalTarget: progresResult.totalTarget,
        persentaseTotal,
        isLulus: progresResult.isLulus,
        statusKelulusan: progresResult.statusKelulusan,
        tahap,
        progresTahunan: progresResult.progresTahunan,
        progressTahun: progresResult.progresTahunan,
        riwayat: tabelRiwayat
      }
    });

  } catch (error: any) {
    next(error);
  }
};

// ==================== RIWAYAT KEGIATAN INTERNAL ====================

export const getRiwayatKegiatanInternal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let userKurikulum: { id: number; nama: string } | null = null;
    try {
      const kur = await resolveKurikulumMahasiswa(BigInt(userId), prisma, {
        includeStructure: false,
        requireActive: false,
      });
      if (kur) {
        userKurikulum = { id: kur.id, nama: kur.nama };
      }
    } catch (err) {
      console.warn('Gagal me-resolve kurikulum mahasiswa:', err);
    }

    const { search, kategoriId, kehadiran, tahun } = req.query;

    const whereKegiatan: any = {
      asal: { in: ['kurikuler_ukm', 'kurikuler_ukmf', 'universitas'] }
    };

    if (search) {
      whereKegiatan.nama = { contains: search as string };
    }
    if (kategoriId) {
      whereKegiatan.kategoriId = parseInt(kategoriId as string);
    }
    if (tahun) {
      const yearStart = new Date(`${tahun}-01-01`);
      const yearEnd = new Date(`${parseInt(tahun as string) + 1}-01-01`);
      whereKegiatan.tanggalMulai = { gte: yearStart, lt: yearEnd };
    }

    const where: any = {
      mahasiswaId: BigInt(userId),
      kegiatan: whereKegiatan
    };

    if (kehadiran === 'hadir') where.kehadiran = true;
    else if (kehadiran === 'tidak_hadir') where.kehadiran = false;
    else if (kehadiran === 'belum') where.kehadiran = null;

    const partisipasi = await prisma.partisipasi.findMany({
      where,
      include: {
        kegiatan: {
          include: {
            kategori: { select: { nama: true } },
            skala: { select: { nama: true } },
            organisasi: { select: { nama: true, tipe: true } }
          }
        },
        mahasiswa: {
          select: {
            kurikulum: { select: { id: true, nama: true } }
          }
        },
        peranVerif: { select: { id: true, nama: true } },
        klaimPoin: {
          include: { perolehanPoin: { select: { totalPoin: true, status: true } } }
        },
        izinPA: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, alasan: true, decidedAt: true }
        }
      },
      orderBy: { kegiatan: { tanggalMulai: 'desc' } }
    });

    // Fallback: perolehan sah via (mahasiswaId, kegiatanId) bila relasi klaim belum lengkap
    const kegiatanIds = [...new Set(partisipasi.map((p) => p.kegiatanId))];
    const perolehanFallback = kegiatanIds.length
      ? await prisma.perolehanPoin.findMany({
          where: {
            mahasiswaId: BigInt(userId),
            kegiatanId: { in: kegiatanIds },
            status: 'sah',
          },
          select: { kegiatanId: true, totalPoin: true },
        })
      : [];
    const poinByKegiatan = new Map(
      perolehanFallback.map((p) => [p.kegiatanId, p.totalPoin]),
    );

    // Estimasi poin dari matriks untuk peserta yang sudah punya peran (belum tentu sudah cair)
    const estimasiEntries = await Promise.all(
      partisipasi
        .filter((p) => p.peranVerifId && p.kegiatan.kurikulumId != null)
        .map(async (p) => {
          const matriks = await prisma.matriksPoin.findFirst({
            where: {
              kurikulumId: p.kegiatan.kurikulumId as number,
              kategoriId: p.kegiatan.kategoriId,
              skalaId: p.kegiatan.skalaId,
              peranId: p.peranVerifId!,
            },
            select: { poin: true },
          });
          return matriks ? ([p.id.toString(), matriks.poin] as const) : null;
        }),
    );
    const estimasiByPartisipasi = new Map(
      estimasiEntries.filter(Boolean) as [string, number][],
    );

    const riwayat = partisipasi.map((p, i) => {
      let statusKehadiran = 'Belum Tercatat';
      if (p.kehadiran === true) statusKehadiran = 'Hadir';
      else if (p.kehadiran === false) statusKehadiran = 'Tidak Hadir';

      const izinTerbaru = p.izinPA?.[0] || null;
      let statusPa: 'belum_disetujui' | 'diteruskan' | 'sudah_disetujui' = 'belum_disetujui';
      let statusPaLabel = 'Belum Disetujui';
      if (izinTerbaru?.status === 'disetujui') {
        statusPa = 'sudah_disetujui';
        statusPaLabel = 'Sudah Disetujui';
      } else if (izinTerbaru?.status === 'diajukan') {
        statusPa = 'diteruskan';
        statusPaLabel = 'Diteruskan';
      }

      const poinDariKlaim =
        p.klaimPoin?.perolehanPoin?.status === 'sah'
          ? p.klaimPoin.perolehanPoin.totalPoin
          : null;
      const poinDariKegiatan = poinByKegiatan.get(p.kegiatanId);
      const poinEstimasi = estimasiByPartisipasi.get(p.id.toString());
      const poin = poinDariKlaim ?? poinDariKegiatan ?? poinEstimasi ?? '-';

      const izin = p.izinPA?.[0];
      let statusIzin = 'Belum Diajukan';
      if (izin) {
        if (izin.status === 'diajukan') statusIzin = 'Menunggu Dosen PA';
        else if (izin.status === 'disetujui') statusIzin = 'Disetujui';
        else if (izin.status === 'ditolak') statusIzin = 'Ditolak';
        else if (izin.status === 'revisi') statusIzin = 'Perlu Revisi';
      }

      const tanpaPersetujuanPa = p.kegiatan.tanpaPersetujuanPa;
      const isIzinDisetujui = tanpaPersetujuanPa || izin?.status === 'disetujui';
      const isHadir = p.kehadiran === true;
      const isPeranAda = Boolean(p.peranVerifId);
      // Poin sah lewat klaim, atau fallback perolehan langsung di kegiatan
      const isPoinTerklaim = poinDariKlaim != null || poinDariKegiatan != null;

      // Status poin = tahap yang masih kurang untuk pencairan otomatis
      let statusPoin = 'Belum Cair';
      if (isPoinTerklaim) {
        statusPoin = 'Terklaim';
      } else if (!isIzinDisetujui) {
        statusPoin = 'Menunggu Izin PA';
      } else if (!isHadir) {
        statusPoin = 'Menunggu Kehadiran';
      } else if (!isPeranAda) {
        statusPoin = 'Menunggu Peran';
      }

      const canMintaIzinPA = !tanpaPersetujuanPa && (!izin || izin.status === 'revisi' || izin.status === 'ditolak');

      return {
        no: i + 1,
        id: p.id.toString(),
        partisipasiId: p.id.toString(),
        kegiatanId: p.kegiatanId,
        namaKegiatan: p.kegiatan.nama,
        jenisKegiatan: p.kegiatan.kategori?.nama || '-',
        skala: p.kegiatan.skala?.nama || '-',
        asal: p.kegiatan.asal,
        penyelenggara: p.kegiatan.organisasi?.nama || 'Ditmawa/Universitas',
        tanggalMulai: p.kegiatan.tanggalMulai,
        tanggalSelesai: p.kegiatan.tanggalSelesai,
        tanggalDiajukan: p.createdAt,
        kehadiran: statusKehadiran,
        isHadir: p.kehadiran,
        peran: p.peranVerif?.nama || '-',
        peranId: p.peranVerifId ?? p.peranVerif?.id ?? null,
        poin,
        statusPa,
        statusPaLabel,
        status: statusPa,
        izinPaId: izinTerbaru?.id?.toString() || null,
        bisaMintaPa: canMintaIzinPA,
        statusKegiatan: p.kegiatan.status,
        izinPA: izin ? {
          id: izin.id.toString(),
          status: izin.status,
          statusLabel: statusIzin,
          alasan: izin.alasan,
          decidedAt: izin.decidedAt
        } : null,
        statusIzinPA: tanpaPersetujuanPa ? 'Tidak Diperlukan' : statusIzin,
        tanpaPersetujuanPa,
        canMintaIzinPA,
        statusPoin,
        kurikulumId: userKurikulum?.id ?? p.mahasiswa?.kurikulum?.id ?? null,
        kurikulumNama: userKurikulum?.nama ?? p.mahasiswa?.kurikulum?.nama ?? null,
      };
    });

    res.status(200).json({ success: true, data: { riwayat } });

  } catch (error: any) {
    next(error);
  }
};

// ==================== KURIKULUM MAHASISWA ====================

/**
 * GET /api/mahasiswa/kurikulum
 * Mengembalikan kurikulum yang dimiliki mahasiswa yang sedang login.
 */
export const getKurikulumMahasiswa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let kurikulum: { id: number; nama: string } | null = null;
    try {
      const resolved = await resolveKurikulumMahasiswa(BigInt(userId), prisma, {
        includeStructure: false,
        requireActive: false,
      });
      if (resolved) {
        kurikulum = { id: resolved.id, nama: resolved.nama };
      }
    } catch (err) {
      console.warn('Gagal me-resolve kurikulum mahasiswa:', err);
    }

    res.json({ success: true, data: kurikulum });
  } catch (error: any) {
    next(error);
  }
};

