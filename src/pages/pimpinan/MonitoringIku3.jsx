import { useEffect, useMemo, useState, Fragment } from 'react'
import { Search, Settings2, Scale, Info, Download, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import StatCard from '../../components/dashboard/StatCard'
import DataTable from '../../components/dashboard/DataTable'
import ActionMenu from '../../components/ui/ActionMenu'
import StatusBadge from '../../components/dashboard/StatusBadge'
import { TableCard, TableFrame } from '../../components/dashboard/TableFrame'
import { ChartSkeleton } from '../../components/dashboard/Skeleton'
import { LineChart, HorizontalBarChart, DoughnutChart } from '../../components/charts'
import Modal from '../../components/ui/Modal'
import { getCurrentUser } from '../../services/authService'
import { getFakultasList, getProdiList } from '../../services/laporanService'
import {
  getIku3Dashboard,
  getIku3Trend,
  getIku3QuarterlyTrend,
  getIku3Faculties,
  getIku3Activities,
  getIku3Targets,
  saveIku3Target,
  getIku3Rules,
  updateIku3Rule,
  createIku3Rule,
  deleteIku3Rule,
  downloadExcelIku3,
} from '../../services/iku3Service'
import { batalBtnClass } from '../../components/ui/buttonStyles'

const ROLE_LABEL = {
  pimpinan_utama: 'Pimpinan Utama',
  pimpinan_ditmawa: 'Pimpinan Ditmawa',
  pimpinan_fakultas: 'Pimpinan Fakultas',
  admin_ditmawa: 'Admin Ditmawa',
  admin_fakultas: 'Admin Fakultas',
}

const GLOBAL_ROLES = new Set(['pimpinan_utama', 'pimpinan_ditmawa', 'admin_ditmawa'])
const TARGET_ROLES = new Set(['pimpinan_ditmawa', 'admin_ditmawa'])
const RULE_ROLES = new Set(['pimpinan_ditmawa', 'admin_ditmawa'])
const PAGE_SIZE = 15

function currentYear() {
  return new Date().getFullYear()
}

function yearOptions(targetYears = []) {
  const now = currentYear()
  const years = new Set([now - 2, now - 1, now, now + 1, ...targetYears])
  return [...years].filter((y) => Number.isFinite(y)).sort((a, b) => b - a)
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID')
}

function formatPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0%'
  return `${n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
}

function formatBobot(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ToolbarSelect({ label, value, onChange, children, disabled = false }) {
  return (
    <label className="flex min-w-36 flex-1 flex-col gap-1">
      <span className="text-xs text-base-content/60">{label}</span>
      <select value={value} onChange={onChange} disabled={disabled} className="select select-sm w-full">
        {children}
      </select>
    </label>
  )
}

function TargetModal({ isOpen, onClose, tahun: initialTahun, onSaved }) {
  const [selectedTahun, setSelectedTahun] = useState(initialTahun || currentYear())
  const [targetPersen, setTargetPersen] = useState('')
  const [targetTw1, setTargetTw1] = useState('')
  const [targetTw2, setTargetTw2] = useState('')
  const [targetTw3, setTargetTw3] = useState('')
  const [targetTw4, setTargetTw4] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [saving, setSaving] = useState(false)
  const [targetsList, setTargetsList] = useState([])

  useEffect(() => {
    if (!isOpen) return
    setSelectedTahun(initialTahun || currentYear())
    getIku3Targets()
      .then((list) => {
        setTargetsList(list)
      })
      .catch(() => {
        setTargetsList([])
      })
  }, [isOpen, initialTahun])

  useEffect(() => {
    if (!isOpen) return
    const current = targetsList.find((t) => Number(t.tahun) === Number(selectedTahun))
    if (current) {
      setTargetPersen(String(current.targetPersen ?? ''))
      setTargetTw1(current.targetTw1 != null ? String(current.targetTw1) : '')
      setTargetTw2(current.targetTw2 != null ? String(current.targetTw2) : '')
      setTargetTw3(current.targetTw3 != null ? String(current.targetTw3) : '')
      setTargetTw4(current.targetTw4 != null ? String(current.targetTw4) : '')
      setKeterangan(current.keterangan || '')
    } else {
      setTargetPersen('')
      setTargetTw1('')
      setTargetTw2('')
      setTargetTw3('')
      setTargetTw4('')
      setKeterangan('')
    }
  }, [selectedTahun, targetsList, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const yr = Number(selectedTahun)
    if (!Number.isInteger(yr) || yr < 2000 || yr > 2100) {
      toast.error('Tahun harus berupa angka antara 2000 dan 2100')
      return
    }
    const value = Number(targetPersen)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast.error('Target tahunan harus berupa angka 0–100')
      return
    }

    const parseTw = (val, label) => {
      if (val === '' || val === null || val === undefined) return null
      const n = Number(val)
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new Error(`Target ${label} harus berupa angka 0–100`)
      }
      return n
    }

    let tw1 = null
    let tw2 = null
    let tw3 = null
    let tw4 = null
    try {
      tw1 = parseTw(targetTw1, 'Triwulan 1')
      tw2 = parseTw(targetTw2, 'Triwulan 2')
      tw3 = parseTw(targetTw3, 'Triwulan 3')
      tw4 = parseTw(targetTw4, 'Triwulan 4')
    } catch (err) {
      toast.error(err.message)
      return
    }

    setSaving(true)
    try {
      const res = await saveIku3Target({
        tahun: yr,
        targetPersen: value,
        targetTw1: tw1,
        targetTw2: tw2,
        targetTw3: tw3,
        targetTw4: tw4,
        keterangan: keterangan.trim() || undefined,
      })
      toast.success(res?.message || `Target tahun ${yr} disimpan.`)
      onSaved?.(yr)
      onClose()
    } catch (err) {
      toast.error('Gagal menyimpan target', { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Atur Target IKU 3"
      description="Tentukan target capaian tahunan dan target per triwulan."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-base-content/80">
              Tahun <span className="text-error">*</span>
            </label>
            <input
              type="number"
              min="2000"
              max="2100"
              required
              value={selectedTahun}
              onChange={(e) => setSelectedTahun(e.target.value)}
              placeholder="Contoh: 2026"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-base-content/80">
              Target Tahunan (%) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={targetPersen}
              onChange={(e) => setTargetPersen(e.target.value)}
              placeholder="Contoh: 50"
              className="input w-full"
            />
          </div>
        </div>

        <div className="rounded-lg border border-base-200 bg-base-200/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-base-content/80">Target per Triwulan</span>
            <span className="text-[11px] text-base-content/50">Opsional (% per triwulan)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-base-content/60">TW 1 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={targetTw1}
                onChange={(e) => setTargetTw1(e.target.value)}
                placeholder="TW 1"
                className="input input-sm w-full bg-base-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-base-content/60">TW 2 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={targetTw2}
                onChange={(e) => setTargetTw2(e.target.value)}
                placeholder="TW 2"
                className="input input-sm w-full bg-base-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-base-content/60">TW 3 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={targetTw3}
                onChange={(e) => setTargetTw3(e.target.value)}
                placeholder="TW 3"
                className="input input-sm w-full bg-base-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-base-content/60">TW 4 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={targetTw4}
                onChange={(e) => setTargetTw4(e.target.value)}
                placeholder="TW 4"
                className="input input-sm w-full bg-base-100"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-base-content/80">
            Keterangan
          </label>
          <input
            type="text"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Opsional (misal: Target Resmi IKU 3 Kepmen 358/2025)"
            className="input w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-base-200">
          <button type="button" onClick={onClose} disabled={saving} className={batalBtnClass}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RulesModal({ isOpen, onClose, onSaved }) {
  const [rules, setRules] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [activeTab, setActiveTab] = useState('pembelajaran')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newRuleForm, setNewRuleForm] = useState({
    jenis: 'pembelajaran',
    skala: 'Nasional',
    peran: '',
    sksMin: '',
    sksMax: '',
    bobot: '',
    keterangan: '',
    tahunMulai: currentYear(),
  })
  const [savingNewRule, setSavingNewRule] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const initDrafts = (list) => {
    return Object.fromEntries(
      list.map((r) => [
        r.id,
        {
          bobot: String(r.bobot ?? ''),
          sksMin: r.sksMin != null ? String(r.sksMin) : '',
          sksMax: r.sksMax != null ? String(r.sksMax) : '',
        },
      ])
    )
  }

  useEffect(() => {
    if (!isOpen) return
    setIsEditing(false)
    setLoading(true)
    getIku3Rules()
      .then((list) => {
        setRules(list)
        setDrafts(initDrafts(list))
      })
      .catch((err) => {
        toast.error('Gagal memuat aturan bobot', { description: err.message })
        setRules([])
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleSaveAll = async () => {
    // Validate all drafts
    const updates = []
    for (const rule of rules) {
      const draft = drafts[rule.id] || {}
      const bobotVal = draft.bobot !== undefined ? draft.bobot : String(rule.bobot ?? '')
      const bobotNum = Number(bobotVal)
      if (!Number.isFinite(bobotNum) || bobotNum < 0 || bobotNum > 1) {
        toast.error(`Bobot untuk "${rule.keterangan || rule.peran}" harus berupa angka antara 0.00 dan 1.00`)
        return
      }

      let sksMinNum = rule.sksMin
      let sksMaxNum = rule.sksMax

      if (rule.jenis === 'pembelajaran') {
        const minStr = draft.sksMin !== undefined ? draft.sksMin : (rule.sksMin != null ? String(rule.sksMin) : '')
        const maxStr = draft.sksMax !== undefined ? draft.sksMax : (rule.sksMax != null ? String(rule.sksMax) : '')

        sksMinNum = minStr !== '' ? Number(minStr) : null
        sksMaxNum = maxStr !== '' ? Number(maxStr) : null

        if (sksMinNum !== null && (!Number.isInteger(sksMinNum) || sksMinNum < 0)) {
          toast.error(`SKS minimal untuk "${rule.keterangan}" harus berupa bilangan bulat >= 0`)
          return
        }
        if (sksMaxNum !== null && (!Number.isInteger(sksMaxNum) || sksMaxNum < 0)) {
          toast.error(`SKS maksimal untuk "${rule.keterangan}" harus berupa bilangan bulat >= 0`)
          return
        }
        if (sksMinNum !== null && sksMaxNum !== null && sksMinNum > sksMaxNum) {
          toast.error(`SKS minimal tidak boleh lebih besar dari SKS maksimal pada "${rule.keterangan}"`)
          return
        }
      }

      const hasChanged =
        bobotNum !== Number(rule.bobot) ||
        (rule.jenis === 'pembelajaran' && (sksMinNum !== rule.sksMin || sksMaxNum !== rule.sksMax))

      if (hasChanged) {
        updates.push({
          id: rule.id,
          payload: {
            bobot: bobotNum,
            sksMin: sksMinNum,
            sksMax: sksMaxNum,
            keterangan: rule.keterangan || undefined,
          },
        })
      }
    }

    if (updates.length === 0) {
      setIsEditing(false)
      return
    }

    setSavingAll(true)
    try {
      await Promise.all(updates.map((u) => updateIku3Rule(u.id, u.payload)))
      toast.success('Aturan bobot berhasil diperbarui.')
      const updatedList = await getIku3Rules()
      setRules(updatedList)
      setDrafts(initDrafts(updatedList))
      setIsEditing(false)
      onSaved()
    } catch (err) {
      toast.error('Gagal memperbarui aturan bobot', { description: err.message })
    } finally {
      setSavingAll(false)
    }
  }

  const handleCreateRule = async (e) => {
    e?.preventDefault()
    const bobotNum = Number(newRuleForm.bobot)
    if (!Number.isFinite(bobotNum) || bobotNum < 0 || bobotNum > 1) {
      toast.error('Nilai bobot harus berupa angka antara 0.00 dan 1.00')
      return
    }

    if (activeTab === 'pembelajaran') {
      if (!newRuleForm.keterangan.trim()) {
        toast.error('Kategori & Aktivitas wajib diisi')
        return
      }
      const minVal = newRuleForm.sksMin !== '' ? Number(newRuleForm.sksMin) : null
      const maxVal = newRuleForm.sksMax !== '' ? Number(newRuleForm.sksMax) : null
      if (minVal !== null && (!Number.isInteger(minVal) || minVal < 0)) {
        toast.error('SKS minimal harus berupa bilangan bulat >= 0')
        return
      }
      if (maxVal !== null && (!Number.isInteger(maxVal) || maxVal < 0)) {
        toast.error('SKS maksimal harus berupa bilangan bulat >= 0')
        return
      }
      if (minVal !== null && maxVal !== null && minVal > maxVal) {
        toast.error('SKS minimal tidak boleh lebih besar dari SKS maksimal')
        return
      }
    } else {
      if (!newRuleForm.skala.trim()) {
        toast.error('Tingkat / skala prestasi wajib diisi')
        return
      }
      if (!newRuleForm.peran.trim()) {
        toast.error('Posisi capaian / peran wajib diisi (misal: Juara 1, Finalis)')
        return
      }
    }

    setSavingNewRule(true)
    try {
      const payload = {
        jenis: activeTab,
        bobot: bobotNum,
        tahunMulai: newRuleForm.tahunMulai ? Number(newRuleForm.tahunMulai) : currentYear(),
        keterangan: newRuleForm.keterangan.trim() || undefined,
        sksMin: activeTab === 'pembelajaran' && newRuleForm.sksMin !== '' ? Number(newRuleForm.sksMin) : undefined,
        sksMax: activeTab === 'pembelajaran' && newRuleForm.sksMax !== '' ? Number(newRuleForm.sksMax) : undefined,
        skala: activeTab === 'prestasi' ? newRuleForm.skala.trim() : undefined,
        peran: activeTab === 'prestasi' ? newRuleForm.peran.trim() : undefined,
      }

      await createIku3Rule(payload)
      toast.success('Aturan bobot berhasil ditambahkan')
      setShowAddModal(false)
      const updatedList = await getIku3Rules()
      setRules(updatedList)
      setDrafts(initDrafts(updatedList))
      onSaved()
    } catch (err) {
      toast.error('Gagal menambahkan aturan bobot', { description: err.message })
    } finally {
      setSavingNewRule(false)
    }
  }

  const handleDeleteRule = async (id, namaAturan) => {
    if (!window.confirm(`Yakin ingin menghapus aturan "${namaAturan}"?`)) {
      return
    }

    setDeletingId(id)
    try {
      await deleteIku3Rule(id)
      toast.success('Aturan bobot berhasil dihapus')
      const updatedList = await getIku3Rules()
      setRules(updatedList)
      setDrafts(initDrafts(updatedList))
      onSaved()
    } catch (err) {
      toast.error('Gagal menghapus aturan bobot', { description: err.message })
    } finally {
      setDeletingId(null)
    }
  }

  const pembelajaranRules = rules.filter((r) => r.jenis === 'pembelajaran')
  const prestasiRules = rules.filter((r) => r.jenis === 'prestasi')

  const prestasiBySkala = useMemo(() => {
    const groups = { Internasional: [], Nasional: [], Provinsi: [] }
    prestasiRules.forEach((r) => {
      const sk = r.skala || 'Nasional'
      if (!groups[sk]) groups[sk] = []
      groups[sk].push(r)
    })
    return groups
  }, [prestasiRules])

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Kelola Bobot IKU 3"
      description="Konfigurasi rentang SKS dan nilai bobot kontribusi mahasiswa mengacu pada Kepmen 358/M/KEP/2025."
      size="3xl"
    >
      <div className="space-y-4">
        {/* Info Tip */}
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-base-content/80">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <span>
            Setiap mahasiswa yang berkegiatan dihitung dengan bobot <strong>0.00 – 1.00</strong> (maksimal 1.00 per mahasiswa).
            Perubahan bobot atau rentang SKS langsung memengaruhi kalkulasi capaian IKU 3.
          </span>
        </div>

        {/* Tab Navigation & Tombol Tambah */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab('pembelajaran')}
              className={`border-b-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'pembelajaran'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-base-content/60 hover:text-base-content'
              }`}
            >
              Pembelajaran Luar Kampus ({pembelajaranRules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prestasi')}
              className={`border-b-2 px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'prestasi'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-base-content/60 hover:text-base-content'
              }`}
            >
              Prestasi & Kompetisi ({prestasiRules.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewRuleForm({
                jenis: activeTab,
                skala: 'Nasional',
                peran: '',
                sksMin: '',
                sksMax: '',
                bobot: '',
                keterangan: '',
                tahunMulai: currentYear(),
              })
              setShowAddModal(true)
            }}
            className="btn btn-xs sm:btn-sm btn-outline btn-primary gap-1.5 mb-1 mr-1 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah {activeTab === 'pembelajaran' ? 'Pembelajaran' : 'Prestasi'}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="mt-2 text-xs text-base-content/50">Memuat aturan bobot…</p>
          </div>
        ) : activeTab === 'pembelajaran' ? (
          /* TAB 1: PEMBELAJARAN (SKS & BOBOT) */
          <div className="overflow-x-auto rounded-lg border border-base-200">
            <table className="table table-sm w-full">
              <thead className="bg-base-200 text-base-content/70">
                <tr>
                  <th className="font-semibold text-xs py-2.5">Kategori & Aktivitas</th>
                  <th className="font-semibold text-xs py-2.5 text-center w-56">Rentang SKS</th>
                  <th className="font-semibold text-xs py-2.5 text-center w-36">Bobot</th>
                  {isEditing && <th className="font-semibold text-xs py-2.5 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200">
                {pembelajaranRules.map((rule) => {
                  const curDraft = drafts[rule.id] || {
                    bobot: String(rule.bobot ?? ''),
                    sksMin: rule.sksMin != null ? String(rule.sksMin) : '',
                    sksMax: rule.sksMax != null ? String(rule.sksMax) : '',
                  }

                  return (
                    <tr key={rule.id} className="hover:bg-base-200/30">
                      <td className="py-3">
                        <div>
                          <p className="font-semibold text-xs sm:text-sm text-base-content">
                            {rule.keterangan || 'Pembelajaran Luar Kampus'}
                          </p>
                          <p className="text-[11px] text-base-content/60">
                            Magang, Studi Independen, Riset, Pertukaran Mahasiswa (MBKM)
                          </p>
                        </div>
                      </td>

                      <td className="py-3 text-center">
                        {isEditing ? (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={curDraft.sksMin ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setDrafts((prev) => ({
                                  ...prev,
                                  [rule.id]: { ...prev[rule.id], sksMin: val },
                                }))
                              }}
                              placeholder="Min"
                              className="input input-sm w-16 text-center font-semibold text-base-content"
                              title="SKS Minimal"
                            />
                            <span className="text-xs text-base-content/60 font-medium">s.d.</span>
                            <input
                              type="number"
                              min="0"
                              max="999"
                              value={curDraft.sksMax ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setDrafts((prev) => ({
                                  ...prev,
                                  [rule.id]: { ...prev[rule.id], sksMax: val },
                                }))
                              }}
                              placeholder="Maks"
                              className="input input-sm w-16 text-center font-semibold text-base-content"
                              title="SKS Maksimal (kosongkan bila tanpa batas)"
                            />
                            <span className="text-xs font-medium text-base-content/60">SKS</span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-base-content">
                            {rule.sksMin ?? 0} s.d. {rule.sksMax != null ? `${rule.sksMax} SKS` : 'Maks SKS'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 text-center">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              value={curDraft.bobot ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setDrafts((prev) => ({
                                  ...prev,
                                  [rule.id]: { ...prev[rule.id], bobot: val },
                                }))
                              }}
                              placeholder="0.00"
                              className="input input-sm w-20 text-center font-semibold text-base-content"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-base-content">
                            {Number(rule.bobot ?? 0).toFixed(2)}
                          </span>
                        )}
                      </td>

                      {isEditing && (
                        <td className="py-3 text-center">
                          <button
                            type="button"
                            disabled={deletingId === rule.id}
                            onClick={() => handleDeleteRule(rule.id, rule.keterangan || 'Pembelajaran')}
                            className="btn btn-ghost btn-xs text-error hover:bg-error/10 p-1"
                            title="Hapus aturan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: PRESTASI (SKALA & PERAN) */
          <div className="overflow-x-auto rounded-lg border border-base-200">
            <table className="table table-sm w-full">
              <thead className="bg-base-200 text-base-content/70">
                <tr>
                  <th className="font-semibold text-xs py-2.5 text-center">Tingkat & Posisi Capaian</th>
                  <th className="font-semibold text-xs py-2.5 text-center">Keterangan</th>
                  <th className="font-semibold text-xs py-2.5 text-center w-36">Bobot</th>
                  {isEditing && <th className="font-semibold text-xs py-2.5 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200">
                {Object.entries(prestasiBySkala).map(([skala, items]) => (
                  <Fragment key={skala}>
                    <tr className="bg-base-200/40">
                      <td colSpan={isEditing ? 4 : 3} className="py-2 px-3.5 text-xs font-bold text-base-content uppercase tracking-wider text-center">
                        Tingkat {skala}
                      </td>
                    </tr>
                    {items.map((rule) => {
                      const curDraft = drafts[rule.id] || { bobot: String(rule.bobot ?? '') }

                      return (
                        <tr key={rule.id} className="hover:bg-base-200/30">
                          <td className="py-2.5 font-semibold text-xs text-base-content pl-6">
                            {rule.peran}
                          </td>
                          <td className="py-2.5 text-xs text-base-content/60">
                            {rule.keterangan || `Juara ${rule.peran}`}
                          </td>
                          <td className="py-2.5 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.01"
                                value={curDraft.bobot ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [rule.id]: { ...prev[rule.id], bobot: val },
                                  }))
                                }}
                                placeholder="0.00"
                                className="input input-sm w-20 text-center font-semibold text-base-content"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-base-content">
                                {Number(rule.bobot ?? 0).toFixed(2)}
                              </span>
                            )}
                          </td>

                          {isEditing && (
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                disabled={deletingId === rule.id}
                                onClick={() => handleDeleteRule(rule.id, `${rule.skala} - ${rule.peran}`)}
                                className="btn btn-ghost btn-xs text-error hover:bg-error/10 p-1"
                                title="Hapus aturan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-base-200">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn-primary btn-sm"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDrafts(initDrafts(rules))
                  setIsEditing(false)
                }}
                disabled={savingAll}
                className={batalBtnClass}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={savingAll}
                className="btn btn-primary btn-sm"
              >
                {savingAll ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          )}
        </div>
      </div>
      </Modal>

      {/* Sub-Modal Tambah Aturan Bobot */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          if (!savingNewRule) setShowAddModal(false)
        }}
        title={activeTab === 'pembelajaran' ? 'Tambah Aturan Pembelajaran Luar Kampus' : 'Tambah Aturan Prestasi & Kompetisi'}
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          {activeTab === 'pembelajaran' ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-base-content">
                  Kategori & Aktivitas <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={newRuleForm.keterangan}
                  onChange={(e) => setNewRuleForm((p) => ({ ...p, keterangan: e.target.value }))}
                  placeholder="Contoh: Wirausaha Merdeka (WMK) atau Magang Mandiri"
                  className="input w-full"
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-base-content">
                    SKS Minimal
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={newRuleForm.sksMin}
                    onChange={(e) => setNewRuleForm((p) => ({ ...p, sksMin: e.target.value }))}
                    placeholder="Contoh: 10"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-base-content">
                    SKS Maksimal
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={newRuleForm.sksMax}
                    onChange={(e) => setNewRuleForm((p) => ({ ...p, sksMax: e.target.value }))}
                    placeholder="Kosongkan jika tanpa batas"
                    className="input w-full"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-base-content">
                  Tingkat / Skala <span className="text-error">*</span>
                </label>
                <select
                  value={newRuleForm.skala}
                  onChange={(e) => setNewRuleForm((p) => ({ ...p, skala: e.target.value }))}
                  className="select w-full"
                  required
                >
                  <option value="Internasional">Tingkat Internasional</option>
                  <option value="Nasional">Tingkat Nasional</option>
                  <option value="Provinsi">Tingkat Provinsi</option>
                  <option value="Wilayah">Tingkat Wilayah / Regional</option>
                  <option value="Lokal">Tingkat Lokal / Internal</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-base-content">
                  Posisi Capaian / Peran <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={newRuleForm.peran}
                  onChange={(e) => setNewRuleForm((p) => ({ ...p, peran: e.target.value }))}
                  placeholder="Contoh: Juara 1, Juara 2/3/Favorit, Finalis, Best Paper"
                  className="input w-full"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-base-content">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={newRuleForm.keterangan}
                  onChange={(e) => setNewRuleForm((p) => ({ ...p, keterangan: e.target.value }))}
                  placeholder="Contoh: Juara 1 Tingkat Nasional"
                  className="input w-full"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-base-content">
              Nilai Bobot (0.00 – 1.00) <span className="text-error">*</span>
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={newRuleForm.bobot}
              onChange={(e) => setNewRuleForm((p) => ({ ...p, bobot: e.target.value }))}
              placeholder="Contoh: 0.80 atau 1.00"
              className="input w-full"
              required
            />
            <p className="mt-1 text-xs text-base-content/50">
              Sesuai Kepmen 358/2025, bobot per kegiatan bernilai antara 0.00 s.d. 1.00.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-base-200 pt-4">
            <button
              type="button"
              disabled={savingNewRule}
              onClick={() => setShowAddModal(false)}
              className={batalBtnClass}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingNewRule}
              className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              {savingNewRule ? 'Menyimpan…' : 'Simpan Aturan'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function MonitoringIku3({ defaultRole, embedded = false }) {
  const user = getCurrentUser()
  const resolvedRole = defaultRole || user?.role || 'pimpinan_ditmawa'
  const isGlobalScope = GLOBAL_ROLES.has(resolvedRole)
  const canSetTarget = TARGET_ROLES.has(resolvedRole)
  const canEditRules = RULE_ROLES.has(resolvedRole)

  const [tahun, setTahun] = useState(currentYear())
  const [triwulan, setTriwulan] = useState('')
  const [fakultasId, setFakultasId] = useState('')
  const [prodiId, setProdiId] = useState('')
  const [fakultasOptions, setFakultasOptions] = useState([])
  const [prodiOptions, setProdiOptions] = useState([])
  const [targetYears, setTargetYears] = useState([])

  const [dashboard, setDashboard] = useState(null)
  const [trend, setTrend] = useState([])
  const [quarterlyTrend, setQuarterlyTrend] = useState([])
  const [faculties, setFaculties] = useState([])
  const [activities, setActivities] = useState([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityPages, setActivityPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchApplied, setSearchApplied] = useState('')

  const [loadingKpi, setLoadingKpi] = useState(true)
  const [loadingCharts, setLoadingCharts] = useState(true)
  const [loadingTable, setLoadingTable] = useState(true)

  const [showTargetModal, setShowTargetModal] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  const handleDownloadExcel = async () => {
    try {
      setExportingExcel(true)
      toast.info('Menyiapkan laporan Excel IKU 3...')
      await downloadExcelIku3(filterParams)
      toast.success('Laporan Excel IKU 3 berhasil diunduh')
    } catch (err) {
      console.error('Failed to export IKU3 Excel:', err)
      toast.error(err?.response?.data?.message || 'Gagal mengunduh laporan Excel IKU 3')
    } finally {
      setExportingExcel(false)
    }
  }

  const filterParams = useMemo(() => ({
    tahun: Number(tahun) || currentYear(),
    triwulan: triwulan ? Number(triwulan) : undefined,
    fakultasId: isGlobalScope && fakultasId ? Number(fakultasId) : undefined,
    prodiId: isGlobalScope && prodiId ? Number(prodiId) : undefined,
  }), [tahun, triwulan, fakultasId, prodiId, isGlobalScope])

  useEffect(() => {
    getFakultasList().then(setFakultasOptions).catch(() => setFakultasOptions([]))
    getIku3Targets()
      .then((list) => setTargetYears(list.map((t) => Number(t.tahun)).filter(Boolean)))
      .catch(() => setTargetYears([]))
  }, [])

  useEffect(() => {
    if (!isGlobalScope || !fakultasId) {
      setProdiOptions([])
      setProdiId('')
      return
    }
    getProdiList(fakultasId).then(setProdiOptions).catch(() => setProdiOptions([]))
    setProdiId('')
  }, [fakultasId, isGlobalScope])

  useEffect(() => {
    const timer = setTimeout(() => setSearchApplied(search.trim()), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [tahun, triwulan, fakultasId, prodiId, searchApplied])

  useEffect(() => {
    let cancelled = false
    setLoadingKpi(true)
    getIku3Dashboard(filterParams)
      .then((data) => {
        if (!cancelled) setDashboard(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setDashboard(null)
          toast.error('Gagal memuat ringkasan IKU 3', { description: err.message })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingKpi(false)
      })
    return () => { cancelled = true }
  }, [filterParams])

  useEffect(() => {
    let cancelled = false
    setLoadingCharts(true)
    Promise.all([
      getIku3Trend({ fakultasId: filterParams.fakultasId }),
      getIku3QuarterlyTrend({
        tahun: filterParams.tahun,
        fakultasId: filterParams.fakultasId,
        prodiId: filterParams.prodiId,
      }),
      getIku3Faculties({ tahun: filterParams.tahun, triwulan: filterParams.triwulan }),
    ])
      .then(([trendData, quarterlyData, facultyData]) => {
        if (cancelled) return
        setTrend(trendData)
        setQuarterlyTrend(quarterlyData)
        setFaculties(facultyData)
      })
      .catch((err) => {
        if (cancelled) return
        setTrend([])
        setQuarterlyTrend([])
        setFaculties([])
        toast.error('Gagal memuat grafik IKU 3', { description: err.message })
      })
      .finally(() => {
        if (!cancelled) setLoadingCharts(false)
      })
    return () => { cancelled = true }
  }, [filterParams.tahun, filterParams.triwulan, filterParams.fakultasId, filterParams.prodiId])

  useEffect(() => {
    let cancelled = false
    setLoadingTable(true)
    getIku3Activities({
      ...filterParams,
      search: searchApplied || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        setActivities(res.data || [])
        setActivityTotal(res.total)
        setActivityPages(Math.max(1, res.totalPages || 1))
      })
      .catch((err) => {
        if (cancelled) return
        setActivities([])
        setActivityTotal(0)
        setActivityPages(1)
        toast.error('Gagal memuat daftar kontributor', { description: err.message })
      })
      .finally(() => {
        if (!cancelled) setLoadingTable(false)
      })
    return () => { cancelled = true }
  }, [filterParams, searchApplied, page])

  const kpi = dashboard?.kpi || {}
  const rumpun = dashboard?.rumpunDistribusi || {}
  const cakupan = dashboard?.cakupan || {}
  const tercapai = kpi.statusTarget === 'tercapai'
  const years = yearOptions(targetYears)

  const refetchAfterWrite = (savedYear) => {
    if (savedYear) {
      setTahun(Number(savedYear))
    }
    getIku3Targets()
      .then((list) => setTargetYears(list.map((t) => Number(t.tahun)).filter(Boolean)))
      .catch(() => {})

    const targetTahun = savedYear ? Number(savedYear) : filterParams.tahun
    const currentParams = { ...filterParams, tahun: targetTahun }

    getIku3Dashboard(currentParams).then(setDashboard).catch(() => {})
    getIku3Trend({ fakultasId: currentParams.fakultasId }).then(setTrend).catch(() => {})
    getIku3QuarterlyTrend({
      tahun: currentParams.tahun,
      fakultasId: currentParams.fakultasId,
      prodiId: currentParams.prodiId,
    }).then(setQuarterlyTrend).catch(() => {})
    getIku3Faculties({ tahun: currentParams.tahun, triwulan: currentParams.triwulan }).then(setFaculties).catch(() => {})
    getIku3Activities({
      ...currentParams,
      search: searchApplied || undefined,
      page,
      limit: PAGE_SIZE,
    }).then((res) => {
      setActivities(res.data || [])
      setActivityTotal(res.total)
      setActivityPages(Math.max(1, res.totalPages || 1))
    }).catch(() => {})
  }

  const content = (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-base-content">Monitoring IKU 3</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Kemdiktisaintek Berdampak 2026 · {cakupan.fakultas || 'Universitas Andalas'}
            {cakupan.prodi ? ` · ${cakupan.prodi}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm shadow-xs flex items-center gap-1.5"
            onClick={handleDownloadExcel}
            disabled={exportingExcel}
          >
            <Download className="w-4 h-4" />
            {exportingExcel ? 'Mengunduh...' : 'Unduh Laporan Excel'}
          </button>
          {canSetTarget ? (
            <button
              type="button"
              className="btn btn-primary btn-sm text-white shadow-xs"
              onClick={() => setShowTargetModal(true)}
            >
              Atur target
            </button>
          ) : null}
          {canEditRules ? (
            <button
              type="button"
              className="btn btn-primary btn-sm text-white shadow-xs"
              onClick={() => setShowRulesModal(true)}
            >
              Kelola bobot
            </button>
          ) : null}
        </div>
      </div>

      <div className="card bg-base-100 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <ToolbarSelect label="Tahun" value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect label="Triwulan" value={triwulan} onChange={(e) => setTriwulan(e.target.value)}>
            <option value="">Semua</option>
            <option value="1">Triwulan 1</option>
            <option value="2">Triwulan 2</option>
            <option value="3">Triwulan 3</option>
            <option value="4">Triwulan 4</option>
          </ToolbarSelect>
          {isGlobalScope ? (
            <ToolbarSelect
              label="Fakultas"
              value={fakultasId}
              onChange={(e) => setFakultasId(e.target.value)}
            >
              <option value="">Semua</option>
              {fakultasOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.nama}</option>
              ))}
            </ToolbarSelect>
          ) : (
            <label className="flex min-w-36 flex-1 flex-col gap-1">
              <span className="text-xs text-base-content/60">Fakultas</span>
              <input
                type="text"
                disabled
                value={cakupan.fakultas || 'Fakultas Anda'}
                className="input input-sm w-full"
              />
            </label>
          )}
          {isGlobalScope && fakultasId ? (
            <ToolbarSelect label="Program studi" value={prodiId} onChange={(e) => setProdiId(e.target.value)}>
              <option value="">Semua</option>
              {prodiOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </ToolbarSelect>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Capaian IKU 3" value={formatPercent(kpi.capaian)} loading={loadingKpi} />
        <StatCard label="Target" value={formatPercent(kpi.target)} loading={loadingKpi} />
        <StatCard label="Total mahasiswa" value={formatNumber(kpi.totalMahasiswa)} loading={loadingKpi} />
        <StatCard label="Kontributor" value={formatNumber(kpi.totalKontributor)} loading={loadingKpi} />
      </div>

      {!loadingKpi && kpi.statusTarget ? (
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
            tercapai
              ? 'border-success/30 bg-success/5 text-base-content'
              : 'border-warning/30 bg-warning/5 text-base-content'
          }`}
        >
          <StatusBadge status={kpi.statusTarget} />
          <span className="text-xs sm:text-sm text-base-content/80 font-medium">
            {tercapai
              ? `Target tahun ${kpi.tahun} sudah tercapai.`
              : `Butuh +${formatNumber(kpi.gapMahasiswa)} mahasiswa lagi untuk mencapai target tahun ${kpi.tahun}.`}
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 p-5">
          <h3 className="text-sm font-semibold text-base-content">Tren capaian tahunan</h3>
          <p className="mt-1 text-xs text-base-content/60">Capaian dibanding target per tahun kalender</p>
          {loadingCharts ? (
            <ChartSkeleton height={280} />
          ) : trend.length === 0 ? (
            <p className="py-10 text-center text-sm text-base-content/50">Belum ada data tren.</p>
          ) : (
            <LineChart
              labels={trend.map((t) => String(t.tahun))}
              datasets={[
                { label: 'Capaian %', data: trend.map((t) => Number(t.capaian) || 0) },
                { label: 'Target %', data: trend.map((t) => Number(t.target) || 0) },
              ]}
              height={280}
            />
          )}
        </div>

        <div className="card bg-base-100 p-5">
          <h3 className="text-sm font-semibold text-base-content">Tren capaian per triwulan ({tahun})</h3>
          <p className="mt-1 text-xs text-base-content/60">Capaian dibanding target per triwulan</p>
          {loadingCharts ? (
            <ChartSkeleton height={280} />
          ) : quarterlyTrend.length === 0 ? (
            <p className="py-10 text-center text-sm text-base-content/50">Belum ada data tren triwulan.</p>
          ) : (
            <LineChart
              labels={quarterlyTrend.map((q) => q.label || `TW ${q.triwulan}`)}
              datasets={[
                { label: 'Capaian %', data: quarterlyTrend.map((q) => Number(q.capaian) || 0) },
                { label: 'Target %', data: quarterlyTrend.map((q) => Number(q.target) || 0) },
              ]}
              height={280}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 p-5">
          <h3 className="text-sm font-semibold text-base-content">Peringkat per fakultas</h3>
          <p className="mt-1 text-xs text-base-content/60">Persentase capaian IKU 3</p>
          {loadingCharts ? (
            <ChartSkeleton height={280} />
          ) : faculties.length === 0 ? (
            <p className="py-10 text-center text-sm text-base-content/50">Belum ada data fakultas.</p>
          ) : (
            <HorizontalBarChart
              labels={faculties.map((f) => f.namaFakultas)}
              values={faculties.map((f) => Number(f.capaianPersen) || 0)}
              max={100}
            />
          )}
        </div>

        <div className="card bg-base-100 p-5">
          <h3 className="text-sm font-semibold text-base-content">Dekomposisi rumpun kontributor</h3>
          <p className="mt-1 text-xs text-base-content/60">Prestasi kompetisi dan pembelajaran luar kampus</p>
          {loadingKpi ? (
            <ChartSkeleton height={240} variant="donut" />
          ) : !(Number(rumpun.prestasi?.count) || Number(rumpun.pembelajaran?.count)) ? (
            <p className="py-10 text-center text-sm text-base-content/50">Belum ada sebaran rumpun.</p>
          ) : (
            <div className="grid items-center gap-4 md:grid-cols-[16rem_1fr]">
              <DoughnutChart
                labels={['Prestasi kompetisi', 'Pembelajaran luar kampus']}
                values={[
                  Number(rumpun.prestasi?.count) || 0,
                  Number(rumpun.pembelajaran?.count) || 0,
                ]}
                centerLabel="Kontributor"
                centerValue={formatNumber(
                  (Number(rumpun.prestasi?.count) || 0) + (Number(rumpun.pembelajaran?.count) || 0),
                )}
                height={240}
              />
              <div className="space-y-2 text-sm">
                <p>
                  Prestasi kompetisi: {formatNumber(rumpun.prestasi?.count)} kegiatan
                  {' '}({formatPercent(rumpun.prestasi?.persentase)})
                </p>
                <p>
                  Pembelajaran luar kampus: {formatNumber(rumpun.pembelajaran?.count)} kegiatan
                  {' '}({formatPercent(rumpun.pembelajaran?.persentase)})
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <TableCard title="Mahasiswa kontributor">
        <label className="input input-sm w-full max-w-md">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari NIM, nama, atau kegiatan"
          />
        </label>
        <TableFrame>
          <DataTable
            columns={[
              { key: '_no', label: 'No' },
              { key: 'nim', label: 'NIM' },
              { key: 'namaMahasiswa', label: 'Nama' },
              { key: 'fakultas', label: 'Fakultas' },
              { key: 'namaKegiatan', label: 'Kegiatan' },
              { key: 'skala', label: 'Skala' },
              { key: 'peran', label: 'Peran' },
              {
                key: 'bobot',
                label: 'Bobot',
                center: true,
                render: (row) => formatBobot(row.bobot),
              },
            ]}
            data={activities.map((row, i) => ({
              ...row,
              _no: (page - 1) * PAGE_SIZE + i + 1,
            }))}
            loading={loadingTable}
            emptyText="Tidak ada kontributor pada filter ini."
            page={page}
            totalPages={activityPages}
            onPageChange={setPage}
            pageSize={PAGE_SIZE}
            totalItems={activityTotal}
          />
        </TableFrame>
      </TableCard>

      {canSetTarget ? (
        <TargetModal
          isOpen={showTargetModal}
          onClose={() => setShowTargetModal(false)}
          tahun={tahun}
          onSaved={refetchAfterWrite}
        />
      ) : null}
      {canEditRules ? (
        <RulesModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          onSaved={refetchAfterWrite}
        />
      ) : null}
    </div>
  )

  if (embedded) return content

  return (
    <DashboardLayout
      role={resolvedRole}
      userName={user?.nama || ROLE_LABEL[resolvedRole] || 'Pengguna'}
      userRole={ROLE_LABEL[resolvedRole] || 'Pengguna'}
    >
      {content}
    </DashboardLayout>
  )
}

export default MonitoringIku3
