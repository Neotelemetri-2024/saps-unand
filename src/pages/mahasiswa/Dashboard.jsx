import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import DataTable from '../../components/dashboard/DataTable'
import { RadarChartCJ } from '../../components/charts'
import ProgressBar from '../../components/dashboard/ProgressBar'
import { getCurrentUser } from '../../services/authService'
import { get } from '../../services/apiClient'
import { getPersetujuanMahasiswa } from '../../services/pengajuanService'
import { getPengajuan } from '../../services/pengajuanService'
import { getKlaim } from '../../services/poinService'
import { TableCard, TableFrame } from '../../components/dashboard/TableFrame'
import PanduanCard from '../../components/dashboard/PanduanCard'
import { CardGridSkeleton, ChartSkeleton, ListItemSkeleton, Skeleton } from '../../components/dashboard/Skeleton'
import StatusBadge from '../../components/dashboard/StatusBadge'

function LihatSelengkapnyaButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-outline btn-primary btn-sm"
    >
      Lihat selengkapnya
    </button>
  )
}

function buildProgressLabel(pct) {
  if (pct >= 100) return 'Selesai'
  return 'Berlangsung'
}

function formatTanggal(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s || s === '-') return null
  // Sudah diformat di service (mis. "19 Agu 2026") — jangan parse ulang
  if (/[a-zA-ZÀ-ÿ]/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s) && !/T\d{2}:/.test(s)) return s
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

