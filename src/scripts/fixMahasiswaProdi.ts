import prisma from '../lib/prisma';
import { getFakultasAndProdiNameFromNim, resolveProdiForMahasiswa } from '../services/prodiResolver.service';

/**
 * Script untuk memeriksa dan memperbaiki sinkronisasi Fakultas & Prodi
 * bagi semua mahasiswa yang sudah terlanjur tersimpan di database.
 * 
 * Jalankan dengan: npx tsx src/scripts/fixMahasiswaProdi.ts
 */
async function main() {
  console.log('🔍 Memeriksa sinkronisasi Fakultas & Program Studi seluruh mahasiswa...');

  const allMhs = await prisma.mahasiswa.findMany({
    include: {
      user: { select: { nama: true, email: true } },
      prodi: {
        include: {
          fakultas: true,
        },
      },
    },
  });

  console.log(`📊 Ditemukan total ${allMhs.length} mahasiswa di database.\n`);

  let correctedCount = 0;
  let skippedCount = 0;

  for (const mhs of allMhs) {
    const nim = mhs.nim;
    const expected = getFakultasAndProdiNameFromNim(nim);

    if (!expected) {
      skippedCount++;
      continue;
    }

    const currentFakNama = mhs.prodi?.fakultas?.nama?.toLowerCase() || '';
    const expectedFakNama = expected.fakultasNama.toLowerCase();

    // Periksa apakah fakultas saat ini tidak cocok dengan fakultas yang seharusnya
    const isMismatched = !currentFakNama.includes(expectedFakNama.replace('fakultas ', '').trim());

    if (isMismatched) {
      console.log(`⚠️ MISMATCH TERDETEKSI:`);
      console.log(`   NIM     : ${nim}`);
      console.log(`   Nama    : ${mhs.user?.nama || '-'}`);
      console.log(`   Saat ini: ${mhs.prodi?.fakultas?.nama} (${mhs.prodi?.nama})`);
      console.log(`   Harusnya: ${expected.fakultasNama} (${expected.prodiNama})`);

      const resolved = await resolveProdiForMahasiswa(nim);

      await prisma.mahasiswa.update({
        where: { userId: mhs.userId },
        data: { prodiId: resolved.prodiId },
      });

      console.log(`   ✅ BERHASIL DIKOREKSI -> ${resolved.fakultasNama} (${resolved.prodiNama})\n`);
      correctedCount++;
    }
  }

  console.log('====================================================');
  console.log(`🎉 Pemeriksaan selesai:`);
  console.log(`   - Total Diperiksa : ${allMhs.length}`);
  console.log(`   - Berhasil Dikoreksi: ${correctedCount}`);
  console.log(`   - Sudah Sesuai / Format Khusus: ${allMhs.length - correctedCount}`);
  console.log('====================================================');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Gagal menjalankan perbaikan prodi mahasiswa:', e);
  await prisma.$disconnect();
  process.exit(1);
});
