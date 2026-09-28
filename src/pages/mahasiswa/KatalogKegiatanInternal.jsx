import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, MapPin, Users, ArrowRight, ChevronLeft, ChevronRight, Info, X, CheckCircle, Clock, XCircle, AlertCircle, MoreHorizontal } from 'lucide-react'
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

function StatusKegiatanBadge({ status }) {
  if (status === 'Berlangsung') {
    return <span className="badge badge-sm badge-success">Berlangsung</span>
  }
  if (status === 'Berakhir') {
    return <span className="badge badge-sm badge-ghost">Berakhir</span>
  }
  return <span className="badge badge-sm">{status}</span>
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

  const handleDaftar = async (kegiatanId, namaKegiatan) => {
    if (!confirm(`Apakah Anda yakin ingin mendaftar pada kegiatan "${namaKegiatan}"?`)) return
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

  const openDetail = (kegiatanId) => {
    navigate(`/mahasiswa/katalog-kegiatan-internal/${kegiatanId}`)
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
                          <StatusKegiatanBadge status={kg.statusKegiatan} />
                        </td>
                        <td className="text-center">
                          <div className="dropdown dropdown-end">
                            <label tabIndex={0} className="btn btn-ghost btn-xs btn-circle m-1">
                              <MoreHorizontal className="h-4 w-4" />
                            </label>
                            <ul tabIndex={0} className="dropdown-content menu rounded-box z-[1] w-32 bg-base-100 p-2 shadow">
                              <li>
                                <button onClick={() => openDetail(kg.id)} className="text-xs">Detail</button>
                              </li>
                              {bisaDaftar && kg.statusKegiatan === 'Berlangsung' && (
                                <li>
                                  <button onClick={() => handleDaftar(kg.id, kg.nama)} disabled={actionLoading} className="text-xs text-primary">Daftar</button>
                                </li>
                              )}
                            </ul>
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

    </DashboardLayout>
  )
}
