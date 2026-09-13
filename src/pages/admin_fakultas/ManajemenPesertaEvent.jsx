import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, Download, UploadCloud, UserPlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import DataTable from '../../components/dashboard/DataTable'
import { DetailBackButton } from '../../components/ui/DetailComponents'
import { KehadiranSelect, PeranSelect } from '../../components/dashboard/PesertaFields'
import ConfirmModal from '../../components/ui/ConfirmModal'
import ActionMenu from '../../components/ui/ActionMenu'
import {
  getKegiatanById,
  getPesertaKegiatan,
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
    nama: p.namaMahasiswa || p.nama || '-',
    prodi: p.programStudi || p.prodi || '-',
    fakultas: p.fakultas || '-',
    hadir,
    peranVerifId: peranId !== '' && peranId != null ? String(peranId) : '',
  }
}

function formatTanggal(value) {
  if (!value) return ''
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return String(value)
  }
}

function ManajemenPesertaEvent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [event, setEvent] = useState({ nama: 'Kegiatan', jenis: '', tanggal: '', lokasi: '' })
  const [eventStatus, setEventStatus] = useState('')
  const [pesertaList, setPesertaList] = useState([])
  const [peranOptions, setPeranOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterKehadiran, setFilterKehadiran] = useState('semua')
  const [isEditing, setIsEditing] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showTambahModal, setShowTambahModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pesertaToDelete, setPesertaToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = () => {
    setLoading(true)
    getKegiatanById(id)
      .then(async (keg) => {
        if (keg) {
          setEventStatus(String(keg.status || '').toLowerCase())
          setEvent({
            nama: keg.nama || keg.judul || 'Kegiatan',
            jenis: keg.kategori?.nama || keg.jenis || '',
            tanggal: formatTanggal(keg.tanggalMulai || keg.tanggal || ''),
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
        const peserta = Array.isArray(full?.peserta) ? full.peserta : []
        setPesertaList(peserta.map(mapPesertaRow))
      })
      .catch((err) => toast.error('Gagal memuat data', { description: err.message }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [id])

  const filtered = pesertaList.filter((p) => {
    const matchSearch =
      (p.nama || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.nim || '').includes(search) ||
      (p.prodi || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filterKehadiran === 'semua' ||
      (filterKehadiran === 'hadir' && p.hadir === true) ||
      (filterKehadiran === 'tidak hadir' && p.hadir === false)
    return matchSearch && matchFilter
  })

  function setHadir(pid, value) {
    if (!isEditing) return
    const hadir = value === '' ? null : value === 'true'
    setPesertaList((prev) => prev.map((p) => (p.id === pid ? { ...p, hadir } : p)))
  }

  function setPilihPeran(pid, peranVerifId) {
    if (!isEditing) return
    setPesertaList((prev) => prev.map((p) => (p.id === pid ? { ...p, peranVerifId } : p)))
  }

  const buildPayload = () =>
    pesertaList.map((p) => ({
      partisipasiId: p.partisipasiId ?? p.id,
      hadir: p.hadir === true ? true : p.hadir === false ? false : null,
      ...(p.peranVerifId ? { peranVerifId: Number(p.peranVerifId) } : {}),
    }))


  async function handleConfirmDeletePeserta() {
    if (!pesertaToDelete) return
    setDeleting(true)
    try {
      const pid = pesertaToDelete.partisipasiId ?? pesertaToDelete.id
      await hapusPesertaKegiatan(id, pid)
      toast.success(`Peserta ${pesertaToDelete.nama} berhasil dihapus`)
      setPesertaList((prev) => prev.filter((p) => (p.partisipasiId ?? p.id) !== pid && p.id !== pid))
      setPesertaToDelete(null)
    } catch (err) {
      toast.error('Gagal menghapus peserta', { description: err.message })
    } finally {
      setDeleting(false)
    }
  }

  function handleBatalEdit() {
    setIsEditing(false)
    loadData()
  }

  async function handleSubmitConfirm() {
    setShowSubmitModal(false)
    setSaving(true)
    try {
      await updatePesertaKegiatan(id, buildPayload())
      const res = await submitPoinPeserta(id)
      const gagal = res?.data?.errors
      if (gagal?.length) {
        toast.warning(res?.message || 'Sebagian peserta gagal diproses', {
          description: gagal.join(' | '),
        })
      } else {
        toast.success(res?.message || 'Poin peserta berhasil diproses otomatis!')
      }
      setIsEditing(false)
      setSubmitted(true)
      loadData()
    } catch (err) {
      toast.error('Gagal submit', { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleImport(file) {
    try {
      await importPesertaCSV(id, file)
      toast.success('Import berhasil')
      loadData()
    } catch (err) {
      toast.error('Gagal import', { description: err.message })
    }
  }

  const belumDisetujui = !['disetujui', 'terpublikasi'].includes(eventStatus)

  return (
    <DashboardLayout role="admin_fakultas" userName="Admin Fakultas" userRole="Admin Fakultas">
      <ConfirmModal
        isOpen={showSubmitModal}
        title="Submit poin peserta"
        message="Kehadiran dan peran akan disimpan, lalu poin peserta diproses otomatis."
        confirmText="Submit"
        cancelText="Batal"
        onConfirm={handleSubmitConfirm}
        onCancel={() => setShowSubmitModal(false)}
      />


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

      <TambahPesertaModal
        isOpen={showTambahModal}
        kegiatanId={id}
        onClose={() => setShowTambahModal(false)}
        onAdded={loadData}
      />

      <div className="space-y-5">
        <DetailBackButton onClick={() => navigate('/admin_fakultas/manajemen-event')} />

        <div>
          <h2 className="text-2xl font-semibold text-base-content">Manajemen Peserta</h2>
          <p className="mt-1 text-base font-medium text-base-content">{event.nama}</p>
          <p className="mt-0.5 text-sm text-base-content/60">
            {[event.jenis, event.tanggal, event.lokasi].filter(Boolean).join(' · ') || 'Detail kegiatan belum tersedia'}
          </p>
        </div>

        {belumDisetujui ? (
          <div className="alert alert-warning">
            <span className="text-sm">Event belum disetujui pimpinan. Edit dan submit poin belum bisa dilakukan.</span>
          </div>
        ) : null}

        <TableCard title="Daftar peserta">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 lg:flex-1 lg:flex-row lg:items-center">
              <label className="input input-sm w-full lg:flex-1">
                <Search className="h-4 w-4 shrink-0 opacity-50" />
                <input
                  type="text"
                  placeholder="Cari nama, NIM, atau prodi"
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
                <option value="tidak hadir">Tidak hadir</option>
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
              >
                <Download className="h-4 w-4" /> Unduh template
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={pesertaImportBtnClass}
              >
                <UploadCloud className="h-4 w-4" /> Import file
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

          <TableFrame>
            <DataTable
              columns={[
                { key: '_no', label: 'No' },
                { key: 'nim', label: 'NIM' },
                { key: 'nama', label: 'Nama' },
                { key: 'fakultas', label: 'Fakultas' },
                { key: 'prodi', label: 'Program studi' },
                {
                  key: 'hadir',
                  label: 'Hadir',
                  center: true,
                  render: (p) => (
                    <KehadiranSelect
                      value={p.hadir}
                      disabled={!isEditing}
                      onChange={(v) => setHadir(p.id, v)}
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
                      onChange={(v) => setPilihPeran(p.id, v)}
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
              {!submitted && !isEditing && !belumDisetujui ? (
                <button type="button" onClick={() => setIsEditing(true)} className={pesertaEditBtnClass}>
                  Edit
                </button>
              ) : null}
              {!submitted && isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleBatalEdit}
                    disabled={saving}
                    className={pesertaBatalBtnClass}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(true)}
                    disabled={saving}
                    className={pesertaSubmitBtnClass}
                  >
                    {saving ? 'Memproses…' : 'Submit poin peserta'}
                  </button>
                </>
              ) : null}
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

export default ManajemenPesertaEvent
