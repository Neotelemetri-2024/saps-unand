import prisma from '../../lib/prisma';
import { hitungProgresKurikulumMahasiswa } from '../../controllers/mahasiswa/dashboard.controller';
import {
  getKurikulumByFilter,
  perolehanUntukKurikulum,
  resolveKurikulumMahasiswaMap,
  targetPoinKurikulum,
} from '../kurikulumResolver.service';

export interface FilterLaporan {
  role: string;
  userId: bigint;
  fakultasId?: number;
  prodiId?: number;
  angkatan?: number;
  tahunAkademik?: string;
  kurikulumId?: number;
  startDate?: Date;
  endDate?: Date;
  isPreview?: boolean;
}

export interface LaporanDataResult {
  scope: 'universitas' | 'ditmawa' | 'fakultas';
  scopeNama: string;
  role: string;
  filter: {
    fakultasId?: number;
    fakultasNama?: string;
    prodiId?: number;
    prodiNama?: string;
    angkatan?: number;
    tahunAkademik?: string;
    kurikulumId?: number;
  };
  kurikulum: {
    id: number;
    nama: string;
    targetPoin: number;
    capaianList: { id: number; nama: string; tahun: number; targetPoin: number }[];
  };
  kpi: {
    totalMahasiswa: number;
    rataRataPoin: number;
    rataRataPersentase: number;
    totalPoinSah: number;
    totalPrestasi: number;
    totalKegiatan: number;
    totalOrmawa: number;
    persentaseLulusTarget: number;
  };
  komparasi: {
    unit: 'fakultas' | 'prodi';
    items: {
      id: number;
      nama: string;
      totalMahasiswa: number;
      totalPoin: number;
      rataRataPoin: number;
      rataRataPersentase: number;
      ranking: number;
      kategoriPoin: Record<string, number>;
    }[];
  };
  capaianKurikulumStats: {
    nama: string;
    tahun: number;
    targetPoin: number;
    rataRataTerkumpul: number;
    persentaseCapaian: number;
    kurikulumNama?: string;
  }[];
  mahasiswaList: {
    nim: string;
    nama: string;
    fakultas: string;
    prodi: string;
    angkatan: number | null;
    poinTahun1: number;
    poinTahun2: number;
    poinTahun3: number;
    poinTahun4: number;
    totalPoin: number;
    targetPoin: number;
    persentase: number;
    statusTarget: 'Tercapai' | 'Belum Tercapai';
  }[];
  prestasiList: {
    nim: string;
    namaMahasiswa: string;
    fakultas: string;
    prodi: string;
    namaKegiatan: string;
    kategori: string;
    skala: string;
    peran: string;
    penyelenggara: string;
    tanggal: string;
    poin: number;
  }[];
  ormawaList: {
    nama: string;
    tipe: string;
    fakultas: string;
    totalKegiatan: number;
    totalPeserta: number;
    totalPoinDidistribusikan: number;
  }[];
}

/**
 * Service untuk mengumpulkan dan mengagregasi data laporan pimpinan
 * dengan isolasi hak akses scope Universitas vs Fakultas
 */
