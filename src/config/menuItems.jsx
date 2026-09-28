// src/config/menuItems.jsx
import {
  LayoutDashboard,
  Users,
  CheckCircle,
  BookOpen,
  BarChart3,
  FileText,
  FileSpreadsheet,
  LayoutGrid,
  UserCheck,
  PlusCircle,
  Award,
  Search,
  UserCog,
  History,
  Target,
  FolderCheck,
  Building2,
} from 'lucide-react'

/* ── MAHASISWA ── */
export const mahasiswaMenu = [
  { path: '/mahasiswa/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  {
    path: '#',
    label: 'Kegiatan Eksternal',
    icon: <PlusCircle className="h-4 w-4" />,
    children: [
      { path: '/mahasiswa/kegiatan-eksternal', label: 'Ajukan Kegiatan Eksternal' },
      { path: '/mahasiswa/persetujuan-dosen', label: 'Persetujuan Dosen' },
      { path: '/mahasiswa/klaim-poin', label: 'Klaim Poin Eksternal' },
    ],
  },
  {
    path: '#',
    label: 'Kegiatan Internal',
    icon: <History className="h-4 w-4" />,
    children: [
      { path: '/mahasiswa/katalog-kegiatan-internal', label: 'Katalog & Pendaftaran' },
      { path: '/mahasiswa/riwayat-kegiatan-internal', label: 'Riwayat Kegiatan' },
    ],
  },
  { path: '/mahasiswa/riwayat-poin', label: 'Riwayat Poin', icon: <Award className="h-4 w-4" /> },
  {
    path: '#',
    label: 'Generate',
    icon: <FileText className="h-4 w-4" />,
    children: [
      { path: '/mahasiswa/generate-cv', label: 'CV' },
      { path: '/mahasiswa/generate-sertifikat', label: 'Sertifikat' },
    ],
  },
]

/* ── DOSEN PA ── */
export const dosenPAMenu = [
  { path: '/dosen/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/dosen/mahasiswa-bimbingan', label: 'Mahasiswa Bimbingan', icon: <Users className="h-4 w-4" /> },
  { path: '/dosen/permintaan-persetujuan', label: 'Permintaan Persetujuan', icon: <CheckCircle className="h-4 w-4" /> },
  { path: '/dosen/mahasiswa-perlu-perhatian', label: 'Mahasiswa Perlu Perhatian', icon: <Users className="h-4 w-4" /> },
]

