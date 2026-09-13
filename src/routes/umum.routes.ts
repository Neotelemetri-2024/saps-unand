import { Router } from "express";
import { authenticateJWT, authorizeRole } from "../middlewares/auth.middleware";
import {
  getNotifikasi,
  bacaNotifikasi,
  bacaSemuaNotifikasi,
  getAuditLog,
} from "../controllers/shared/notifikasi.controller";
import { dashboardAdminDitmawa } from "../controllers/admin/ditmawa/dashboard.controller";
import { dashboardPimpinanDitmawa } from "../controllers/pimpinan/ditmawa/dashboard.controller";
import { dashboardPimpinanFakultas } from "../controllers/pimpinan/fakultas/dashboard.controller";
import {
  getDashboardPimpinanUtama,
  getDetailFakultasPimpinanUtama,
} from "../controllers/pimpinan/utama/dashboard.controller";
import { getDashboardFakultas } from "../controllers/admin/fakultas/dashboard.controller";
import { getPortofolio } from "../controllers/shared/portofolio.controller";
import {
  getFakultas,
  getProdi,
  getOrganisasi,
} from "../controllers/shared/referensi.controller";
import { getPublicCv } from "../controllers/mahasiswa/cv.controller";
import { getValidasiSertifikat } from "../controllers/mahasiswa/sertifikat.controller";
import {
  siaSyncAll,
  siaSyncFakultas,
  siaSyncProdi,
  siaSyncDosenPA,
  siaSyncMahasiswa,
  siaSyncKelasMbkm,
  siaCleanup,
  getSiaSyncStatus,
} from "../controllers/admin/ditmawa/siaSync.controller";

const router = Router();

// Public CV Route (No JWT required)
router.get("/cv/public/:token", getPublicCv);
router.get("/sertifikat/validasi/:token", getValidasiSertifikat);

router.use(authenticateJWT);

// ─── REFERENSI MASTER (semua role) ────────────────────────────────────────────
router.get("/fakultas", getFakultas);
router.get("/prodi", getProdi);
router.get("/organisasi", getOrganisasi);

// ─── NOTIFIKASI (semua role) ──────────────────────────────────────────────────
router.get("/notifikasi", getNotifikasi);
router.put("/notifikasi/baca-semua", bacaSemuaNotifikasi);
router.put("/notifikasi/:id/baca", bacaNotifikasi);

// ─── AUDIT LOG (Dinonaktifkan sementara — un-comment jika client meminta diaktifkan kembali) ───
// router.get("/audit-log", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), getAuditLog);

// ─── DASHBOARD per ROLE ───────────────────────────────────────────────────────
router.get(
  "/dashboard/admin-ditmawa",
  authorizeRole("admin_ditmawa"),
  dashboardAdminDitmawa,
);
router.get(
  "/dashboard/pimpinan-ditmawa",
  authorizeRole("pimpinan_ditmawa"),
  dashboardPimpinanDitmawa,
);
router.get(
  "/dashboard/pimpinan-fakultas",
  authorizeRole("pimpinan_fakultas"),
  dashboardPimpinanFakultas,
);
router.get(
  "/dashboard/pimpinan-utama",
  authorizeRole("pimpinan_utama"),
  getDashboardPimpinanUtama,
);
router.get(
  "/dashboard/pimpinan-utama/fakultas/:id",
  authorizeRole("pimpinan_utama"),
  getDetailFakultasPimpinanUtama,
);
router.get(
  "/dashboard/admin-fakultas",
  authorizeRole("admin_fakultas"),
  getDashboardFakultas,
);

// ─── PORTOFOLIO / CV ──────────────────────────────────────────────────────────
router.get(
  "/portofolio/:mahasiswaId",
  authorizeRole("mahasiswa", "dosen", "admin_ditmawa", "pimpinan_ditmawa", "pimpinan_utama"),
  getPortofolio,
);

// ─── SINKRONISASI DATA SIA (Admin & Pimpinan Ditmawa) ─────────────────────────
router.get("/sia/status", authorizeRole("admin_ditmawa", "pimpinan_ditmawa", "pimpinan_utama"), getSiaSyncStatus);
router.post("/sia/sync", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), siaSyncAll);
router.post("/sia/sync/fakultas", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), siaSyncFakultas);
router.post("/sia/sync/prodi", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), siaSyncProdi);
router.post("/sia/sync/dosen", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), siaSyncDosenPA);
router.post("/sia/sync/mahasiswa", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), siaSyncMahasiswa);
router.post("/sia/sync/kelas-mbkm", authorizeRole("admin_ditmawa", "pimpinan_ditmawa"), siaSyncKelasMbkm);
router.post("/sia/cleanup", authorizeRole("pimpinan_ditmawa"), siaCleanup);

export default router;
