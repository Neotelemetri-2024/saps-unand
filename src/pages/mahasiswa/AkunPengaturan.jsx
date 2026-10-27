import { useEffect, useState } from 'react'
import { Lock, User, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { getCurrentUser, updateProfil, gantiPassword, isSsoUser } from '../../services/authService'
import { get } from '../../services/apiClient'
import { getFakultas, getProdi } from '../../services/matriksService'
import { getLinkedInStatus, disconnectLinkedIn, getLinkedInConnectUrl } from '../../services/cvService'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { FormSkeleton } from '../../components/dashboard/Skeleton'

function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452z" />
    </svg>
  )
}

function formatExpiresAt(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return null
  }
}

function AkunPengaturan() {
  const user = getCurrentUser()
  const isSso = isSsoUser(user)
  const [displayName, setDisplayName] = useState(user?.nama || 'Mahasiswa')
  const [fakultasList, setFakultasList] = useState([])
  const [prodiList, setProdiList] = useState([])
  const [form, setForm] = useState({
    namaLengkap: user?.nama || '',
    nim: '',
    fakultasId: '',
    programStudiId: '',
    nomorTelepon: '',
    alamat: '',
  })
  const [pwdForm, setPwdForm] = useState({
    passwordLama: '',
    passwordBaru: '',
    konfirmasiPassword: '',
  })
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [linkedinStatus, setLinkedinStatus] = useState({ connected: false, expiresAt: null, memberIdMasked: null })
  const [linkedinLoading, setLinkedinLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  const loadLinkedInStatus = () => {
    setLinkedinLoading(true)
    getLinkedInStatus()
      .then((data) => {
        setLinkedinStatus({
          connected: Boolean(data?.connected),
          expiresAt: data?.expiresAt || null,
          memberIdMasked: data?.memberIdMasked || null,
        })
      })
      .catch(() => {
        setLinkedinStatus({ connected: false, expiresAt: null, memberIdMasked: null })
      })
      .finally(() => setLinkedinLoading(false))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const linkedin = params.get('linkedin')
    if (linkedin) {
      window.history.replaceState({}, '', window.location.pathname)
      if (linkedin === 'connected') toast.success('Akun LinkedIn berhasil dihubungkan')
      else if (linkedin === 'denied') toast.error('Otorisasi LinkedIn dibatalkan')
      else if (linkedin === 'error') toast.error('Gagal menghubungkan akun LinkedIn')
    }

    getFakultas()
      .then((list) => setFakultasList(Array.isArray(list) ? list : []))
      .catch(() => {})

    get('/api/auth/me')
      .then((res) => {
        const d = res?.data || res || {}
        const mhs = d.mahasiswa || {}
        const prodi = mhs.prodi || {}
        setForm((p) => ({
          ...p,
          namaLengkap: d.nama || p.namaLengkap,
          nim: mhs.nim || '',
          fakultasId: String(prodi.fakultasId || prodi.fakultas?.id || mhs.fakultasId || ''),
          programStudiId: String(mhs.prodiId || prodi.id || ''),
          nomorTelepon: d.nomorTelepon || p.nomorTelepon,
          alamat: d.alamat || p.alamat,
        }))
        if (d.nama) setDisplayName(d.nama)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    loadLinkedInStatus()
  }, [])

  useEffect(() => {
    if (!form.fakultasId) {
      setProdiList([])
      return
    }
    getProdi(form.fakultasId)
      .then((list) => setProdiList(Array.isArray(list) ? list : []))
      .catch(() => setProdiList([]))
  }, [form.fakultasId])

  const handleDisconnectLinkedIn = async () => {
    setDisconnecting(true)
    try {
      await disconnectLinkedIn()
      setLinkedinStatus({ connected: false, expiresAt: null, memberIdMasked: null })
      setShowDisconnectModal(false)
      toast.success('Koneksi LinkedIn diputuskan')
    } catch (err) {
      toast.error(err?.message || 'Gagal memutuskan koneksi LinkedIn')
    } finally {
      setDisconnecting(false)
    }
  }
  const handleSimpanPerubahan = async () => {
    if (!form.namaLengkap.trim()) {
      toast.error('Nama lengkap wajib diisi.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        nama: form.namaLengkap.trim(),
        nomorTelepon: form.nomorTelepon || null,
        alamat: form.alamat || null,
      }
      if (form.programStudiId) payload.prodiId = Number(form.programStudiId)
      const updated = await updateProfil(payload)
      if (updated?.nama) setDisplayName(updated.nama)
      toast.success('Berhasil Disimpan!', {
        description: 'Perubahan pada informasi pribadi Anda telah disimpan.',
      })
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan perubahan.')
    } finally {
      setSaving(false)
    }
  }

  const handlePwdChange = (e) => {
    const { name, value } = e.target
    setPwdForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleGantiPassword = async () => {
    if (!pwdForm.passwordLama || !pwdForm.passwordBaru) {
      toast.error('Lengkapi semua field password.')
      return
    }
    if (pwdForm.passwordBaru !== pwdForm.konfirmasiPassword) {
      toast.error('Password baru dan konfirmasi tidak cocok.')
      return
    }
    setChangingPwd(true)
    try {
      await gantiPassword({
        passwordLama: pwdForm.passwordLama,
        passwordBaru: pwdForm.passwordBaru,
        konfirmasiPassword: pwdForm.konfirmasiPassword,
      })
      toast.success('Password berhasil diubah!')
      setPwdForm({ passwordLama: '', passwordBaru: '', konfirmasiPassword: '' })
    } catch (err) {
      toast.error(err?.message || 'Gagal mengganti password.')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <DashboardLayout role="mahasiswa" userName={displayName || 'Mahasiswa'} userRole="Mahasiswa">
      <ConfirmModal
        isOpen={showDisconnectModal}
        title="Putuskan Koneksi LinkedIn?"
        message="Anda bisa menghubungkan akun LinkedIn lain kapan saja setelah koneksi ini diputuskan."
        confirmText={disconnecting ? 'Memutuskan…' : 'Ya, putuskan'}
        cancelText="Batal"
        onConfirm={handleDisconnectLinkedIn}
        onCancel={() => !disconnecting && setShowDisconnectModal(false)}
      />
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-base-content">Profil dan pengaturan</h2>
          <p className="mt-1 text-sm text-base-content/60">{form.namaLengkap || 'Mahasiswa'}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Informasi Pribadi */}
          <div className="card bg-base-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <User className="h-5 w-5 text-base-content" />
              <h3 className="text-sm font-semibold text-base-content">Informasi pribadi</h3>
            </div>

            {loading ? (
              <FormSkeleton fields={6} />
            ) : (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSimpanPerubahan() }}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-base-content">Nama Lengkap</label>
                    <input
                      type="text"
                      value={form.namaLengkap}
                      onChange={(e) => setForm((p) => ({ ...p, namaLengkap: e.target.value }))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-base-content">NIM</label>
                    <input
                      type="text"
                      value={form.nim}
                      readOnly
                      className="input mt-1 w-full bg-base-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-base-content">Fakultas</label>
                    <select
                      value={form.fakultasId}
                      onChange={(e) => setForm((p) => ({ ...p, fakultasId: e.target.value, programStudiId: '' }))}
                      className="select mt-1 w-full"
                    >
                      <option value="">Pilih Fakultas</option>
                      {fakultasList.map((f) => (
                        <option key={f.id} value={f.id}>{f.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-base-content">Program Studi</label>
                    <select
                      value={form.programStudiId}
                      onChange={(e) => setForm((p) => ({ ...p, programStudiId: e.target.value }))}
                      className="select mt-1 w-full"
                      disabled={!form.fakultasId}
                    >
                      <option value="">Pilih Program studi</option>
                      {prodiList.map((p) => (
                        <option key={p.id} value={p.id}>{p.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-base-content">Nomor Telepon</label>
                    <input
                      type="text"
                      value={form.nomorTelepon}
                      onChange={(e) => setForm((p) => ({ ...p, nomorTelepon: e.target.value }))}
                      className="input mt-1 w-full"
                      placeholder="Masukkan nomor telepon"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">Alamat</label>
                  <input
                    type="text"
                    value={form.alamat}
                    onChange={(e) => setForm((p) => ({ ...p, alamat: e.target.value }))}
                    className="input mt-1 w-full"
                    placeholder="Masukkan alamat"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary btn-sm"
                  >
                    {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Ganti Password (hanya untuk akun non-SSO / internal) */}
          {!isSso && (
            <div className="card bg-base-100 p-6">
              <div className="mb-5 flex items-center gap-3">
                <Lock className="h-5 w-5 text-base-content" />
                <h3 className="text-sm font-semibold text-base-content">Ganti password</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-base-content">Password Lama <span className="text-red-500">*</span></label>
                  <div className="relative mt-1">
                    <input
                      type={showOld ? 'text' : 'password'}
                      name="passwordLama"
                      value={pwdForm.passwordLama}
                      onChange={handlePwdChange}
                      className="input w-full pr-10"
                    />
                    <button type="button" onClick={() => setShowOld(!showOld)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50">
                      {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">Password Baru <span className="text-red-500">*</span></label>
                  <div className="relative mt-1">
                    <input
                      type={showNew ? 'text' : 'password'}
                      name="passwordBaru"
                      value={pwdForm.passwordBaru}
                      onChange={handlePwdChange}
                      className="input w-full pr-10"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">Konfirmasi Password Baru <span className="text-red-500">*</span></label>
                  <div className="relative mt-1">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      name="konfirmasiPassword"
                      value={pwdForm.konfirmasiPassword}
                      onChange={handlePwdChange}
                      className="input w-full pr-10"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleGantiPassword}
                    disabled={changingPwd}
                    className="btn btn-primary btn-sm"
                  >
                    {changingPwd ? 'Mengganti…' : 'Ganti Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Koneksi LinkedIn */}
        <div className="card bg-base-100 p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A66C2]/10 text-[#0A66C2]">
              <LinkedInIcon />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-base-content">Koneksi LinkedIn</h3>
              <p className="text-xs text-base-content/50">Untuk membagikan CV ke LinkedIn. Token biasanya berlaku sekitar 60 hari.</p>
            </div>
          </div>

          {linkedinLoading ? (
            <p className="text-sm text-base-content/50">Memuat status…</p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {linkedinStatus.connected ? (
                  <>
                    <p className="text-sm font-semibold text-green-700">Terhubung</p>
                    {linkedinStatus.memberIdMasked && (
                      <p className="mt-0.5 text-xs text-base-content/60">ID: {linkedinStatus.memberIdMasked}</p>
                    )}
                    {formatExpiresAt(linkedinStatus.expiresAt) && (
                      <p className="mt-0.5 text-xs text-base-content/50">
                        Berlaku hingga {formatExpiresAt(linkedinStatus.expiresAt)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-base-content/60">Belum terhubung</p>
                    <p className="mt-0.5 text-xs text-base-content/50">Hubungkan akun untuk share CV ke LinkedIn.</p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {linkedinStatus.connected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDisconnectModal(true)}
                      disabled={disconnecting}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {disconnecting ? 'Memutuskan…' : 'Putuskan'}
                    </button>
                    <a
                      href={getLinkedInConnectUrl('pengaturan')}
                      className="inline-flex items-center justify-center rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#004182]"
                    >
                      Ganti akun
                    </a>
                  </>
                ) : (
                  <a
                    href={getLinkedInConnectUrl('pengaturan')}
                    className="inline-flex items-center justify-center rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#004182]"
                  >
                    Hubungkan LinkedIn
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-base-content/60">
          Data login terintegrasi dengan portal utama universitas.
        </p>
      </div>
    </DashboardLayout>
  )
}

export default AkunPengaturan