/* ── PIMPINAN (Ditmawa / Fakultas / Utama) ── */
export const pimpinanDitmawaMenu = [
  { path: '/pimpinan_ditmawa/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/pimpinan_ditmawa/manajemen-kurikulum', label: 'Manajemen Kurikulum', icon: <BookOpen className="h-4 w-4" /> },
  { path: '/pimpinan_ditmawa/bobot-poin', label: 'Bobot Poin', icon: <BarChart3 className="h-4 w-4" /> },
  { path: '/pimpinan_ditmawa/laporan', label: 'Laporan & Evaluasi', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { path: '/pimpinan_ditmawa/monitoring-iku3', label: 'Monitoring IKU 3', icon: <Target className="h-4 w-4" /> },
  {
    path: '#',
    label: 'Verifikasi',
    icon: <FileText className="h-4 w-4" />,
    children: [
      { path: '/pimpinan_ditmawa/verifikasi-pengajuan-eksternal', label: 'Verifikasi Pengajuan Eksternal' },
      { path: '/pimpinan_ditmawa/verifikasi-pengajuan-internal', label: 'Verifikasi Pengajuan Internal' },
      { path: '/pimpinan_ditmawa/verifikasi-klaim', label: 'Verifikasi Klaim Poin Eksternal' },
    ],
  },
  { path: '/pimpinan_ditmawa/manajemen-akun', label: 'Manajemen Akun', icon: <UserCog className="h-4 w-4" /> },
  {
    path: '#',
    label: 'Manajemen Ormawa',
    icon: <Users className="h-4 w-4" />,
    children: [
      { path: '/pimpinan_ditmawa/manajemen-akun-ukm', label: 'Akun UKM Universitas' },
      { path: '/pimpinan_ditmawa/manajemen-akun-ukmf', label: 'Akun UKMF Fakultas' },
    ],
  },
  { path: '/pimpinan_ditmawa/manajemen-event', label: 'Event Global', icon: <Search className="h-4 w-4" /> },
  // { path: '/pimpinan_ditmawa/audit-log', label: 'Audit Log Sistem', icon: <History className="h-4 w-4" /> }, // Dinonaktifkan sementara untuk role Pimpinan Ditmawa
]
export const pimpinanFakultasMenu = [
  { path: '/pimpinan_fakultas/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/pimpinan_fakultas/manajemen-akun-admin', label: 'Manajemen Akun Admin', icon: <UserCog className="h-4 w-4" /> },

  { path: '/pimpinan_fakultas/laporan', label: 'Laporan & Evaluasi', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { path: '/pimpinan_fakultas/monitoring-iku3', label: 'Monitoring IKU 3 Fakultas', icon: <Building2 className="h-4 w-4" /> },
  {
    path: '#',
    label: 'Verifikasi',
    icon: <CheckCircle className="h-4 w-4" />,
    children: [
      { path: '/pimpinan_fakultas/verifikasi-pengajuan-ukmf', label: 'Verifikasi Pengajuan UKMF' },
      { path: '/pimpinan_fakultas/verifikasi-kegiatan-internal', label: 'Verifikasi Kegiatan Internal' },
    ],
  },
]
export const pimpinanUtamaMenu = [
  { path: '/pimpinan_utama/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/pimpinan_utama/detail-fakultas', label: 'Detail Fakultas', icon: <BarChart3 className="h-4 w-4" /> },
  { path: '/pimpinan_utama/laporan', label: 'Laporan & Evaluasi', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { path: '/pimpinan_utama/monitoring-iku3', label: 'Monitoring IKU 3', icon: <BarChart3 className="h-4 w-4" /> },
]

/* ── ADMIN DITMAWA ── */
export const adminDitmawaMenu = [
  { path: '/admin_ditmawa/dashboard', label: 'Dashboard', icon: <LayoutGrid className="h-4 w-4" />, end: true },
  { path: '/admin_ditmawa/monitoring-iku3', label: 'Monitoring IKU 3', icon: <FolderCheck className="h-4 w-4" /> },
  {
    path: '#',
    label: 'Verifikasi',
    icon: <FileText className="h-4 w-4" />,
    children: [
      { path: '/admin_ditmawa/verifikasi-pengajuan-eksternal', label: 'Verifikasi Pengajuan Eksternal' },
      { path: '/admin_ditmawa/verifikasi-pengajuan-internal', label: 'Verifikasi Pengajuan Internal' },
      { path: '/admin_ditmawa/verifikasi-klaim', label: 'Verifikasi Klaim Poin Eksternal' },
    ],
  },
  { path: '/admin_ditmawa/manajemen-event', label: 'Event Global', icon: <Search className="h-4 w-4" /> },
  { path: '/admin_ditmawa/manajemen-akun-ukm', label: 'Manajemen Akun UKM', icon: <UserCog className="h-4 w-4" /> },
]

/* ── ADMIN FAKULTAS ── */
export const adminFakultasMenu = [
  { path: '/admin_fakultas/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/admin_fakultas/monitoring-iku3', label: 'Monitoring IKU 3 Fakultas', icon: <Building2 className="h-4 w-4" /> },
  { path: '/admin_fakultas/verifikasi-pengajuan-ukmf', label: 'Verifikasi Pengajuan UKMF', icon: <CheckCircle className="h-4 w-4" /> },
  { path: '/admin_fakultas/manajemen-event', label: 'Event Fakultas', icon: <Search className="h-4 w-4" /> },
  { path: '/admin_fakultas/manajemen-akun-ukmf', label: 'Manajemen Akun UKMF', icon: <UserCog className="h-4 w-4" /> },
]
export const ukmMenu = [
  { path: '/operator_ukm/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/operator_ukm/daftar-kegiatan', label: 'Daftar Kegiatan', icon: <FileText className="h-4 w-4" /> },
]
export const ukmfMenu = [
  { path: '/operator_ukmf/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { path: '/operator_ukmf/daftar-kegiatan', label: 'Daftar Kegiatan', icon: <FileText className="h-4 w-4" /> },
]
// Objek ini berfungsi memetakan string role dari backend ke menu yang sesuai
export const roleMenus = {
  mahasiswa: mahasiswaMenu,
  dosen: dosenPAMenu,
  dosen_pa: dosenPAMenu,
  pimpinan_ditmawa: pimpinanDitmawaMenu,
  pimpinan_fakultas: pimpinanFakultasMenu,
  pimpinan_utama: pimpinanUtamaMenu,
  admin_ditmawa: adminDitmawaMenu,
  admin_fakultas: adminFakultasMenu,
  operator_ukm: ukmMenu,
  operator_ukmf: ukmfMenu,
}
