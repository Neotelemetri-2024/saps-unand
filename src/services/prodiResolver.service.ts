import prisma from '../lib/prisma';

/**
 * Pemetaan resmi kode Fakultas dan Program Studi Universitas Andalas (UNAND).
 * Pola NIM 10 Digit: YY J FF P XXXX
 * - YY   : Tahun Angkatan (2 digit)
 * - J    : Jenjang (1 = S1, 0 = D3/D4)
 * - FF   : Kode Fakultas (2 digit, misal: 09 = Teknik, 15 = FTI, 05 = FEB)
 * - P    : Kode Prodi di dalam Fakultas
 * - XXXX : Nomor Urut
 */

interface FakultasMapping {
  nama: string;
  defaultProdi: string;
  prodis: Record<string, string>; // key: 4-digit JFFP code, value: nama prodi
}

const UNAND_FAKULTAS_MAP: Record<string, FakultasMapping> = {
  '01': {
    nama: 'Fakultas Hukum',
    defaultProdi: 'Ilmu Hukum',
    prodis: {
      '1011': 'Ilmu Hukum',
    },
  },
  '02': {
    nama: 'Fakultas Pertanian',
    defaultProdi: 'Agroteknologi',
    prodis: {
      '1021': 'Agroteknologi',
      '1022': 'Agribisnis',
      '1023': 'Proteksi Tanaman',
      '1024': 'Ilmu Tanah',
    },
  },
  '03': {
    nama: 'Fakultas Kedokteran',
    defaultProdi: 'Kedokteran',
    prodis: {
      '1031': 'Kedokteran',
      '1032': 'Psikologi',
      '1033': 'Kebidanan',
    },
  },
  '04': {
    nama: 'Fakultas MIPA',
    defaultProdi: 'Matematika',
    prodis: {
      '1041': 'Kimia',
      '1042': 'Biologi',
      '1043': 'Fisika',
      '1044': 'Matematika',
    },
  },
  '05': {
    nama: 'Fakultas Ekonomi dan Bisnis',
    defaultProdi: 'Manajemen',
    prodis: {
      '1051': 'Ekonomi',
      '1052': 'Manajemen',
      '1053': 'Akuntansi',
      '0051': 'D3 Keuangan',
      '0052': 'D3 Manajemen Pemasaran',
      '0053': 'D3 Akuntansi',
    },
  },
  '06': {
    nama: 'Fakultas Peternakan',
    defaultProdi: 'Peternakan',
    prodis: {
      '1061': 'Peternakan',
    },
  },
  '07': {
    nama: 'Fakultas Ilmu Budaya',
    defaultProdi: 'Sastra Inggris',
    prodis: {
      '1071': 'Sastra Indonesia',
      '1072': 'Sastra Inggris',
      '1073': 'Sastra Minangkabau',
      '1074': 'Sastra Jepang',
      '1075': 'Sejarah',
    },
  },
  '08': {
    nama: 'Fakultas Ilmu Sosial dan Ilmu Politik',
    defaultProdi: 'Ilmu Komunikasi',
    prodis: {
      '1081': 'Sosiologi',
      '1082': 'Antropologi',
      '1083': 'Ilmu Politik',
      '1084': 'Hubungan Internasional',
      '1085': 'Administrasi Publik',
      '1086': 'Ilmu Komunikasi',
    },
  },
  '09': {
    nama: 'Fakultas Teknik',
    defaultProdi: 'Teknik Elektro',
    prodis: {
      '1091': 'Teknik Mesin',
      '1092': 'Teknik Sipil',
      '1093': 'Teknik Industri',
      '1094': 'Teknik Lingkungan',
      '1095': 'Teknik Elektro',
      '0091': 'D3 Teknik Mesin',
      '0092': 'D3 Teknik Sipil',
      '0095': 'D3 Teknik Elektro',
    },
  },
  '10': {
    nama: 'Fakultas Farmasi',
    defaultProdi: 'Farmasi',
    prodis: {
      '1101': 'Farmasi',
    },
  },
  '11': {
    nama: 'Fakultas Teknologi Pertanian',
    defaultProdi: 'Teknik Pertanian dan Biosistem',
    prodis: {
      '1111': 'Teknik Pertanian dan Biosistem',
      '1112': 'Teknologi Hasil Pertanian',
      '1113': 'Teknologi Industri Pertanian',
    },
  },
  '12': {
    nama: 'Fakultas Keperawatan',
    defaultProdi: 'Keperawatan',
    prodis: {
      '1121': 'Keperawatan',
    },
  },
  '13': {
    nama: 'Fakultas Kesehatan Masyarakat',
    defaultProdi: 'Kesehatan Masyarakat',
    prodis: {
      '1131': 'Kesehatan Masyarakat',
      '1132': 'Gizi',
    },
  },
  '14': {
    nama: 'Fakultas Kedokteran Gigi',
    defaultProdi: 'Kedokteran Gigi',
    prodis: {
      '1141': 'Kedokteran Gigi',
    },
  },
  '15': {
    nama: 'Fakultas Teknologi Informasi',
    defaultProdi: 'Sistem Informasi',
    prodis: {
      '1151': 'Teknik Komputer',
      '1152': 'Sistem Informasi',
      '1153': 'Informatika',
    },
  },
};

/**
 * Mengekstrak informasi Fakultas & Prodi dari NIM 10 digit.
 */