function formatTanggalJam(value) {
  if (!value) return null
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return null
    const tanggal = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${tanggal}, ${jam}`
  } catch {
    return null
  }
}

function KegiatanCell({ nama, diajukanPada }) {
  const tanggal = formatTanggal(diajukanPada)
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-base-content">{nama || '-'}</p>
      {tanggal && <p className="text-xs text-base-content/60">Diajukan: {tanggal}</p>}
    </div>
  )
}
function KegiatanInternalPreview() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/api/mahasiswa/kegiatan-internal/katalog', { page: 1, limit: 5 })
      .then((res) => setItems(res?.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <TableFrame>
        <DataTable
          columns={[
            { key: '_no', label: 'No' },
            { key: 'nama', label: 'Kegiatan' },
            { key: 'kategori', label: 'Kategori' },
            { key: 'penyelenggara', label: 'Penyelenggara' },
            { key: 'tanggal', label: 'Tanggal' },
            { key: 'status', label: 'Status', center: true },
          ]}
          data={[]}
          loading={true}
          emptyText="Memuat..."
        />
      </TableFrame>
    )
  }

  return (
    <TableFrame>
      <DataTable
        columns={[
          { key: '_no', label: 'No' },
          { key: 'nama', label: 'Kegiatan', render: (row) => (
            <div className="max-w-[200px]">
              <p className="truncate text-base-content">{row.nama}</p>
              <p className="text-xs text-base-content/50">{row.penyelenggara}</p>
            </div>
          )},
          { key: 'kategori', label: 'Kategori' },
          { key: 'skala', label: 'Skala' },
          { key: 'tanggal', label: 'Tanggal', render: (row) => formatTanggal(row.tanggalMulai) },
          { key: 'kuota', label: 'Kuota', center: true, render: (row) => row.kuota ? `${row.sisaKuota}/${row.kuota}` : '∞' },
          { key: 'aksi', label: 'Aksi', center: true, render: (row) => (
            <button
              onClick={() => navigate('/mahasiswa/katalog-kegiatan-internal')}
              className="btn btn-ghost btn-xs text-primary"
            >
              Lihat
            </button>
          )},
        ]}
        data={items.map((r, i) => ({ ...r, _no: i + 1 }))}
        loading={false}
        emptyText="Belum ada kegiatan internal yang tersedia."
      />
    </TableFrame>
  )
}

const FALLBACK_RADAR = [
  { label: 'Fondasi', value: 0 },
  { label: 'Penguatan', value: 0 },
  { label: 'Pemantapan', value: 0 },
  { label: 'Aktualisasi', value: 0 },
]

function MahasiswaDashboard() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [dashData, setDashData] = useState(null)
  const [loadingDash, setLoadingDash] = useState(true)
  const [persetujuan, setPersetujuan] = useState([])
  const [pengajuan, setPengajuan] = useState([])
  const [klaim, setKlaim] = useState([])
  const [loadingTables, setLoadingTables] = useState(true)
  const [saranPa, setSaranPa] = useState([])
  const [loadingSaran, setLoadingSaran] = useState(true)

  useEffect(() => {
    get('/api/mahasiswa/dashboard')
      .then((res) => setDashData(res?.data || res))
      .catch(() => setDashData(null))
      .finally(() => setLoadingDash(false))

    get('/api/mahasiswa/saran-pa')
      .then((res) => {
        const list = res?.data || res || []
        setSaranPa(Array.isArray(list) ? list : [])
      })
      .catch(() => setSaranPa([]))
      .finally(() => setLoadingSaran(false))

    Promise.all([
      getPersetujuanMahasiswa().catch(() => []),
      getPengajuan().catch(() => []),
      getKlaim().catch(() => []),
    ]).then(([p, e, k]) => {
      setPersetujuan(Array.isArray(p) ? p : [])
      setPengajuan(Array.isArray(e) ? e : [])
      setKlaim(Array.isArray(k) ? k : [])
    }).finally(() => setLoadingTables(false))
  }, [])

  const rawProgres = dashData?.progresTahunan || dashData?.progressTahun || []
  const progressData = (Array.isArray(rawProgres) ? rawProgres : []).map((item) => {
    const current = item.poinProgres ?? Math.min(item.poinTerkumpul ?? 0, item.targetPoin ?? 1)
    const target = item.targetPoin ?? item.target ?? 1
    const pct = item.persentase ?? (target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0)
    return {
      tahun: item.nama || `Tahun ${item.urutan || ''}`,
      current,
      target,
      pct,
      poinLebih: item.poinLebih || 0,
      label: buildProgressLabel(pct),
      onTrack: pct >= 100,
    }
  })

  const totalPoinProgres = dashData?.totalPoinProgres ?? progressData.reduce((sum, t) => sum + (t.current || 0), 0)
  const maxPoin = dashData?.totalTarget ?? 0
  const pctTotal = dashData?.persentaseTotal ?? (maxPoin > 0 ? Math.min(100, Math.round((totalPoinProgres / maxPoin) * 100)) : 0)

  const radarRaw = dashData?.radarData || dashData?.radar || dashData?.capaian || FALLBACK_RADAR
  const radarLabels = radarRaw.map((d) => d.label || d.nama || '')
  const radarValues = radarRaw.map((d) => d.value ?? d.poin ?? 0)

  return (
    <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="card min-w-0 bg-base-100 p-4 sm:p-6">
            <h2 className="text-xl font-extrabold text-base-content sm:text-2xl lg:text-3xl">
              Selamat Datang,<br />{user?.nama || 'Mahasiswa'}!
            </h2>
            <p className="mt-3 max-w-lg text-sm text-base-content/60">
              Pantau aktivitas akademik, capaian poin, dan sertifikasi kamu secara real-time.
            </p>
            {dashData?.kurikulumNama ? (
              <p className="mt-2 text-sm text-base-content/70">
                Kurikulum: <span className="font-medium text-base-content">{dashData.kurikulumNama}</span>
                {dashData?.angkatan ? ` · Angkatan ${dashData.angkatan}` : ''}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-base-content/60">Poin Target Kelulusan</p>
              <span className={`badge badge-sm ${
                dashData?.isLulus || pctTotal >= 100 ? 'badge-success' : 'badge-warning'
              }`}>
                {dashData?.isLulus || pctTotal >= 100 ? 'Memenuhi Syarat Kelulusan' : 'Belum Memenuhi Syarat'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-end gap-6">
              <div className="flex items-baseline">
                {loadingDash ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  <span className="text-4xl font-extrabold text-base-content">{totalPoinProgres}</span>
                )}
                <span className="text-lg font-semibold text-base-content/50">/{maxPoin} poin</span>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-base-300">
                  <div className="h-2.5 rounded-full bg-brand-dark transition-all" style={{ width: `${Math.min(pctTotal, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl bg-gradient-to-b from-brand-dark to-brand-light px-3 py-5 text-center shadow-sm sm:px-4 sm:py-6">
            <h3 className="text-sm font-bold text-white">Radar Karakter Andalasian</h3>
            <div className="mx-auto mt-2 w-full max-w-[290px]">
              {loadingDash ? (
                <ChartSkeleton variant="radar" height={200} />
              ) : (
                <RadarChartCJ labels={radarLabels} values={radarValues} darkBg height={200} />
              )}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-base-content">Progres poin kelulusan</h3>
              <p className="mt-0.5 text-sm text-base-content/60">
                {loadingDash ? '…' : totalPoinProgres}/{maxPoin} poin ({pctTotal}%)
              </p>
            </div>
            <LihatSelengkapnyaButton onClick={() => navigate('/mahasiswa/riwayat-poin')} />
          </div>
          {loadingDash ? (
            <CardGridSkeleton />
          ) : progressData.length === 0 ? (
            <p className="py-8 text-center text-sm text-base-content/50">Belum ada data progress kurikulum.</p>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {progressData.map((item, index) => (
                <div key={index} className="rounded-lg border border-base-300 px-4 py-3 text-center">
                  <p className="text-xs text-base-content/60">{item.tahun}</p>
                  <p className="mt-1 text-2xl font-extrabold leading-none text-base-content">
                    {item.current}
                    <span className="text-sm font-normal text-base-content/60">/{item.target} poin</span>
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs text-base-content/60">
                    {item.onTrack ? <CheckCircle className="h-3.5 w-3.5 text-base-content" /> : null}
                    <span>{item.label}</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={item.current} max={item.target || 1} height={6} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kegiatan Internal Terbaru (Katalog) */}
        <TableCard
          title="Kegiatan Internal Terbaru"
          headerRight={<LihatSelengkapnyaButton onClick={() => navigate('/mahasiswa/katalog-kegiatan-internal')} />}
        >
          <KegiatanInternalPreview />
        </TableCard>

        {/* Pesan dari Dosen PA */}
        <div className="card bg-base-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-base-content">Pesan dari Dosen PA</h3>
            <LihatSelengkapnyaButton onClick={() => navigate('/mahasiswa/pesan-dosen-pa')} />
          </div>
          {loadingSaran ? (
            <div className="mt-3">
              <ListItemSkeleton rows={3} />
            </div>
          ) : saranPa.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-content/50">Belum ada pesan dari Dosen PA.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {saranPa.slice(0, 3).map((s) => {
                const waktu = formatTanggalJam(s.createdAt || s.tanggal)
                return (
                  <div key={s.id} className="rounded-lg border border-base-300 bg-base-200 px-4 py-3">
                    <p className="text-sm leading-relaxed text-base-content">{s.isi}</p>
                    <p className="mt-1 text-xs text-base-content/50">
                      {waktu ? `${waktu} · ` : ''}Dosen PA
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tabel Pengajuan Eksternal */}
        <TableCard
          title="Riwayat Pengajuan Kegiatan Eksternal"
          headerRight={<LihatSelengkapnyaButton onClick={() => navigate('/mahasiswa/kegiatan-eksternal')} />}
        >
          <TableFrame>
            <DataTable
              columns={[
                { key: '_no', label: 'No' },
                { key: 'kegiatan', label: 'Kegiatan', render: (row) => <KegiatanCell nama={row.kegiatan || row.namaKegiatan} diajukanPada={row.tanggalPengajuan || row.dibuatPada || row.createdAt} /> },
                { key: 'jenis', label: 'Jenis' },
                { key: 'penyelenggara', label: 'Penyelenggara' },
                { key: 'tanggal', label: 'Tanggal', render: (row) => formatTanggal(row.tanggalPelaksanaan || row.tanggalMulai || row.tanggal) || '-' },
                { key: 'status', label: 'Status', center: true, render: (row) => <div className="flex w-full items-center justify-center text-center"><StatusBadge status={row.status} /></div> },
              ]}
              data={pengajuan.slice(0, 5).map((r, i) => ({ ...r, _no: i + 1 }))}
              loading={loadingTables}
              emptyText="Belum ada data."
            />
          </TableFrame>
        </TableCard>

        {/* Tabel Persetujuan Dosen */}
        <TableCard
          title="Riwayat Persetujuan Dosen PA"
          headerRight={<LihatSelengkapnyaButton onClick={() => navigate('/mahasiswa/persetujuan-dosen')} />}
        >
          <TableFrame>
            <DataTable
              columns={[
                { key: '_no', label: 'No' },
                { key: 'kegiatan', label: 'Kegiatan', render: (row) => <KegiatanCell nama={row.kegiatan || row.namaKegiatan} diajukanPada={row.tanggalDiajukan || row.createdAt} /> },
                { key: 'jenis', label: 'Jenis' },
                { key: 'peran', label: 'Peran' },
                { key: 'penyelenggara', label: 'Penyelenggara' },
                { key: 'tanggal', label: 'Tanggal', render: (row) => formatTanggal(row.tanggalPelaksanaan || row.tanggalMulai || row.tanggal) || '-' },
                { key: 'status', label: 'Status', center: true, render: (row) => <div className="flex w-full items-center justify-center text-center"><StatusBadge status={row.status} /></div> },
              ]}
              data={persetujuan.slice(0, 5).map((r, i) => ({ ...r, _no: i + 1 }))}
              loading={loadingTables}
              emptyText="Belum ada data."
            />
          </TableFrame>
        </TableCard>

        {/* Tabel Klaim Poin */}
        <TableCard
          title="Riwayat Klaim Poin"
          headerRight={<LihatSelengkapnyaButton onClick={() => navigate('/mahasiswa/klaim-poin')} />}
        >
          <TableFrame>
            <DataTable
              columns={[
                { key: '_no', label: 'No' },
                { key: 'kegiatan', label: 'Kegiatan', render: (row) => <KegiatanCell nama={row.namaKegiatan || row.kegiatan} diajukanPada={row.tanggalKlaim || row.createdAt} /> },
                { key: 'jenis', label: 'Jenis', render: (row) => row.jenisKegiatan || row.jenis || '-' },
                { key: 'peran', label: 'Peran' },
                { key: 'poin', label: 'Poin', render: (row) => <span className="tabular-nums text-base-content">{row.poin ?? '-'}</span> },
                { key: 'status', label: 'Status', center: true, render: (row) => <div className="flex w-full items-center justify-center text-center"><StatusBadge status={row.status} /></div> },
              ]}
              data={klaim.slice(0, 5).map((r, i) => ({ ...r, _no: i + 1 }))}
              loading={loadingTables}
              emptyText="Belum ada data."
            />
          </TableFrame>
        </TableCard>

        <PanduanCard
          className="max-w-lg"
          title="Manual Book User Mahasiswa"
          description="Panduan Penggunaan Website MY UNAND STUDENT CONNECT untuk Mahasiswa"
        />
      </div>
    </DashboardLayout>
  )
}

export default MahasiswaDashboard