export async function getLaporanData(filter: FilterLaporan): Promise<LaporanDataResult> {
  const { role, userId } = filter;

  // 1. Tentukan Scope & Batasan Fakultas
  let effectiveFakultasId = filter.fakultasId;
  let scope: 'universitas' | 'ditmawa' | 'fakultas' = 'universitas';
  let scopeNama = 'Universitas Andalas (Seluruh Fakultas)';

  if (role === 'pimpinan_fakultas' || role === 'admin_fakultas') {
    scope = 'fakultas';
    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { fakultas: true },
    });
    if (!staff || !staff.fakultasId) {
      throw new Error('Akun Anda tidak terikat dengan fakultas manapun.');
    }
    effectiveFakultasId = staff.fakultasId;
    scopeNama = staff.fakultas?.nama || 'Fakultas Terkait';
  } else if (role === 'pimpinan_ditmawa' || role === 'admin_ditmawa') {
    scope = 'ditmawa';
    scopeNama = 'Direktorat Kemahasiswaan (Ditmawa) - Universitas Andalas';
    if (effectiveFakultasId) {
      const fak = await prisma.fakultas.findUnique({ where: { id: effectiveFakultasId } });
      if (fak) scopeNama += ` (Filter: ${fak.nama})`;
    }
  } else if (role === 'pimpinan_utama') {
    scope = 'universitas';
    scopeNama = 'Pimpinan Utama (Rektorat) - Universitas Andalas';
    if (effectiveFakultasId) {
      const fak = await prisma.fakultas.findUnique({ where: { id: effectiveFakultasId } });
      if (fak) scopeNama += ` (Filter: ${fak.nama})`;
    }
  } else if (effectiveFakultasId) {
    const fak = await prisma.fakultas.findUnique({ where: { id: effectiveFakultasId } });
    if (fak) scopeNama = `${fak.nama} - Universitas Andalas`;
  }

  // 2. Ambil kurikulum filter atau biarkan per-mahasiswa
  const kurikulumFilter = filter.kurikulumId
    ? await getKurikulumByFilter(filter.kurikulumId)
    : null;
  if (filter.kurikulumId && !kurikulumFilter) {
    throw new Error('Kurikulum filter tidak ditemukan');
  }

  // Jika filter kurikulumId tidak dipilih, ambil SEMUA kurikulum aktif
  const semuaKurikulumAktif: any[] = [];
  if (!kurikulumFilter) {
    const aktifList = await prisma.kurikulum.findMany({
      where: { status: 'aktif' },
      orderBy: [{ angkatanMulai: 'desc' }, { id: 'desc' }],
      include: {
        capaian: {
          orderBy: { urutan: 'asc' },
          include: { subCapaian: { orderBy: { id: 'asc' } } },
        },
      },
    });
    if (aktifList.length > 0) {
      semuaKurikulumAktif.push(...aktifList);
    } else {
      // Fallback: ambil kurikulum terakhir jika tidak ada yang aktif
      const fallback = await prisma.kurikulum.findFirst({
        orderBy: { id: 'desc' },
        include: {
          capaian: {
            orderBy: { urutan: 'asc' },
            include: { subCapaian: { orderBy: { id: 'asc' } } },
          },
        },
      });
      if (fallback) semuaKurikulumAktif.push(fallback);
    }
  }

  const kurikulumAcuan = kurikulumFilter || semuaKurikulumAktif[0] || null;

  const kurikulumMeta = kurikulumFilter || {
    id: kurikulumAcuan?.id || 0,
    nama: semuaKurikulumAktif.length > 1
      ? 'Campuran (semua kurikulum aktif)'
      : (kurikulumAcuan ? kurikulumAcuan.nama : 'Campuran (per mahasiswa)'),
    capaian: kurikulumAcuan?.capaian || [],
  };

  const targetPoinTotalDefault = targetPoinKurikulum(kurikulumAcuan) || 200;
  const rawCapaian = kurikulumAcuan?.capaian || [];
  const capaianList = rawCapaian.length > 0
    ? rawCapaian.map((c: any, i: number) => ({
        id: c.id,
        nama: c.nama || `Tahun ${c.urutan || (i + 1)}`,
        tahun: c.urutan || (i + 1),
        targetPoin: c.jumlahPoin,
      }))
    : [
        { id: 1, nama: 'Tahun 1', tahun: 1, targetPoin: Math.round(targetPoinTotalDefault / 4) },
        { id: 2, nama: 'Tahun 2', tahun: 2, targetPoin: Math.round(targetPoinTotalDefault / 4) },
        { id: 3, nama: 'Tahun 3', tahun: 3, targetPoin: Math.round(targetPoinTotalDefault / 4) },
        { id: 4, nama: 'Tahun 4', tahun: 4, targetPoin: Math.round(targetPoinTotalDefault / 4) },
      ];

  // Mapping subCapaian ID ke tahun capaian (untuk SEMUA kurikulum aktif)
  const subCapaianTahunMap = new Map<number, number>();
  const kurikulumSources = kurikulumFilter ? [kurikulumFilter] : semuaKurikulumAktif;
  kurikulumSources.forEach((k: any) => {
    k.capaian?.forEach((c: any, idx: number) => {
      const th = c.urutan || (idx + 1);
      c.subCapaian?.forEach((sc: any) => subCapaianTahunMap.set(sc.id, th));
    });
  });

  // Per-kurikulum stats tracking untuk grafik capaian multi-kurikulum
  const perKurikulumPoin = new Map<number, { sumPerTahun: number[]; count: number }>();
  kurikulumSources.forEach((k: any) => {
    perKurikulumPoin.set(k.id, { sumPerTahun: [0, 0, 0, 0, 0], count: 0 });
  });

  // 3. Query Mahasiswa sesuai Scope & Filter
  const mhsWhere: any = {};
  if (effectiveFakultasId) {
    mhsWhere.prodi = { fakultasId: effectiveFakultasId };
  }
  if (filter.prodiId) {
    mhsWhere.prodiId = filter.prodiId;
  }
  if (filter.angkatan) {
    mhsWhere.angkatan = filter.angkatan;
  }
  if (filter.kurikulumId) {
    mhsWhere.kurikulumId = filter.kurikulumId;
  }

  // A. Hitung total mahasiswa dengan query COUNT (ringan & instan ~2ms)
  const totalMahasiswa = await prisma.mahasiswa.count({ where: mhsWhere });

  // B. Kelompokkan jumlah mahasiswa per program studi (1 query groupBy ~5ms)
  const mhsPerProdiGroup = await prisma.mahasiswa.groupBy({
    by: ['prodiId'],
    where: mhsWhere,
    _count: { userId: true },
  });
  const mhsCountByProdiId = new Map<number, number>();
  mhsPerProdiGroup.forEach((g) => mhsCountByProdiId.set(g.prodiId, g._count.userId));

  // C. Distribusi mahasiswa per kurikulum (1 query groupBy ~3ms)
  const mhsPerKurikulumGroup = await prisma.mahasiswa.groupBy({
    by: ['kurikulumId'],
    where: mhsWhere,
    _count: { userId: true },
  });
  const mhsCountByKurikulumId = new Map<number, number>();
  mhsPerKurikulumGroup.forEach((g) => {
    if (g.kurikulumId != null) mhsCountByKurikulumId.set(g.kurikulumId, g._count.userId);
  });

  kurikulumSources.forEach((k: any) => {
    const assignedCount = mhsCountByKurikulumId.get(k.id) || 0;
    perKurikulumPoin.set(k.id, { sumPerTahun: [0, 0, 0, 0, 0], count: assignedCount });
  });

  // D. Query HANYA mahasiswa yang memiliki perolehan poin sah (sangat cepat ~10ms karena hanya mahasiswa aktif berkegiatan)
  const mahasiswaDenganPoin = await prisma.mahasiswa.findMany({
    where: {
      ...mhsWhere,
      perolehanPoin: { some: { status: 'sah' } },
    },
    include: {
      user: { select: { nama: true, email: true } },
      prodi: {
        include: {
          fakultas: { select: { id: true, nama: true } },
        },
      },
      perolehanPoin: {
        where: { status: 'sah' },
        include: {
          detail: {
            include: {
              subCapaian: { include: { capaian: true } },
            },
          },
          kegiatan: {
            include: {
              kategori: true,
              skala: true,
            },
          },
        },
      },
    },
    orderBy: [{ angkatan: 'desc' }, { nim: 'asc' }],
  });

  // 4. Proses Data Capaian Mahasiswa dengan Poin & Pemetaan Kurikulum
  const kurikulumMap = await resolveKurikulumMahasiswaMap(
    mahasiswaDenganPoin.map((m) => ({
      userId: m.userId,
      angkatan: m.angkatan,
      kurikulumId: m.kurikulumId,
    })),
  );

  let totalPoinSahGlobal = 0;
  let totalMahasiswaLulusTarget = 0;
  const sumPoinPerTahun = [0, 0, 0, 0, 0]; // index 1..4

  const mhsDenganPoinList = mahasiswaDenganPoin.map((m) => {
    const kurikulumMhs = kurikulumFilter || kurikulumMap.get(String(m.userId)) || kurikulumAcuan || null;
    const targetPoinTotal = targetPoinKurikulum(kurikulumMhs) || targetPoinTotalDefault;
    const localSubMap = new Map<number, number>();
    if (kurikulumMhs?.capaian) {
      kurikulumMhs.capaian.forEach((c: any, idx: number) => {
        const th = c.urutan || (idx + 1);
        c.subCapaian?.forEach((sc: any) => localSubMap.set(sc.id, th));
      });
    }

    const perolehanFiltered = kurikulumMhs
      ? perolehanUntukKurikulum(m.perolehanPoin, kurikulumMhs.id)
      : m.perolehanPoin;

    const progres = kurikulumMhs?.capaian?.length
      ? hitungProgresKurikulumMahasiswa(kurikulumMhs, perolehanFiltered)
      : null;

    const poinPerTahun = [0, 0, 0, 0, 0];
    perolehanFiltered.forEach((pp: any) => {
      if (pp.detail && pp.detail.length > 0) {
        pp.detail.forEach((d: any) => {
          const th = localSubMap.get(d.subCapaianId) || subCapaianTahunMap.get(d.subCapaianId) || 1;
          if (th >= 1 && th <= 4) {
            poinPerTahun[th] += d.poin;
          } else {
            poinPerTahun[1] += d.poin;
          }
        });
      } else {
        poinPerTahun[1] += pp.totalPoin;
      }
    });

    for (let th = 1; th <= 4; th++) {
      sumPoinPerTahun[th] += poinPerTahun[th];
    }

    const kurikulumMhsId = kurikulumMhs?.id;
    if (kurikulumMhsId && perKurikulumPoin.has(kurikulumMhsId)) {
      const pkStats = perKurikulumPoin.get(kurikulumMhsId)!;
      for (let th = 1; th <= 4; th++) {
        pkStats.sumPerTahun[th] += poinPerTahun[th];
      }
    }

    const mhsTotalPoin = progres?.totalPoin ?? perolehanFiltered.reduce((s: number, p: any) => s + (p.totalPoin || 0), 0);
    const isTercapai = Boolean(progres?.isLulus);
    const persentase = progres?.persentaseTotal ?? (
      targetPoinTotal > 0
        ? Math.min(Math.round((mhsTotalPoin / targetPoinTotal) * 100), 100)
        : 0
    );

    totalPoinSahGlobal += mhsTotalPoin;
    if (isTercapai) {
      totalMahasiswaLulusTarget++;
    }

    return {
      nim: m.nim,
      nama: m.user?.nama || '-',
      fakultas: m.prodi?.fakultas?.nama || '-',
      prodi: m.prodi?.nama || '-',
      angkatan: m.angkatan,
      kurikulumId: kurikulumMhs?.id ?? null,
      kurikulumNama: kurikulumMhs?.nama ?? null,
      poinTahun1: poinPerTahun[1],
      poinTahun2: poinPerTahun[2],
      poinTahun3: poinPerTahun[3],
      poinTahun4: poinPerTahun[4],
      totalPoin: mhsTotalPoin,
      totalPoinProgres: progres?.totalPoinProgres ?? mhsTotalPoin,
      targetPoin: progres?.totalTarget ?? targetPoinTotal,
      persentase,
      statusTarget: (isTercapai ? 'Tercapai' : 'Belum Tercapai') as 'Tercapai' | 'Belum Tercapai',
    };
  });

  // Siapkan daftar mahasiswa (preview dibatasi agar tidak overload network browser)
  let mahasiswaList = [...mhsDenganPoinList];
  const MAX_PREVIEW_MHS = 150;
  if (filter.isPreview && mahasiswaList.length < MAX_PREVIEW_MHS && totalMahasiswa > mahasiswaList.length) {
    const needed = MAX_PREVIEW_MHS - mahasiswaList.length;
    const existingUserIds = mahasiswaDenganPoin.map((m) => m.userId);
    const extraMhs = await prisma.mahasiswa.findMany({
      where: {
        ...mhsWhere,
        ...(existingUserIds.length > 0 ? { userId: { notIn: existingUserIds } } : {}),
      },
      take: needed,
      select: {
        nim: true,
        angkatan: true,
        kurikulumId: true,
        user: { select: { nama: true } },
        prodi: { select: { nama: true, fakultas: { select: { nama: true } } } },
      },
      orderBy: [{ angkatan: 'desc' }, { nim: 'asc' }],
    });

    for (const em of extraMhs) {
      const kId = em.kurikulumId || kurikulumAcuan?.id || 0;
      const kNama = kurikulumSources.find((k: any) => k.id === kId)?.nama || kurikulumAcuan?.nama || '-';
      mahasiswaList.push({
        nim: em.nim,
        nama: em.user?.nama || '-',
        fakultas: em.prodi?.fakultas?.nama || '-',
        prodi: em.prodi?.nama || '-',
        angkatan: em.angkatan,
        kurikulumId: kId,
        kurikulumNama: kNama,
        poinTahun1: 0,
        poinTahun2: 0,
        poinTahun3: 0,
        poinTahun4: 0,
        totalPoin: 0,
        totalPoinProgres: 0,
        targetPoin: targetPoinTotalDefault,
        persentase: 0,
        statusTarget: 'Belum Tercapai',
      });
    }
  } else if (!filter.isPreview && totalMahasiswa > mahasiswaList.length) {
    const existingUserIds = mahasiswaDenganPoin.map((m) => m.userId);
    const extraMhs = await prisma.mahasiswa.findMany({
      where: {
        ...mhsWhere,
        ...(existingUserIds.length > 0 ? { userId: { notIn: existingUserIds } } : {}),
      },
      take: Math.max(0, 2000 - mahasiswaList.length),
      select: {
        nim: true,
        angkatan: true,
        kurikulumId: true,
        user: { select: { nama: true } },
        prodi: { select: { nama: true, fakultas: { select: { nama: true } } } },
      },
      orderBy: [{ angkatan: 'desc' }, { nim: 'asc' }],
    });

    for (const em of extraMhs) {
      const kId = em.kurikulumId || kurikulumAcuan?.id || 0;
      const kNama = kurikulumSources.find((k: any) => k.id === kId)?.nama || kurikulumAcuan?.nama || '-';
      mahasiswaList.push({
        nim: em.nim,
        nama: em.user?.nama || '-',
        fakultas: em.prodi?.fakultas?.nama || '-',
        prodi: em.prodi?.nama || '-',
        angkatan: em.angkatan,
        kurikulumId: kId,
        kurikulumNama: kNama,
        poinTahun1: 0,
        poinTahun2: 0,
        poinTahun3: 0,
        poinTahun4: 0,
        totalPoin: 0,
        totalPoinProgres: 0,
        targetPoin: targetPoinTotalDefault,
        persentase: 0,
        statusTarget: 'Belum Tercapai',
      });
    }
  }

  const rataRataPoin = totalMahasiswa > 0 ? Math.round(totalPoinSahGlobal / totalMahasiswa) : 0;

  // Hitung target rata-rata tertimbang berdasarkan distribusi mahasiswa per kurikulum
  const isMultiKurikulum = !kurikulumFilter && semuaKurikulumAktif.length > 1;
  let effectiveTarget = targetPoinTotalDefault;
  if (isMultiKurikulum && totalMahasiswa > 0) {
    let totalWeightedTarget = 0;
    let totalStudentsWithKurikulum = 0;
    for (const kur of kurikulumSources) {
      const pkStats = perKurikulumPoin.get(kur.id);
      const kurTarget = targetPoinKurikulum(kur) || targetPoinTotalDefault;
      const count = pkStats?.count || 0;
      totalWeightedTarget += kurTarget * count;
      totalStudentsWithKurikulum += count;
    }
    if (totalStudentsWithKurikulum > 0) {
      effectiveTarget = Math.round(totalWeightedTarget / totalStudentsWithKurikulum);
    }
  }

  // Gunakan rata-rata persentase individu
  const totalPersenSemuaMhs = mhsDenganPoinList.reduce((sum, m) => sum + m.persentase, 0);
  const rataRataPersentase = totalMahasiswa > 0
    ? Math.round(totalPersenSemuaMhs / totalMahasiswa)
    : 0;
  const persentaseLulusTarget = totalMahasiswa > 0 ? Math.round((totalMahasiswaLulusTarget / totalMahasiswa) * 100) : 0;

  // 5. Statistik Capaian per Pilar Kurikulum (multi-kurikulum support)
  const capaianKurikulumStats: {
    nama: string;
    tahun: number;
    targetPoin: number;
    rataRataTerkumpul: number;
    persentaseCapaian: number;
    kurikulumNama?: string;
  }[] = [];

  for (const kur of kurikulumSources) {
    const pkStats = perKurikulumPoin.get(kur.id);
    const kurCapaian = kur.capaian || [];
    const kurTargetTotal = targetPoinKurikulum(kur) || targetPoinTotalDefault;

    const entries = kurCapaian.length > 0
      ? kurCapaian.map((c: any, i: number) => ({
          nama: c.nama || `Tahun ${c.urutan || (i + 1)}`,
          tahun: c.urutan || (i + 1),
          targetPoin: c.jumlahPoin,
        }))
      : [
          { nama: 'Tahun 1', tahun: 1, targetPoin: Math.round(kurTargetTotal / 4) },
          { nama: 'Tahun 2', tahun: 2, targetPoin: Math.round(kurTargetTotal / 4) },
          { nama: 'Tahun 3', tahun: 3, targetPoin: Math.round(kurTargetTotal / 4) },
          { nama: 'Tahun 4', tahun: 4, targetPoin: Math.round(kurTargetTotal / 4) },
        ];

    const mhsCount = pkStats?.count || totalMahasiswa || 0;

    for (const c of entries) {
      const th = (c.tahun >= 1 && c.tahun <= 4) ? c.tahun : 1;
      const poinTahun = pkStats?.sumPerTahun[th] || 0;
      const avgTerkumpul = mhsCount > 0 ? Math.round(poinTahun / mhsCount) : 0;
      const persen = c.targetPoin > 0 ? Math.min(Math.round((avgTerkumpul / c.targetPoin) * 100), 100) : 0;
      capaianKurikulumStats.push({
        nama: isMultiKurikulum ? `${kur.nama} - ${c.nama}` : c.nama,
        tahun: c.tahun,
        targetPoin: c.targetPoin,
        rataRataTerkumpul: avgTerkumpul,
        persentaseCapaian: persen,
        kurikulumNama: isMultiKurikulum ? kur.nama : undefined,
      });
    }
  }

  // 6. Komparasi Unit (Fakultas atau Prodi)
  let komparasiUnit: 'fakultas' | 'prodi' = 'fakultas';
  const komparasiItems: any[] = [];

  if (scope === 'fakultas' || effectiveFakultasId) {
    komparasiUnit = 'prodi';
    const prodiList = await prisma.programStudi.findMany({
      where: {
        deletedAt: null,
        ...(effectiveFakultasId ? { fakultasId: effectiveFakultasId } : {}),
      },
      select: { id: true, nama: true },
    });

    const prodiMap = new Map<number, { id: number; nama: string; totalMhs: number; totalPoin: number; katMap: Record<string, number> }>();
    prodiList.forEach((p) => {
      const countMhs = mhsCountByProdiId.get(p.id) || 0;
      prodiMap.set(p.id, { id: p.id, nama: p.nama, totalMhs: countMhs, totalPoin: 0, katMap: {} });
    });

    mahasiswaDenganPoin.forEach((m) => {
      const pEntry = prodiMap.get(m.prodiId);
      if (!pEntry) return;
      m.perolehanPoin.forEach((pp) => {
        pEntry.totalPoin += pp.totalPoin;
        const kName = pp.kegiatan?.kategori?.nama || 'Lainnya';
        pEntry.katMap[kName] = (pEntry.katMap[kName] || 0) + pp.totalPoin;
      });
    });

    prodiMap.forEach((p) => {
      const avgPoin = p.totalMhs > 0 ? Math.round(p.totalPoin / p.totalMhs) : 0;
      const avgPersen = Math.min(Math.round((avgPoin / (targetPoinTotalDefault || 1)) * 100), 100);
      komparasiItems.push({
        id: p.id,
        nama: p.nama,
        totalMahasiswa: p.totalMhs,
        totalPoin: p.totalPoin,
        rataRataPoin: avgPoin,
        rataRataPersentase: avgPersen,
        kategoriPoin: p.katMap,
      });
    });
  } else {
    // Tingkat Universitas: Ranking Fakultas (Kecuali Pascasarjana)
    komparasiUnit = 'fakultas';
    const fakultasList = await prisma.fakultas.findMany({
      where: {
        deletedAt: null,
        NOT: { nama: { contains: 'Pascasarjana' } },
      },
      select: { id: true, nama: true },
    });
    const fakultasMap = new Map<number, { id: number; nama: string; totalMhs: number; totalPoin: number; katMap: Record<string, number> }>();
    fakultasList.forEach((f) => fakultasMap.set(f.id, { id: f.id, nama: f.nama, totalMhs: 0, totalPoin: 0, katMap: {} }));

    const allProdis = await prisma.programStudi.findMany({
      where: { deletedAt: null },
      select: { id: true, fakultasId: true },
    });
    const prodiToFakId = new Map(allProdis.map((p) => [p.id, p.fakultasId]));

    mhsCountByProdiId.forEach((count, prodiId) => {
      const fId = prodiToFakId.get(prodiId);
      if (fId && fakultasMap.has(fId)) {
        fakultasMap.get(fId)!.totalMhs += count;
      }
    });

    mahasiswaDenganPoin.forEach((m) => {
      const fId = m.prodi?.fakultas?.id;
      if (!fId || !fakultasMap.has(fId)) return;
      const fEntry = fakultasMap.get(fId)!;

      m.perolehanPoin.forEach((pp) => {
        fEntry.totalPoin += pp.totalPoin;
        const kName = pp.kegiatan?.kategori?.nama || 'Lainnya';
        fEntry.katMap[kName] = (fEntry.katMap[kName] || 0) + pp.totalPoin;
      });
    });

    fakultasMap.forEach((f) => {
      const avgPoin = f.totalMhs > 0 ? Math.round(f.totalPoin / f.totalMhs) : 0;
      const avgPersen = Math.min(Math.round((avgPoin / (targetPoinTotalDefault || 1)) * 100), 100);
      komparasiItems.push({
        id: f.id,
        nama: f.nama,
        totalMahasiswa: f.totalMhs,
        totalPoin: f.totalPoin,
        rataRataPoin: avgPoin,
        rataRataPersentase: avgPersen,
        kategoriPoin: f.katMap,
      });
    });
  }

  // Urutkan ranking berdasarkan rata-rata persentase tertinggi
  komparasiItems.sort((a, b) => b.rataRataPersentase - a.rataRataPersentase);
  komparasiItems.forEach((item, idx) => {
    item.ranking = idx + 1;
  });

  // 7. Rekapitulasi Prestasi Mahasiswa (SIMKATMAWA / Prestasi Nasional & Internasional)
  const perolehanPrestasi = await prisma.perolehanPoin.findMany({
    where: {
      status: 'sah',
      ...(effectiveFakultasId ? { mahasiswa: { prodi: { fakultasId: effectiveFakultasId } } } : {}),
      ...(filter.prodiId ? { mahasiswa: { prodiId: filter.prodiId } } : {}),
      ...(filter.angkatan ? { mahasiswa: { angkatan: filter.angkatan } } : {}),
      ...(filter.kurikulumId ? { mahasiswa: { kurikulumId: filter.kurikulumId } } : {}),
      kegiatan: {
        OR: [
          { skala: { nama: { in: ['Nasional', 'Internasional', 'Wilayah / Regional'] } } },
          { kategori: { nama: { contains: 'Kompetisi' } } },
          { kategori: { nama: { contains: 'Prestasi' } } },
          { kategori: { nama: { contains: 'Lomba' } } },
        ],
      },
    },
    include: {
      mahasiswa: {
        include: {
          user: { select: { nama: true } },
          prodi: { include: { fakultas: { select: { nama: true } } } },
        },
      },
      kegiatan: {
        include: {
          kategori: true,
          skala: true,
          organisasi: { select: { nama: true } },
        },
      },
      klaimPoin: {
        include: { peranUsulan: true },
      },
    },
    orderBy: { totalPoin: 'desc' },
    take: 200,
  });

  const prestasiList = perolehanPrestasi.map((p) => ({
    nim: p.mahasiswa.nim,
    namaMahasiswa: p.mahasiswa.user?.nama || '-',
    fakultas: p.mahasiswa.prodi?.fakultas?.nama || '-',
    prodi: p.mahasiswa.prodi?.nama || '-',
    namaKegiatan: p.kegiatan.nama,
    kategori: p.kegiatan.kategori?.nama || 'Kompetisi',
    skala: p.kegiatan.skala?.nama || 'Universitas',
    peran: p.klaimPoin?.peranUsulan?.nama || 'Peserta',
    penyelenggara: p.kegiatan.organisasi?.nama || p.kegiatan.penyelenggaraExt || 'Ditmawa UNAND',
    tanggal: p.kegiatan.tanggalMulai ? new Date(p.kegiatan.tanggalMulai).toISOString().split('T')[0] : '-',
    poin: p.totalPoin,
  }));

  // 8. Keaktifan Organisasi / UKM
  const ormawaWhere: any = {};
  if (effectiveFakultasId) {
    ormawaWhere.fakultasId = effectiveFakultasId;
  }

  const ormawaRaw = await prisma.organisasi.findMany({
    where: ormawaWhere,
    include: {
      fakultas: { select: { nama: true } },
      kegiatan: {
        where: { status: { in: ['disetujui', 'terpublikasi'] } },
        include: {
          partisipasi: {
            include: {
              klaimPoin: {
                include: { perolehanPoin: true },
              },
            },
          },
        },
      },
    },
  });

  const ormawaList = ormawaRaw.map((o) => {
    let totalPeserta = 0;

    o.kegiatan.forEach((k) => {
      totalPeserta += k.partisipasi.length;
    });

    return {
      nama: o.nama,
      tipe: o.tipe.toUpperCase(),
      fakultas: o.fakultas?.nama || 'Tingkat Universitas',
      totalKegiatan: o.kegiatan.length,
      totalPeserta,
      totalPoinDidistribusikan: o.kegiatan.length, // Sesuai revisi: Poin = Jumlah Kegiatan
    };
  });

  ormawaList.sort((a, b) => b.totalKegiatan - a.totalKegiatan);

  const totalKegiatanCount = await prisma.kegiatan.count({
    where: {
      status: { in: ['disetujui', 'terpublikasi'] },
      ...(effectiveFakultasId ? { organisasi: { fakultasId: effectiveFakultasId } } : {}),
    },
  });

  return {
    scope,
    scopeNama,
    role,
    filter: {
      fakultasId: effectiveFakultasId,
      fakultasNama: effectiveFakultasId ? (await prisma.fakultas.findUnique({ where: { id: effectiveFakultasId } }))?.nama : undefined,
      prodiId: filter.prodiId,
      prodiNama: filter.prodiId ? (await prisma.programStudi.findUnique({ where: { id: filter.prodiId } }))?.nama : undefined,
      angkatan: filter.angkatan,
      tahunAkademik: filter.tahunAkademik,
      kurikulumId: filter.kurikulumId,
    },
    kurikulum: {
      id: kurikulumMeta.id || 0,
      nama: kurikulumMeta.nama || 'Campuran (per mahasiswa)',
      targetPoin: effectiveTarget,
      capaianList,
    },
    kpi: {
      totalMahasiswa,
      rataRataPoin,
      rataRataPersentase,
      totalPoinSah: totalPoinSahGlobal,
      totalPrestasi: prestasiList.length,
      totalKegiatan: totalKegiatanCount,
      totalOrmawa: ormawaList.length,
      persentaseLulusTarget,
    },
    komparasi: {
      unit: komparasiUnit,
      items: komparasiItems,
    },
    capaianKurikulumStats,
    mahasiswaList,
    prestasiList,
    ormawaList,
  };
}
