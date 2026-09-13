import { post, get, put } from './apiClient'
import { setupFirebaseMessaging, isFirebaseConfigured } from '../lib/firebase'

const USER_STORAGE_KEY = 'saps_current_user'

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return {}
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonStr)
  } catch (err) {
    console.warn('[JWT Decode Warning]', err)
    return {}
  }
}

/**
 * BE memakai peran generik:
 *   'operator_org' (UKM atau UKMF, dibedakan dari tipe organisasi)
 *   'admin_org'    (admin_ditmawa atau admin_fakultas)
 */
function resolveRoleFromMe(peranRaw, meData) {
  const tipe = (
    meData?.organisasiOperator?.organisasi?.tipe ||
    meData?.tipeOrganisasi ||
    meData?.tipe ||
    meData?.organisasi?.tipe ||
    meData?.organisasi?.tingkat ||
    meData?.tingkat ||
    ''
  ).toLowerCase()

  if (peranRaw === 'operator_org') {
    if (['ukmf', 'fakultas', 'ukmf_org'].includes(tipe)) return 'operator_ukmf'
    return 'operator_ukm'
  }

  if (peranRaw === 'staff') {
    const jabatan = (meData?.staff?.jabatan || '').toLowerCase()
    if (jabatan) return jabatan
  }

  if (peranRaw === 'admin_org') {
    if (tipe === 'fakultas') return 'admin_fakultas'
    return 'admin_ditmawa'
  }

  return peranRaw
}

/**
 * Login Akun Internal (Email/Username + Password)
 * Digunakan untuk: Pimpinan Ditmawa, Pimpinan Utama, Pimpinan Fakultas,
 * Admin Ditmawa/Fakultas, Operator UKM & UKMF.
 *
 * Dioptimalkan untuk respon instan (<300ms) tanpa menunggu blocking /api/auth/me.
 */
export async function login(email, password) {
  if (!password) throw new Error('Password wajib diisi')

  const emailLower = email.trim().toLowerCase()
  const res = await post('/api/auth/login', { email: emailLower, password })

  if (!res?.success) {
    throw new Error('Username atau password yang Anda masukkan salah.')
  }

  const token = res.data?.token
  const userData = res.data?.user || {}

  // Prioritaskan role langsung dari backend response
  const peranRaw = (userData.jabatan || userData.peran || '').trim()
  let role = userData.role || (userData.jabatan ? userData.jabatan : null)
  if (!role) {
    if (peranRaw === 'operator_org') {
      const tipe = (userData.tipeOrganisasi || '').toLowerCase()
      role = ['ukmf', 'fakultas', 'ukmf_org'].includes(tipe) ? 'operator_ukmf' : 'operator_ukm'
    } else {
      role = peranRaw || 'mahasiswa'
    }
  }

  const user = {
    id: userData.id,
    email: userData.email || emailLower,
    nama: userData.nama || emailLower,
    peran: userData.peran || null,
    jabatan: userData.jabatan || null,
    organisasiId: userData.organisasiId ?? null,
    namaOrganisasi: userData.namaOrganisasi ?? null,
    tipeOrganisasi: userData.tipeOrganisasi ?? null,
    kurikulumId: null,
    kurikulumNama: null,
    role,
    userRole: userData.jabatan || userData.peran || role,
    token,
    authProvider: 'internal',
  }

  // Simpan segera ke localStorage agar halaman langsung beralih ke Dashboard
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))

  // Ambil detail profil secara non-blocking di background untuk memperkaya data kurikulum/organisasi
  get('/api/auth/me')
    .then((meRes) => {
      const meData = meRes?.data || meRes || {}
      const finalRole = resolveRoleFromMe(peranRaw, meData) || role
      const updatedUser = {
        ...user,
        nama: meData.nama || user.nama,
        organisasiId: user.organisasiId ?? meData.organisasiOperator?.organisasi?.id ?? null,
        namaOrganisasi: user.namaOrganisasi ?? meData.organisasiOperator?.organisasi?.nama ?? null,
        tipeOrganisasi: user.tipeOrganisasi ?? meData.organisasiOperator?.organisasi?.tipe ?? null,
        kurikulumId: meData.mahasiswa?.kurikulum?.id ?? meData.mahasiswa?.kurikulumId ?? null,
        kurikulumNama: meData.mahasiswa?.kurikulum?.nama ?? null,
        role: finalRole,
        userRole: meData.staff?.jabatan || user.userRole,
      }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
      window.dispatchEvent(new Event('saps-user-updated'))
    })
    .catch((e) => {
      console.warn('[Background /api/auth/me] gagal:', e?.message)
    })

  // Registrasi FCM token setelah login sukses (non-blocking).
  if (isFirebaseConfigured()) {
    setupFirebaseMessaging()
      .then((fcmToken) => {
        if (!fcmToken) return
        return put('/api/auth/fcm-token', { fcmToken })
      })
      .catch((err) => {
        console.error('[FCM] Gagal registrasi/simpan token FCM:', err)
      })
  }

  return user
}

