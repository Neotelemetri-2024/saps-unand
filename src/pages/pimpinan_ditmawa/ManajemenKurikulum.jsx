import { useState, useEffect } from 'react'
import { Pencil, Trash2, AlignJustify, ChevronLeft, ChevronRight, Plus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import ConfirmModal from '../../components/ui/ConfirmModal'
import Modal from '../../components/ui/Modal'
import ActionMenu from '../../components/ui/ActionMenu'
import { TableCard, TableFrame } from '../../components/dashboard/TableFrame'
import StatusBadge from '../../components/dashboard/StatusBadge'
import {
  getKurikulum,
  getKurikulumById,
  createKurikulum,
  updateKurikulum,
  aktivasiKurikulum,
  nonaktifkanKurikulum,
  hapusKurikulum,
  tambahCapaian,
  updateCapaian,
  hapusCapaian,
  tambahSubCapaian,
  updateSubCapaian,
  hapusSubCapaian,
} from '../../services/kurikulumService'
import { batalBtnClass } from '../../components/ui/buttonStyles'

function normalizeKurikulum(k) {
  return {
    id: k.id,
    nama: k.nama || k.namaKurikulum || '-',
    tahun: k.tahunAkademik || k.tahun || '-',
    angkatanMulai: k.angkatanMulai ?? null,
    status: k.status || 'draft',
    capaian: (k.capaian || k.capaiapembelajaran || []).map((c) => ({
      id: c.id,
      label: c.nama || c.label || c.namaCapaian || '-',
      jumlahPoin: c.jumlahPoin ?? c.poin ?? 0,
      subCapaian: (c.subCapaian || c.sub_capaian || []).map((sc) => ({
        id: sc.id,
        nama: sc.nama || sc.namaSubCapaian || '-',
        presentasi: Number(sc.bobotPersen ?? sc.bobot ?? sc.presentasi ?? 0),
      })),
    })),
  }
}

function formatCakupanAngkatan(kur, allKurikulum) {
  if (kur.angkatanMulai == null) return 'Angkatan mulai belum diisi'
  const nextStarts = allKurikulum
    .map((k) => k.angkatanMulai)
    .filter((y) => y != null && y > kur.angkatanMulai)
    .sort((a, b) => a - b)
  if (nextStarts.length === 0) return `Angkatan ${kur.angkatanMulai} dan seterusnya`
  return `Angkatan ${kur.angkatanMulai}–${nextStarts[0] - 1}`
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-brand-dark' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-base-100 shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function ManajemenKurikulum() {
  const [kurikulum, setKurikulum] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeKurId, setActiveKurId] = useState(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showNonaktifConfirm, setShowNonaktifConfirm] = useState(false)
  const [nonaktifTarget, setNonaktifTarget] = useState(null)

  const [showTambahKurikulum, setShowTambahKurikulum] = useState(false)
  const [kurForm, setKurForm] = useState({ tahun: `${new Date().getFullYear()}`, angkatanMulai: new Date().getFullYear(), nama: '' })

  const [editKurikulumTarget, setEditKurikulumTarget] = useState(null)
  const [editKurikulumForm, setEditKurikulumForm] = useState({
    nama: '',
    tahun: '',
    angkatanMulai: '',
  })
  const [savingEditKurikulum, setSavingEditKurikulum] = useState(false)

  const [showTambahCapaian, setShowTambahCapaian] = useState(false)
  const [capaianForm, setCapaianForm] = useState({ nama: '', jumlahPoin: '' })

  const [showTambahSubCapaian, setShowTambahSubCapaian] = useState(false)
  const [subCapaianForm, setSubCapaianForm] = useState({ capaianId: '', nama: '', presentasi: '' })

  const [editSubCapaian, setEditSubCapaian] = useState(null)
  const [editCapaian, setEditCapaian] = useState(null)

  const [showHapusCapaianConfirm, setShowHapusCapaianConfirm] = useState(false)
  const [hapusCapaianTarget, setHapusCapaianTarget] = useState(null)

  const [showHapusSubCapaianConfirm, setShowHapusSubCapaianConfirm] = useState(false)
  const [hapusSubCapaianTarget, setHapusSubCapaianTarget] = useState(null)

  const [page, setPage] = useState(1)

  const activeKur = kurikulum.find((k) => k.id === activeKurId) || null

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil((activeKur?.capaian?.length || 0) / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const pageCapaian = (activeKur?.capaian || []).slice(start, start + PAGE_SIZE)

  // Perhitungan dinamis untuk persentase bobot 100% per capaian (Tambah Sub Capaian)
  const selectedCapaianForAdd = activeKur?.capaian.find((c) => c.id === Number(subCapaianForm.capaianId))
  const currentTotalForAdd = (selectedCapaianForAdd?.subCapaian || []).reduce(
    (sum, sc) => sum + (parseInt(sc.presentasi, 10) || 0),
    0
  )
  const sisaBobotForAdd = Math.max(0, 100 - currentTotalForAdd)
  const inputBobotTambah = parseInt(subCapaianForm.presentasi, 10)
  const totalSetelahTambah = currentTotalForAdd + (isNaN(inputBobotTambah) ? 0 : inputBobotTambah)
  const isTambahValid = !isNaN(inputBobotTambah) && inputBobotTambah > 0 && totalSetelahTambah <= 100

  // Perhitungan dinamis untuk persentase bobot 100% per capaian (Edit Sub Capaian)
  const parentCapaianForEdit = editSubCapaian
    ? activeKur?.capaian.find((c) => c.subCapaian.some((sc) => sc.id === editSubCapaian.id))
    : null
  const otherTotalForEdit = parentCapaianForEdit
    ? (parentCapaianForEdit.subCapaian || [])
        .filter((sc) => sc.id !== editSubCapaian?.id)
        .reduce((sum, sc) => sum + (parseInt(sc.presentasi, 10) || 0), 0)
    : 0
  const maxAllowedForEdit = Math.max(0, 100 - otherTotalForEdit)
  const inputBobotEdit = editSubCapaian ? parseInt(editSubCapaian.presentasi, 10) : 0
  const totalSetelahEdit = otherTotalForEdit + (isNaN(inputBobotEdit) ? 0 : inputBobotEdit)
  const isEditValid = !isNaN(inputBobotEdit) && inputBobotEdit > 0 && totalSetelahEdit <= 100

  // Capaian yang belum 100%
  const capaianBelumLengkap = (activeKur?.capaian || []).filter((c) => {
    const tot = (c.subCapaian || []).reduce((acc, sc) => acc + (parseInt(sc.presentasi, 10) || 0), 0)
    return tot !== 100
  })

  const loadList = async () => {
    setLoading(true)
    try {
      const data = await getKurikulum()
      const list = (Array.isArray(data) ? data : []).map(normalizeKurikulum)
      setKurikulum(list)
      if (!activeKurId && list.length) setActiveKurId(list[0].id)

      // Load detail untuk setiap kurikulum agar jumlah sub capaian akurat
      const details = await Promise.all(
        list.map((k) => getKurikulumById(k.id).then(normalizeKurikulum).catch(() => k))
      )
      setKurikulum(details)
    } catch (err) {
      toast.error('Gagal memuat kurikulum', { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id) => {
    try {
      const detail = await getKurikulumById(id)
      const norm = normalizeKurikulum(detail)
      setKurikulum((prev) => prev.map((k) => (k.id === id ? norm : k)))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadList()
  }, [])

  useEffect(() => {
    setPage(1)
    if (activeKurId) loadDetail(activeKurId)
  }, [activeKurId])

  const handleToggleStatus = (id) => {
    const kur = kurikulum.find((k) => k.id === id)
    if (kur?.status === 'aktif') {
      setNonaktifTarget(kur)
      setShowNonaktifConfirm(true)
    } else {
      confirmToggleStatus(kur)
    }
  }

  const confirmToggleStatus = async (kur) => {
    try {
      if (kur?.status === 'aktif') {
        await nonaktifkanKurikulum(kur.id)
        toast.success('Kurikulum dinonaktifkan.')
      } else {
        // Validasi sebelum aktivasi: seluruh capaian wajib memiliki sub-capaian dengan total bobot pas 100%
        const detailKur = await getKurikulumById(kur.id)
        const normKur = normalizeKurikulum(detailKur)
        if (!normKur.capaian || normKur.capaian.length === 0) {
          toast.error('Kurikulum tidak dapat diaktifkan', {
            description: 'Kurikulum belum memiliki capaian kompetensi.',
          })
          return
        }

        for (const cap of normKur.capaian) {
          if (!cap.subCapaian || cap.subCapaian.length === 0) {
            toast.error('Kurikulum tidak dapat diaktifkan', {
              description: `Capaian "${cap.label}" belum memiliki sub capaian. Total persentase bobot harus pas 100%.`,
            })
            return
          }
          const totalBobot = cap.subCapaian.reduce((sum, sc) => sum + (Number(sc.presentasi) || 0), 0)
          if (Math.round(totalBobot * 100) / 100 !== 100) {
            toast.error('Kurikulum tidak dapat diaktifkan', {
              description: `Total persentase bobot pada capaian "${cap.label}" adalah ${totalBobot}%. Total seluruh persentase sub capaian wajib pas 100% (tidak boleh kurang maupun lebih).`,
            })
            return
          }
        }

        await aktivasiKurikulum(kur.id)
        toast.success('Kurikulum diaktifkan.')
      }
      loadList()
    } catch (err) {
      toast.error('Gagal mengubah status', { description: err.message })
    }
  }

  const confirmNonaktif = async () => {
    if (!nonaktifTarget) return
    setShowNonaktifConfirm(false)
    await confirmToggleStatus(nonaktifTarget)
    setNonaktifTarget(null)
  }

  const handleHapus = (id, nama) => {
    setDeleteTarget({ id, nama })
    setShowDeleteConfirm(true)
  }

  const confirmHapus = async () => {
    try {
      await hapusKurikulum(deleteTarget.id)
      if (activeKurId === deleteTarget.id) setActiveKurId(null)
      toast.success('Kurikulum dihapus.')
      loadList()
    } catch (err) {
      toast.error('Gagal menghapus', { description: err.message })
    }
    setShowDeleteConfirm(false)
    setDeleteTarget(null)
  }

  const handleTambahKurikulum = async () => {
    const namaTrimmed = String(kurForm.nama || '').trim()
    const tahunVal = String(kurForm.tahun || '').trim()
    const tahunInt = parseInt(tahunVal.split('/')[0], 10)
    const angkatanMulai = Number(kurForm.angkatanMulai)

    if (!namaTrimmed) {
      toast.error('Nama kurikulum tidak boleh kosong.')
      return
    }
    if (!tahunVal || isNaN(tahunInt) || tahunInt < 2000 || tahunInt > 2100) {
      toast.error('Tahun akademik harus valid (contoh: 2026 atau 2026/2027).')
      return
    }
    if (!angkatanMulai || angkatanMulai < 2000 || angkatanMulai > 2100) {
      toast.error('Angkatan mulai harus diisi (contoh: 2026).')
      return
    }

    try {
      const tahunAkademik = tahunVal
      const created = await createKurikulum({
        nama: namaTrimmed,
        tahunAkademik,
        angkatanMulai,
      })
      toast.success('Kurikulum berhasil ditambahkan.')
      setKurForm({
        tahun: `${new Date().getFullYear()}`,
        angkatanMulai: new Date().getFullYear(),
        nama: '',
      })
      setShowTambahKurikulum(false)
      loadList()
      if (created?.id) setActiveKurId(created.id)
    } catch (err) {
      toast.error('Gagal menambahkan kurikulum', { description: err.message })
    }
  }

  const handleUpdateKurikulum = async (e) => {
    e?.preventDefault()
    if (!editKurikulumTarget) return
    const namaTrimmed = String(editKurikulumForm.nama || '').trim()
    const tahunTrimmed = String(editKurikulumForm.tahun || '').trim()
    const angkatanVal = editKurikulumForm.angkatanMulai !== '' ? parseInt(editKurikulumForm.angkatanMulai, 10) : undefined

    if (!namaTrimmed) {
      toast.error('Nama kurikulum tidak boleh kosong.')
      return
    }
    if (!tahunTrimmed) {
      toast.error('Tahun akademik wajib diisi (Contoh: 2024 atau 2024/2025).')
      return
    }
    if (angkatanVal !== undefined && (isNaN(angkatanVal) || angkatanVal < 1900 || angkatanVal > 2200)) {
      toast.error('Tahun angkatan mulai harus berupa angka tahun yang valid (antara 1900 - 2200).')
      return
    }

    setSavingEditKurikulum(true)
    try {
      const payload = {
        nama: namaTrimmed,
        tahunAkademik: tahunTrimmed,
        ...(angkatanVal !== undefined ? { angkatanMulai: angkatanVal } : {}),
      }
      await updateKurikulum(editKurikulumTarget.id, payload)
      toast.success('Kurikulum berhasil diperbarui.')
      setEditKurikulumTarget(null)
      loadList()
    } catch (err) {
      toast.error('Gagal memperbarui kurikulum', { description: err.message })
    } finally {
      setSavingEditKurikulum(false)
    }
  }

  const handleTambahCapaian = async () => {
    if (!capaianForm.nama.trim()) {
      toast.error('Nama capaian tidak boleh kosong.')
      return
    }
    if (!capaianForm.jumlahPoin || Number(capaianForm.jumlahPoin) <= 0) {
      toast.error('Jumlah poin harus diisi dan lebih dari 0.')
      return
    }
    try {
      await tambahCapaian(activeKurId, {
        nama: capaianForm.nama.trim(),
        jumlahPoin: Number(capaianForm.jumlahPoin),
      })
      toast.success('Capaian ditambahkan.')
      setCapaianForm({ nama: '', jumlahPoin: '' })
    setShowTambahCapaian(false)
    loadDetail(activeKurId)
  } catch (err) {
    toast.error('Gagal menambahkan capaian', { description: err.message })
  }
}

const handleTambahSubCapaian = async () => {
  if (!subCapaianForm.capaianId) {
    toast.error('Pilih capaian induk terlebih dahulu.')
    return
  }
  if (!subCapaianForm.nama.trim()) {
    toast.error('Nama sub capaian tidak boleh kosong.')
    return
  }
  const bobot = parseInt(subCapaianForm.presentasi, 10)
  if (isNaN(bobot) || bobot < 1 || bobot > 100) {
    toast.error('Persentase bobot harus berupa bilangan bulat antara 1% - 100%.')
    return
  }

  const selectedCap = activeKur?.capaian.find((c) => c.id === Number(subCapaianForm.capaianId))
  const currentTotal = (selectedCap?.subCapaian || []).reduce((sum, sc) => sum + (parseInt(sc.presentasi, 10) || 0), 0)
  const newTotal = currentTotal + bobot

  if (newTotal > 100) {
    toast.error('Total persentase melebihi 100%', {
      description: `Total bobot saat ini sudah ${currentTotal}%. Maksimal yang dapat ditambahkan adalah ${Math.max(0, 100 - currentTotal)}%.`,
    })
    return
  }

  try {
    await tambahSubCapaian(subCapaianForm.capaianId, {
      nama: subCapaianForm.nama.trim(),
      bobotPersen: bobot,
    })
    toast.success('Sub capaian ditambahkan.')
    setSubCapaianForm({ capaianId: '', nama: '', presentasi: '' })
    setShowTambahSubCapaian(false)
    loadDetail(activeKurId)
  } catch (err) {
    toast.error('Gagal menambahkan sub capaian', { description: err.message })
  }
}

const handleEditSubCapaian = async () => {
  if (!editSubCapaian.nama.trim()) {
    toast.error('Nama sub capaian tidak boleh kosong.')
    return
  }
  const bobot = parseInt(editSubCapaian.presentasi, 10)
  if (isNaN(bobot) || bobot < 1 || bobot > 100) {
    toast.error('Persentase bobot harus berupa bilangan bulat antara 1% - 100%.')
    return
  }

  const parentCap = activeKur?.capaian.find((c) => c.subCapaian.some((sc) => sc.id === editSubCapaian.id))
  const otherTotal = (parentCap?.subCapaian || [])
    .filter((sc) => sc.id !== editSubCapaian.id)
    .reduce((sum, sc) => sum + (parseInt(sc.presentasi, 10) || 0), 0)
  const newTotal = otherTotal + bobot

  if (newTotal > 100) {
    toast.error('Total persentase melebihi 100%', {
      description: `Sub capaian lain pada "${parentCap?.label}" berjumlah ${otherTotal}%. Bobot maksimal adalah ${Math.max(0, 100 - otherTotal)}%.`,
    })
    return
  }

  try {
    await updateSubCapaian(editSubCapaian.id, {
      nama: editSubCapaian.nama.trim(),
      bobotPersen: bobot,
    })
    toast.success('Sub capaian diperbarui.')
      setEditSubCapaian(null)
      loadDetail(activeKurId)
    } catch (err) {
      toast.error('Gagal memperbarui sub capaian', { description: err.message })
    }
  }

  const handleEditCapaian = async () => {
    if (!editCapaian.label.trim()) {
      toast.error('Nama capaian tidak boleh kosong.')
      return
    }
    if (!editCapaian.jumlahPoin || Number(editCapaian.jumlahPoin) <= 0) {
      toast.error('Jumlah poin harus diisi dan lebih dari 0.')
      return
    }
    try {
      await updateCapaian(editCapaian.id, {
        nama: editCapaian.label.trim(),
        jumlahPoin: Number(editCapaian.jumlahPoin),
      })
      toast.success('Capaian diperbarui.')
      setEditCapaian(null)
      loadDetail(activeKurId)
    } catch (err) {
      toast.error('Gagal memperbarui capaian', { description: err.message })
    }
  }

  const handleHapusSubCapaian = (sc) => {
    setHapusSubCapaianTarget(sc)
    setShowHapusSubCapaianConfirm(true)
  }

  const confirmHapusSubCapaian = async () => {
    try {
      await hapusSubCapaian(hapusSubCapaianTarget.id)
      toast.success('Sub capaian dihapus.')
      loadDetail(activeKurId)
    } catch (err) {
      toast.error('Gagal menghapus sub capaian', { description: err.message })
    }
    setShowHapusSubCapaianConfirm(false)
    setHapusSubCapaianTarget(null)
  }

  const handleHapusCapaian = (cap) => {
    setHapusCapaianTarget(cap)
    setShowHapusCapaianConfirm(true)
  }

  const confirmHapusCapaian = async () => {
    try {
      await hapusCapaian(hapusCapaianTarget.id)
      toast.success('Capaian dihapus.')
      loadDetail(activeKurId)
    } catch (err) {
      toast.error('Gagal menghapus capaian', { description: err.message })
    }
    setShowHapusCapaianConfirm(false)
    setHapusCapaianTarget(null)
  }

  return (
      <>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={`Hapus "${deleteTarget?.nama}"?`}
        message="Tindakan ini tidak dapat dibatalkan."
        confirmText="HAPUS"
        cancelText="BATAL"
        onConfirm={confirmHapus}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmModal
        isOpen={showNonaktifConfirm}
        title="Nonaktifkan Kurikulum?"
        message={`Kurikulum "${nonaktifTarget?.nama}" akan dinonaktifkan. Pastikan sudah ada kurikulum lain yang aktif sebelum melanjutkan, karena kurikulum nonaktif tidak lagi dipakai sebagai acuan pemetaan capaian.`}
        confirmText="NONAKTIFKAN"
        cancelText="BATAL"
        onConfirm={confirmNonaktif}
        onCancel={() => {
          setShowNonaktifConfirm(false)
          setNonaktifTarget(null)
        }}
      />

      <ConfirmModal
        isOpen={showHapusCapaianConfirm}
        message={`Apakah Anda yakin ingin menghapus capaian "${hapusCapaianTarget?.label}"? Semua sub capaian di dalamnya juga akan ikut terhapus.`}
        confirmText="HAPUS"
        cancelText="BATAL"
        onConfirm={confirmHapusCapaian}
        onCancel={() => setShowHapusCapaianConfirm(false)}
      />

      <ConfirmModal
        isOpen={showHapusSubCapaianConfirm}
        message={`Apakah Anda yakin ingin menghapus sub capaian "${hapusSubCapaianTarget?.nama}"?`}
        confirmText="HAPUS"
        cancelText="BATAL"
        onConfirm={confirmHapusSubCapaian}
        onCancel={() => setShowHapusSubCapaianConfirm(false)}
      />

      {/* Modal Tambah Kurikulum */}
      <Modal isOpen={showTambahKurikulum} onClose={() => setShowTambahKurikulum(false)} title="Tambah Kurikulum">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Tahun Akademik <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={kurForm.tahun}
              onChange={(e) => setKurForm((p) => ({ ...p, tahun: e.target.value }))}
              placeholder="Contoh: 2026 atau 2026/2027"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Mulai Berlaku untuk Angkatan <span className="text-error">*</span>
            </label>
            <input
              type="number"
              min="2000"
              max="2100"
              step="1"
              value={kurForm.angkatanMulai}
              onChange={(e) =>
                setKurForm((p) => ({
                  ...p,
                  angkatanMulai: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                }))
              }
              placeholder="Contoh: 2024"
              className="input w-full"
            />
            <p className="mt-1 text-xs text-base-content/50">
              Berlaku untuk angkatan ini dan seterusnya sampai kurikulum baru dengan tahun mulai lebih besar.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Nama Kurikulum <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={kurForm.nama}
              onChange={(e) => setKurForm((p) => ({ ...p, nama: e.target.value }))}
              placeholder="Contoh: Kurikulum Merdeka 2025"
              className="input w-full"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowTambahKurikulum(false)} className={batalBtnClass}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleTambahKurikulum}
            className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Simpan
          </button>
        </div>
      </Modal>

      {/* Modal Edit Kurikulum */}
      <Modal
        isOpen={Boolean(editKurikulumTarget)}
        onClose={() => {
          if (!savingEditKurikulum) setEditKurikulumTarget(null)
        }}
        title="Edit Kurikulum"
      >
        <form onSubmit={handleUpdateKurikulum} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Nama Kurikulum <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={editKurikulumForm.nama}
              onChange={(e) => setEditKurikulumForm((p) => ({ ...p, nama: e.target.value }))}
              placeholder="Contoh: Kurikulum Merdeka 2024"
              className="input w-full"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Tahun Akademik <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={editKurikulumForm.tahun}
              onChange={(e) => setEditKurikulumForm((p) => ({ ...p, tahun: e.target.value }))}
              placeholder="Contoh: 2024 atau 2024/2025"
              className="input w-full"
              required
            />
            <p className="mt-1 text-xs text-base-content/50">
              Format: 2024 atau 2024/2025
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Mulai Berlaku untuk Angkatan <span className="text-error">*</span>
            </label>
            <input
              type="number"
              min="2000"
              max="2100"
              step="1"
              value={editKurikulumForm.angkatanMulai}
              onChange={(e) =>
                setEditKurikulumForm((p) => ({
                  ...p,
                  angkatanMulai: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                }))
              }
              placeholder="Contoh: 2024"
              className="input w-full"
              required
            />
            <p className="mt-1 text-xs text-base-content/50">
              Berlaku untuk mahasiswa angkatan ini dan seterusnya sampai kurikulum baru dengan tahun mulai lebih besar.
            </p>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              disabled={savingEditKurikulum}
              onClick={() => setEditKurikulumTarget(null)}
              className={batalBtnClass}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingEditKurikulum}
              className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              {savingEditKurikulum ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Tambah Capaian */}
      <Modal isOpen={showTambahCapaian} onClose={() => setShowTambahCapaian(false)} title="Tambah Capaian">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Nama Capaian <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={capaianForm.nama}
              onChange={(e) => setCapaianForm((p) => ({ ...p, nama: e.target.value }))}
              placeholder="Contoh: Pemantapan"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Jumlah Poin <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={capaianForm.jumlahPoin}
              onChange={(e) => setCapaianForm((p) => ({ ...p, jumlahPoin: e.target.value }))}
              placeholder="Contoh: 100"
              min="1"
              className="input w-full"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowTambahCapaian(false)} className={batalBtnClass}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleTambahCapaian}
            className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Simpan
          </button>
        </div>
      </Modal>

      {/* Modal Tambah Sub Capaian */}
      <Modal isOpen={showTambahSubCapaian} onClose={() => setShowTambahSubCapaian(false)} title="Tambah Sub Capaian">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Capaian Induk <span className="text-red-500">*</span>
            </label>
            <select
              value={subCapaianForm.capaianId}
              onChange={(e) => setSubCapaianForm((p) => ({ ...p, capaianId: e.target.value }))}
              className="input w-full"
            >
              <option value="">-- Pilih Capaian --</option>
              {activeKur?.capaian.map((c) => {
                const capTotal = (c.subCapaian || []).reduce((sum, sc) => sum + (parseInt(sc.presentasi, 10) || 0), 0)
                return (
                  <option key={c.id} value={c.id}>
                    {c.label} (Total saat ini: {capTotal}%)
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Nama Sub Capaian <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subCapaianForm.nama}
              onChange={(e) => setSubCapaianForm((p) => ({ ...p, nama: e.target.value }))}
              placeholder="Contoh: Keikutsertaan Organisasi / Kepanitiaan"
              className="input w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Persentase Bobot (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={subCapaianForm.presentasi}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '')
                setSubCapaianForm((p) => ({ ...p, presentasi: val }))
              }}
              onKeyDown={(e) => {
                if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                  e.preventDefault()
                }
              }}
              placeholder="Contoh: 25"
              className="input w-full"
            />
            {selectedCapaianForAdd && totalSetelahTambah > 100 && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertCircle className="h-3.5 w-3.5" /> Total bobot {totalSetelahTambah}% melebihi 100%.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowTambahSubCapaian(false)} className={batalBtnClass}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleTambahSubCapaian}
            disabled={!isTambahValid || !subCapaianForm.nama.trim() || !subCapaianForm.capaianId || totalSetelahTambah > 100}
            className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      </Modal>

      {/* Modal Edit Capaian */}
      <Modal isOpen={!!editCapaian} onClose={() => setEditCapaian(null)} title="Edit Capaian">
        {editCapaian && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Nama Capaian <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editCapaian.label}
                onChange={(e) => setEditCapaian((p) => ({ ...p, label: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Jumlah Poin <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={editCapaian.jumlahPoin}
                onChange={(e) => setEditCapaian((p) => ({ ...p, jumlahPoin: e.target.value }))}
                placeholder="Contoh: 100"
                min="1"
                className="input w-full"
              />
            </div>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditCapaian(null)} className={batalBtnClass}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleEditCapaian}
            className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            Simpan
          </button>
        </div>
      </Modal>

      {/* Modal Edit Sub Capaian */}
      <Modal isOpen={!!editSubCapaian} onClose={() => setEditSubCapaian(null)} title="Edit Sub Capaian">
        {editSubCapaian && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">Capaian Induk</label>
              <div className="rounded-lg bg-base-200 px-3.5 py-2 text-sm font-medium text-base-content border border-base-300">
                {parentCapaianForEdit?.label || '-'}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Nama Sub Capaian <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editSubCapaian.nama}
                onChange={(e) => setEditSubCapaian((p) => ({ ...p, nama: e.target.value }))}
                className="input w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Persentase Bobot (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={editSubCapaian.presentasi}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '')
                  setEditSubCapaian((p) => ({ ...p, presentasi: val }))
                }}
                onKeyDown={(e) => {
                  if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                    e.preventDefault()
                  }
                }}
                placeholder="Contoh: 25"
                className="input w-full"
              />
              {totalSetelahEdit > 100 && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> Total bobot {totalSetelahEdit}% melebihi 100%.
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditSubCapaian(null)} className={batalBtnClass}>
                Batal
              </button>
              <button
                type="button"
                onClick={handleEditSubCapaian}
                disabled={!isEditValid || !editSubCapaian.nama.trim() || totalSetelahEdit > 100}
                className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-base-content sm:text-3xl">Manajemen Kurikulum</h2>
          <p className="mt-1 text-sm text-base-content/60">Kelola kurikulum dan pemetaan Capaian dan Sub Capaian sesuai BRD.</p>
        </div>

        {/* Tombol tambah kurikulum */}
        <div>
          <button
            type="button"
            onClick={() => {
              setKurForm({
                tahun: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
                angkatanMulai: new Date().getFullYear(),
                nama: '',
              })
              setShowTambahKurikulum(true)
            }}
            className="btn btn-primary w-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto sm:justify-start"
          >
            <Plus className="h-4 w-4" /> Tambah Kurikulum
          </button>
        </div>

        {/* Daftar Kurikulum */}
        <section className="overflow-hidden rounded-md border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-5 py-4">
            <h3 className="text-base font-semibold text-base-content">Daftar Kurikulum</h3>
            <p className="mt-0.5 text-sm text-base-content/60">Pilih kurikulum untuk melihat dan mengelola capaian pembelajarannya.</p>
          </div>
          <div className="divide-y divide-base-300">
            {loading ? (
              <p className="px-5 py-6 text-sm text-base-content/50">Memuat kurikulum...</p>
            ) : kurikulum.length === 0 ? (
              <p className="px-5 py-6 text-sm text-base-content/50">Belum ada kurikulum.</p>
            ) : null}
            {kurikulum.map((kur) => {
              const totalSub = kur.capaian.reduce((a, c) => a + c.subCapaian.length, 0)
              const isActive = activeKurId === kur.id
              return (
                <div
                  key={kur.id}
                  className={`flex w-full items-center gap-4 px-5 py-4 ${isActive ? 'bg-base-200' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveKurId(isActive ? null : kur.id)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    <p className="text-sm font-semibold text-base-content">{kur.nama}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={kur.status === 'arsip' ? 'diarsipkan' : kur.status} />
                      <span className="text-xs text-base-content/60">
                        {kur.tahun} · {formatCakupanAngkatan(kur, kurikulum)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-base-content/50">{totalSub} sub capaian</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <ToggleSwitch checked={kur.status === 'aktif'} onChange={() => handleToggleStatus(kur.id)} />
                    <ActionMenu
                      items={[
                        {
                          label: 'Edit Kurikulum',
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => {
                            setEditKurikulumTarget(kur)
                            setEditKurikulumForm({
                              nama: kur.nama || '',
                              tahun: kur.tahun && kur.tahun !== '-' ? kur.tahun : '',
                              angkatanMulai: kur.angkatanMulai ?? '',
                            })
                          },
                        },
                        {
                          label: 'Hapus Kurikulum',
                          icon: <Trash2 className="h-4 w-4" />,
                          color: 'text-red-500',
                          onClick: () => handleHapus(kur.id, kur.nama),
                        },
                      ]}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Detail kurikulum aktif */}
        {activeKur && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-base-content">{activeKur.nama}</h3>
            
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCapaianForm({ nama: '', jumlahPoin: '' })
                    setShowTambahCapaian(true)
                  }}
                  className="btn btn-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Tambah Capaian
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubCapaianForm({ capaianId: '', nama: '', presentasi: '' })
                    setShowTambahSubCapaian(true)
                  }}
                  className="btn btn-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Tambah Sub Capaian
                </button>
              </div>
            </div>

            {capaianBelumLengkap.length > 0 && (
              <p className="text-xs text-base-content/60">
                Bobot belum 100% pada:{' '}
                {capaianBelumLengkap.map((c, i) => {
                  const tot = (c.subCapaian || []).reduce((acc, sc) => acc + (Number(sc.presentasi) || 0), 0)
                  return (
                    <span key={c.id}>
                      {i > 0 && ', '}
                      <span className="font-medium text-base-content">{c.label}</span> ({tot}%)
                    </span>
                  )
                })}
              </p>
            )}

            <TableCard title="Struktur Capaian & Sub Capaian">
              <TableFrame>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="bg-primary text-xs font-semibold uppercase tracking-wide text-white">
                        <th className="px-5 py-3 text-center">Capaian & Status Bobot</th>
                        <th className="px-5 py-3 text-center">Poin</th>
                        <th className="px-5 py-3 text-center">Sub Capaian</th>
                        <th className="px-5 py-3 text-center">Persentase Bobot</th>
                        <th className="px-5 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeKur.capaian.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-base-content/50">
                            Belum ada capaian. Klik "Tambah Capaian" untuk memulai.
                          </td>
                        </tr>
                      ) : (
                        pageCapaian.map((cap) => {
                          const totalBobotCap = (cap.subCapaian || []).reduce(
                            (acc, sc) => acc + (Number(sc.presentasi) || 0),
                            0
                          )
                          const isPas = Math.round(totalBobotCap * 100) / 100 === 100

                          if (cap.subCapaian.length === 0) {
                            return (
                              <tr key={cap.id} className="divide-x divide-base-300 border-b border-base-300">
                                <td className="px-5 py-3 align-top">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="rounded border border-base-300 px-2 py-0.5 text-xs font-semibold text-base-content">
                                        {cap.label}
                                      </span>
                                      <ActionMenu
                                        items={[
                                          {
                                            label: 'Edit Capaian',
                                            icon: <Pencil className="h-3.5 w-3.5" />,
                                            color: 'text-brand-dark',
                                            onClick: () =>
                                              setEditCapaian({ id: cap.id, label: cap.label, jumlahPoin: cap.jumlahPoin }),
                                          },
                                          {
                                            label: 'Hapus Capaian',
                                            icon: <Trash2 className="h-3.5 w-3.5" />,
                                            color: 'text-red-500',
                                            onClick: () => handleHapusCapaian(cap),
                                          },
                                        ]}
                                      />
                                    </div>
                                    <span className="text-[11px] font-medium text-amber-600">
                                      Bobot: 0% / 100%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-center text-base-content/60">{cap.jumlahPoin ?? '-'}</td>
                                <td className="px-5 py-3 text-base-content/50 italic">Belum ada sub capaian</td>
                                <td className="px-5 py-3 text-center">-</td>
                                <td className="px-5 py-3 text-center">-</td>
                              </tr>
                            )
                          }

                          return cap.subCapaian.map((sc, idx) => (
                            <tr key={sc.id} className="divide-x divide-base-300 border-b border-base-300 last:border-0 hover:bg-base-200">
                              {idx === 0 && (
                                <>
                                  <td rowSpan={cap.subCapaian.length} className="border-r border-base-300 px-5 py-3 align-top">
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="rounded border border-base-300 px-2 py-0.5 text-xs font-semibold text-base-content">
                                          {cap.label}
                                        </span>
                                        <ActionMenu
                                          items={[
                                            {
                                              label: 'Edit Capaian',
                                              icon: <Pencil className="h-3.5 w-3.5" />,
                                              color: 'text-brand-dark',
                                              onClick: () =>
                                                setEditCapaian({ id: cap.id, label: cap.label, jumlahPoin: cap.jumlahPoin }),
                                            },
                                            {
                                              label: 'Hapus Capaian',
                                              icon: <Trash2 className="h-3.5 w-3.5" />,
                                              color: 'text-red-500',
                                              onClick: () => handleHapusCapaian(cap),
                                            },
                                          ]}
                                        />
                                      </div>
                                      {!isPas && (
                                        <span className={`text-[11px] font-medium ${totalBobotCap > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                                          Bobot: {totalBobotCap}% / 100%
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td rowSpan={cap.subCapaian.length} className="border-r border-base-300 px-5 py-3 align-top text-center text-base-content/60">
                                    {cap.jumlahPoin ?? '-'}
                                  </td>
                                </>
                              )}
                              <td className="px-5 py-3 text-base-content">{sc.nama || '-'}</td>
                              <td className="px-5 py-3 text-center font-medium text-base-content">
                                {sc.presentasi != null ? `${sc.presentasi} %` : '-'}
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex justify-center">
                                  <ActionMenu
                                    align="right"
                                    items={[
                                      {
                                        label: 'Edit Sub Capaian',
                                        icon: <Pencil className="h-3.5 w-3.5" />,
                                        color: 'text-brand-dark',
                                        onClick: () => setEditSubCapaian({ ...sc }),
                                      },
                                      {
                                        label: 'Hapus Sub Capaian',
                                        icon: <Trash2 className="h-3.5 w-3.5" />,
                                        color: 'text-red-500',
                                        onClick: () => handleHapusSubCapaian(sc),
                                      },
                                    ]}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-end gap-1 border-t border-base-300 px-5 py-3">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(currentPage - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-base-300 text-base-content/60 transition hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-xs text-base-content/50">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(currentPage + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-base-300 text-base-content/60 transition hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </TableFrame>
            </TableCard>
          </div>
        )}
      </div>
      </>
  )
}

export default ManajemenKurikulum
