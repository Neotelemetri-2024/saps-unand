import prisma from '../lib/prisma';

const run = async () => {
  console.log('🚀 Memulai pengaturan data Beta Testing...');
  try {
    // 1. Cari ID Dosen Ahmad Rivai
    const dosenRivai = await prisma.user.findUnique({ where: { email: 'ahmad.rivai@unand.ac.id' } });
    if (!dosenRivai) {
      console.log('❌ Dosen Ahmad Rivai tidak ditemukan!');
    } else {
      // Cari ID ke-6 mahasiswa
      const mhsRivaiEmails = [
        '2411521001@student.unand.ac.id',
        '2411521002@student.unand.ac.id',
        '2411521003@student.unand.ac.id',
        '2311521005@student.unand.ac.id',
        '2311521006@student.unand.ac.id',
        '2311521007@student.unand.ac.id'
      ];
      
      const mhsRivaiUsers = await prisma.user.findMany({ where: { email: { in: mhsRivaiEmails } } });
      const mhsRivaiIds = mhsRivaiUsers.map(u => u.id);
      
      if (mhsRivaiIds.length > 0) {
        await prisma.mahasiswa.updateMany({
          where: { userId: { in: mhsRivaiIds } },
          data: { dosenPaId: dosenRivai.id }
        });
        console.log(`✅ Berhasil menghubungkan ${mhsRivaiIds.length} mahasiswa ke Dr. Ahmad Rivai`);
      } else {
        console.log('⚠️ Tidak ada mahasiswa Ahmad Rivai yang ditemukan di database. (Apakah emailnya sudah benar?)');
      }
    }

    // 2. Cari ID Dosen Sri Wahyuni
    const dosenSri = await prisma.user.findUnique({ where: { email: 'dosen.sri@unand.ac.id' } });
    if (!dosenSri) {
      console.log('❌ Dosen Sri Wahyuni tidak ditemukan!');
    } else {
      const mhsSriEmails = [
        '2410811001@student.unand.ac.id',
        '2410211001@student.unand.ac.id',
        '2410811002@student.unand.ac.id'
      ];
      
      const mhsSriUsers = await prisma.user.findMany({ where: { email: { in: mhsSriEmails } } });
      const mhsSriIds = mhsSriUsers.map(u => u.id);
      
      if (mhsSriIds.length > 0) {
        await prisma.mahasiswa.updateMany({
          where: { userId: { in: mhsSriIds } },
          data: { dosenPaId: dosenSri.id }
        });
        console.log(`✅ Berhasil menghubungkan ${mhsSriIds.length} mahasiswa ke Dr. Ir. Sri Wahyuni`);
      } else {
         console.log('⚠️ Tidak ada mahasiswa Sri Wahyuni yang ditemukan di database.');
      }
    }

  } catch (error) {
    console.error('❌ Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🏁 Selesai.');
    process.exit(0);
  }
};

run();