/**
 * Login SSO UNAND (OAuth2 Keycloak)
 * Digunakan untuk: Mahasiswa & Dosen umum kampus.
 * Menggunakan session claim SSO langsung dan respon instan tanpa penundaan blocking.
 */
export async function handleSsoLogin(token) {
  if (!token) throw new Error('Token SSO tidak ditemukan.')

  const tokenPayload = decodeJwtPayload(token)
  console.log('[SSO Token Payload]', tokenPayload)

  const peranRaw = (
    tokenPayload?.jabatan ||
    tokenPayload?.peran ||
    tokenPayload?.role ||
    'mahasiswa'
  ).toString().trim()

  let role = peranRaw
  if (peranRaw === 'staff' && tokenPayload?.jabatan) {
    role = tokenPayload.jabatan
  } else if (peranRaw === 'operator_org') {
    role = tokenPayload.organisasiId ? 'operator_ukm' : 'operator_ukmf'
  }

  const user = {
    id: tokenPayload.id || tokenPayload.sub || null,
    email: tokenPayload.email || '',
    nama: tokenPayload.nama || tokenPayload.name || 'Pengguna UNAND',
    peran: tokenPayload.peran || peranRaw,
    jabatan: tokenPayload.jabatan || null,
    organisasiId: tokenPayload.organisasiId ?? null,
    namaOrganisasi: tokenPayload.namaOrganisasi ?? null,
    tipeOrganisasi: null,
    kurikulumId: null,
    kurikulumNama: null,
    role,
    userRole: tokenPayload.jabatan || tokenPayload.peran || role,
    token,
    authProvider: 'sso',
  }

  // Simpan segera agar redirect halaman instan
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))

  // Ambil detail profil jika sudah ada di internal DB secara background (enrichment)
  get('/api/auth/me')
    .then((meRes) => {
      const meData = meRes?.data || meRes || {}
      const finalRole = resolveRoleFromMe(peranRaw, meData) || role
      const updatedUser = {
        ...user,
        id: meData.id || user.id,
        nama: meData.nama || user.nama,
        email: meData.email || user.email,
        peran: meData.peran || user.peran,
        jabatan: meData.staff?.jabatan || user.jabatan,
        organisasiId: meData.organisasiOperator?.organisasi?.id ?? user.organisasiId,
        namaOrganisasi: meData.organisasiOperator?.organisasi?.nama ?? user.namaOrganisasi,
        tipeOrganisasi: meData.organisasiOperator?.organisasi?.tipe ?? user.tipeOrganisasi,
        kurikulumId: meData.mahasiswa?.kurikulum?.id ?? meData.mahasiswa?.kurikulumId ?? null,
        kurikulumNama: meData.mahasiswa?.kurikulum?.nama ?? null,
        role: finalRole,
        userRole: meData.staff?.jabatan || meData.peran || finalRole,
      }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
      window.dispatchEvent(new Event('saps-user-updated'))
    })
    .catch((e) => {
      console.warn('[SSO Background /api/auth/me]:', e?.message)
    })

  if (isFirebaseConfigured()) {
    setupFirebaseMessaging()
      .then((fcmToken) => {
        if (!fcmToken) return
        return put('/api/auth/fcm-token', { fcmToken })
      })
      .catch((err) => {
        console.error('[FCM SSO] error:', err)
      })
  }

  return user
}

/**
 * Logout Cerdas (Smart Logout)
 * Membersihkan sesi lokal secara tuntas dan seketika (< 10ms) kembali ke /login.
 * Mencegah browser diarahkan ke halaman error Keycloak (HTTP 400 'Invalid redirect uri').
 */
export function logout() {
  localStorage.removeItem(USER_STORAGE_KEY)
  window.location.href = '/login'
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAuthenticated() {
  const u = getCurrentUser()
  return u !== null && !!u.role
}

/** GET /api/mahasiswa/kurikulum */
export async function getKurikulumMahasiswa() {
  try {
    const res = await get('/api/mahasiswa/kurikulum')
    const data = res?.data ?? res
    if (data) {
      const kurikulumId = data.id ?? null
      const kurikulumNama = data.nama ?? null
      try {
        const raw = localStorage.getItem(USER_STORAGE_KEY)
        if (raw) {
          const current = JSON.parse(raw)
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ ...current, kurikulumId, kurikulumNama }))
        }
      } catch { /* ignore */ }
      return { id: kurikulumId, nama: kurikulumNama }
    }
    return null
  } catch {
    return null
  }
}

/** PUT /api/auth/profil */
export async function updateProfil(payload) {
  const res = await put('/api/auth/profil', payload)
  const data = res?.data || res

  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (raw && data) {
      const current = JSON.parse(raw)
      const next = {
        ...current,
        ...(data.nama != null ? { nama: data.nama } : {}),
        ...(data.email != null ? { email: data.email } : {}),
      }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
      window.dispatchEvent(new Event('saps-user-updated'))
    }
  } catch {
    /* ignore */
  }

  return data
}

/** PUT /api/auth/ganti-password */
export async function gantiPassword(payload) {
  const res = await put('/api/auth/ganti-password', payload)
  return res?.data || res
}
