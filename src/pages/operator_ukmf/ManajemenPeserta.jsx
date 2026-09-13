import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Info, Search, Download, UploadCloud, UserPlus, Trash2 } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import StatCard from '../../components/dashboard/StatCard'
import DataTable from '../../components/dashboard/DataTable'
import ConfirmModal from '../../components/ui/ConfirmModal'
import ActionMenu from '../../components/ui/ActionMenu'
import { DetailBackButton } from '../../components/ui/DetailComponents'
import { KehadiranSelect, PeranSelect } from '../../components/dashboard/PesertaFields'
import { getCurrentUser } from '../../services/authService'
import {
  getKegiatanById,
  getPesertaKegiatanFull,
  updatePesertaKegiatan,
  importPesertaCSV,
  downloadTemplatePeserta,
  submitPoinPeserta,
  hapusPesertaKegiatan,
} from '../../services/kegiatanService'
import { getPeranKegiatan } from '../../services/matriksService'
import { TableCard, TableFrame } from '../../components/dashboard/TableFrame'
import TambahPesertaModal from '../../components/ui/TambahPesertaModal'
import {
  pesertaResetFilterBtnClass,
  pesertaDownloadBtnClass,
  pesertaImportBtnClass,
  pesertaTambahBtnClass,
  pesertaEditBtnClass,
  pesertaBatalBtnClass,
  pesertaSubmitBtnClass,
} from '../../components/dashboard/pesertaToolbarStyles'

function formatTanggal(val) {
  if (!val) return ''
  try {
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return String(val)
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(val)
  }
}

function mapPesertaRow(p, i) {
  const peranId = p.peran?.id ?? p.peranVerifId ?? p.peranId ?? ''
  let hadir = null
  if (p.kehadiran === true || p.kehadiran === 'Hadir' || p.hadir === true) hadir = true
  else if (p.kehadiran === false || p.kehadiran === 'Tidak Hadir' || p.hadir === false) hadir = false
  return {
    ...p,
    no: i + 1,
    id: p.partisipasiId ?? p.id,
    partisipasiId: p.partisipasiId ?? p.id,
    nama: p.namaMahasiswa || p.nama || p.mahasiswa?.user?.nama || '-',
    nim: p.nim || p.mahasiswa?.nim || '-',
    prodi: p.programStudi || p.prodi || p.mahasiswa?.prodi?.nama || '-',
    fakultas: p.fakultas || p.mahasiswa?.prodi?.fakultas?.nama || '-',
    hadir,
    peranVerifId: peranId !== '' && peranId != null ? String(peranId) : '',
  }
}

