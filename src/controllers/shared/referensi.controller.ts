import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

// Re-exports read-only matriks functions
export { getMatriksPoin, getKategori, getSkala, getPeran } from '../pimpinan/ditmawa/matriks.controller';

// GET /api/umum/fakultas
export const getFakultas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await prisma.fakultas.findMany({
      where: {
        deletedAt: null,
        NOT: { nama: { contains: 'Pascasarjana' } },
      },
      orderBy: { nama: 'asc' },
      select: { id: true, nama: true },
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

// GET /api/umum/prodi?fakultasId=X
export const getProdi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fakultasId } = req.query;
    const where: any = { deletedAt: null };
    if (fakultasId) where.fakultasId = Number(fakultasId);

    const data = await prisma.programStudi.findMany({
      where,
      orderBy: { nama: 'asc' },
      select: {
        id: true,
        nama: true,
        fakultasId: true,
        fakultas: { select: { id: true, nama: true } },
      },
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

// GET /api/umum/organisasi?tipe=UKM|UKMF
export const getOrganisasi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipe } = req.query;
    const where: any = { deletedAt: null };
    if (tipe === 'UKM' || tipe === 'UKMF') where.tipe = tipe;

    const data = await prisma.organisasi.findMany({
      where,
      orderBy: { nama: 'asc' },
      select: {
        id: true,
        nama: true,
        tipe: true,
        fakultasId: true,
        fakultas: { select: { id: true, nama: true } },
      },
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};
