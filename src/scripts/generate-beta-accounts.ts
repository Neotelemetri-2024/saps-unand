import prisma from '../lib/prisma';

const PASSWORD_HASH = '$2b$10$z9SyfgQKdbrg9pIl0Ks1PeeNmrDBxLOKrlYNas8IJZXYgAqHc3gVq'; // password123

const betaUsers = [
  // ================= DOSEN PA =================
  { email: 'ahmad.rivai@unand.ac.id', nama: 'Dr. Ahmad Rivai, M.T.', peran: 'dosen' },
  { email: 'dosen.sri@unand.ac.id', nama: 'Dr. Ir. Sri Wahyuni, M.Si.', peran: 'dosen' },

  // ================= MAHASISWA =================
  // Ahmad Rivai's students
  { email: '2411521001@student.unand.ac.id', nama: 'Fathur Rahman', peran: 'mahasiswa', nim: '2411521001', dosenEmail: 'ahmad.rivai@unand.ac.id', prodi: 'Sistem Informasi' },
  { email: '2411521002@student.unand.ac.id', nama: 'Annisa Salsabila', peran: 'mahasiswa', nim: '2411521002', dosenEmail: 'ahmad.rivai@unand.ac.id', prodi: 'Sistem Informasi' },
  { email: '2411521003@student.unand.ac.id', nama: 'M. Farhan Alfarisi', peran: 'mahasiswa', nim: '2411521003', dosenEmail: 'ahmad.rivai@unand.ac.id', prodi: 'Informatika' },
  { email: '2311521005@student.unand.ac.id', nama: 'Dimas Aditya', peran: 'mahasiswa', nim: '2311521005', dosenEmail: 'ahmad.rivai@unand.ac.id', prodi: 'Informatika' },
  { email: '2311521006@student.unand.ac.id', nama: 'Zahra Khairunnisa', peran: 'mahasiswa', nim: '2311521006', dosenEmail: 'ahmad.rivai@unand.ac.id', prodi: 'Informatika' },
  { email: '2311521007@student.unand.ac.id', nama: 'Gilang Ramadhan', peran: 'mahasiswa', nim: '2311521007', dosenEmail: 'ahmad.rivai@unand.ac.id', prodi: 'Informatika' },

  // Sri Wahyuni's students
  { email: '2410811001@student.unand.ac.id', nama: 'Rizky Pratama', peran: 'mahasiswa', nim: '2410811001', dosenEmail: 'dosen.sri@unand.ac.id', prodi: 'Ilmu Komunikasi' },
  { email: '2410211001@student.unand.ac.id', nama: 'Siti Nurhaliza', peran: 'mahasiswa', nim: '2410211001', dosenEmail: 'dosen.sri@unand.ac.id', prodi: 'Agroteknologi' },
  { email: '2410811002@student.unand.ac.id', nama: 'Budi Santoso', peran: 'mahasiswa', nim: '2410811002', dosenEmail: 'dosen.sri@unand.ac.id', prodi: 'Ilmu Komunikasi' }
];

const run = async () => {
  console.log('🚀 Memulai pembuatan Akun Beta Testing (HANYA Dosen PA dan Mahasiswa Sesuai PDF)...');

  try {
    for (const data of betaUsers) {
      // 1. Upsert Data User Utama
      const user = await prisma.user.upsert({
        where: { email: data.email },
        update: { nama: data.nama, passwordHash: PASSWORD_HASH, peran: data.peran as any },
        create: {
          email: data.email,
          nama: data.nama,
          passwordHash: PASSWORD_HASH,
          peran: data.peran as any,
          aktif: true
        }
      });

      // 2. Buat profil Dosen jika dia Dosen
      if (data.peran === 'dosen') {
        await prisma.dosen.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id, nidn: 'NIDN_' + user.id }
        });
        console.log(`👨‍🏫 Dosen PA Siap: ${user.nama}`);
      }

      // 3. Buat profil Mahasiswa jika dia Mahasiswa
      if (data.peran === 'mahasiswa' && data.nim && data.dosenEmail) {
        // Cari ID Dosen PA-nya
        const dosenPA = await prisma.user.findUnique({ where: { email: data.dosenEmail } });
        
        // Cari Prodi ID dummy (ambil prodi pertama yang ada, atau buat jika kosong)
        let prodi = await prisma.programStudi.findFirst({ where: { nama: data.prodi } });
        if (!prodi) {
          const fak = await prisma.fakultas.findFirst() || await prisma.fakultas.create({ data: { nama: 'Fakultas Dummy' } });
          prodi = await prisma.programStudi.create({ data: { nama: data.prodi, fakultasId: fak.id } });
        }

        await prisma.mahasiswa.upsert({
          where: { nim: data.nim },
          update: { dosenPaId: dosenPA?.id, prodiId: prodi.id },
          create: {
            userId: user.id,
            nim: data.nim,
            dosenPaId: dosenPA?.id,
            prodiId: prodi.id,
            angkatan: parseInt('20' + data.nim.substring(0, 2))
          }
        });
        console.log(`🎓 Mahasiswa Siap: ${user.nama} (Terhubung ke ${data.dosenEmail})`);
      }
    }

    console.log('✅ SEMUA AKUN DOSEN PA & MAHASISWA DARI PDF BERHASIL DIBUAT/DIPERBARUI!');
  } catch (error) {
    console.error('❌ Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

run();
