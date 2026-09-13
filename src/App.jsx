import { Toaster } from 'sonner'
import { Route, Routes, Outlet, Navigate } from 'react-router-dom'
import AuthGuard, { RoleGuard } from './components/AuthGuard'
import LoginPage from './pages/LoginPage'
import CvPublic from './pages/CvPublic'
import MahasiswaDashboard from './pages/mahasiswa/Dashboard'
import AjukanKegiatanEksternal from './pages/mahasiswa/AjukanKegiatanEksternal'
import AjukanKegiatanForm from './pages/mahasiswa/AjukanKegiatanForm'
import GenerateCV from './pages/mahasiswa/GenerateCV'
import GenerateSertifikat from './pages/mahasiswa/GenerateSertifikat'
import SertifikatValidasi from './pages/SertifikatValidasi'
import PersetujuanDosen from './pages/mahasiswa/PersetujuanDosen'
import KlaimPoinCapaian from './pages/mahasiswa/KlaimPoinCapaian'
import RiwayatPoin from './pages/mahasiswa/RiwayatPoin'
import RiwayatKegiatanInternal from './pages/mahasiswa/RiwayatKegiatanInternal'
import PesanDosenPA from './pages/mahasiswa/PesanDosenPA'
import AkunPengaturan from './pages/mahasiswa/AkunPengaturan'
import DetailPengajuanMahasiswa from './pages/mahasiswa/DetailPengajuan'
import DetailIzinPAMahasiswa from './pages/mahasiswa/DetailIzinPA'
import DetailKegiatanInternalMahasiswa from './pages/mahasiswa/DetailKegiatanInternal'
import Notifikasi from './pages/Notifikasi'
import DosenPADashboard from './pages/dosen/Dashboard'
import DosenPAMahasiswaBimbingan from './pages/dosen/MahasiswaBimbingan'
import DosenPADetail from './pages/dosen/Detail'
import PermintaanPersetujuan from './pages/dosen/PermintaanPersetujuan'
import DetailPersetujuanDosen from './pages/dosen/DetailPersetujuan'
import MahasiswaPerluPerhatian from './pages/dosen/MahasiswaPerluPerhatian'
import PimpinanDitmawaDashboard from './pages/pimpinan/DitmawaDashboard'
import PimpinanDitmawaVerifikasiPengajuanEksternal from './pages/pimpinan/VerifikasiPengajuanEksternal'
import PimpinanDitmawaDashboardNew from './pages/pimpinan_ditmawa/Dashboard'
import PimpinanDitmawaManajemenKurikulum from './pages/pimpinan_ditmawa/ManajemenKurikulum'
import PimpinanDitmawaTambahMatriks from './pages/pimpinan_ditmawa/TambahMatriks'
import PimpinanDitmawaBobotPoin from './pages/pimpinan_ditmawa/BobotPoin'
import PimpinanDitmawaEditPoin from './pages/pimpinan_ditmawa/EditPoin'
import PimpinanDitmawaVerifikasiEksternal from './pages/pimpinan_ditmawa/VerifikasiPengajuanEksternal'
import PimpinanDitmawaDetailVerifikasiEksternal from './pages/pimpinan_ditmawa/DetailVerifikasiPengajuanEksternal'
import PimpinanDitmawaVerifikasiInternal from './pages/pimpinan_ditmawa/VerifikasiPengajuanInternal'
import PimpinanDitmawaDetailVerifikasiInternal from './pages/pimpinan_ditmawa/DetailVerifikasiPengajuanInternal'
import PimpinanDitmawaValidasiKlaimPoin from './pages/pimpinan_ditmawa/ValidasiKlaimPoin'
import PimpinanDitmawaDetailValidasiKlaim from './pages/pimpinan_ditmawa/DetailValidasiKlaim'
import PimpinanDitmawaManajemenAkunUKM from './pages/pimpinan_ditmawa/ManajemenAkunUKM'
import PimpinanDitmawaManajemenAkunUKMF from './pages/pimpinan_ditmawa/ManajemenAkunUKMF'

