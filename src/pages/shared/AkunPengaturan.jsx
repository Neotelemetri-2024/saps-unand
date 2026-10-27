import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Lock, User, Eye, EyeOff } from 'lucide-react'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { FormSkeleton } from '../../components/dashboard/Skeleton'
import { getCurrentUser, updateProfil, gantiPassword, isSsoUser } from '../../services/authService'
import { get } from '../../services/apiClient'

const ROLE_LABELS = {
  admin_ditmawa: 'Admin Ditmawa',
  admin_fakultas: 'Admin Fakultas',
  dosen: 'Dosen Pembimbing',
  dosen_pa: 'Dosen Pembimbing',
  pimpinan_ditmawa: 'Pimpinan Ditmawa',
  pimpinan_fakultas: 'Pimpinan Fakultas',
  pimpinan_utama: 'Pimpinan Utama',
  operator_ukm: 'Operator UKM',
  operator_ukmf: 'Operator UKMF',
  mahasiswa: 'Mahasiswa',
  staff: 'Staf',
}

function labelJabatanStaff(jabatan) {
  if (!jabatan) return null
  return ROLE_LABELS[jabatan] || String(jabatan).replace(/_/g, ' ')
}

function AkunPengaturan({ role: roleProp } = {}) {
  const storedUser = getCurrentUser()
  const isSso = isSsoUser(storedUser)
  const role = roleProp || storedUser?.role || 'admin_ditmawa'
  const roleLabel = ROLE_LABELS[role] || storedUser?.userRole || role

  const [form, setForm] = useState({
    namaLengkap: storedUser?.nama || '',
    identitas: '',
    identitasLabel: 'Identitas',
    jabatan: roleLabel,
    email: storedUser?.email || '',
    nomorTelepon: '',
    alamat: '',
  })
  const [loading, setLoading] = useState(true)
  const [pwdForm, setPwdForm] = useState({
    passwordLama: '',
    passwordBaru: '',
    konfirmasiPassword: '',
  })
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [displayName, setDisplayName] = useState(storedUser?.nama || 'Pengguna')

  useEffect(() => {
    setLoading(true)
    get('/api/auth/me')
      .then((res) => {
        const me = res?.data || res || {}
        const nidn = me.dosen?.nidn || ''
        const nim = me.mahasiswa?.nim || ''
        let identitas = ''
        let identitasLabel = 'Identitas'
        if (nidn) {
          identitas = nidn
          identitasLabel = 'NIDN'
        } else if (nim) {
          identitas = nim
          identitasLabel = 'NIM'
        }

        const jabatan =
          labelJabatanStaff(me.staff?.jabatan) ||
          ROLE_LABELS[role] ||
          ROLE_LABELS[me.peran] ||
          me.organisasiOperator?.organisasi?.nama ||
          roleLabel

        setForm({
          namaLengkap: me.nama || '',
          identitas,
          identitasLabel,
          jabatan,
          email: me.email || '',
          nomorTelepon: me.nomorTelepon || '',
          alamat: me.alamat || '',
        })
        setDisplayName(me.nama || 'Pengguna')
      })
      .catch(() => {
        // fallback: tetap pakai data lokal
      })
      .finally(() => setLoading(false))
  }, [role, roleLabel])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handlePwdChange = (e) => {
    const { name, value } = e.target
    setPwdForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSimpan = async () => {
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
      if (form.email) payload.email = form.email.trim()
      const updated = await updateProfil(payload)
      setDisplayName(updated?.nama || form.namaLengkap)
      toast.success('Berhasil Disimpan!', {
        description: 'Perubahan informasi akun telah disimpan.',
      })
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan perubahan.')
    } finally {
      setSaving(false)
    }
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

  const showIdentitas = Boolean(form.identitas)

  return (
    <DashboardLayout role={role} userName={displayName || 'Pengguna'} userRole={roleLabel}>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-base-content">Profil dan pengaturan</h2>
          <p className="mt-1 text-sm text-base-content/60">{form.namaLengkap || roleLabel}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card bg-base-100 p-6">
            <div className="mb-4 flex items-center gap-3">
              <User className="h-5 w-5 text-base-content" />
              <h3 className="text-sm font-semibold text-base-content">Informasi akun</h3>
            </div>

            {loading ? (
              <FormSkeleton fields={4} />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSimpan()
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-base-content">Nama Lengkap</label>
                  <input
                    type="text"
                    name="namaLengkap"
                    value={form.namaLengkap}
                    onChange={handleChange}
                    className="input mt-1 w-full"
                  />
                </div>
                {showIdentitas ? (
                  <div>
                    <label className="block text-sm font-medium text-base-content">{form.identitasLabel}</label>
                    <input
                      type="text"
                      value={form.identitas}
                      readOnly
                      className="input mt-1 w-full bg-base-200"
                    />
                  </div>
                ) : null}
                <div>
                  <label className="block text-sm font-medium text-base-content">Jabatan</label>
                  <input
                    type="text"
                    value={form.jabatan}
                    readOnly
                    className="input mt-1 w-full bg-base-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="input mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">Nomor Telepon</label>
                  <input
                    type="text"
                    name="nomorTelepon"
                    value={form.nomorTelepon}
                    onChange={handleChange}
                    placeholder="Masukkan nomor telepon"
                    className="input mt-1 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">Alamat</label>
                  <input
                    type="text"
                    name="alamat"
                    value={form.alamat}
                    onChange={handleChange}
                    placeholder="Masukkan alamat"
                    className="input mt-1 w-full"
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                    {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {!isSso && (
            <div className="card bg-base-100 p-6">
              <div className="mb-5 flex items-center gap-3">
                <Lock className="h-5 w-5 text-base-content" />
                <h3 className="text-sm font-semibold text-base-content">Ganti password</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-base-content">
                    Password Lama <span className="text-error">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showOld ? 'text' : 'password'}
                      name="passwordLama"
                      value={pwdForm.passwordLama}
                      onChange={handlePwdChange}
                      className="input w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOld(!showOld)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50"
                    >
                      {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">
                    Password Baru <span className="text-error">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showNew ? 'text' : 'password'}
                      name="passwordBaru"
                      value={pwdForm.passwordBaru}
                      onChange={handlePwdChange}
                      className="input w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-content">
                    Konfirmasi Password Baru <span className="text-error">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      name="konfirmasiPassword"
                      value={pwdForm.konfirmasiPassword}
                      onChange={handlePwdChange}
                      className="input w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50"
                    >
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

        <p className="text-sm text-base-content/60">
          Data login terintegrasi dengan portal utama universitas.
        </p>
      </div>
    </DashboardLayout>
  )
}

export default AkunPengaturan
