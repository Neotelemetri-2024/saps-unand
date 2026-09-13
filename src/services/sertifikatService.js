import { getApiBase, getAuthToken } from './apiClient'

export async function getValidasiSertifikat(token) {
  const response = await fetch(`${getApiBase()}/api/umum/sertifikat/validasi/${encodeURIComponent(token)}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(body?.message || 'Sertifikat tidak ditemukan')
    error.status = response.status
    throw error
  }
  return body
}

function filenameFromDisposition(value) {
  const utf8 = value?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = value?.match(/filename="?([^";]+)"?/i)?.[1]
  try {
    return decodeURIComponent(utf8 || plain || 'Sertifikat SAPS.pdf')
  } catch {
    return plain || 'Sertifikat SAPS.pdf'
  }
}

export async function getSertifikatPdf() {
  const token = getAuthToken()
  if (!token) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.')

  const response = await fetch(`${getApiBase()}/api/mahasiswa/sertifikat/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Gagal memuat sertifikat SAPS')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/pdf')) throw new Error('Respons sertifikat bukan file PDF yang valid')

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('content-disposition')),
  }
}

export function downloadSertifikatPdf({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
