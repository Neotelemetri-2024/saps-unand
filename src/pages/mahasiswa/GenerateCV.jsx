import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import Modal from '../../components/ui/Modal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { getCurrentUser } from '../../services/authService'
import { getPortofolio } from '../../services/dashboardService'
import { shareCvToLinkedIn, getLinkedInConnectUrl, getLinkedInStatus, disconnectLinkedIn } from '../../services/cvService'
import { batalBtnClass } from '../../components/ui/buttonStyles'
import logoUnand from '../../assets/logo_unand.png'

function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452z" />
    </svg>
  )
}

function yearFromDate(val) {
  if (!val) return ''
  try {
    return String(new Date(val).getFullYear())
  } catch {
    return ''
  }
}

function findKategoriEntries(riwayatPerKategori = {}, keys) {
  const entries = Object.entries(riwayatPerKategori)
  const matched = []
  for (const [kat, items] of entries) {
    const lower = kat.toLowerCase()
    if (keys.some((k) => lower.includes(k))) {
      matched.push(...(items || []).map((item) => ({ ...item, kategori: kat })))
    }
  }
  return matched
}

const CAPTION_STORAGE_KEY = 'saps_linkedin_caption'

function defaultShareCaption(nama) {
  return `Halo, saya ${nama}! Berikut CV & portofolio kegiatan kemahasiswaan saya yang tercatat di MY UNAND STUDENT CONNECT, Universitas Andalas.`
}

