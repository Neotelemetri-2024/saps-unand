import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { NotifikasiService } from '../../services/notifikasi.service';

const ASAL_INTERNAL = ['kurikuler_ukm', 'kurikuler_ukmf', 'universitas'] as const;

// ==================== 1. LIST KEGIATAN INTERNAL UNTUK MAHASISWA ====================

/**
 * GET /api/mahasiswa/kegiatan-internal/katalog
 * Mengambil daftar kegiatan internal yang statusnya terpublikasi/disetujui/berlangsung.
 * Menampilkan informasi sisa kuota & status pendaftaran mahasiswa saat ini.
 */
export const getKatalogKegiatanInternal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { page = '1', limit = '10', search, kategori, skala } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      asal: { in: [...ASAL_INTERNAL] },
      status: { in: ['terpublikasi', 'disetujui', 'berlangsung'] },
      deletedAt: null,
    };

    if (search) {
      where.nama = { contains: search as string };
    }
    if (kategori) {
      where.kategoriId = parseInt(kategori as string);
    }
    if (skala) {
      where.skalaId = parseInt(skala as string);
    }

    const [kegiatan, total] = await Promise.all([
      prisma.kegiatan.findMany({
        where,
        include: {
          kategori: { select: { nama: true } },
          skala: { select: { nama: true } },
          organisasi: { select: { nama: true } },
          pembuat: { select: { nama: true } },
          partisipasi: {
            where: { mahasiswaId: BigInt(userId) },
            select: {
              id: true,
              status: true,
              izinPA: {
                select: { status: true },
                orderBy: { createdAt: 'desc' as const },
                take: 1,
              },
            },
          },
          _count: {
            select: {
              partisipasi: {
                where: {
                  status: { in: ['terdaftar', 'menunggu_izin_pa', 'disetujui_pa', 'hadir', 'selesai'] }
                }
              }
            }
          }
        },
        orderBy: { tanggalMulai: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.kegiatan.count({ where }),
    ]);

    const data = kegiatan.map((kg: any) => {
      const partisipasi = kg.partisipasi?.[0] || null;
      const jumlahPendaftar = kg._count?.partisipasi || 0;
      const sisaKuota = kg.kuota ? Math.max(0, kg.kuota - jumlahPendaftar) : null;

      let statusPendaftaran: string = 'belum_daftar';
      if (partisipasi) {
        statusPendaftaran = partisipasi.status;
      }

      return {
        id: kg.id,
        nama: kg.nama,
        kategori: kg.kategori?.nama || '-',
        skala: kg.skala?.nama || '-',
        penyelenggara: kg.organisasi?.nama || kg.pembuat?.nama || '-',
        tanggalMulai: kg.tanggalMulai,
        tanggalSelesai: kg.tanggalSelesai,
        lokasi: kg.lokasi,
        deskripsi: kg.deskripsi,
        kuota: kg.kuota,
        sisaKuota,
        jumlahPendaftar,
        tanpaPersetujuanPa: kg.tanpaPersetujuanPa,
        statusPendaftaran,
        sudahDaftar: !!partisipasi,
        partisipasiId: partisipasi?.id?.toString() || null,
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== 2. DETAIL KEGIATAN INTERNAL ====================

/**
 * GET /api/mahasiswa/kegiatan-internal/katalog/:id
 * Mengambil detail kegiatan internal tertentu.
 */
export const getDetailKegiatanInternal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const kegiatanId = parseInt(req.params.id);
    if (isNaN(kegiatanId)) {
      return res.status(400).json({ success: false, message: 'ID kegiatan tidak valid' });
    }

    const kg = await prisma.kegiatan.findFirst({
      where: {
        id: kegiatanId,
        asal: { in: [...ASAL_INTERNAL] },
        deletedAt: null,
      },
      include: {
        kategori: { select: { nama: true } },
        skala: { select: { nama: true } },
        organisasi: { select: { nama: true } },
        pembuat: { select: { nama: true } },
        partisipasi: {
          where: { mahasiswaId: BigInt(userId) },
          include: {
            izinPA: {
              orderBy: { createdAt: 'desc' as const },
              take: 1,
            },
            peranVerif: { select: { nama: true } },
          },
        },
        _count: {
          select: {
            partisipasi: {
              where: {
                status: { in: ['terdaftar', 'menunggu_izin_pa', 'disetujui_pa', 'hadir', 'selesai'] }
              }
            }
          }
        }
      },
    });

    if (!kg) {
      return res.status(404).json({ success: false, message: 'Kegiatan tidak ditemukan' });
    }

    const partisipasi = (kg as any).partisipasi?.[0] || null;
    const jumlahPendaftar = (kg as any)._count?.partisipasi || 0;
    const sisaKuota = kg.kuota ? Math.max(0, kg.kuota - jumlahPendaftar) : null;

    res.json({
      success: true,
      data: {
        id: kg.id,
        nama: kg.nama,
        kategori: kg.kategori?.nama || '-',
        skala: kg.skala?.nama || '-',
        penyelenggara: kg.organisasi?.nama || kg.pembuat?.nama || '-',
        tanggalMulai: kg.tanggalMulai,
        tanggalSelesai: kg.tanggalSelesai,
        lokasi: kg.lokasi,
        deskripsi: kg.deskripsi,
        kuota: kg.kuota,
        sisaKuota,
        jumlahPendaftar,
        tanpaPersetujuanPa: kg.tanpaPersetujuanPa,
        statusPendaftaran: partisipasi?.status || 'belum_daftar',
        sudahDaftar: !!partisipasi,
        partisipasiId: partisipasi?.id?.toString() || null,
        izinPA: partisipasi?.izinPA?.[0] ? {
          status: partisipasi.izinPA[0].status,
          alasan: partisipasi.izinPA[0].alasan,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== 3. DAFTAR (PENDAFTARAN MANDIRI) ====================

/**
 * POST /api/mahasiswa/kegiatan-internal/katalog/:id/daftar
 * Mahasiswa mendaftarkan diri ke kegiatan internal.
 *
 * Alur:
 * 1. Cek kegiatan ada, internal, dan terpublikasi.
 * 2. Cek mahasiswa belum mendaftar.
 * 3. Cek kuota masih tersedia (jika ada kuota).
 * 4. Jika tanpaPersetujuanPa → langsung status "terdaftar".
 * 5. Jika perlu izin PA → status "menunggu_izin_pa" + buat IzinPA "diajukan".
 */
export const daftarKegiatanInternal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const kegiatanId = parseInt(req.params.id);
    if (isNaN(kegiatanId)) {
      return res.status(400).json({ success: false, message: 'ID kegiatan tidak valid' });
    }

    // 1. Cek kegiatan
    const kegiatan = await prisma.kegiatan.findFirst({
      where: {
        id: kegiatanId,
        asal: { in: [...ASAL_INTERNAL] },
        status: { in: ['terpublikasi', 'disetujui', 'berlangsung'] },
        deletedAt: null,
      },
    });

    if (!kegiatan) {
      return res.status(404).json({ success: false, message: 'Kegiatan internal tidak ditemukan atau belum dipublikasi.' });
    }

    // 2. Cek duplikasi
    const existing = await prisma.partisipasi.findUnique({
      where: {
        kegiatanId_mahasiswaId: {
          kegiatanId,
          mahasiswaId: BigInt(userId),
        },
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Anda sudah terdaftar pada kegiatan ini.' });
    }

    // 3. Cek kuota
    if (kegiatan.kuota) {
      const jumlahPendaftar = await prisma.partisipasi.count({
        where: {
          kegiatanId,
          status: { in: ['terdaftar', 'menunggu_izin_pa', 'disetujui_pa', 'hadir', 'selesai'] },
        },
      });

      if (jumlahPendaftar >= kegiatan.kuota) {
        return res.status(400).json({ success: false, message: 'Kuota kegiatan sudah penuh.' });
      }
    }

    // 4. Tentukan apakah perlu izin PA
    const butuhIzinPA = !kegiatan.tanpaPersetujuanPa;

    if (butuhIzinPA) {
      // Cek apakah mahasiswa punya Dosen PA
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { userId: BigInt(userId) },
        include: { user: { select: { nama: true } } },
      });

      if (!mahasiswa || !mahasiswa.dosenPaId) {
        return res.status(400).json({ success: false, message: 'Anda belum memiliki Dosen PA. Silakan hubungi admin.' });
      }

      // 5a. Buat partisipasi + izin PA dalam satu transaksi
      const result = await prisma.$transaction(async (tx: any) => {
        const partisipasi = await tx.partisipasi.create({
          data: {
            kegiatanId,
            mahasiswaId: BigInt(userId),
            status: 'menunggu_izin_pa',
          },
        });

        const izin = await tx.izinPA.create({
          data: {
            partisipasiId: partisipasi.id,
            dosenPaId: mahasiswa.dosenPaId,
            status: 'diajukan',
          },
        });

        return { partisipasi, izin, mahasiswa };
      });

      // Kirim notifikasi ke Dosen PA
      try {
        await NotifikasiService.kirim({
          userId: result.mahasiswa.dosenPaId!,
          judul: 'Permohonan Izin Kegiatan Internal',
          isi: `${result.mahasiswa.user.nama} mendaftar kegiatan internal "${kegiatan.nama}" dan membutuhkan persetujuan Anda.`,
          refType: 'izin_pa',
          refId: result.izin.id,
        });
      } catch (err) {
        console.error('[daftarKegiatanInternal] Gagal kirim notifikasi:', err);
      }

      return res.status(201).json({
        success: true,
        message: 'Pendaftaran berhasil! Menunggu persetujuan Dosen PA.',
        data: {
          partisipasiId: result.partisipasi.id.toString(),
          status: 'menunggu_izin_pa',
          butuhIzinPA: true,
        },
      });
    } else {
      // 5b. Tanpa izin PA → langsung terdaftar
      const partisipasi = await prisma.partisipasi.create({
        data: {
          kegiatanId,
          mahasiswaId: BigInt(userId),
          status: 'terdaftar',
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Pendaftaran berhasil! Anda langsung terdaftar.',
        data: {
          partisipasiId: partisipasi.id.toString(),
          status: 'terdaftar',
          butuhIzinPA: false,
        },
      });
    }
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Anda sudah terdaftar pada kegiatan ini.' });
    }
    next(error);
  }
};

// ==================== 4. BATALKAN PENDAFTARAN ====================

/**
 * DELETE /api/mahasiswa/kegiatan-internal/katalog/:id/daftar
 * Mahasiswa membatalkan pendaftarannya sebelum acara berlangsung.
 * Hanya bisa membatalkan jika status masih menunggu_izin_pa atau terdaftar.
 */
export const batalkanPendaftaran = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const kegiatanId = parseInt(req.params.id);
    if (isNaN(kegiatanId)) {
      return res.status(400).json({ success: false, message: 'ID kegiatan tidak valid' });
    }

    const partisipasi = await prisma.partisipasi.findUnique({
      where: {
        kegiatanId_mahasiswaId: {
          kegiatanId,
          mahasiswaId: BigInt(userId),
        },
      },
    });

    if (!partisipasi) {
      return res.status(404).json({ success: false, message: 'Pendaftaran tidak ditemukan.' });
    }

    if (!['menunggu_izin_pa', 'terdaftar', 'disetujui_pa'].includes(partisipasi.status)) {
      return res.status(400).json({ success: false, message: 'Pendaftaran tidak bisa dibatalkan pada tahap ini.' });
    }

    await prisma.$transaction(async (tx: any) => {
      // Batalkan izin PA yang masih pending
      await tx.izinPA.updateMany({
        where: {
          partisipasiId: partisipasi.id,
          status: 'diajukan',
        },
        data: { status: 'ditolak', alasan: 'Dibatalkan oleh mahasiswa' },
      });

      // Update status partisipasi
      await tx.partisipasi.update({
        where: { id: partisipasi.id },
        data: { status: 'dibatalkan' },
      });
    });

    res.json({
      success: true,
      message: 'Pendaftaran berhasil dibatalkan.',
    });
  } catch (error) {
    next(error);
  }
};
