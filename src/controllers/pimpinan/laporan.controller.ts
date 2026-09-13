import { Request, Response, NextFunction } from 'express';
import { getLaporanData } from '../../services/laporan/dataLaporan.service';
import { generateExcelLaporan } from '../../services/laporan/excelLaporan.service';
import { generatePdfLaporan } from '../../services/laporan/pdfLaporan.service';

/**
 * GET /api/pimpinan/laporan/preview
 * Mengambil ringkasan data laporan dalam format JSON untuk ditampilkan di UI dashboard pimpinan
 */
export const getPreviewLaporan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const effectiveRole = user.peran === 'staff' && user.jabatan ? user.jabatan : user.peran;
    const { fakultasId, prodiId, angkatan, tahunAkademik, kurikulumId } = req.query;

    const data = await getLaporanData({
      role: effectiveRole,
      userId: BigInt(user.id),
      fakultasId: fakultasId ? Number(fakultasId) : undefined,
      prodiId: prodiId ? Number(prodiId) : undefined,
      angkatan: angkatan ? Number(angkatan) : undefined,
      tahunAkademik: tahunAkademik ? String(tahunAkademik) : undefined,
      kurikulumId: kurikulumId ? Number(kurikulumId) : undefined,
      isPreview: true,
    });

    res.status(200).json({
      success: true,
      message: 'Data preview laporan berhasil dimuat',
      data,
    });
  } catch (error: any) {
    console.error('[getPreviewLaporan]', error);
    next(error);
  }
};

/**
 * GET /api/pimpinan/laporan/excel
 * Download laporan evaluasi & riset pimpinan dalam format Excel (.xlsx)
 */
export const downloadExcelLaporan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const effectiveRole = user.peran === 'staff' && user.jabatan ? user.jabatan : user.peran;
    const { fakultasId, prodiId, angkatan, tahunAkademik, kurikulumId } = req.query;

    const data = await getLaporanData({
      role: effectiveRole,
      userId: BigInt(user.id),
      fakultasId: fakultasId ? Number(fakultasId) : undefined,
      prodiId: prodiId ? Number(prodiId) : undefined,
      angkatan: angkatan ? Number(angkatan) : undefined,
      tahunAkademik: tahunAkademik ? String(tahunAkademik) : undefined,
      kurikulumId: kurikulumId ? Number(kurikulumId) : undefined,
    });

    const csvBuffer = await generateExcelLaporan(data);

    const safeScope = data.scopeNama.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Laporan_MY_UNAND_STUDENT_CONNECT_${safeScope}_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', csvBuffer.length);

    res.status(200).send(csvBuffer);
  } catch (error: any) {
    console.error('[downloadExcelLaporan]', error);
    next(error);
  }
};

/**
 * GET /api/pimpinan/laporan/pdf
 * Download laporan resmi evaluasi pimpinan dalam format PDF (.pdf)
 */
export const downloadPdfLaporan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const effectiveRole = user.peran === 'staff' && user.jabatan ? user.jabatan : user.peran;
    const { fakultasId, prodiId, angkatan, tahunAkademik, kurikulumId } = req.query;

    const data = await getLaporanData({
      role: effectiveRole,
      userId: BigInt(user.id),
      fakultasId: fakultasId ? Number(fakultasId) : undefined,
      prodiId: prodiId ? Number(prodiId) : undefined,
      angkatan: angkatan ? Number(angkatan) : undefined,
      tahunAkademik: tahunAkademik ? String(tahunAkademik) : undefined,
      kurikulumId: kurikulumId ? Number(kurikulumId) : undefined,
    });

    const pdfBuffer = await generatePdfLaporan(data);

    const safeScope = data.scopeNama.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Laporan_MY_UNAND_STUDENT_CONNECT_${safeScope}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.status(200).send(pdfBuffer);
  } catch (error: any) {
    console.error('[downloadPdfLaporan]', error);
    next(error);
  }
};
