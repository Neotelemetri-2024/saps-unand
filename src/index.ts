import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

// Fix BigInt serialization in JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Import Routes
import authRoutes from './routes/auth.routes';
import kurikulumRoutes from './routes/kurikulum.routes';
import matriksRoutes from './routes/matriks.routes';
import kegiatanRoutes from './routes/kegiatan.routes';
import klaimRoutes from './routes/klaim.routes';
import umumRoutes from './routes/umum.routes';
import organisasiRoutes from './routes/organisasi.routes';
import organisasiFakultasRoutes from './routes/organisasi_fakultas.routes';
import pesertaRoutes from './routes/peserta.routes';
import { getPublicCvOgPage, getPublicCvImage } from './controllers/mahasiswa/cv.controller';
import { getValidasiSertifikat } from './controllers/mahasiswa/sertifikat.controller';
import { linkedinCallback } from './controllers/mahasiswa/linkedin.controller';
import { initializeFirebase } from './lib/fcm';
import { initSiaScheduler } from './services/sia/siaScheduler.service';

dotenv.config();

// Inisialisasi Firebase Cloud Messaging (Push Notification)
initializeFirebase();

const app = express();
const port = process.env.PORT || 3000;

// Di balik proxy/ngrok, header X-Forwarded-For dipakai rate-limit untuk IP client
app.set('trust proxy', 1);

// ==================== SECURITY MIDDLEWARES ====================
app.use(helmet());

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // Allow all origins during development & testing
  },
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 2000,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false, xForwardedForHeader: false },
  keyGenerator: (req) => {
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return rawIp.replace(/:\d+$/, '');
  },
});
app.use('/api/', limiter);

// Mencegah hacker mengirim payload raksasa yang membuat server down (DoS)
app.use(express.json({ limit: '10kb' }));

// Serve uploaded files statically (boleh diakses lintas origin dari SPA)
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// ==================== ROUTES ====================
// Health Check
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to MyUnand Student Connect API!',
    version: '2.0.0',
    schema: '29 tabel — arsitektur baru',
    endpoints: {
      auth: '/api/auth',
      kurikulum: '/api/kurikulum',
      matriks: '/api/matriks',
      kegiatan: '/api/kegiatan',
      partisipasi: '/api/partisipasi',
      klaim: '/api/klaim',
      notifikasi: '/api/umum/notifikasi',
      auditLog: '/api/umum/audit-log',
      dashboard: '/api/umum/dashboard/{role}',
      portofolio: '/api/umum/portofolio/{mahasiswaId}',
    },
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Validasi QR sertifikat harus publik dan didaftarkan sebelum router berautentikasi.
app.get('/api/umum/sertifikat/validasi/:token', getValidasiSertifikat);

// Halaman "og-page" CV publik — target link share LinkedIn (lihat cv.controller.ts).
// Didaftarkan di root (bukan /api) karena URL ini yang di-crawl LinkedIn/Facebook/dll
// dan dibagikan langsung ke pengguna. Bot dilayani HTML + meta OG; manusia di-redirect ke SPA.
app.get('/cv/public/:token', getPublicCvOgPage);
// Gambar kartu ringkasan CV (og:image) yang dirujuk dari halaman og-page di atas.
app.get('/cv/public/:token/image.png', getPublicCvImage);

// OAuth callback LinkedIn — publik, karena LinkedIn redirect browser tidak membawa JWT.
app.get('/api/mahasiswa/linkedin/callback', linkedinCallback);

// ==================== SWAGGER API DOCS ====================
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Auth (Login — Publik, tanpa middleware)
app.use('/api/auth', authRoutes);

// Kurikulum & Matriks Poin (Pimpinan Ditmawa)
app.use('/api/kurikulum', kurikulumRoutes);
app.use('/api/matriks', matriksRoutes);

// Kegiatan & Approval (UKM/UKMF, Admin, Pimpinan)
app.use('/api/kegiatan', kegiatanRoutes);

// Manajemen Peserta Kegiatan (UKM/UKMF, Admin)
app.use('/api/kegiatan', pesertaRoutes);

// Manajemen Organisasi & Akun UKM (Admin)
app.use('/api/organisasi', organisasiRoutes);
app.use('/api/organisasi-fakultas', organisasiFakultasRoutes);

// (Rute partisipasi telah dipindahkan ke dosen.routes.ts dan mahasiswa.routes.ts)

import mahasiswaRoutes from './routes/mahasiswa.routes';
import dosenRoutes from './routes/dosen.routes';
import ukmRoutes from './routes/ukm.routes';
import staffRoutes from './routes/staff.routes';

// Klaim Poin & Perolehan (Mahasiswa, Validator, Admin)
app.use('/api/klaim', klaimRoutes);

// Manajemen Akun Staff (Pimpinan)
app.use('/api/staff', staffRoutes);

// Khusus Mahasiswa
app.use('/api/mahasiswa', mahasiswaRoutes);

// Khusus Dosen PA
app.use('/api/dosen', dosenRoutes);

// Khusus Operator UKM
app.use('/api/ukm', ukmRoutes);

// Umum: Notifikasi, Audit Log, Dashboard, Portofolio
app.use('/api/umum', umumRoutes);

// Laporan & Evaluasi Pimpinan (Excel, PDF, Preview)
import laporanRoutes from './routes/laporan.routes';
app.use('/api/pimpinan/laporan', laporanRoutes);

// Monitoring IKU 3 Kemdiktisaintek Berdampak 2026
import iku3Routes from './routes/iku3.routes';
app.use('/api/iku3', iku3Routes); // Prisma client must include Iku3Target / Iku3BobotRule

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[ERROR]', err?.stack || err?.message || err);
  res.status(err?.status || 500).json({
    success: false,
    message: err?.message || 'Terjadi kesalahan internal server',
  });
});

// ==================== START SERVER ====================
app.listen(port, () => {
  console.log(`[server]: MyUnand Student Connect API v2.0`);
  console.log(`[server]: Running at http://localhost:${port}`);
  console.log(`[server]: Swagger UI at http://localhost:${port}/api-docs`);
  console.log(`[server]: Schema: 29 tabel (MySQL)`);

  // Inisialisasi background scheduler untuk sinkronisasi otomatis SIA
  initSiaScheduler();
});

