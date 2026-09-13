/**
 * Fix Kurikulum Mahasiswa
 * -----------------------
 * Script untuk mengisi dan mengoreksi kurikulum_id pada tabel mahasiswa secara kilat (Group Batch Update).
 * Logika:
 *   1. Mahasiswa angkatan X → pakai kurikulum dengan angkatan_mulai ≤ X yang paling dekat.
 *   2. Mahasiswa angkatan sebelum kurikulum terawal (misal mhs 2020-2023, kurikulum awal 2024):
 *      Wajib mengikuti kurikulum paling awal / terdekat (yaitu Kurikulum 2024, BUKAN 2026).
 *
 * Jalankan: npx tsx src/scripts/fixKurikulumMahasiswa.ts
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  console.log('🔧 Memeriksa dan memperbaiki kurikulum_id mahasiswa...\n');

  // 1. Load semua kurikulum (non-deleted), urutkan dari angkatan_mulai terbesar (DESC)
  const semuaKurikulum = await prisma.kurikulum.findMany({
    where: { deletedAt: null },
    orderBy: { angkatanMulai: 'desc' },
  });

  console.log('📚 Kurikulum tersedia di database:');
  for (const k of semuaKurikulum) {
    console.log(`   • [ID: ${k.id}] ${k.nama} — angkatan_mulai: ${k.angkatanMulai ?? 'NULL'} — status: ${k.status}`);
  }

  if (semuaKurikulum.length === 0) {
    console.log('\n❌ Tidak ada kurikulum di database. Buat kurikulum terlebih dahulu.');
    return;
  }

  // Urutkan juga secara ASC untuk mencari kurikulum terawal jika angkatan mahasiswa < kurikulum terawal
  const kurikulumDenganAngkatanAsc = semuaKurikulum
    .filter((k) => k.angkatanMulai !== null)
    .sort((a, b) => a.angkatanMulai! - b.angkatanMulai!);

  // 2. Helper: cari kurikulum berdasarkan angkatan dengan logika presisi
  function cariKurikulumId(angkatan: number | null): number | null {
    if (!angkatan || semuaKurikulum.length === 0) {
      const aktif = semuaKurikulum.find((k) => k.status === 'aktif');
      return aktif?.id ?? semuaKurikulum[0]?.id ?? null;
    }

    // A. Cari kurikulum yang angkatanMulai <= angkatan (terdekat di bawahnya)
    for (const k of semuaKurikulum) {
      if (k.angkatanMulai !== null && k.angkatanMulai <= angkatan) {
        return k.id;
      }
    }

    // B. Jika angkatan mahasiswa lebih tua dari kurikulum paling awal (misal mhs 2020-2023 sedangkan kurikulum awal 2024):
    // Mengikuti kurikulum paling awal / terdekat (yaitu Kurikulum 2024, BUKAN 2026!)
    if (kurikulumDenganAngkatanAsc.length > 0) {
      return kurikulumDenganAngkatanAsc[0].id;
    }

    // C. Fallback ke kurikulum aktif
    const aktif = semuaKurikulum.find((k) => k.status === 'aktif');
    return aktif?.id ?? semuaKurikulum[0]?.id ?? null;
  }

  // 3. Kelompokkan mahasiswa berdasarkan angkatan (super cepat, 1 query)
  const angkatanGroups = await prisma.mahasiswa.groupBy({
    by: ['angkatan'],
    _count: { userId: true },
  });

  const totalMhs = await prisma.mahasiswa.count();
  console.log(`\n📊 Total Mahasiswa di database: ${totalMhs} orang terbagi dalam ${angkatanGroups.length} kelompok angkatan\n`);

  let totalUpdated = 0;
  const perKurikulum: Record<string, number> = {};

  for (const group of angkatanGroups) {
    const angkatan = group.angkatan;
    const count = group._count.userId;
    const targetKurikulumId = cariKurikulumId(angkatan);

    if (!targetKurikulumId) {
      console.log(`⚠️ Angkatan ${angkatan ?? 'NULL'} (${count} mhs): Tidak ada kurikulum yang cocok.`);
      continue;
    }

    const kObj = semuaKurikulum.find((k) => k.id === targetKurikulumId);
    const kNama = kObj?.nama ?? `ID ${targetKurikulumId}`;
    const kAngkatan = kObj?.angkatanMulai ?? '?';

    // Batch update semua mahasiswa di angkatan ini yang kurikulumId-nya NULL atau belum sesuai
    const updateRes = await prisma.mahasiswa.updateMany({
      where: {
        angkatan: angkatan,
        OR: [
          { kurikulumId: null },
          { kurikulumId: { not: targetKurikulumId } },
        ],
      },
      data: { kurikulumId: targetKurikulumId },
    });

    const key = `kurikulum_${targetKurikulumId}`;
    perKurikulum[key] = (perKurikulum[key] || 0) + count;
    totalUpdated += updateRes.count;

    console.log(
      `   • Angkatan ${String(angkatan ?? 'NULL').padEnd(5)} (${String(count).padStart(5)} mhs) → [ID: ${targetKurikulumId}] ${kNama} (Mulai ${kAngkatan}) [Diupdate: ${updateRes.count}]`
    );
  }

  // Pastikan seluruh akun user mahasiswa berstatus aktif (aktif = true)
  const userAktifRes = await prisma.user.updateMany({
    where: {
      peran: 'mahasiswa',
      aktif: false,
    },
    data: { aktif: true },
  });
  if (userAktifRes.count > 0) {
    console.log(`⚡ Mengaktifkan ${userAktifRes.count} akun user mahasiswa yang sebelumnya nonaktif.`);
  }

  // 4. Ringkasan
  console.log(`\n====================================================`);
  console.log(`🎉 PERBAIKAN KURIKULUM SELESAI!`);
  console.log(`Total mahasiswa yang diupdate/dikoreksi: ${totalUpdated} mahasiswa`);

  console.log('\n📋 Distribusi Akhir Seluruh Mahasiswa:');
  for (const [key, count] of Object.entries(perKurikulum)) {
    const kId = parseInt(key.replace('kurikulum_', ''), 10);
    const kObj = semuaKurikulum.find((k) => k.id === kId);
    const kNama = kObj?.nama ?? `ID ${kId}`;
    const kAngkatan = kObj?.angkatanMulai ?? '?';
    console.log(`   • [ID: ${kId}] ${kNama} (Mulai Angkatan ${kAngkatan}) : ${count} mahasiswa`);
  }

  // 5. Verifikasi sisa NULL
  const sisaNull = await prisma.mahasiswa.count({ where: { kurikulumId: null } });
  console.log(`\n📊 Verifikasi: Sisa kurikulum_id NULL = ${sisaNull}`);
  console.log(`====================================================\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
