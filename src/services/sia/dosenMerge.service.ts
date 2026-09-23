import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const autoMergeDuplicateDosen = async () => {
  console.log('[AutoMerge] 🔍 Memulai pengecekan duplikasi akun Dosen (SSO vs SIA)...');
  try {
    // 1. Cari semua Dosen SSO (email tidak berakhiran @dosen.unand.ac.id)
    const ssoDosenList = await prisma.user.findMany({
      where: {
        peran: 'dosen',
        email: { not: { endsWith: '@dosen.unand.ac.id' } },
      },
      include: {
        dosen: {
          include: {
            mahasiswaBimbingan: {
              select: { userId: true },
              take: 1
            }
          }
        }
      }
    });

    for (const ssoUser of ssoDosenList) {
      // Jika sudah punya mahasiswa bimbingan, abaikan (sudah aman)
      if (ssoUser.dosen?.mahasiswaBimbingan && ssoUser.dosen.mahasiswaBimbingan.length > 0) {
        continue;
      }

      // STRICT MATCHING LOGIC
      // Ambil kata-kata dari nama SSO, abaikan gelar umum dan singkatan (1-2 huruf)
      const nameParts = ssoUser.nama
        .toLowerCase()
        .split(/[\s,\.]+/)
        .filter(p => p.length > 2 && !['dosen', 'prof', 'eng', 's.t', 'm.t', 'spd', 'mpd', 'phd', 'dr.', 'dr', 'dra'].includes(p));
        
      if (nameParts.length === 0) continue; // Nama terlalu pendek, lewati demi keamanan

      // Cari akun Dummy SIA (email @dosen.unand.ac.id)
      const allDummyDosen = await prisma.user.findMany({
        where: {
          peran: 'dosen',
          email: { endsWith: '@dosen.unand.ac.id' },
        },
        include: {
          dosen: true
        }
      });

      // Filter manual di memori agar lebih akurat (Semua 'kata' dari SSO harus ada di nama Dummy)
      const dummyCandidates = allDummyDosen.filter(dummy => {
        const dummyNameLower = dummy.nama.toLowerCase();
        // Setiap kata kunci dari nama SSO harus ditemukan di nama Dummy
        return nameParts.every(part => dummyNameLower.includes(part));
      });

      // SYARAT MUTLAK: Hanya boleh digabung jika ketemu TEPAT 1 kandidat dummy.
      if (dummyCandidates.length === 1) {
        const dummyUser = dummyCandidates[0];
        console.log(`[AutoMerge] ✨ Menemukan kecocokan SANGAT AKURAT untuk '${ssoUser.nama}' -> '${dummyUser.nama}'`);
        
        // 1. Pindahkan mahasiswa dari dummy ke SSO
        if (dummyUser.dosen) {
           await prisma.mahasiswa.updateMany({
             where: { dosenPaId: dummyUser.id },
             data: { dosenPaId: ssoUser.id }
           });
        }
        
        // 2. Update nama dan NIDN/NIP akun SSO agar sesuai standar SIA (mengambil dari dummy)
        await prisma.user.update({
          where: { id: ssoUser.id },
          data: { nama: dummyUser.nama }
        });
        
        if (ssoUser.dosen && dummyUser.dosen?.nidn) {
          await prisma.dosen.update({
            where: { userId: ssoUser.id },
            data: { nidn: dummyUser.dosen.nidn }
          });
        }

        // 3. Hapus akun dummy
        if (dummyUser.dosen) {
          await prisma.dosen.delete({ where: { userId: dummyUser.id } });
        }
        await prisma.user.delete({ where: { id: dummyUser.id } });
        
        console.log(`[AutoMerge] ✅ Berhasil menggabungkan akun & memindahkan mahasiswa ke ${ssoUser.email}`);
      } else if (dummyCandidates.length > 1) {
        console.log(`[AutoMerge] ⚠️ Batal menggabungkan '${ssoUser.nama}'. Ditemukan ${dummyCandidates.length} kandidat (Berpotensi salah sambung).`);
      }
    }
    
    console.log('[AutoMerge] 🏁 Selesai pengecekan duplikasi akun Dosen.');
  } catch (error) {
    console.error('[AutoMerge] ❌ Terjadi kesalahan saat auto-merge:', error);
  }
};