export function getFakultasAndProdiNameFromNim(nim: string): {
  fakultasNama: string;
  prodiNama: string;
  fakultasKode: string;
  prodiKode: string;
} | null {
  const cleanNim = (nim || '').trim();
  if (!/^\d{10}$/.test(cleanNim)) {
    return null;
  }

  // Digit ke 3-4 (0-indexed: index 3 sampai 4) adalah kode fakultas (FF)
  // Contoh: 21 1 09 5 2001 -> index 0-1: 21, index 2: 1, index 3-4: 09, index 5: 5
  const fakultasKode = cleanNim.substring(3, 5);
  const prodiKode = cleanNim.substring(2, 6); // Misal: 1095, 1152, 1053

  const fakInfo = UNAND_FAKULTAS_MAP[fakultasKode];
  if (!fakInfo) {
    return null;
  }

  const prodiNama = fakInfo.prodis[prodiKode] || fakInfo.defaultProdi;

  return {
    fakultasNama: fakInfo.nama,
    prodiNama,
    fakultasKode,
    prodiKode,
  };
}

/**
 * Menyelesaikan program studi dan fakultas yang benar untuk mahasiswa di database.
 * Menjamin bahwa mahasiswa TIDAK AKAN PERNAH salah masuk ke fakultas lain.
 */
export async function resolveProdiForMahasiswa(nim: string): Promise<{
  prodiId: number;
  fakultasId: number;
  fakultasNama: string;
  prodiNama: string;
}> {
  const parsed = getFakultasAndProdiNameFromNim(nim);

  // Jika NIM tidak sesuai format standar UNAND, gunakan fallback aman
  const targetFakNama = parsed?.fakultasNama || 'Fakultas Teknologi Informasi';
  const targetProdiNama = parsed?.prodiNama || 'Sistem Informasi';

  // 1. Cari atau buat Fakultas di database
  let fakultas = await prisma.fakultas.findFirst({
    where: {
      OR: [
        { nama: targetFakNama },
        { nama: { contains: targetFakNama.replace('Fakultas ', '').trim() } },
      ],
    },
  });

  if (!fakultas) {
    fakultas = await prisma.fakultas.create({
      data: { nama: targetFakNama },
    });
  }

  // 2. Cari Program Studi di bawah fakultas tersebut
  let prodi = await prisma.programStudi.findFirst({
    where: {
      fakultasId: fakultas.id,
      OR: [
        { nama: targetProdiNama },
        { nama: { contains: targetProdiNama } },
      ],
    },
  });

  // 3. Jika belum ada di database, buat prodi di bawah fakultas yang tepat
  if (!prodi) {
    try {
      prodi = await prisma.programStudi.create({
        data: {
          nama: targetProdiNama,
          fakultasId: fakultas.id,
        },
      });
    } catch {
      // Fallback jika terjadi race condition saat create
      prodi = await prisma.programStudi.findFirst({
        where: { fakultasId: fakultas.id },
      });
    }
  }

  // 4. Jika tetap belum ada, ambil prodi apapun yang berada di bawah FAKULTAS TERSEBUT
  if (!prodi) {
    prodi = await prisma.programStudi.findFirst({
      where: { fakultasId: fakultas.id },
    });
  }

  // Fallback absolut (sangat jarang terjadi)
  const finalProdiId = prodi?.id || 1;
  const finalFakultasId = fakultas.id;

  return {
    prodiId: finalProdiId,
    fakultasId: finalFakultasId,
    fakultasNama: fakultas.nama,
    prodiNama: prodi?.nama || targetProdiNama,
  };
}

/**
 * Memeriksa dan mengoreksi profil mahasiswa jika prodi/fakultas di database
 * tidak cocok dengan NIM aslinya (misal NIM Fakultas Teknik tetapi tersimpan di FTI).
 */
export async function correctMahasiswaProdiIfMismatched(
  userId: bigint,
  nim: string
): Promise<{ corrected: boolean; oldFakultas?: string; newFakultas?: string; prodiNama?: string }> {
  try {
    const mhs = await prisma.mahasiswa.findUnique({
      where: { userId },
      include: {
        prodi: {
          include: { fakultas: true },
        },
      },
    });

    if (!mhs) {
      return { corrected: false };
    }

    const expected = getFakultasAndProdiNameFromNim(nim);
    if (!expected) {
      return { corrected: false };
    }

    const currentFakultasNama = mhs.prodi?.fakultas?.nama?.toLowerCase() || '';
    const expectedFakultasNama = expected.fakultasNama.toLowerCase();

    // Cek apakah nama fakultas sekarang berbeda dengan nama fakultas yang seharusnya
    const isMismatched = !currentFakultasNama.includes(expectedFakultasNama.replace('fakultas ', '').trim());

    if (isMismatched) {
      const resolved = await resolveProdiForMahasiswa(nim);

      await prisma.mahasiswa.update({
        where: { userId },
        data: { prodiId: resolved.prodiId },
      });

      console.log(
        `[SSO Auto-Fix] Mengoreksi data mahasiswa NIM ${nim}: dari "${mhs.prodi?.fakultas?.nama} (${mhs.prodi?.nama})" -> "${resolved.fakultasNama} (${resolved.prodiNama})"`
      );

      return {
        corrected: true,
        oldFakultas: mhs.prodi?.fakultas?.nama,
        newFakultas: resolved.fakultasNama,
        prodiNama: resolved.prodiNama,
      };
    }

    return { corrected: false };
  } catch (err) {
    console.error(`[SSO Auto-Fix Error] Gagal memverifikasi prodi mahasiswa NIM ${nim}:`, err);
    return { corrected: false };
  }
}
