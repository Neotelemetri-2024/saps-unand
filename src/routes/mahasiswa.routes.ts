import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ajukanIzinPA, getRiwayatIzin, getCatatanPA } from '../controllers/mahasiswa/izin_pa.controller';
import {
  ajukanKegiatanEksternal,
  getRiwayatPengajuan,
  simpanDraftKegiatanEksternal,
  editDraftKegiatanEksternal,
  hapusDraftKegiatanEksternal,
  ajukanDraftKegiatanEksternal,
  getKegiatanEksternalTerdaftar,
} from '../controllers/mahasiswa/kegiatan_eksternal.controller';
import { getKegiatanTersedia, ajukanKlaimEksternal, getRiwayatKlaimEksternal } from '../controllers/mahasiswa/klaim_eksternal.controller';
import { getDashboard, getRiwayatPoin, getRiwayatKegiatanInternal, getKurikulumMahasiswa } from '../controllers/mahasiswa/dashboard.controller';
import { authenticateJWT, authorizeRole } from '../middlewares/auth.middleware';
import { getPrivateCv, generatePublicCvToken } from '../controllers/mahasiswa/cv.controller';
import { connectLinkedIn, shareCvToLinkedIn, getLinkedInStatus, disconnectLinkedIn } from '../controllers/mahasiswa/linkedin.controller';
import { downloadSertifikatMahasiswa } from '../controllers/mahasiswa/sertifikat.controller';

const router = Router();

// Setup Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 } // Maks 1MB
});

// Middleware: Hanya role mahasiswa yang bisa mengakses rute ini
router.use(authenticateJWT);
router.use(authorizeRole('mahasiswa'));

// Dashboard
router.get('/dashboard', getDashboard);

// Riwayat Poin
router.get('/riwayat-poin', getRiwayatPoin);

// Riwayat Kegiatan Internal
router.get('/riwayat-kegiatan-internal', getRiwayatKegiatanInternal);

// Kurikulum mahasiswa yang sedang login
router.get('/kurikulum', getKurikulumMahasiswa);

// Izin Dosen PA
router.post('/izin-pa', ajukanIzinPA);
router.get('/izin-pa', getRiwayatIzin);
router.get('/saran-pa', getCatatanPA);


// Pengajuan Kegiatan Eksternal
router.get('/kegiatan-eksternal/terdaftar', getKegiatanEksternalTerdaftar);
router.get('/kegiatan-eksternal', getRiwayatPengajuan);
router.post('/kegiatan-eksternal', ajukanKegiatanEksternal);
router.post('/kegiatan-eksternal/draft', simpanDraftKegiatanEksternal);
router.put('/kegiatan-eksternal/:id/draft', editDraftKegiatanEksternal);
router.delete('/kegiatan-eksternal/:id/draft', hapusDraftKegiatanEksternal);
router.put('/kegiatan-eksternal/:id/ajukan', ajukanDraftKegiatanEksternal);

// Klaim Poin Eksternal
router.get('/klaim-eksternal/kegiatan-tersedia', getKegiatanTersedia);
router.post('/klaim-eksternal', upload.single('bukti'), ajukanKlaimEksternal);
router.get('/klaim-eksternal', getRiwayatKlaimEksternal);

// CV, Portofolio & Sertifikat
router.get('/cv', getPrivateCv);
router.post('/cv/generate-link', generatePublicCvToken);
router.get('/sertifikat/download', downloadSertifikatMahasiswa);

// Share native ke LinkedIn (OAuth + Posts API)
router.get('/linkedin/status', getLinkedInStatus);
router.get('/linkedin/connect', connectLinkedIn);
router.delete('/linkedin/disconnect', disconnectLinkedIn);
router.post('/linkedin/share', shareCvToLinkedIn);

export default router;
