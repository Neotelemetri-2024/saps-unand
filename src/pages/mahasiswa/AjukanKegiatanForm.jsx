import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Info,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { DetailBackButton } from '../../components/ui/DetailComponents'
import StatusBadge from '../../components/dashboard/StatusBadge'
import DatePickerInput from '../../components/ui/DatePickerInput'
import ConfirmModal from '../../components/ui/ConfirmModal'
import SimilarActivityModal from '../../components/ui/SimilarActivityModal'
import InfoTooltip from '../../components/ui/InfoTooltip'
import {
  ajukanKegiatan,
  simpanDraftKegiatanEksternal,
  editDraftKegiatanEksternal,
  ajukanDraftKegiatanEksternal,
  mintaPersetujuanDosenEksternal,
  getKegiatanEksternalTerdaftar,
} from '../../services/pengajuanService'
import { getKategoriKegiatan, getSkalaKegiatan } from '../../services/matriksService'
import { getCurrentUser } from '../../services/authService'
import { batalBtnClass } from '../../components/ui/buttonStyles'

const EMPTY_FORM = {
  kategoriId: '',
  namaKegiatan: '',
  penyelenggara: '',
  skalaId: '',
  tanggalPelaksanaan: null,
  deskripsiKegiatan: '',
  linkWebsite: '',
  emailPenyelenggara: '',
}

function toISODate(d) {
  if (!d) return null
  if (typeof d === 'string') return d
  return d.toISOString().split('T')[0]
}

function AjukanKegiatanForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getCurrentUser()

  // Jika dinavigasi dari tabel draft → mode edit
  // isRevisi: dinavigasi dari tabel revisi → edit + ajukan ulang
  const draftItem = location.state?.draft || null
  const isRevisi = !!(location.state?.isRevisi && draftItem)
  const isEditDraft = !!draftItem && !isRevisi
  const selectedKegiatan = location.state?.selectedKegiatan || null
  const isModeTerdaftar = location.state?.mode === 'terdaftar' && !!selectedKegiatan
  const [submittingIzin, setSubmittingIzin] = useState(false)

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [draftId, setDraftId] = useState(draftItem?.id || null)
  const [showKirimConfirm, setShowKirimConfirm] = useState(false)
  const [kategoriList, setKategoriList] = useState([])
  const [skalaList, setSkalaList] = useState([])

  // State untuk Autocomplete & Deteksi Duplikasi
  const [selectedExistingKegiatan, setSelectedExistingKegiatan] = useState(null)
  const [searchSuggestions, setSearchSuggestions] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [similarModalData, setSimilarModalData] = useState(null)
  const [showSimilarModal, setShowSimilarModal] = useState(false)

  const searchTimeoutRef = useRef(null)
  const searchContainerRef = useRef(null)

  // Populate form dari draft yang diedit atau dari kegiatan terdaftar
  useEffect(() => {
    getKategoriKegiatan()
      .then((list) => setKategoriList(Array.isArray(list) ? list : []))
      .catch(() => setKategoriList([]))

    if (isModeTerdaftar && selectedKegiatan) {
      setFormData({
        kategoriId: String(selectedKegiatan.kategoriId || ''),
        namaKegiatan: selectedKegiatan.nama || '',
        penyelenggara: selectedKegiatan.penyelenggara || '',
        skalaId: String(selectedKegiatan.skalaId || ''),
        tanggalPelaksanaan: selectedKegiatan.tanggalMulai ? new Date(selectedKegiatan.tanggalMulai) : null,
        deskripsiKegiatan: selectedKegiatan.deskripsi || '',
        linkWebsite: selectedKegiatan.linkWebsite || '',
        emailPenyelenggara: selectedKegiatan.emailPenyelenggara || '',
      })
      if (selectedKegiatan.kategoriId) {
        getSkalaKegiatan(selectedKegiatan.kategoriId)
          .then((list) => setSkalaList(Array.isArray(list) ? list : []))
          .catch(() => setSkalaList([]))
      }
    } else if (draftItem) {
      setFormData({
        kategoriId: String(draftItem.kategoriId || ''),
        namaKegiatan: draftItem.namaKegiatan || '',
        penyelenggara: draftItem.penyelenggara || '',
        skalaId: String(draftItem.skalaId || ''),
        tanggalPelaksanaan: draftItem.tanggalPelaksanaan ? new Date(draftItem.tanggalPelaksanaan) : null,
        deskripsiKegiatan: draftItem.deskripsi || '',
        linkWebsite: draftItem.linkWebsite || '',
        emailPenyelenggara: draftItem.emailPenyelenggara || '',
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!formData.kategoriId) {
      setSkalaList([])
      return
    }
    getSkalaKegiatan(formData.kategoriId)
      .then((list) => setSkalaList(Array.isArray(list) ? list : []))
      .catch(() => setSkalaList([]))
  }, [formData.kategoriId])

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'kategoriId') {
      setFormData((prev) => ({ ...prev, kategoriId: value, skalaId: '' }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle typing on namaKegiatan with debounced autocomplete
  const handleNamaKegiatanChange = (e) => {
    const val = e.target.value
    setFormData((prev) => ({ ...prev, namaKegiatan: val }))

    if (selectedExistingKegiatan && val !== selectedExistingKegiatan.nama) {
      setSelectedExistingKegiatan(null)
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const query = val.trim()
    if (query.length < 3 || isModeTerdaftar) {
      setSearchSuggestions([])
      setShowSuggestions(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await getKegiatanEksternalTerdaftar({
          search: query,
          allStatus: 'true',
        })
        if (Array.isArray(results) && results.length > 0) {
          setSearchSuggestions(results)
          setShowSuggestions(true)
        } else {
          setSearchSuggestions([])
          setShowSuggestions(false)
        }
      } catch (err) {
        console.error('Error fetching autocomplete suggestions:', err)
        setSearchSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsSearching(false)
      }
    }, 350)
  }

  const handleSelectSuggestion = (item) => {
    setSelectedExistingKegiatan(item)
    setShowSuggestions(false)
    setFormData((prev) => ({
      ...prev,
      namaKegiatan: item.nama || '',
      penyelenggara: item.penyelenggara || '',
      kategoriId: item.kategoriId ? String(item.kategoriId) : prev.kategoriId,
      skalaId: item.skalaId ? String(item.skalaId) : prev.skalaId,
      tanggalPelaksanaan: item.tanggalMulai ? new Date(item.tanggalMulai) : prev.tanggalPelaksanaan,
      deskripsiKegiatan: item.deskripsi || prev.deskripsiKegiatan,
      linkWebsite: item.linkWebsite || prev.linkWebsite,
      emailPenyelenggara: item.emailPenyelenggara || prev.emailPenyelenggara,
    }))
    if (item.kategoriId) {
      getSkalaKegiatan(item.kategoriId)
        .then((list) => setSkalaList(Array.isArray(list) ? list : []))
        .catch(() => setSkalaList([]))
    }
    toast.info('Data kegiatan terdaftar dimuat', {
      description: `Form telah diisi berdasarkan kegiatan "${item.nama}".`,
    })
  }

  const handleClearExistingKegiatan = () => {
    setSelectedExistingKegiatan(null)
    setFormData(EMPTY_FORM)
    setSearchSuggestions([])
    setShowSuggestions(false)
    toast.info('Kaitan kegiatan dilepas. Formulir telah dikosongkan untuk pengisian mandiri.')
  }

  const handleClearNamaKegiatan = () => {
    setFormData((prev) => ({ ...prev, namaKegiatan: '' }))
    setSelectedExistingKegiatan(null)
    setSearchSuggestions([])
    setShowSuggestions(false)
  }

  const handleDateChange = (date) => {
    setFormData((prev) => ({ ...prev, tanggalPelaksanaan: date }))
  }

  function buildPayload() {
    return {
      kategoriId: formData.kategoriId ? Number(formData.kategoriId) : undefined,
      namaKegiatan: formData.namaKegiatan,
      penyelenggara: formData.penyelenggara,
      skalaId: formData.skalaId ? Number(formData.skalaId) : undefined,
      tanggalPelaksanaan: toISODate(formData.tanggalPelaksanaan),
      deskripsi: formData.deskripsiKegiatan,
      linkWebsite: formData.linkWebsite,
      emailPenyelenggara: formData.emailPenyelenggara,
    }
  }

  /** Simpan / update draft ke BE */
  const handleSimpanDraft = async () => {
    setLoading(true)
    try {
      if (draftId) {
        await editDraftKegiatanEksternal(draftId, buildPayload())
        toast.success('Draft diperbarui!')
      } else {
        await simpanDraftKegiatanEksternal(buildPayload())
        toast.success('Draft tersimpan!', {
          description: 'Terlihat di tabel dengan status Draft. Bisa diedit kapan saja.',
        })
      }
      navigate('/mahasiswa/kegiatan-eksternal')
    } catch (err) {
      toast.error('Gagal menyimpan draft', { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  /** Eksekusi pengiriman pengajuan */
  const executeSubmission = async (options = {}) => {
    setLoading(true)
    try {
      // Kasus A: Bergabung ke kegiatan terdaftar (dari autocomplete atau modal saran)
      if (options.existingKegiatanId || selectedExistingKegiatan?.id) {
        const targetId = options.existingKegiatanId || selectedExistingKegiatan.id
        const res = await ajukanKegiatan({
          ...buildPayload(),
          existingKegiatanId: targetId,
        })
        const isApproved = res?.data?.isApproved || res?.isApproved
        toast.success('Berhasil!', {
          description: isApproved
            ? 'Berhasil bergabung! Kegiatan ini sudah disetujui Ditmawa, Anda dapat langsung meminta persetujuan Dosen PA.'
            : 'Anda berhasil bergabung dengan kegiatan terdaftar.',
        })
        if (isApproved) {
          navigate('/mahasiswa/persetujuan-dosen')
        } else {
          navigate('/mahasiswa/kegiatan-eksternal')
        }
        return
      }

      // Kasus B: Kirim dari draft (jika bukan forceNew)
      if (draftId && !options.forceNew) {
        await editDraftKegiatanEksternal(draftId, buildPayload())
        await ajukanDraftKegiatanEksternal(draftId)
      } else {
        // Kasus C: Pengajuan baru (bisa dengan flag forceNew: true)
        await ajukanKegiatan({
          ...buildPayload(),
          ...(options.forceNew ? { forceNew: true } : {}),
        })
      }

      toast.success('Berhasil!', {
        description: 'Pengajuan kegiatan dikirim dan akan ditinjau Admin Ditmawa.',
      })
      navigate('/mahasiswa/kegiatan-eksternal')
    } catch (err) {
      const errBody = err?.body || err?.response?.data || {}
      const errCode = errBody?.code
      const errMsg = errBody?.message || err?.message || 'Gagal mengajukan kegiatan'

      if (errCode === 'DUPLICATE_OWN_SUBMISSION') {
        toast.error('Pengajuan Duplikat Ditolak', {
          description: errMsg,
          duration: 7000,
        })
      } else if (errCode === 'SIMILAR_ACTIVITY_EXISTS') {
        const existing = errBody?.data?.existingKegiatan
        setSimilarModalData(existing)
        setShowSimilarModal(true)
      } else {
        toast.error('Gagal', { description: errMsg })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    setShowKirimConfirm(false)
    if (!formData.kategoriId || !formData.skalaId) {
      toast.error('Pilih jenis dan skala kegiatan')
      return
    }
    if (!formData.namaKegiatan.trim()) {
      toast.error('Nama kegiatan tidak boleh kosong')
      return
    }
    if (!formData.penyelenggara.trim()) {
      toast.error('Penyelenggara tidak boleh kosong')
      return
    }
    executeSubmission()
  }

  const handleJoinSimilar = async (id) => {
    setShowSimilarModal(false)
    await executeSubmission({ existingKegiatanId: id })
  }

  const handleForceNewSimilar = async () => {
    setShowSimilarModal(false)
    await executeSubmission({ forceNew: true })
  }

  const handleMintaPersetujuanDosen = async () => {
    if (!selectedKegiatan?.id) {
      toast.error('Data kegiatan tidak valid')
      return
    }
    setSubmittingIzin(true)
    try {
      await mintaPersetujuanDosenEksternal(selectedKegiatan.id)
      toast.success('Berhasil!', {
        description: 'Permintaan persetujuan telah dikirimkan ke Dosen PA Anda.',
      })
      navigate('/mahasiswa/persetujuan-dosen')
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || err?.message || 'Gagal meminta persetujuan dosen')
    } finally {
      setSubmittingIzin(false)
    }
  }

  const isLocked = isModeTerdaftar || !!selectedExistingKegiatan
  const isDirty = !!(formData.namaKegiatan || formData.penyelenggara || formData.kategoriId || selectedExistingKegiatan)

  return (
    <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
      <ConfirmModal
        isOpen={showKirimConfirm}
        message={
          selectedExistingKegiatan
            ? `Daftarkan diri Anda ke kegiatan terdaftar "${selectedExistingKegiatan.nama}"?`
            : 'Kirim pengajuan kegiatan ini ke Admin Ditmawa untuk ditinjau?'
        }
        confirmText={selectedExistingKegiatan ? 'Ya, gabung' : 'Ya, kirim'}
        cancelText="Batal"
        onConfirm={handleSubmit}
        onCancel={() => setShowKirimConfirm(false)}
      />

      <SimilarActivityModal
        isOpen={showSimilarModal}
        similarData={similarModalData}
        loading={loading}
        onJoin={handleJoinSimilar}
        onForceNew={handleForceNewSimilar}
        onCancel={() => setShowSimilarModal(false)}
      />

      <div className="space-y-5">
        <DetailBackButton onClick={() => navigate('/mahasiswa/kegiatan-eksternal')} />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-extrabold text-base-content">
                {isModeTerdaftar
                  ? 'Pengajuan kegiatan terdaftar'
                  : isRevisi
                  ? 'Perbaiki & ajukan ulang'
                  : isEditDraft
                  ? 'Edit draft kegiatan'
                  : 'Pengajuan kegiatan'}
              </h2>
              <InfoTooltip
                message={
                  isModeTerdaftar ? (
                    <>
                      Kegiatan ini sudah <strong>terdaftar dan disetujui</strong> di sistem. Silakan klik <strong>Minta persetujuan dosen</strong> untuk mengajukan izin ke Dosen PA Anda.
                    </>
                  ) : (
                    <>
                      Kegiatan berstatus <strong>draft</strong> dapat diedit atau dihapus. Setelah <strong>Kirim</strong>, kegiatan tidak dapat diedit.
                    </>
                  )
                }
              />
            </div>
            <p className="text-sm text-base-content/60">
              {isModeTerdaftar
                ? 'Detail kegiatan eksternal yang dipilih dari daftar kegiatan terdaftar'
                : 'Lengkapi formulir pengajuan kegiatan eksternal di bawah ini'}
            </p>
          </div>
          {isModeTerdaftar ? (
            <span className="badge badge-primary badge-sm">Terdaftar</span>
          ) : isRevisi ? (
            <StatusBadge status="revisi" />
          ) : draftId ? (
            <StatusBadge status="draft" />
          ) : null}
        </div>

        <div className="card bg-base-100 p-5">
          {isModeTerdaftar && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs sm:text-sm text-sky-950 shadow-xs">
              <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-sky-900">Kegiatan Terdaftar: </span>
                Data kegiatan ini telah diverifikasi di sistem. Seluruh field di bawah dikunci secara otomatis. Klik tombol <strong>Minta persetujuan dosen</strong> di bagian bawah untuk mengajukan izin ke Dosen PA Anda.
              </div>
            </div>
          )}

          {/* Panduan Resmi Penamaan Kegiatan */}
          {!isModeTerdaftar && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs sm:text-sm text-amber-950 shadow-xs">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="leading-relaxed space-y-1">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  Perhatian: Panduan Pengisian Nama Kegiatan Resmi
                </div>
                <p className="text-amber-800">
                  Harap masukkan <strong>nama resmi kegiatan beserta tahun/edisinya</strong> (contoh: <em>GEMASTIK XVII 2024</em> atau <em>Lomba Karya Tulis Ilmiah Nasional 2024</em>, bukan singkatan umum seperti <em>Lomba IT</em>).
                </p>
                <p className="text-amber-700/90 text-xs">
                  💡 <em>Tips:</em> Saat mengetik nama kegiatan, sistem akan menampilkan saran kegiatan serupa yang sudah terdaftar. Jika kegiatan Anda sudah ada, cukup klik saran tersebut agar tidak terjadi duplikasi data.
                </p>
              </div>
            </div>
          )}

          {/* Banner Kegiatan Terdaftar Terpilih */}
          {selectedExistingKegiatan && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-950 shadow-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-emerald-900">Kegiatan Terdaftar Dipilih: </span>
                  Data form otomatis dikunci sesuai kegiatan terdaftar: <strong>{selectedExistingKegiatan.nama}</strong> ({selectedExistingKegiatan.penyelenggara || '-'}, {selectedExistingKegiatan.tahun || '-'}). Anda akan didaftarkan ke kegiatan ini tanpa membuat data baru.
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearExistingKegiatan}
                className="btn btn-ghost btn-xs text-emerald-800 hover:text-red-600 shrink-0 font-medium"
              >
                Lepas Kaitan
              </button>
            </div>
          )}

          <h3 className="mb-4 text-sm font-semibold text-base-content">Detail kegiatan</h3>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-base-content">
                Jenis Kegiatan<span className="text-red-500">*</span>
              </label>
              <select
                name="kategoriId"
                value={formData.kategoriId}
                onChange={handleChange}
                disabled={isLocked}
                className="select mt-1 w-full disabled:bg-base-200 disabled:text-base-content/80"
              >
                <option value="">Pilih jenis kegiatan</option>
                {kategoriList.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama || k.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Autocomplete Input: Nama Kegiatan */}
              <div className="relative" ref={searchContainerRef}>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-base-content">
                    Nama Kegiatan<span className="text-red-500">*</span>
                  </label>
                  {isSearching && (
                    <span className="text-xs text-primary flex items-center gap-1 font-medium">
                      <span className="loading loading-spinner loading-xs"></span>
                      Mencari kegiatan terdaftar...
                    </span>
                  )}
                </div>

                <div className="relative mt-1">
                  <input
                    type="text"
                    name="namaKegiatan"
                    value={formData.namaKegiatan}
                    onChange={handleNamaKegiatanChange}
                    onFocus={() => {
                      if (searchSuggestions.length > 0) setShowSuggestions(true)
                    }}
                    disabled={isLocked}
                    placeholder="Contoh: GEMASTIK XVII 2024"
                    className="input w-full pr-8 disabled:bg-base-200 disabled:text-base-content/80"
                    autoComplete="off"
                  />
                  {formData.namaKegiatan && !isLocked && (
                    <button
                      type="button"
                      onClick={handleClearNamaKegiatan}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                      aria-label="Bersihkan input"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Hasil Autocomplete */}
                {showSuggestions && searchSuggestions.length > 0 && !isModeTerdaftar && (
                  <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-base-300 bg-base-100 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="p-2.5 border-b border-base-200 bg-base-200/50 flex items-center justify-between text-xs text-base-content/70">
                      <span className="font-semibold flex items-center gap-1.5 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        Kegiatan Terdaftar Serupa:
                      </span>
                      <span>{searchSuggestions.length} ditemukan</span>
                    </div>
                    <ul className="max-h-60 overflow-y-auto divide-y divide-base-200">
                      {searchSuggestions.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectSuggestion(item)}
                            className="w-full p-3 text-left hover:bg-primary/5 transition-colors flex items-start justify-between gap-3 group"
                          >
                            <div className="space-y-1 min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-base-content group-hover:text-primary transition-colors truncate">
                                {item.nama}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-base-content/60">
                                <span>Penyelenggara: {item.penyelenggara || '-'}</span>
                                {item.tahun && (
                                  <>
                                    <span>•</span>
                                    <span>Tahun {item.tahun}</span>
                                  </>
                                )}
                                {item.skala && (
                                  <>
                                    <span>•</span>
                                    <span className="badge badge-ghost badge-xs">{item.skala}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              Pilih <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="p-2 border-t border-base-200 bg-base-200/30 text-[11px] text-center text-base-content/60">
                      💡 Pilih kegiatan untuk bergabung tanpa membuat master baru, atau abaikan jika berbeda.
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-base-content">
                  Penyelenggara<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="penyelenggara"
                  value={formData.penyelenggara}
                  onChange={handleChange}
                  disabled={isLocked}
                  placeholder="Masukkan penyelenggara..."
                  className="input mt-1 w-full disabled:bg-base-200 disabled:text-base-content/80"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-base-content">
                Skala Kegiatan<span className="text-red-500">*</span>
              </label>
              <select
                name="skalaId"
                value={formData.skalaId}
                onChange={handleChange}
                disabled={isLocked || !formData.kategoriId}
                className="select mt-1 w-full disabled:bg-base-200 disabled:text-base-content/80"
              >
                <option value="">
                  {formData.kategoriId ? 'Pilih skala kegiatan' : 'Pilih jenis kegiatan terlebih dahulu'}
                </option>
                {skalaList.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama || s.name}</option>
                ))}
              </select>
            </div>

            <DatePickerInput
              label="Tanggal Pelaksanaan"
              value={formData.tanggalPelaksanaan}
              onChange={handleDateChange}
              disabled={isLocked}
              placeholder="Pilih tanggal"
            />

            <div>
              <label className="block text-sm font-medium text-base-content">Deskripsi Kegiatan</label>
              <textarea
                name="deskripsiKegiatan"
                value={formData.deskripsiKegiatan}
                onChange={handleChange}
                disabled={isLocked}
                rows={3}
                placeholder="Jelaskan peran dan manfaat kegiatan..."
                className="input mt-1 w-full disabled:bg-base-200 disabled:text-base-content/80"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-base-content">Link Website Penyelenggara</label>
                <input
                  type="url"
                  name="linkWebsite"
                  value={formData.linkWebsite}
                  onChange={handleChange}
                  disabled={isLocked}
                  placeholder="https://..."
                  className="input mt-1 w-full disabled:bg-base-200 disabled:text-base-content/80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-base-content">Email Penyelenggara</label>
                <input
                  type="email"
                  name="emailPenyelenggara"
                  value={formData.emailPenyelenggara}
                  onChange={handleChange}
                  disabled={isLocked}
                  placeholder="unand@gmail.com"
                  className="input mt-1 w-full disabled:bg-base-200 disabled:text-base-content/80"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:justify-end">
              {isModeTerdaftar ? (
                <>
                  <button
                    type="button"
                    disabled={submittingIzin}
                    onClick={handleMintaPersetujuanDosen}
                    className="btn btn-primary btn-sm"
                  >
                    {submittingIzin ? 'Mengirim…' : 'Minta persetujuan dosen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/mahasiswa/kegiatan-eksternal')}
                    className={batalBtnClass}
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  {/* Simpan draft — hanya tampil jika bukan mode revisi dan belum memilih kegiatan terdaftar */}
                  {!isRevisi && !selectedExistingKegiatan && (
                    <button
                      type="button"
                      disabled={loading || !isDirty}
                      onClick={handleSimpanDraft}
                      className="btn btn-outline btn-primary btn-sm"
                    >
                      {draftId ? 'Perbarui draft' : 'Simpan draft'}
                    </button>
                  )}

                  {/* Ajukan / Gabung */}
                  <button
                    type="button"
                    disabled={loading || !isDirty}
                    onClick={() => setShowKirimConfirm(true)}
                    className="btn btn-primary btn-sm"
                  >
                    {loading
                      ? 'Mengirim…'
                      : selectedExistingKegiatan
                      ? 'Gabung Kegiatan Terdaftar'
                      : isRevisi
                      ? 'Ajukan ulang'
                      : 'Ajukan'}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/mahasiswa/kegiatan-eksternal')}
                    className={batalBtnClass}
                  >
                    Batal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default AjukanKegiatanForm
