import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { login, handleSsoLogin } from '../services/authService'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import logoUnand from '../assets/logo_unand.png'
import fotoUnand from '../assets/foto-unand.jpeg'
import AccessibilityMenu from '../components/dashboard/AccessibilityMenu'

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ssoRedirecting, setSsoRedirecting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const navigate = useNavigate()

  // Reset semua loading state saat halaman dipulihkan dari bfcache (tombol Back browser)
  useEffect(() => {
    const handleResetLoading = () => {
      setSubmitting(false)
      setSsoRedirecting(false)
    }

    window.addEventListener('pageshow', handleResetLoading)
    window.addEventListener('focus', handleResetLoading)

    return () => {
      window.removeEventListener('pageshow', handleResetLoading)
      window.removeEventListener('focus', handleResetLoading)
    }
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const sso = searchParams.get('sso')
    const token = searchParams.get('token')
    const error = searchParams.get('error')

    if (error) {
      setErrorMsg(decodeURIComponent(error))
      setSubmitting(false)
      setSsoRedirecting(false)
      window.history.replaceState({}, document.title, '/login')
      return
    }

    if (sso === 'success' && token) {
      setSubmitting(true)
      setErrorMsg('')
      handleSsoLogin(token)
        .then((user) => {
          toast.success('Login SSO berhasil')
          const roleRoutes = {
            mahasiswa: '/mahasiswa/dashboard',
            dosen: '/dosen/dashboard',
            dosen_pa: '/dosen/dashboard',
            pimpinan_fakultas: '/pimpinan_fakultas/dashboard',
            pimpinan_ditmawa: '/pimpinan_ditmawa/dashboard',
            admin_ditmawa: '/admin_ditmawa/dashboard',
            admin_fakultas: '/admin_fakultas/dashboard',
            operator_ukm: '/operator_ukm/dashboard',
            operator_ukmf: '/operator_ukmf/dashboard',
            pimpinan_utama: '/pimpinan_utama/dashboard',
          }
          const dest = roleRoutes[user.role] || '/mahasiswa/dashboard'
          window.history.replaceState({}, document.title, '/login')
          navigate(dest, { replace: true })
        })
        .catch((err) => {
          console.error('SSO Login Error:', err)
          setErrorMsg(err.message || 'Gagal menyelesaikan login SSO.')
        })
        .finally(() => {
          setSubmitting(false)
          setSsoRedirecting(false)
        })
      return
    }

    setSubmitting(false)
    setSsoRedirecting(false)
    localStorage.removeItem('saps_current_user')
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    try {
      const user = await login(email, password)
      toast.success('Login berhasil')
      const roleRoutes = {
        mahasiswa: '/mahasiswa/dashboard',
        dosen: '/dosen/dashboard',
        dosen_pa: '/dosen/dashboard',
        pimpinan_fakultas: '/pimpinan_fakultas/dashboard',
        pimpinan_ditmawa: '/pimpinan_ditmawa/dashboard',
        admin_ditmawa: '/admin_ditmawa/dashboard',
        admin_fakultas: '/admin_fakultas/dashboard',
        operator_ukm: '/operator_ukm/dashboard',
        operator_ukmf: '/operator_ukmf/dashboard',
        pimpinan_utama: '/pimpinan_utama/dashboard',
      }
      const dest = roleRoutes[user.role]
      if (!dest) toast.error(`Role "${user.role}" tidak dikenali`)
      navigate(dest || '/login')
    } catch (err) {
      setPassword('')
      setErrorMsg(err.message || 'Username atau password yang Anda masukkan salah.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSsoClick = () => {
    setSsoRedirecting(true)
    setErrorMsg('')

    // Reset otomatis setelah 6 detik jika user batal / navigasi tertahan
    setTimeout(() => {
      setSsoRedirecting(false)
    }, 6000)

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const defaultUrl = isLocal
      ? 'http://localhost:3000/api/auth/sso/mock'
      : 'https://api-studentconnect.unand.ac.id/api/auth/sso'
    const baseUrl = import.meta.env.VITE_SSO_LOGIN_URL || defaultUrl
    const ssoUrl = `${baseUrl}?frontend=${encodeURIComponent(window.location.origin)}`
    window.location.href = ssoUrl
  }

  const form = (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-base-content" htmlFor="login-email">
          Email atau username
        </label>
        <label className="input w-full">
          <User className="h-4 w-4 opacity-50" />
          <input
            id="login-email"
            type="text"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrorMsg('') }}
            placeholder="Masukkan email Anda"
            autoComplete="username"
          />
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-base-content" htmlFor="login-password">
          Password
        </label>
        <label className="input w-full">
          <Lock className="h-4 w-4 opacity-50" />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrorMsg('') }}
            placeholder="Masukkan password Anda"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            className="btn btn-ghost btn-xs btn-square"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </label>
      </div>

      {errorMsg ? (
        <div role="alert" className="alert alert-error text-sm">
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || ssoRedirecting}
        className="btn btn-primary w-full"
      >
        {submitting ? <span className="loading loading-spinner loading-sm" /> : null}
        {submitting ? 'Memproses…' : 'Masuk'}
      </button>

      <div className="divider text-xs text-base-content/50">atau</div>

      <button
        type="button"
        onClick={handleSsoClick}
        disabled={submitting || ssoRedirecting}
        className="btn btn-outline btn-primary w-full"
      >
        {ssoRedirecting ? <span className="loading loading-spinner loading-sm mr-2" /> : null}
        {ssoRedirecting ? 'Mengarahkan ke SSO…' : 'Masuk dengan SSO Unand'}
      </button>
    </form>
  )

  return (
    <div className="flex min-h-screen w-full bg-base-200 font-sans lg:overflow-hidden lg:bg-base-100">
      <div className="relative hidden h-screen w-1/2 flex-col justify-between overflow-hidden p-10 xl:p-14 lg:flex">
        {/* Background Image */}
        <img
          src={fotoUnand}
          alt="Gedung Rektorat Universitas Andalas"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Green gradients strictly at perimeter edges */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#187a39]/65 via-[#238b45]/20 to-transparent" />

        {/* Top Header & Title */}
        <div className="relative z-10 space-y-12 xl:space-y-16">
          <div className="flex items-center gap-3.5">
            <img src={logoUnand} alt="Logo Universitas Andalas" className="h-12 w-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              Universitas Andalas
            </span>
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.18] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
              MY UNAND<br />STUDENT CONNECT
            </h1>
          </div>
        </div>

        <div className="relative z-10 space-y-5">
          <p className="max-w-md text-sm xl:text-base leading-relaxed text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
            Platform terintegrasi pengelolaan pengajuan kegiatan, verifikasi poin, dan rekapitulasi capaian mahasiswa secara transparan, akuntabel, dan terintegrasi.
          </p>
          <p className="text-xs text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            &copy; {new Date().getFullYear()} Universitas Andalas - Developed by Neo Telemetri.
          </p>
        </div>
      </div>

      <div className="relative flex min-h-screen w-full flex-col lg:w-1/2 lg:bg-base-100">
        <header className="flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-3 lg:absolute lg:inset-x-0 lg:top-0 lg:z-20 lg:border-0 lg:bg-transparent lg:px-5 lg:py-4">
          <div className="flex items-center gap-2 lg:hidden">
            <img src={logoUnand} alt="Universitas Andalas" className="h-9 w-9 object-contain" />
            <div>
              <p className="text-sm font-semibold text-base-content">MY UNAND STUDENT CONNECT</p>
              <p className="text-xs text-base-content/60">Universitas Andalas</p>
            </div>
          </div>
          <div className="hidden lg:block" />
          <AccessibilityMenu />
        </header>

        <div className="flex flex-1 flex-col justify-center px-4 py-6 sm:px-8 lg:px-20 lg:py-10">
          <div className="mx-auto w-full max-w-md">
            <div className="card border border-base-300 bg-base-100 p-5 sm:p-6 lg:border-0 lg:bg-transparent lg:p-0">
              <h2 className="text-2xl font-extrabold text-base-content">Masuk</h2>
              <p className="mt-1 text-sm text-base-content/60">
                Gunakan akun portal Universitas Andalas.
              </p>
              <div className="mt-6">{form}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
