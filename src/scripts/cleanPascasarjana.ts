/**
 * CLI Script: Pembersihan Mahasiswa Pascasarjana (S2/S3/Spesialis/Profesi) dari SAPS
 * ---------------------------------------------------------------------------------
 * SAPS (Sistem Aktivitas dan Prestasi Mahasiswa) secara regulasi hanya ditujukan untuk
 * mahasiswa program Sarjana & Diploma (S1, D4, dan D3).
 *
 * Script ini digunakan untuk menghapus data mahasiswa Pascasarjana yang terlanjur tersinkron
 * ke dalam database SAPS beserta relasi data terkait.
 *
 * Cara menjalankan:
 *   Simulasi (Dry Run) : npm run clean:pascasarjana -- --dry-run
 *   Eksekusi Hapus     : npm run clean:pascasarjana
 */
import 'dotenv/config';
import prisma from '../lib/prisma';
import { isMahasiswaS1D4D3 } from '../services/sia/siaSync.service';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('================================================================');
  console.log('🧹 PEMBERSIHAN MAHASISWA PASCASARJANA (S2, S3, SPESIALIS, PROFESI)');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulasi saja - tidak ada data dihapus)' : 'EKSEKUSI PENGHAPUSAN'}`);
  console.log('================================================================\n');

  // 1. Ambil semua data mahasiswa beserta nama program studi dan user
  const allMhs = await prisma.mahasiswa.findMany({
    include: {
      prodi: { select: { id: true, nama: true } },
      user: { select: { id: true, nama: true, email: true } },
    },
  });

  console.log(`📊 Total Mahasiswa Terdaftar di Database Saat Ini: ${allMhs.length}`);

  // 2. Filter mahasiswa yang tergolong Pascasarjana
  const pascaMhs = allMhs.filter((m) => {
    const nim = m.nim.trim();
    const prodiNama = (m.prodi?.nama || '').trim();

    // Gunakan fungsi filter standar SAPS
    const isS1D4D3 = isMahasiswaS1D4D3({
      nim,
      prodiNama,
      prodiNamaResmi: prodiNama,
    });

    return !isS1D4D3;
  });

  const s1d4d3Count = allMhs.length - pascaMhs.length;
  console.log(`- Mahasiswa S1 / D4 / D3 (Valid - Tetap Disimpan) : ${s1d4d3Count}`);
  console.log(`- Mahasiswa Pascasarjana (Target Pembersihan)     : ${pascaMhs.length}\n`);

  if (pascaMhs.length === 0) {
    console.log('✅ Database sudah bersih. Tidak ditemukan mahasiswa Pascasarjana di SAPS.');
    return;
  }

  // Tampilkan contoh data mahasiswa pascasarjana
  console.log('Contoh data mahasiswa Pascasarjana yang terdeteksi:');
  pascaMhs.slice(0, 10).forEach((m, idx) => {
    console.log(`  ${idx + 1}. [NIM: ${m.nim}] ${m.user?.nama || 'Unknown'} — Prodi: ${m.prodi?.nama || 'Unknown'}`);
  });
  if (pascaMhs.length > 10) {
    console.log(`  ... dan ${pascaMhs.length - 10} mahasiswa lainnya.\n`);
  }

  if (isDryRun) {
    console.log('ℹ️  Mode --dry-run selesai. Jalankan tanpa opsi --dry-run untuk mengeksekusi penghapusan.');
    return;
  }

  const userIdsToDelete = pascaMhs.map((m) => m.userId);

  console.log(`⏳ Menghapus relasi & data ${userIdsToDelete.length} mahasiswa Pascasarjana...`);

  // A. Hapus relasi data
  await prisma.partisipasi.deleteMany({ where: { mahasiswaId: { in: userIdsToDelete } } });
  await prisma.perolehanPoin.deleteMany({ where: { mahasiswaId: { in: userIdsToDelete } } });
  await prisma.saranPA.deleteMany({ where: { mahasiswaId: { in: userIdsToDelete } } });
  await prisma.cvGenerated.deleteMany({ where: { mahasiswaId: { in: userIdsToDelete } } });
  await prisma.sertifikatPenerbitan.deleteMany({ where: { mahasiswaId: { in: userIdsToDelete } } });
  await prisma.notifikasi.deleteMany({ where: { userId: { in: userIdsToDelete } } });
  await prisma.auditLog.deleteMany({ where: { aktorId: { in: userIdsToDelete } } });

  // B. Hapus profil mahasiswa
  const delMhs = await prisma.mahasiswa.deleteMany({ where: { userId: { in: userIdsToDelete } } });
  console.log(`✅ Terhapus: ${delMhs.count} baris data dari tabel mahasiswa.`);

  // C. Hapus akun user dalam batch (chunk 500)
  const CHUNK_SIZE = 500;
  let totalUserDeleted = 0;
  for (let i = 0; i < userIdsToDelete.length; i += CHUNK_SIZE) {
    const chunk = userIdsToDelete.slice(i, i + CHUNK_SIZE);
    const res = await prisma.user.deleteMany({ where: { id: { in: chunk } } });
    totalUserDeleted += res.count;
  }
  console.log(`✅ Terhapus: ${totalUserDeleted} akun user Pascasarjana.`);

  // D. Hapus program studi pascasarjana yang sudah kosong (0 mahasiswa)
  const allProdis = await prisma.programStudi.findMany({
    include: { _count: { select: { mahasiswa: true } } },
  });
  const emptyPascaProdi = allProdis.filter(
    (p) =>
      p._count.mahasiswa === 0 &&
      /\b(magister|doktor|s2|s-2|s3|s-3|spesialis|subspesialis|profesi|pascasarjana)\b/i.test(p.nama)
  );
  if (emptyPascaProdi.length > 0) {
    const delProdi = await prisma.programStudi.deleteMany({
      where: { id: { in: emptyPascaProdi.map((p) => p.id) } },
    });
    console.log(`✅ Terhapus: ${delProdi.count} master program studi pascasarjana kosong.`);
  }

  const sisaMhs = await prisma.mahasiswa.count();
  console.log(`\n🎉 Pembersihan selesai! Sisa mahasiswa aktif di SAPS (S1/D4/D3): ${sisaMhs} orang.\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error saat membersihkan data pascasarjana:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
