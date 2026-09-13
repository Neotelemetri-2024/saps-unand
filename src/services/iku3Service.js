import { get, post, put, del, getAuthToken, getApiBase } from './apiClient'

export async function getIku3Dashboard(params = {}) {
  const res = await get('/api/iku3/dashboard', params)
  return res?.data || res || {}
}

export async function getIku3Trend(params = {}) {
  const res = await get('/api/iku3/trend', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function getIku3QuarterlyTrend(params = {}) {
  const res = await get('/api/iku3/trend/quarterly', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function getIku3Faculties(params = {}) {
  const res = await get('/api/iku3/faculties', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function getIku3Activities(params = {}) {
  const res = await get('/api/iku3/activities', params)
  return {
    total: res?.total ?? 0,
    page: res?.page ?? 1,
    totalPages: res?.totalPages ?? 1,
    data: Array.isArray(res?.data) ? res.data : [],
  }
}

export async function getIku3Targets() {
  const res = await get('/api/iku3/targets')
  return Array.isArray(res?.data) ? res.data : []
}

export async function saveIku3Target(body) {
  return post('/api/iku3/targets', body)
}

export async function getIku3Rules(params = {}) {
  const res = await get('/api/iku3/rules', params)
  return Array.isArray(res?.data) ? res.data : []
}

export async function updateIku3Rule(id, body) {
  const res = await put(`/api/iku3/rules/${id}`, body)
  return res?.data || res || {}
}

export async function createIku3Rule(body) {
  const res = await post('/api/iku3/rules', body)
  return res?.data || res || {}
}

export async function deleteIku3Rule(id) {
  const res = await del(`/api/iku3/rules/${id}`)
  return res?.data || res || {}
}

export async function downloadExcelIku3(filter = {}) {
  const token = getAuthToken()
  const apiBase = getApiBase()
  const qs = new URLSearchParams()
  if (filter.tahun) qs.set('tahun', filter.tahun)
  if (filter.triwulan) qs.set('triwulan', filter.triwulan)
  if (filter.fakultasId) qs.set('fakultasId', filter.fakultasId)
  if (filter.prodiId) qs.set('prodiId', filter.prodiId)
  const queryString = qs.toString() ? '?' + qs.toString() : ''

  const url = `${apiBase}/api/iku3/export${queryString}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  })

  if (!res.ok) {
    let errorMsg = 'Gagal mengunduh file Excel IKU 3'
    try {
      const errJson = await res.json()
      if (errJson?.message) errorMsg = errJson.message
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  const blob = await res.blob()
  const contentDisposition = res.headers.get('Content-Disposition')
  let filename = 'Laporan_IKU3_' + (filter.tahun || 2026) + '.xlsx'
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/)
    if (match && match[1]) {
      filename = match[1]
    }
  }

  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(blobUrl)
}
