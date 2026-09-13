/** Base URL backend — set di .env: VITE_API_BASE=... */
const API_BASE = (import.meta.env.VITE_API_BASE || 'https://api.saps.neotelemetri.id').replace(/\/$/, '')

const DEFAULT_TIMEOUT_MS = 15000 // 15 detik batas waktu koneksi

function getToken() {
  try {
    const raw = localStorage.getItem('saps_current_user')
    if (!raw) return null
    return JSON.parse(raw)?.token || null
  } catch {
    return null
  }
}

function buildHeaders(extra = {}) {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    // Lewati halaman peringatan interstisial ngrok (free tier)
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function createTimeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

async function fetchWithTimeout(url, options = {}) {
  const signal = options.signal || createTimeoutSignal()
  try {
    return await fetch(url, { ...options, signal })
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError' || signal.aborted) {
      throw new Error('Koneksi ke server timeout (melebihi 15 detik). Silakan periksa jaringan Anda atau coba sesaat lagi.')
    }
    throw err
  }
}

function extractErrorMessage(text, body, status) {
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    const details = body.errors.map((e) => e.message || `${e.path?.join('.')}: invalid`).join(', ')
    return details
  }
  if (body?.message && typeof body.message === 'string' && !body.message.trim().startsWith('<')) {
    return body.message
  }
  if (body?.error && typeof body.error === 'string' && !body.error.trim().startsWith('<')) {
    return body.error
  }
  const pre = text?.match(/<pre>([\s\S]*?)<\/pre>/i)
  if (pre?.[1]) return pre[1].trim()
  const plain = text?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (plain && plain.length < 200) return plain
  return `HTTP ${status}`
}

async function handleResponse(res) {
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { message: text }
  }

  if (res.status === 401) {
    localStorage.removeItem('saps_current_user')
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
    throw new Error('Email atau password yang Anda masukkan salah.')
  }

  if (!res.ok) {
    const err = new Error(extractErrorMessage(text, body, res.status))
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

function buildUrl(path, params) {
  let url = `${API_BASE}${path}`
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ),
    ).toString()
    if (qs) url += `?${qs}`
  }
  return url
}

export async function get(path, params) {
  const res = await fetchWithTimeout(buildUrl(path, params), { headers: buildHeaders() })
  return handleResponse(res)
}

export async function post(path, data) {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data ?? {}),
  })
  return handleResponse(res)
}

export async function put(path, data) {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(data ?? {}),
  })
  return handleResponse(res)
}

export async function del(path) {
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'DELETE',
    headers: buildHeaders(),
  })
  return handleResponse(res)
}

export async function postFormData(path, formData) {
  const token = getToken()
  const headers = {
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetchWithTimeout(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
  })
  return handleResponse(res)
}

export function getApiBase() {
  return API_BASE
}

/** Ubah path relatif `/uploads/...` jadi URL absolut ke backend. */
export function resolveUploadUrl(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${API_BASE}${path}`
}

export function getAuthToken() {
  return getToken()
}