function ManajemenPeserta() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = getCurrentUser()
  const fileRef = useRef(null)

  const [kegiatan, setKegiatan] = useState({ nama: 'Kegiatan', tanggal: '', lokasi: '' })
  const [pesertaData, setPesertaData] = useState([])
  const [peranOptions, setPeranOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [filterKehadiran, setFilterKehadiran] = useState('semua')
  const [isEditing, setIsEditing] = useState(false)
  const [pesertaToDelete, setPesertaToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showTambahModal, setShowTambahModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const loadData = () => {
    setLoading(true)
    getKegiatanById(id)
      .then(async (keg) => {
        if (keg) {
          setKegiatan({
            nama: keg.nama || keg.judul || 'Kegiatan',
            tanggal: formatTanggal(keg.tanggalMulai || keg.tanggal || keg.tgl || ''),
            lokasi: keg.lokasi || '',
          })
          const kategoriId = keg.kategoriId || keg.kategori?.id
          if (kategoriId) {
            try {
              const peran = await getPeranKegiatan(kategoriId)
              setPeranOptions(Array.isArray(peran) ? peran : [])
            } catch {
              setPeranOptions([])
            }
          }
        }
        const full = await getPesertaKegiatanFull(id)
        if (Array.isArray(full?.peranTersedia) && full.peranTersedia.length > 0) {
          setPeranOptions(full.peranTersedia)
        }
        const list = Array.isArray(full.peserta) ? full.peserta : []
        setPesertaData(list.map(mapPesertaRow))
        setSubmitted(full.statusSubmit === 'sudah_submit')
      })
      .catch((err) => toast.error('Gagal memuat data', { description: err.message }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [id])

  const handleKehadiranChange = (pesertaId, value) => {
    if (!isEditing) return
    const hadir = value === '' ? null : value === 'true'
    setPesertaData((prev) =>
      prev.map((p) => (p.id === pesertaId || p.partisipasiId === pesertaId ? { ...p, hadir } : p)),
    )
  }

  const handlePeranChange = (pesertaId, value) => {
    if (!isEditing) return
    setPesertaData((prev) =>
      prev.map((p) =>
        p.id === pesertaId || p.partisipasiId === pesertaId
          ? { ...p, peranVerifId: value }
          : p,
      ),
    )
  }

  const buildPayload = () =>
    pesertaData.map((p) => ({
      partisipasiId: p.partisipasiId ?? p.id,
      hadir: p.hadir === true ? true : p.hadir === false ? false : null,
      ...(p.peranVerifId ? { peranVerifId: Number(p.peranVerifId) } : {}),
    }))

  const handleSubmitPoin = async () => {
    setSubmitLoading(true)
    try {
      await updatePesertaKegiatan(id, buildPayload())

      // Submit selalu dikirim ulang: backend hanya memproses peserta yang
      // kehadiran atau perannya berubah, sehingga poin tidak tercatat dua kali.
      const res = await submitPoinPeserta(id)
      const gagal = res?.data?.errors
      if (gagal?.length) {
        toast.warning(res?.message || 'Sebagian peserta gagal diproses', {
          description: gagal.join(' | '),
        })
      } else {
        toast.success(res?.message || 'Poin peserta berhasil diproses otomatis!')
      }
      setSubmitted(true)
      setIsEditing(false)
      loadData()
    } catch (err) {
      toast.error('Gagal', { description: err.message })
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleBatalEdit = () => {
    setIsEditing(false)
    loadData()
  }

  async function handleConfirmDeletePeserta() {
    if (!pesertaToDelete) return
    setDeleting(true)
    try {
      const pid = pesertaToDelete.partisipasiId ?? pesertaToDelete.id
      await hapusPesertaKegiatan(id, pid)
      toast.success(`Peserta ${pesertaToDelete.nama} berhasil dihapus`)
      setPesertaData((prev) => prev.filter((p) => (p.partisipasiId ?? p.id) !== pid && p.id !== pid))
      setPesertaToDelete(null)
    } catch (err) {
      toast.error('Gagal menghapus peserta', { description: err.message })
    } finally {
      setDeleting(false)
    }
  }

  const handleImport = async (file) => {
    setImporting(true)
    try {
      const res = await importPesertaCSV(id, file)
      const body = res?.data || res || {}
      const importedCount = body.imported?.length ?? 0
      const errors = body.errors ?? []
      if (errors.length > 0) {
        const msg = errors.slice(0, 3).map((e) => `NIM ${e.nim}: ${e.error}`).join('\n')
        toast.warning(
          `${importedCount} peserta berhasil, ${errors.length} gagal`,
          { description: msg },
        )
      } else {
        toast.success(`Import berhasil: ${importedCount} peserta`)
      }
      loadData()
    } catch (err) {
      toast.error('Gagal import', { description: err.message })
    } finally {
      setImporting(false)
    }
  }

  const filtered = pesertaData.filter((p) => {
    const matchSearch = !search ||
      (p.nama || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.nim || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filterKehadiran === 'semua' ||
      (filterKehadiran === 'hadir' && p.hadir === true) ||
      (filterKehadiran === 'tidak' && p.hadir === false) ||
      (filterKehadiran === 'belum' && p.hadir == null)
    return matchSearch && matchFilter
  })

  const total = pesertaData.length
  const hadir = pesertaData.filter((p) => p.hadir === true).length
  const tidakHadir = pesertaData.filter((p) => p.hadir === false).length

  return (
    <DashboardLayout role="operator_ukmf" userName={user?.nama || 'Operator UKMF'} userRole="Operator UKMF">

      <ConfirmModal
        isOpen={!!pesertaToDelete}
        title="Hapus Peserta"
        message={`Apakah Anda yakin ingin menghapus ${pesertaToDelete?.nama || 'peserta ini'} (${pesertaToDelete?.nim || ''}) dari daftar peserta kegiatan ini?`}
        confirmText={deleting ? 'Menghapus…' : 'Hapus'}
        confirmClassName="btn btn-error text-white"
        cancelText="Batal"
        onConfirm={handleConfirmDeletePeserta}
        onCancel={() => setPesertaToDelete(null)}
      />

      <div className="space-y-5">
        <DetailBackButton onClick={() => navigate(-1)} />

        <div>
          <h2 className="text-2xl font-semibold text-base-content">Manajemen Peserta</h2>
          <p className="mt-1 text-base font-medium text-base-content">{kegiatan.nama}</p>
          <p className="mt-0.5 text-sm text-base-content/60">
            {[kegiatan.tanggal, kegiatan.lokasi].filter(Boolean).join(' · ') || 'Detail waktu dan lokasi belum tersedia'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total terdaftar" value={String(total)} loading={loading} />
          <StatCard label="Hadir" value={String(hadir)} loading={loading} />
          <StatCard label="Tidak hadir" value={String(tidakHadir)} loading={loading} />
        </div>

        <div className="alert alert-warning">
          <Info className="h-4 w-4 shrink-0" />
          <p className="text-sm">
            Kehadiran dan peran boleh dikosongkan dulu. Poin cair setelah izin Dosen PA disetujui.
            Klik Submit poin peserta untuk menyimpan perubahan.
          </p>
        </div>

        <TableCard title="Daftar peserta">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 lg:flex-1 lg:flex-row lg:items-center">
              <label className="input input-sm w-full lg:flex-1">
                <Search className="h-4 w-4 shrink-0 opacity-50" />
                <input
                  type="text"
                  placeholder="Cari NIM atau nama"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                value={filterKehadiran}
                onChange={(e) => setFilterKehadiran(e.target.value)}
                aria-label="Filter kehadiran"
                className="select select-sm w-full sm:w-48"
              >
                <option value="semua">Semua kehadiran</option>
                <option value="hadir">Hadir</option>
                <option value="tidak">Tidak hadir</option>
                <option value="belum">Belum diverifikasi</option>
              </select>
              {(search || filterKehadiran !== 'semua') ? (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setFilterKehadiran('semua') }}
                  className={pesertaResetFilterBtnClass}
                >
                  Reset
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadTemplatePeserta(id).catch((err) => toast.error('Gagal download template', { description: err.message }))}
                className={pesertaDownloadBtnClass}
              ><Download className="h-4 w-4" /> Unduh Template
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className={pesertaImportBtnClass}
              >{importing ? 'Mengimpor…' : <><UploadCloud className="h-4 w-4" /> Import File</>}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <TambahPesertaModal
            isOpen={showTambahModal}
            kegiatanId={id}
            onClose={() => setShowTambahModal(false)}
            onAdded={loadData}
          />

          <TableFrame>
            <DataTable
              columns={[
                { key: '_no', label: 'No' },
                { key: 'nim', label: 'NIM' },
                { key: 'nama', label: 'Nama' },
                { key: 'prodi', label: 'Prodi' },
                {
                  key: 'hadir',
                  label: 'Hadir',
                  center: true,
                  render: (p) => (
                    <KehadiranSelect
                      value={p.hadir}
                      disabled={!isEditing}
                      onChange={(v) => handleKehadiranChange(p.partisipasiId || p.id, v)}
                    />
                  ),
                },
                {
                  key: 'peran',
                  label: 'Peran',
                  render: (p) => (
                    <PeranSelect
                      value={p.peranVerifId}
                      disabled={!isEditing}
                      options={peranOptions}
                      onChange={(v) => handlePeranChange(p.partisipasiId || p.id, v)}
                    />
                  ),
                },
                ...(isEditing ? [{
                  key: '_aksi',
                  label: 'Aksi',
                  center: true,
                  stopPropagation: true,
                  render: (p) => (
                    <ActionMenu
                      items={[
                        {
                          label: 'Hapus',
                          icon: <Trash2 className="h-4 w-4" />,
                          color: 'text-red-500',
                          onClick: () => setPesertaToDelete(p),
                        },
                      ]}
                    />
                  ),
                }] : []),
              ]}
              data={filtered.map((p, i) => ({ ...p, _no: i + 1 }))}
              loading={loading}
              emptyText="Tidak ada peserta."
              pageSize={10}
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-base-300 px-3 py-3">
              <button
                type="button"
                onClick={() => setShowTambahModal(true)}
                className={pesertaTambahBtnClass}
              >
                <UserPlus className="h-4 w-4" /> Tambah peserta
              </button>
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)} className={pesertaEditBtnClass}>
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleBatalEdit}
                    disabled={submitLoading}
                    className={pesertaBatalBtnClass}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitPoin}
                    disabled={submitLoading}
                    className={pesertaSubmitBtnClass}
                  >
                    {submitLoading ? 'Memproses…' : 'Submit poin peserta'}
                  </button>
                </>
              )}
            </div>
          </TableFrame>
        </TableCard>

        {submitted ? (
          <p className="text-sm text-base-content/60">Poin peserta telah tercatat.</p>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default ManajemenPeserta
