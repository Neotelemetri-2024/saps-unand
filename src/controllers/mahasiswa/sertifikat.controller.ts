import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveKurikulumMahasiswa } from '../../services/kurikulumResolver.service';
import { createSertifikatPdf, hitungKategoriSaps, MahasiswaSertifikatData } from '../../services/sertifikat/generatorSertifikat.service';

/** Susun data sertifikat dari profil dan perolehan poin sah mahasiswa. */
export async function buildSertifikatDataForMahasiswa(mahasiswaId: bigint): Promise<MahasiswaSertifikatData | null> {
  const mahasiswa = await prisma.mahasiswa.findFirst({
    where: { userId: mahasiswaId, deletedAt: null, user: { deletedAt: null } },
    include: {
      user: { select: { nama: true } },
      prodi: { include: { fakultas: true } },
      kurikulum: true,
    },
  });

  if (!mahasiswa) return null;

  const kurikulum = await resolveKurikulumMahasiswa(mahasiswa, prisma, { includeStructure: true });
  const semuaPerolehan = await prisma.perolehanPoin.findMany({
    where: { mahasiswaId, status: 'sah' },
    include: {
      detail: {
        include: {
          subCapaian: { include: { capaian: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const perolehan = semuaPerolehan.filter((poin) => {
    if (Number(poin.kurikulumId) === kurikulum.id) return true;
    return poin.detail.some(
      (detail) => Number(detail.subCapaian?.capaian?.kurikulumId) === kurikulum.id,
    );
  });

  const bidangMap = new Map<number, {
    nama: string;
    kredit: number;
    urutan: number;
    subCapaianMap: Map<number, { nama: string; poin: number; urutan: number }>;
  }>();

  for (const [index, capaian] of (kurikulum.capaian || []).entries()) {
    bidangMap.set(capaian.id, {
      nama: capaian.nama,
      kredit: 0,
      urutan: capaian.urutan ?? index,
      subCapaianMap: new Map(
        (capaian.subCapaian || []).map((sub: any, subIndex: number) => [
          sub.id,
          { nama: sub.nama, poin: 0, urutan: subIndex },
        ]),
      ),
    });
  }

  for (const poin of perolehan) {
    let detailSum = 0;
    for (const detail of poin.detail || []) {
      const sub = detail.subCapaian;
      const capaian = sub?.capaian;
      if (!sub || !capaian || capaian.kurikulumId !== kurikulum.id) continue;
      const bidang = bidangMap.get(capaian.id);
      if (!bidang) continue;
      const nilai = Number(detail.poin || 0);
      bidang.kredit += nilai;
      detailSum += nilai;
      const item = bidang.subCapaianMap.get(sub.id) || {
        nama: sub.nama,
        poin: 0,
        urutan: bidang.subCapaianMap.size,
      };
      item.poin += nilai;
      bidang.subCapaianMap.set(sub.id, item);
    }

    const selisih = Number(poin.totalPoin || 0) - detailSum;
    if (selisih > 0) {
      const capaianDefault = bidangMap.values().next().value;
      if (capaianDefault) capaianDefault.kredit += selisih;
    }
  }

  const bidang = [...bidangMap.values()].sort((a, b) => a.urutan - b.urutan);
  const rekapBidang = bidang.map((item, index) => ({
    no: index + 1,
    nama: item.nama,
    kredit: item.kredit,
  }));
  const rincianCapaian = bidang
    .map((item, index) => ({
      nama: `${index + 1}. ${item.nama}`,
      items: [...item.subCapaianMap.values()]
        .filter((sub) => sub.poin > 0)
        .sort((a, b) => a.urutan - b.urutan)
        .map(({ nama, poin }) => ({ nama, poin })),
    }))
    .filter((item) => item.items.length > 0);
  const totalKredit = rekapBidang.reduce((sum, item) => sum + item.kredit, 0);

  return {
    nama: mahasiswa.user.nama || '-',
    tempatTanggalLahir: '-',
    nim: mahasiswa.nim,
    fakultas: mahasiswa.prodi?.fakultas?.nama || '-',
    prodi: mahasiswa.prodi?.nama || '-',
    totalKredit,
    kategoriStatus: hitungKategoriSaps(totalKredit),
    rekapBidang,
    rincianCapaian,
  };
}

async function sendCertificate(res: Response, data: MahasiswaSertifikatData, mahasiswaId: bigint) {
  const filename = `Sertifikat-SAPS-${data.nim}.pdf`;
  const token = randomBytes(24).toString('hex');
  const issuance = await prisma.sertifikatPenerbitan.create({
    data: { token, mahasiswaId, snapshot: data as any },
  });
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  try {
    const pdf = await createSertifikatPdf(data, `${frontendUrl}/sertifikat/validasi/${token}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    await prisma.sertifikatPenerbitan.delete({ where: { id: issuance.id } }).catch(() => undefined);
    throw error;
  }
}

/** GET /api/mahasiswa/sertifikat/download */
export const getValidasiSertifikat = async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{48}$/.test(token)) {
    res.status(404).json({ success: false, valid: false, message: 'Sertifikat tidak ditemukan' });
    return;
  }
  const issuance = await prisma.sertifikatPenerbitan.findUnique({ where: { token } });
  if (!issuance) {
    res.status(404).json({ success: false, valid: false, message: 'Sertifikat tidak ditemukan' });
    return;
  }
  const snapshot = issuance.snapshot as unknown as MahasiswaSertifikatData;
  const maskedNim = snapshot.nim.length > 6
    ? `${snapshot.nim.slice(0, 3)}${'*'.repeat(snapshot.nim.length - 6)}${snapshot.nim.slice(-3)}`
    : snapshot.nim;
  res.json({
    success: true,
    valid: !issuance.dicabutAt,
    revoked: Boolean(issuance.dicabutAt),
    data: {
      nama: snapshot.nama,
      nim: maskedNim,
      fakultas: snapshot.fakultas,
      prodi: snapshot.prodi,
      totalKredit: snapshot.totalKredit,
      kategoriStatus: snapshot.kategoriStatus,
      diterbitkanAt: issuance.diterbitkanAt,
    },
  });
};

export const downloadSertifikatMahasiswa = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await buildSertifikatDataForMahasiswa(BigInt(req.user!.id));
    if (!data) {
      res.status(404).json({ success: false, message: 'Data mahasiswa tidak ditemukan' });
      return;
    }
    await sendCertificate(res, data, BigInt(req.user!.id));
  } catch (error) {
    console.error('Error generating sertifikat mahasiswa:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Gagal generate sertifikat SAPS' });
  }
};
