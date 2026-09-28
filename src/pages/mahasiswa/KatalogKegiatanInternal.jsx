import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, MapPin, Users, ArrowRight, ChevronLeft, ChevronRight, Info, X, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { getCurrentUser } from '../../services/authService'
import { get, post, del } from '../../services/apiClient'
import { toast } from 'sonner'
import StatusBadge from '../../components/dashboard/StatusBadge'

function formatTanggal(value) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

function StatusPendaftaranBadge({ status }) {
  const map = {
    belum_daftar: null,
    menunggu_izin_pa: { label: 'Menunggu Izin PA', color: 'badge-warning' },
    terdaftar: { label: 'Terdaftar', color: 'badge-success' },
    disetujui_pa: { label: 'Disetujui PA', color: 'badge-success' },
    ditolak_pa: { label: 'Ditolak PA', color: 'badge-error' },
    hadir: { label: 'Hadir', color: 'badge-info' },
    dibatalkan: { label: 'Dibatalkan', color: 'badge-ghost' },
  }
  const info = map[status]
  if (!info) return null
  return <span className={`badge badge-sm ${info.color}`}>{info.label}</span>
}

function DetailModal({ kegiatan, onClose, onDaftar, onBatalkan, loading }) {
  if (!kegiatan) return null

  const bisaDaftar = !kegiatan.sudahDaftar && (kegiatan.sisaKuota === null || kegiatan.sisaKuota > 0)
  const bisaBatalkan = kegiatan.sudahDaftar && ['menunggu_izin_pa', 'terdaftar', 'disetujui_pa'].includes(kegiatan.statusPendaftaran)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-base-100 p-6 shadow-xl">
        <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3">
          <X className="h-4 w-4" />
        </button>

        <h2 className="pr-8 text-lg font-bold text-base-content">{kegiatan.nama}</h2>

        <div className="mt-4 space-y-3 text-sm text-base-content/80">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium">Kategori:</span> {kegiatan.kategori} · <span className="font-medium">Skala:</span> {kegiatan.skala}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium">Penyelenggara:</span> {kegiatan.penyelenggara}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium">Tanggal:</span> {formatTanggal(kegiatan.tanggalMulai)} — {formatTanggal(kegiatan.tanggalSelesai)}
            </div>
          </div>
          {kegiatan.lokasi && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <span className="font-medium">Lokasi:</span> {kegiatan.lokasi}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium">Kuota:</span>{' '}
              {kegiatan.kuota ? `${kegiatan.jumlahPendaftar}/${kegiatan.kuota} (Sisa: ${kegiatan.sisaKuota})` : 'Tidak dibatasi'}
            </div>
          </div>
          {kegiatan.tanpaPersetujuanPa && (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <CheckCircle className="mr-1 inline h-3.5 w-3.5" />
              Kegiatan ini tidak memerlukan persetujuan Dosen PA
            </div>
          )}
          {kegiatan.deskripsi && (
            <div className="mt-2">
              <p className="font-medium text-base-content">Deskripsi:</p>
              <p className="mt-1 whitespace-pre-line text-base-content/70">{kegiatan.deskripsi}</p>
            </div>
          )}
        </div>

        {/* Status Pendaftaran */}
        {kegiatan.sudahDaftar && (
          <div className="mt-4 rounded-lg border border-base-300 bg-base-200 px-4 py-3">
            <p className="text-xs font-medium text-base-content/60">Status Pendaftaran Anda:</p>
            <div className="mt-1">
              <StatusPendaftaranBadge status={kegiatan.statusPendaftaran} />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex gap-2">
          {bisaDaftar && (
            <button onClick={() => onDaftar(kegiatan.id)} disabled={loading} className="btn btn-primary btn-sm flex-1">
              {loading ? <span className="loading loading-spinner loading-xs" /> : null}
              {kegiatan.tanpaPersetujuanPa ? 'Daftar Langsung' : 'Daftar & Minta Izin PA'}
            </button>
          )}
          {bisaBatalkan && (
            <button onClick={() => onBatalkan(kegiatan.id)} disabled={loading} className="btn btn-error btn-outline btn-sm">
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'Batalkan'}
            </button>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KatalogKegiatanInternal() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [selectedKegiatan, setSelectedKegiatan] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get('/api/mahasiswa/kegiatan-internal/katalog', { page, limit: 10, search: search || undefined })
      setData(res?.data || [])
      setPagination(res?.pagination || { total: 0, totalPages: 1 })
    } catch (err) {
      toast.error(err.message || 'Gagal memuat katalog kegiatan')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    fetchData()
  }

  const handleDaftar = async (kegiatanId) => {
    setActionLoading(true)
    try {
      const res = await post(`/api/mahasiswa/kegiatan-internal/katalog/${kegiatanId}/daftar`)
      toast.success(res?.message || 'Pendaftaran berhasil!')
      setSelectedKegiatan(null)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Gagal mendaftar kegiatan')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBatalkan = async (kegiatanId) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pendaftaran?')) return
    setActionLoading(true)
    try {
      const res = await del(`/api/mahasiswa/kegiatan-internal/katalog/${kegiatanId}/daftar`)
      toast.success(res?.message || 'Pendaftaran dibatalkan')
      setSelectedKegiatan(null)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Gagal membatalkan pendaftaran')
    } finally {
      setActionLoading(false)
    }
  }

  const openDetail = async (kegiatanId) => {
    try {
      const res = await get(`/api/mahasiswa/kegiatan-internal/katalog/${kegiatanId}`)
      setSelectedKegiatan(res?.data || null)
    } catch (err) {
      toast.error(err.message || 'Gagal memuat detail kegiatan')
    }
  }

  return (
    <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-base-content">Katalog Kegiatan Internal</h1>
            <p className="text-sm text-base-content/60">Temukan dan daftar kegiatan internal kampus yang tersedia</p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
            <input
              type="text"
              placeholder="Cari kegiatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input-bordered input-sm w-full pl-9"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Cari</button>
        </form>

        {/* Tabel Kegiatan */}
        <div className="card bg-base-100">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="bg-primary text-xs font-semibold uppercase tracking-wide text-primary-content">
                  <th className="w-10">No</th>
                  <th>Kegiatan</th>
                  <th>Kategori</th>
                  <th>Skala</th>
                  <th>Penyelenggara</th>
                  <th>Tanggal</th>
                  <th className="text-center">Kuota</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}><div className="h-4 w-full animate-pulse rounded bg-base-300" /></td>
                      ))}
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-base-content/50">
                      Belum ada kegiatan internal yang tersedia saat ini.
                    </td>
                  </tr>
                ) : (
                  data.map((kg, i) => {
                    const bisaDaftar = !kg.sudahDaftar && (kg.sisaKuota === null || kg.sisaKuota > 0)
                    return (
                      <tr key={kg.id} className="hover">
                        <td className="text-base-content/60">{(page - 1) * 10 + i + 1}</td>
                        <td>
                          <div className="max-w-[200px]">
                            <p className="truncate font-medium text-base-content">{kg.nama}</p>
                            {kg.tanpaPersetujuanPa && (
                              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-success">
                                <CheckCircle className="h-3 w-3" /> Tanpa Izin PA
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-base-content/70">{kg.kategori}</td>
                        <td className="text-base-content/70">{kg.skala}</td>
                        <td className="text-base-content/70">{kg.penyelenggara}</td>
                        <td className="whitespace-nowrap text-base-content/70">{formatTanggal(kg.tanggalMulai)}</td>
                        <td className="text-center">
                          {kg.kuota ? (
                            <span className={`text-xs font-medium ${kg.sisaKuota === 0 ? 'text-error' : 'text-base-content'}`}>
                              {kg.sisaKuota}/{kg.kuota}
                            </span>
                          ) : (
                            <span className="text-xs text-base-content/50">∞</span>
                          )}
                        </td>
                        <td className="text-center">
                          <StatusPendaftaranBadge status={kg.statusPendaftaran} />
                          {!kg.sudahDaftar && <span className="text-xs text-base-content/40">—</span>}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openDetail(kg.id)}
                              className="btn btn-ghost btn-xs"
                              title="Detail"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                            {bisaDaftar && (
                              <button
                                onClick={() => handleDaftar(kg.id)}
                                disabled={actionLoading}
                                className="btn btn-primary btn-xs"
                              >
                                Daftar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
              <p className="text-xs text-base-content/60">
                Menampilkan {data.length} dari {pagination.total} kegiatan
              </p>
              <div className="join">
                <button
                  className="btn join-item btn-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="btn join-item btn-xs pointer-events-none">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  className="btn join-item btn-xs"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail */}
      {selectedKegiatan && (
        <DetailModal
          kegiatan={selectedKegiatan}
          onClose={() => setSelectedKegiatan(null)}
          onDaftar={handleDaftar}
          onBatalkan={handleBatalkan}
          loading={actionLoading}
        />
      )}
    </DashboardLayout>
  )
}