import PimpinanDitmawaManajemenAkunPimpinan from './pages/pimpinan_ditmawa/ManajemenAkunPimpinan'
import PimpinanDitmawaManajemenAkunAdmin from './pages/pimpinan_ditmawa/ManajemenAkunAdmin'
import PimpinanDitmawaManajemenAkun from './pages/pimpinan_ditmawa/ManajemenAkun'
import PimpinanFakultasManajemenAkunAdmin from './pages/pimpinan_fakultas/ManajemenAkunAdminFakultas'
// import PimpinanDitmawaAuditLog from './pages/pimpinan_ditmawa/AuditLog'
import PimpinanDitmawaLayout from './layouts/PimpinanDitmawaLayout'
import PimpinanFakultasDashboard from './pages/pimpinan_fakultas/FakultasDashboard'
import PimpinanFakultasPersetujuan from './pages/pimpinan_fakultas/FakultasPersetujuan'
import PimpinanFakultasVerifikasiUKMF from './pages/pimpinan_fakultas/VerifikasiPengajuanUKMF'
import DetailVerifikasiUKMF from './pages/pimpinan_fakultas/DetailVerifikasiUKMF'
import PimpinanFakultasVerifikasiKegiatanInternal from './pages/pimpinan_fakultas/VerifikasiKegiatanInternal'
import PimpinanFakultasDetailVerifikasiKegiatanInternal from './pages/pimpinan_fakultas/DetailVerifikasiKegiatanInternal'
import PimpinanUtamaDashboard from './pages/pimpinan_utama/UtamaDashboard'
import DetailFakultas from './pages/pimpinan_utama/DetailFakultas'
import DetailFakultasProdi from './pages/pimpinan_utama/DetailFakultasProdi'
import LaporanPimpinan from './pages/pimpinan/LaporanPimpinan'
import MonitoringIku3 from './pages/pimpinan/MonitoringIku3'
import AdminDitmawaDashboard from './pages/admin_ditmawa/Dashboard'
import AdminDitmawaVerifikasiKlaim from './pages/admin_ditmawa/VerifikasiKlaimPoin'
import AdminDitmawaVerifikasiPengajuanEksternal from './pages/admin_ditmawa/VerifikasiPengajuanEksternal'
import AdminDitmawaDetailVerifikasiPengajuanEksternal from './pages/admin_ditmawa/DetailVerifikasiPengajuanEksternal'
import AdminDitmawaPemetaanCapaianMassal from './pages/admin_ditmawa/PemetaanCapaianMassal'
import AdminDitmawaManajemenAkunUKM from './pages/admin_ditmawa/ManajemenAkunUKM'
import AdminDitmawaManajemenEvent from './pages/admin_ditmawa/ManajemenEvent'
import AdminDitmawaManajemenPesertaEvent from './pages/admin_ditmawa/ManajemenPesertaEvent'
import DetailEvent from './pages/admin_ditmawa/DetailEvent'
import AdminDitmawaDetailVerifikasiKlaimPoin from './pages/admin_ditmawa/DetailVerifikasiKlaimPoin'
import AdminDitmawaVerifikasiPengajuanInternal from './pages/admin_ditmawa/VerifikasiPengajuanInternal'
import AdminDitmawaDetailVerifikasiPengajuanInternal from './pages/admin_ditmawa/DetailVerifikasiPengajuanInternal'
import SharedAkunPengaturan from './pages/shared/AkunPengaturan'
import AdminFakultasDashboard from './pages/admin/FakultasDashboard'
import AdminFakultasDashboardNew from './pages/admin_fakultas/Dashboard'
import AdminFakultasManajemenEvent from './pages/admin_fakultas/ManajemenEvent'
import AdminFakultasManajemenPesertaEvent from './pages/admin_fakultas/ManajemenPesertaEvent'
import AdminFakultasManajemenAkunUKMF from './pages/admin_fakultas/ManajemenAkunUKMF'
import AdminFakultasVerifikasiPengajuanUKMF from './pages/admin_fakultas/VerifikasiPengajuanUKMF'
import AdminFakultasDetailVerifikasiUKMF from './pages/admin_fakultas/DetailVerifikasiUKMF'
import UKMDashboard from './pages/operator_ukm/Dashboard'
import UKMDaftarKegiatan from './pages/operator_ukm/DaftarKegiatan'
import UKMBuatKegiatan from './pages/operator_ukm/BuatKegiatan'
import UKMManajemenPeserta from './pages/operator_ukm/ManajemenPeserta'
import UKMDetailKegiatan from './pages/operator_ukm/DetailKegiatan'
import UKMFDashboard from './pages/operator_ukmf/Dashboard'
import UKMFDaftarKegiatan from './pages/operator_ukmf/DaftarKegiatan'
import UKMFBuatKegiatan from './pages/operator_ukmf/BuatKegiatan'
import UKMFManajemenPeserta from './pages/operator_ukmf/ManajemenPeserta'
import UKMFDetailKegiatan from './pages/operator_ukmf/DetailKegiatan'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cv/public/:token" element={<CvPublic />} />
        <Route path="/sertifikat/validasi/:token" element={<SertifikatValidasi />} />

        {/* Mahasiswa */}
        <Route path="mahasiswa" element={<AuthGuard><RoleGuard allowedRoles={['mahasiswa']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<MahasiswaDashboard />} />
          <Route path="kegiatan-eksternal" element={<AjukanKegiatanEksternal />} />
          <Route path="kegiatan-eksternal/ajukan" element={<AjukanKegiatanForm />} />
          <Route path="kegiatan-eksternal/:id" element={<DetailPengajuanMahasiswa />} />
          <Route path="generate-cv" element={<GenerateCV />} />
          <Route path="generate-sertifikat" element={<GenerateSertifikat />} />
          <Route path="persetujuan-dosen" element={<PersetujuanDosen />} />
          <Route path="persetujuan-dosen/:id" element={<DetailIzinPAMahasiswa />} />
          <Route path="klaim-poin" element={<KlaimPoinCapaian />} />
          <Route path="riwayat-poin" element={<RiwayatPoin />} />
          <Route path="riwayat-kegiatan-internal" element={<RiwayatKegiatanInternal />} />
          <Route path="riwayat-kegiatan-internal/:id" element={<DetailKegiatanInternalMahasiswa />} />
          <Route path="pesan-dosen-pa" element={<PesanDosenPA />} />
          <Route path="pengaturan" element={<AkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Dosen PA */}
        <Route path="dosen" element={<AuthGuard><RoleGuard allowedRoles={['dosen', 'dosen_pa']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<DosenPADashboard />} />
          <Route path="mahasiswa-bimbingan" element={<DosenPAMahasiswaBimbingan />} />
          <Route path="lihat-detail/:nim" element={<DosenPADetail />} />
          <Route path="permintaan-persetujuan" element={<PermintaanPersetujuan />} />
          <Route path="permintaan-persetujuan/:id" element={<DetailPersetujuanDosen />} />
          <Route path="mahasiswa-perlu-perhatian" element={<MahasiswaPerluPerhatian />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Pimpinan Ditmawa */}
        <Route path="pimpinan_ditmawa" element={<AuthGuard><RoleGuard allowedRoles={['pimpinan_ditmawa']}><PimpinanDitmawaLayout /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<PimpinanDitmawaDashboardNew />} />
          <Route path="manajemen-kurikulum" element={<PimpinanDitmawaManajemenKurikulum />} />
          <Route path="tambah-matriks" element={<PimpinanDitmawaTambahMatriks />} />
          <Route path="bobot-poin" element={<PimpinanDitmawaBobotPoin />} />
          <Route path="edit-poin/:id" element={<PimpinanDitmawaEditPoin />} />
          <Route path="laporan" element={<LaporanPimpinan defaultRole="pimpinan_ditmawa" embedded />} />
          <Route path="monitoring-iku3" element={<MonitoringIku3 defaultRole="pimpinan_ditmawa" embedded />} />
          <Route path="verifikasi-klaim" element={<PimpinanDitmawaValidasiKlaimPoin />} />
          <Route path="verifikasi-klaim/:id" element={<PimpinanDitmawaDetailValidasiKlaim />} />
          <Route path="validasi-klaim" element={<PimpinanDitmawaValidasiKlaimPoin />} />
          <Route path="validasi-klaim/:id" element={<PimpinanDitmawaDetailValidasiKlaim />} />
          <Route path="verifikasi-pengajuan-eksternal" element={<PimpinanDitmawaVerifikasiEksternal />} />
          <Route path="verifikasi-pengajuan-eksternal/:id" element={<PimpinanDitmawaDetailVerifikasiEksternal />} />
          <Route path="verifikasi-pengajuan-internal" element={<PimpinanDitmawaVerifikasiInternal />} />
          <Route path="verifikasi-pengajuan-internal/:id" element={<PimpinanDitmawaDetailVerifikasiInternal />} />
          <Route path="manajemen-akun-ukm" element={<PimpinanDitmawaManajemenAkunUKM />} />
          <Route path="manajemen-akun-ukmf" element={<PimpinanDitmawaManajemenAkunUKMF />} />

          <Route path="manajemen-akun" element={<PimpinanDitmawaManajemenAkun />} />
          <Route path="manajemen-akun-pimpinan" element={<PimpinanDitmawaManajemenAkunPimpinan />} />
          <Route path="manajemen-akun-admin" element={<PimpinanDitmawaManajemenAkunAdmin />} />
          <Route path="manajemen-event" element={<AdminDitmawaManajemenEvent />} />
          <Route path="manajemen-event/:id" element={<DetailEvent role="pimpinan_ditmawa" userRole="Pimpinan Ditmawa" />} />
          <Route path="manajemen-peserta-event" element={<AdminDitmawaManajemenPesertaEvent />} />
          <Route path="manajemen-peserta-event/:id" element={<AdminDitmawaManajemenPesertaEvent />} />
          <Route path="manajemen-event/:id/peserta" element={<AdminDitmawaManajemenPesertaEvent />} />
          {/* <Route path="audit-log" element={<PimpinanDitmawaAuditLog />} /> */}
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Pimpinan Fakultas */}
        <Route path="pimpinan_fakultas" element={<AuthGuard><RoleGuard allowedRoles={['pimpinan_fakultas']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<PimpinanFakultasDashboard />} />
          <Route path="manajemen-akun-admin" element={<PimpinanFakultasManajemenAkunAdmin />} />
          <Route path="laporan" element={<LaporanPimpinan defaultRole="pimpinan_fakultas" />} />
          <Route path="monitoring-iku3" element={<MonitoringIku3 defaultRole="pimpinan_fakultas" />} />
          <Route path="persetujuan" element={<PimpinanFakultasPersetujuan />} />
          <Route path="verifikasi-pengajuan-ukmf" element={<PimpinanFakultasVerifikasiUKMF />} />
          <Route path="verifikasi-pengajuan-ukmf/:id" element={<DetailVerifikasiUKMF />} />
          <Route path="verifikasi-kegiatan-internal" element={<PimpinanFakultasVerifikasiKegiatanInternal />} />
          <Route path="verifikasi-kegiatan-internal/:id" element={<PimpinanFakultasDetailVerifikasiKegiatanInternal />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Pimpinan Utama */}
        <Route path="pimpinan_utama" element={<AuthGuard><RoleGuard allowedRoles={['pimpinan_utama']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<PimpinanUtamaDashboard />} />
          <Route path="detail-fakultas" element={<DetailFakultas />} />
          <Route path="detail-fakultas/:fakultas" element={<DetailFakultasProdi />} />
          <Route path="laporan" element={<LaporanPimpinan defaultRole="pimpinan_utama" />} />
          <Route path="monitoring-iku3" element={<MonitoringIku3 defaultRole="pimpinan_utama" />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin Ditmawa */}
        <Route path="admin_ditmawa" element={<AuthGuard><RoleGuard allowedRoles={['admin_ditmawa']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<AdminDitmawaDashboard />} />
          <Route path="monitoring-iku3" element={<MonitoringIku3 defaultRole="admin_ditmawa" />} />
          <Route path="verifikasi-pengajuan-eksternal" element={<AdminDitmawaVerifikasiPengajuanEksternal />} />
          <Route path="verifikasi-pengajuan-eksternal/:id" element={<AdminDitmawaDetailVerifikasiPengajuanEksternal />} />
          <Route path="pemetaan-capaian-massal" element={<AdminDitmawaPemetaanCapaianMassal />} />
          <Route path="verifikasi-klaim" element={<AdminDitmawaVerifikasiKlaim />} />
          <Route path="verifikasi-klaim/:id" element={<AdminDitmawaDetailVerifikasiKlaimPoin />} />
          <Route path="verifikasi-pengajuan-internal" element={<AdminDitmawaVerifikasiPengajuanInternal />} />
          <Route path="verifikasi-pengajuan-internal/:id" element={<AdminDitmawaDetailVerifikasiPengajuanInternal />} />
          <Route path="manajemen-akun-ukm" element={<AdminDitmawaManajemenAkunUKM />} />
          <Route path="manajemen-event" element={<AdminDitmawaManajemenEvent />} />
          <Route path="manajemen-event/:id" element={<DetailEvent role="admin_ditmawa" userRole="Admin Ditmawa" />} />
          <Route path="manajemen-peserta-event" element={<AdminDitmawaManajemenPesertaEvent />} />
          <Route path="manajemen-peserta-event/:id" element={<AdminDitmawaManajemenPesertaEvent />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin Fakultas */}
        <Route path="admin_fakultas" element={<AuthGuard><RoleGuard allowedRoles={['admin_fakultas']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<AdminFakultasDashboardNew />} />
          <Route path="monitoring-iku3" element={<MonitoringIku3 defaultRole="admin_fakultas" />} />
          <Route path="manajemen-event" element={<AdminFakultasManajemenEvent />} />
          <Route path="manajemen-event/:id" element={<DetailEvent role="admin_fakultas" userRole="Admin Fakultas" />} />
          <Route path="manajemen-event/:id/peserta" element={<AdminFakultasManajemenPesertaEvent />} />
          <Route path="manajemen-akun-ukmf" element={<AdminFakultasManajemenAkunUKMF />} />
          <Route path="verifikasi-pengajuan-ukmf" element={<AdminFakultasVerifikasiPengajuanUKMF />} />
          <Route path="verifikasi-pengajuan-ukmf/:id" element={<AdminFakultasDetailVerifikasiUKMF />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* UKM */}
        <Route path="operator_ukm" element={<AuthGuard><RoleGuard allowedRoles={['operator_ukm']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<UKMDashboard />} />
          <Route path="daftar-kegiatan" element={<UKMDaftarKegiatan />} />
          <Route path="buat-kegiatan" element={<UKMBuatKegiatan />} />
          <Route path="daftar-kegiatan/:id" element={<UKMDetailKegiatan role="operator_ukm" userRole="UKM" />} />
          <Route path="daftar-kegiatan/:id/manajemen-peserta" element={<UKMManajemenPeserta />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* UKMF */}
        <Route path="operator_ukmf" element={<AuthGuard><RoleGuard allowedRoles={['operator_ukmf']}><Outlet /></RoleGuard></AuthGuard>}>
          <Route path="dashboard" element={<UKMFDashboard />} />
          <Route path="daftar-kegiatan" element={<UKMFDaftarKegiatan />} />
          <Route path="daftar-kegiatan/:id" element={<UKMFDetailKegiatan role="operator_ukmf" userRole="UKMF" />} />
          <Route path="daftar-kegiatan/:id/manajemen-peserta" element={<UKMFManajemenPeserta />} />
          <Route path="buat-kegiatan" element={<UKMFBuatKegiatan />} />
          <Route path="pengaturan" element={<SharedAkunPengaturan />} />
          <Route path="notifikasi" element={<Notifikasi />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}

export default App