function GenerateCV() {
  const user = getCurrentUser()
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState(null)
  const [pendidikanData, setPendidikanData] = useState([])
  const [organisasiData, setOrganisasiData] = useState([])
  const [sertifikasiData, setSertifikasiData] = useState([])
  const [prestasiData, setPrestasiData] = useState([])
  const [sharingLinkedIn, setSharingLinkedIn] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareCaption, setShareCaption] = useState('')
  const [linkedinConnected, setLinkedinConnected] = useState(false)
  const [linkedinExpiresAt, setLinkedinExpiresAt] = useState(null)
  const [disconnectingLinkedIn, setDisconnectingLinkedIn] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  const loadLinkedInStatus = () => {
    getLinkedInStatus()
      .then((data) => {
        setLinkedinConnected(Boolean(data?.connected))
        setLinkedinExpiresAt(data?.expiresAt || null)
      })
      .catch(() => {
        setLinkedinConnected(false)
        setLinkedinExpiresAt(null)
      })
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedinStatus = params.get('linkedin')
    if (!linkedinStatus) return

    window.history.replaceState({}, '', window.location.pathname)

    if (linkedinStatus === 'connected') {
      setGenerated(true)
      setLinkedinConnected(true)
      loadLinkedInStatus()
      const saved = sessionStorage.getItem(CAPTION_STORAGE_KEY)
      setShareCaption(saved || defaultShareCaption(user?.nama || 'Mahasiswa'))
      setShareModalOpen(true)
      toast.success('Akun LinkedIn terhubung. Periksa caption, lalu posting.')
      return
    }

    if (linkedinStatus === 'denied') {
      toast.error('Otorisasi LinkedIn dibatalkan')
      return
    }

    if (linkedinStatus === 'error') {
      toast.error('Gagal menghubungkan akun LinkedIn')
    }
  }, [user?.nama])

  useEffect(() => {
    loadLinkedInStatus()
  }, [])

  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    getPortofolio(userId)
      .then((data) => {
        const mhs = data?.mahasiswa || {}
        const nama = mhs.nama || user?.nama || 'Mahasiswa'
        setUserData({
          name: nama,
          nim: mhs.nim || '-',
          prodi: mhs.prodi || '-',
          universitas: 'Universitas Andalas',
          email: mhs.email || user?.email || '-',
          phone: mhs.phone || mhs.nomorTelepon || '-',
          address: mhs.fakultas ? `${mhs.fakultas}, Padang, Sumatera Barat` : 'Padang, Sumatera Barat',
        })

        setPendidikanData([
          {
            jenjang: mhs.prodi ? `S1 ${mhs.prodi}` : 'S1',
            institusi: `Universitas Andalas, Padang`,
            tahunMulai: mhs.angkatan ? String(mhs.angkatan) : '',
            tahunSelesai: 'Sekarang',
            ipk: mhs.ipk || null,
          },
        ])

        const riwayat = data?.riwayatPerKategori || {}
        const orgItems = findKategoriEntries(riwayat, ['organisasi', 'ukm', 'kepanitiaan'])
        setOrganisasiData(
          orgItems.length
            ? orgItems.map((item) => ({
                jabatan: item.peran || item.kegiatan || '-',
                organisasi: item.kegiatan || item.organisasi || item.kategori || '-',
                tahunMulai: '',
                tahunSelesai: yearFromDate(item.tanggal) || '-',
              }))
            : [],
        )

        const semItems = findKategoriEntries(riwayat, ['seminar', 'pelatihan', 'workshop', 'sertifikasi'])
        setSertifikasiData(
          semItems.map((item) => ({
            nama: item.kegiatan || '-',
            tahun: yearFromDate(item.tanggal) || '-',
          })),
        )

        const prestItems = findKategoriEntries(riwayat, ['prestasi', 'lomba', 'kompetisi', 'penghargaan'])
        setPrestasiData(
          prestItems.map((item) => ({
            nama: item.kegiatan || '-',
            pemberi: item.skala || item.kategori || '-',
            tahun: yearFromDate(item.tanggal) || '-',
          })),
        )
      })
      .catch((err) => {
        toast.error('Gagal memuat portofolio', { description: err.message })
        setUserData({
          name: user?.nama || 'Mahasiswa',
          nim: '-',
          prodi: '-',
          universitas: 'Universitas Andalas',
          email: user?.email || '-',
          phone: '-',
          address: 'Padang, Sumatera Barat',
        })
      })
      .finally(() => setLoading(false))
  }, [user?.id, user?.nama, user?.email])

  const displayUser = userData || {
    name: user?.nama || 'Mahasiswa',
    nim: '-',
    prodi: '-',
    universitas: 'Universitas Andalas',
    email: user?.email || '-',
    phone: '-',
    address: 'Padang, Sumatera Barat',
  }

  const handleDownloadPdf = () => {
    window.print()
  }

  const openShareModal = () => {
    const saved = sessionStorage.getItem(CAPTION_STORAGE_KEY)
    setShareCaption(saved || defaultShareCaption(displayUser.name))
    setShareModalOpen(true)
  }

  const handleConfirmShareLinkedIn = async () => {
    const caption = shareCaption.trim()
    if (!caption) {
      toast.error('Caption tidak boleh kosong')
      return
    }
    sessionStorage.setItem(CAPTION_STORAGE_KEY, caption)
    setSharingLinkedIn(true)
    try {
      await shareCvToLinkedIn(caption)
      sessionStorage.removeItem(CAPTION_STORAGE_KEY)
      setShareModalOpen(false)
      toast.success('Berhasil diposting ke LinkedIn')
    } catch (err) {
      if (err?.status === 428 && err?.body?.needsConnect) {
        window.location.href = getLinkedInConnectUrl('generate-cv')
        return
      }
      toast.error('Gagal membagikan CV ke LinkedIn', { description: err.message })
    } finally {
      setSharingLinkedIn(false)
    }
  }

  const handleDisconnectLinkedIn = async () => {
    setDisconnectingLinkedIn(true)
    try {
      await disconnectLinkedIn()
      setLinkedinConnected(false)
      setLinkedinExpiresAt(null)
      setShowDisconnectModal(false)
      toast.success('Koneksi LinkedIn diputuskan')
    } catch (err) {
      toast.error(err?.message || 'Gagal memutuskan koneksi LinkedIn')
    } finally {
      setDisconnectingLinkedIn(false)
    }
  }

  const expiresLabel = (() => {
    if (!linkedinExpiresAt) return null
    try {
      const d = new Date(linkedinExpiresAt)
      if (Number.isNaN(d.getTime())) return null
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return null
    }
  })()

  return (
    <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
      <ConfirmModal
        isOpen={showDisconnectModal}
        title="Putuskan Koneksi LinkedIn?"
        message="Anda bisa menghubungkan akun LinkedIn lain kapan saja setelah koneksi ini diputuskan."
        confirmText={disconnectingLinkedIn ? 'Memutuskan…' : 'Ya, putuskan'}
        cancelText="Batal"
        onConfirm={handleDisconnectLinkedIn}
        onCancel={() => !disconnectingLinkedIn && setShowDisconnectModal(false)}
      />
      <div className="space-y-6">
       

        {/* Tombol Generate CV + deskripsi */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setGenerated(true)}
            disabled={loading}
            className="btn btn-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Memuat data…' : 'Generate CV'}
          </button>
          <p className="text-sm text-base-content/60">Buat CV profesional dari data aktivitas Anda secara otomatis.</p>
        </div>

        {/* CV + tombol aksi — tampil setelah generate */}
        {generated && (
          <div className="space-y-4">
            {/* Tombol Download & Bagikan */}
            <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="text-sm text-base-content/60">
                {linkedinConnected ? (
                  <span>
                    LinkedIn: <span className="font-semibold text-green-700">Terhubung</span>
                    {expiresLabel ? <span className="text-[#888]"> · berlaku hingga {expiresLabel}</span> : null}
                  </span>
                ) : (
                  <span>
                    LinkedIn: <span className="font-semibold text-[#888]">Belum terhubung</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="btn btn-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </button>
                {linkedinConnected ? (
                  <>
                    <button
                      type="button"
                      onClick={openShareModal}
                      disabled={sharingLinkedIn}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004182] disabled:opacity-60"
                    >
                      <LinkedInIcon /> {sharingLinkedIn ? 'Memproses…' : 'Share ke LinkedIn'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDisconnectModal(true)}
                      disabled={disconnectingLinkedIn}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {disconnectingLinkedIn ? 'Memutuskan…' : 'Putuskan'}
                    </button>
                    <a
                      href={getLinkedInConnectUrl('generate-cv')}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#0A66C2] px-4 py-2 text-sm font-semibold text-[#0A66C2] transition hover:bg-[#eef5fb]"
                    >
                      Ganti akun
                    </a>
                  </>
                ) : (
                  <a
                    href={getLinkedInConnectUrl('generate-cv')}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004182]"
                  >
                    <LinkedInIcon /> Hubungkan LinkedIn
                  </a>
                )}
              </div>
            </div>

            {/* Dokumen CV — layout Civitor ATS: padat, Times, header Title | meta + tanggal kanan */}
            <div
              id="cv-print-area"
              className="relative isolate mx-auto w-full max-w-[210mm] overflow-hidden bg-white px-11 py-8 shadow-lg ring-1 ring-[#e5e7eb] [&>*:not(.cv-watermark)]:relative [&>*:not(.cv-watermark)]:z-10"
              style={{ fontFamily: "'Times New Roman', Times, serif", color: '#111827' }}
            >
              <img
                src={logoUnand}
                alt=""
                aria-hidden="true"
                className="cv-watermark pointer-events-none absolute left-1/2 top-1/2 z-0 w-[42%] max-w-[280px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.055]"
              />

              <div className="mb-2 text-center">
                <h1 className="text-[26px] font-bold tracking-wide">
                  {displayUser.name}
                </h1>
                {displayUser.prodi && displayUser.prodi !== '-' && (
                  <p className="mt-1 text-[16px] font-bold text-[#374151]">
                    {displayUser.prodi}
                  </p>
                )}
                <p className="mt-1 text-[14px] text-[#374151]">
                  {[displayUser.address, displayUser.phone, displayUser.email].filter((p) => p && p !== '-').join(' | ')}
                </p>
                <p className="mt-0.5 text-[14px] text-[#374151]">
                  {[displayUser.nim !== '-' ? `NIM: ${displayUser.nim}` : '', displayUser.universitas].filter(Boolean).join(' | ')}
                </p>
              </div>

              {/* Pendidikan */}
              <section className="mt-[14px]">
                <h2 className="mb-[6px] border-b border-[#1f2937] pb-[2px] text-[13px] font-bold uppercase tracking-wide">
                  Pendidikan
                </h2>
                {pendidikanData.length === 0 ? null : (
                  <div className="space-y-[10px]">
                    {pendidikanData.map((item, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-[13px] leading-[1.35]">
                        <p className="min-w-0 flex-1">
                          <span className="font-bold">{item.institusi}{item.jenjang ? ` - ${item.jenjang}` : ''}</span>
                          <span> | Padang</span>
                        </p>
                        <p className="shrink-0 whitespace-nowrap">
                          {item.tahunMulai && item.tahunSelesai ? `${item.tahunMulai} - ${item.tahunSelesai}` : item.tahunSelesai}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Pengalaman Organisasi */}
              {organisasiData.length > 0 && (
                <section className="mt-[14px]">
                  <h2 className="mb-[6px] border-b border-[#1f2937] pb-[2px] text-[13px] font-bold uppercase tracking-wide">
                    Pengalaman Organisasi
                  </h2>
                  <div className="space-y-[10px]">
                    {organisasiData.map((item, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-[13px] leading-[1.35]">
                        <p className="min-w-0 flex-1">
                          <span className="font-bold">{item.jabatan}</span>
                          {item.organisasi && item.organisasi !== item.jabatan && (
                            <span> | {item.organisasi}</span>
                          )}
                        </p>
                        <p className="shrink-0 whitespace-nowrap">
                          {item.tahunMulai && item.tahunSelesai
                            ? `${item.tahunMulai} - ${item.tahunSelesai}`
                            : item.tahunSelesai}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sertifikasi & Pelatihan */}
              {sertifikasiData.length > 0 && (
                <section className="mt-[14px]">
                  <h2 className="mb-[6px] border-b border-[#1f2937] pb-[2px] text-[13px] font-bold uppercase tracking-wide">
                    Sertifikasi &amp; Pelatihan
                  </h2>
                  <div className="space-y-[4px] text-[13px] leading-[1.35]">
                    {sertifikasiData.map((item, i) => (
                      <p key={i}>
                        {item.nama}{item.tahun ? ` (${item.tahun})` : ''}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              {/* Prestasi & Penghargaan */}
              {prestasiData.length > 0 && (
                <section className="mt-[14px]">
                  <h2 className="mb-[6px] border-b border-[#1f2937] pb-[2px] text-[13px] font-bold uppercase tracking-wide">
                    Prestasi &amp; Penghargaan
                  </h2>
                  <div className="space-y-[10px]">
                    {prestasiData.map((item, i) => (
                      <div key={i} className="flex items-baseline justify-between gap-2 text-[13px] leading-[1.35]">
                        <p className="min-w-0 flex-1">
                          <span className="font-bold">{item.nama}</span>
                          {item.pemberi && <span> | {item.pemberi}</span>}
                        </p>
                        <span className="shrink-0 whitespace-nowrap">{item.tahun}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <p className="mt-8 text-center text-[10px] text-[#6b7280]">
                Diverifikasi oleh Direktorat Kemahasiswaan Universitas Andalas —{' '}
                {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={shareModalOpen}
        onClose={() => !sharingLinkedIn && setShareModalOpen(false)}
        title="Share ke LinkedIn"
        size="lg"
      >
        <label htmlFor="linkedin-caption" className="mb-1 block text-sm font-semibold text-[#111827]">
          Teks postingan
        </label>
        <p className="mb-3 text-sm text-base-content/60">
          Ganti teks di bawah ini — persis ini yang akan tampil di LinkedIn, bukan pesan default. Gambar CV dilampirkan otomatis.
        </p>
        <textarea
          id="linkedin-caption"
          value={shareCaption}
          onChange={(e) => {
            const next = e.target.value.slice(0, 3000)
            setShareCaption(next)
            sessionStorage.setItem(CAPTION_STORAGE_KEY, next)
          }}
          autoFocus
          rows={6}
          placeholder={defaultShareCaption(displayUser.name)}
          className="w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#0A66C2] focus:ring-1 focus:ring-[#0A66C2]"
        />
        <p className="mt-1 text-right text-xs text-base-content/50">{shareCaption.length}/3000</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShareModalOpen(false)}
            disabled={sharingLinkedIn} className={batalBtnClass}>
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmShareLinkedIn}
            disabled={sharingLinkedIn || !shareCaption.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] disabled:opacity-60"
          >
            <LinkedInIcon /> {sharingLinkedIn ? 'Memposting…' : 'Posting'}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}

export default GenerateCV
