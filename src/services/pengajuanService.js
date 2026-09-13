import { get, post, put, del, resolveUploadUrl } from './apiClient'

const EVENT_NAME = 'saps-data-updated'

function emitUpdate(type) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type } }))
  } catch { /* ignore */ }
}

export function subscribeDataUpdate(callback) {
  const handler = (e) => callback(e?.detail)
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}

function formatTanggalValue(value) {
  if (value == null || value === '') return ''
  const s = String(value)
  if (s === '-' || /invalid/i.test(s)) return s
  // Sudah teks tanggal manusiawi
  if (/[a-zA-ZÀ-ÿ]/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s) && !/T\d{2}:/.test(s)) return s
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return s
  }
}

function resolvePenyelenggaraKegiatan(kegiatanObj, item = {}) {
  const fromDb =
    kegiatanObj?.organisasi?.nama ||
    kegiatanObj?.penyelenggaraExt ||
    kegiatanObj?.penyelenggara ||
    item.penyelenggara
  if (fromDb) return fromDb
  if (kegiatanObj?.asal === 'universitas') return 'Direktorat Kemahasiswaan UNAND'
  if (kegiatanObj?.asal === 'kurikuler_ukmf' && !kegiatanObj?.organisasiId) return 'Admin Fakultas'
  return '-'
}

function normalizePersetujuan(item, i = 0) {
  const id = item.id ?? item.partisipasiId ?? item.izinId ?? i
  // BE getIzinForDosen kembalikan struktur nested: item.partisipasi.kegiatan, dll.
  const part = item.partisipasi || {}
  const kegiatanObj = part.kegiatan || (typeof item.kegiatan === 'object' && item.kegiatan ? item.kegiatan : null)
  const mhsObj = part.mahasiswa || {}
  const peranObj = part.peranVerif || {}
  const tanggalMulai = formatTanggalValue(kegiatanObj?.tanggalMulai) || null
  const skalaNama =
    (typeof kegiatanObj?.skala === 'object' && kegiatanObj?.skala?.nama) ||
    (typeof kegiatanObj?.skala === 'string' ? kegiatanObj.skala : null) ||
    item.skala ||
    '-'
  return {
    ...item,
    id,
    kegiatan: kegiatanObj?.nama || item.kegiatan || item.namaKegiatan || item.kegiatanNama || item.judul || '-',
    diajukanPada: formatTanggalValue(item.tanggalDiajukan || item.createdAt),
    jenis: (typeof kegiatanObj?.kategori === 'object' ? kegiatanObj?.kategori?.nama : kegiatanObj?.kategori) || item.jenis || item.jenisKegiatan || '-',
    peran: peranObj?.nama || item.peran || item.peranPencapaian || '-',
    penyelenggara: resolvePenyelenggaraKegiatan(kegiatanObj, item),
    tanggal: tanggalMulai || formatTanggalValue(item.tanggal || item.tanggalPelaksanaan || item.tanggalDiajukan),
    skala: skalaNama,
    mahasiswa: mhsObj?.user?.nama || item.mahasiswa || item.namaMahasiswa || item.mahasiswaNama || 'Mahasiswa',
    namaMahasiswa: mhsObj?.user?.nama || item.namaMahasiswa || item.mahasiswaNama || 'Mahasiswa',
    status: (item.statusIzin || item.status || 'pending').toLowerCase(),
    isUlang: item.isUlang || false,
  }
}

function normalizePengajuanMahasiswa(item, i = 0) {
  return {
    ...item,
    id: item.id ?? i,
    kegiatan: item.namaKegiatan || item.kegiatan || '-',
    namaKegiatan: item.namaKegiatan || item.kegiatan || '-',
    jenis: item.jenisKegiatan || item.jenis || '-',
    kategori: item.jenisKegiatan || item.kategori || '-',
    penyelenggara: item.penyelenggara || '-',
    tanggal: formatTanggalValue(item.tanggalPelaksanaan || item.tanggal),
    skala: item.skala || '-',
    status: (item.status || 'pending').toLowerCase(),
    alasan: item.alasan || null,
    dibuatPada: formatTanggalValue(item.tanggalPengajuan || item.createdAt || item.dibuatPada),
  }
}

function normalizeKlaimEksternal(item, i = 0) {
  const part = item.partisipasi || {}
  const kegiatan = part.kegiatan || {}
  const mahasiswa = part.mahasiswa || {}
  const statusRaw = (item.status || '').toLowerCase()
  let status = statusRaw
  if (statusRaw === 'menunggu_validasi') status = 'pending'
  else if (statusRaw === 'menunggu_pimpinan') status = 'diteruskan'
  else if (statusRaw === 'perlu_revisi') status = 'revisi'
  else if (statusRaw === 'disetujui') status = 'disetujui'
  else if (statusRaw === 'ditolak') status = 'ditolak'

  const peran = item.peranUsulan?.nama || part.peranVerif?.nama || item.peran || '-'
  const tanggalMulai = kegiatan.tanggalMulai
  const tanggalSelesai = kegiatan.tanggalSelesai
  let tanggal = '-'
  try {
    if (tanggalMulai) {
      const ds = new Date(tanggalMulai)
      if (!Number.isNaN(ds.getTime())) {
        const a = ds.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        tanggal = tanggalSelesai
          ? `${a} - ${(() => { const de = new Date(tanggalSelesai); return Number.isNaN(de.getTime()) ? a : de.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) })()}`
          : a
      }
    }
  } catch { /* ignore */ }

  const capaian = (kegiatan.kegiatanCapaian || [])
    .map((kc) => kc.subCapaian?.capaian?.nama)
    .filter(Boolean)
  const uniqueCapaian = [...new Set(capaian)]
  const subCapaian = (kegiatan.kegiatanCapaian || []).map((kc) => ({
    label: kc.subCapaian?.nama || '-',
    persen: kc.persentase != null ? `${kc.persentase}%` : '-',
    poin: kc.persentase,
  }))

  return {
    ...item,
    id: String(item.id ?? i),
    mahasiswa: mahasiswa.user?.nama || item.namaMahasiswa || item.mahasiswa || '-',
    namaMahasiswa: mahasiswa.user?.nama || item.namaMahasiswa || '-',
    nim: mahasiswa.nim || item.nim || '-',
    prodi: mahasiswa.prodi?.nama || item.prodi || '-',
    kegiatan: kegiatan.nama || item.kegiatan || '-',
    kategori: kegiatan.kategori?.nama || item.kategori || '-',
    peran,
    tanggal,
    info: kegiatan.penyelenggaraExt || kegiatan.organisasi?.nama || item.info || '-',
    penyelenggara: kegiatan.penyelenggaraExt || kegiatan.organisasi?.nama || '-',
    email: kegiatan.emailExt || mahasiswa.user?.email || '-',
    linkWebsite: kegiatan.linkWebsiteExt || '-',
    deskripsi: kegiatan.deskripsi || '-',
    bukti: resolveUploadUrl(item.bukti?.[0]?.url || item.buktiUrl || null),
    capaian: uniqueCapaian.length ? uniqueCapaian : [],
    subCapaian,
    skala: kegiatan.skala?.nama || item.skala || '-',
    status,
    statusRaw,
    dibuatPada: formatTanggalValue(item.createdAt || item.dibuatPada),
    diajukanPada: formatTanggalValue(item.createdAt || item.dibuatPada),
    alasan: item.alasan || null,
  }
}

function mapKeputusan(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'disetujui' || s === 'setujui' || s === 'approved') return 'disetujui'
  if (s === 'revisi' || s === 'perlu_revisi') return 'perlu_revisi'
  if (s === 'ditolak' || s === 'tolak' || s === 'rejected') return 'ditolak'
  return s
}

// ─── Pengajuan Kegiatan Eksternal (Mahasiswa) ────────────────────────────────

/** POST /api/mahasiswa/kegiatan-eksternal/draft — simpan sebagai draft */
export async function simpanDraftKegiatanEksternal(data = {}) {
  const res = await post('/api/mahasiswa/kegiatan-eksternal/draft', data)
  emitUpdate('pengajuan')
  return res?.data || res
}

/** PUT /api/mahasiswa/kegiatan-eksternal/:id/draft — edit draft */
export async function editDraftKegiatanEksternal(id, data = {}) {
  const res = await put(`/api/mahasiswa/kegiatan-eksternal/${id}/draft`, data)
  emitUpdate('pengajuan')
  return res?.data || res
}

/** DELETE /api/mahasiswa/kegiatan-eksternal/:id/draft — hapus draft */
export async function hapusDraftKegiatanEksternal(id) {
  const res = await del(`/api/mahasiswa/kegiatan-eksternal/${id}/draft`)
  emitUpdate('pengajuan')
  return res?.data || res
}

/** PUT /api/mahasiswa/kegiatan-eksternal/:id/ajukan — kirim draft jadi diajukan */
export async function ajukanDraftKegiatanEksternal(id) {
  const res = await put(`/api/mahasiswa/kegiatan-eksternal/${id}/ajukan`, {})
  emitUpdate('pengajuan')
  return res?.data || res
}

/** POST /api/mahasiswa/kegiatan-eksternal */
export async function ajukanKegiatan(data = {}) {
  const body = {
    kategoriId: data.kategoriId ?? data.jenis,
    namaKegiatan: data.namaKegiatan || data.kegiatan,
    penyelenggara: data.penyelenggara,
    skalaId: data.skalaId ?? data.skala,
    tanggalPelaksanaan: data.tanggalPelaksanaan || data.tanggal,
    deskripsi: data.deskripsi || data.deskripsiKegiatan || '',
    linkWebsite: data.linkWebsite || '',
    emailPenyelenggara: data.emailPenyelenggara || '',
    ...(data.forceNew ? { forceNew: true } : {}),
    ...(data.existingKegiatanId ? { existingKegiatanId: data.existingKegiatanId } : {}),
  }
  const res = await post('/api/mahasiswa/kegiatan-eksternal', body)
  emitUpdate('pengajuan')
  return res?.data || res
}

/** GET /api/mahasiswa/kegiatan-eksternal */
export async function getPengajuan() {
  const res = await get('/api/mahasiswa/kegiatan-eksternal')
  const data = res?.data || res
  return Array.isArray(data) ? data.map(normalizePengajuanMahasiswa) : []
}

export async function getRiwayatPengajuan() {
  return getPengajuan()
}

// ─── Klaim Eksternal — Admin / Pimpinan Ditmawa ──────────────────────────────

/** GET /api/klaim/verifikasi-eksternal (admin: menunggu_validasi) */
export async function getPengajuanEksternal(params = {}) {
  const res = await get('/api/klaim/verifikasi-eksternal', {
    status: params.status || 'menunggu_validasi',
    ...params,
  })
  const data = res?.data || res
  return Array.isArray(data) ? data.map(normalizeKlaimEksternal) : []
}

/** GET /api/klaim/:id */
export async function getPengajuanEksternalById(id) {
  const res = await get(`/api/klaim/${id}`)
  const data = res?.data || res
  return data ? normalizeKlaimEksternal(data) : null
}

/** GET /api/klaim/verifikasi-eksternal (pimpinan default statuses) */
export async function getPengajuanPimpinanDitmawa(params = {}) {
  const res = await get('/api/klaim/verifikasi-eksternal', params)
  const data = res?.data || res
  return Array.isArray(data) ? data.map(normalizeKlaimEksternal) : []
}

/**
 * PUT /api/klaim/:id/validasi
 * Admin: revisi / tolak (keputusan: perlu_revisi | ditolak)
 */
export async function verifikasiPengajuanEksternal(id, status, alasan) {
  const keputusan = mapKeputusan(status)
  const res = await put(`/api/klaim/${id}/validasi`, {
    keputusan,
    ...(alasan ? { alasan } : {}),
  })
  emitUpdate('pengajuan')
  return res?.data || res
}

/**
 * Admin setujui → diteruskan ke pimpinan
 * PUT /api/klaim/:id/validasi { keputusan: 'disetujui' }
 */
export async function teruskanKePimpinanDitmawa(id, alasan) {
  const res = await put(`/api/klaim/${id}/validasi`, {
    keputusan: 'disetujui',
    ...(alasan ? { alasan } : {}),
  })
  emitUpdate('pengajuan')
  return res?.data || res
}

/**
 * Pimpinan setujui — pakai validasi-bulk (single validasi hanya untuk menunggu_validasi)
 */
export async function setujuiPengajuanEksternalPimpinan(id, alasan) {
  const res = await put('/api/klaim/validasi-bulk', {
    klaimIds: [Number(id)],
    keputusan: 'disetujui',
    ...(alasan ? { alasan } : {}),
  })
  emitUpdate('pengajuan')
  return res?.data || res
}

export async function tolakPengajuanEksternalPimpinan(id, alasan) {
  const res = await put('/api/klaim/validasi-bulk', {
    klaimIds: [Number(id)],
    keputusan: 'ditolak',
    alasan: alasan || 'Ditolak oleh Pimpinan Ditmawa',
  })
  emitUpdate('pengajuan')
  return res?.data || res
}

/** PUT /api/klaim/validasi-bulk */
export async function validasiBulk(ids, status, alasan) {
  const keputusan = mapKeputusan(status)
  const res = await put('/api/klaim/validasi-bulk', {
    klaimIds: (ids || []).map(Number),
    keputusan,
    ...(alasan ? { alasan } : {}),
  })
  emitUpdate('pengajuan')
  return res?.data || res
}

// ─── Persetujuan Dosen PA (Mahasiswa) ────────────────────────────────────────

/**
 * Minta persetujuan dosen PA dari daftar pengajuan kegiatan eksternal.
 * kegiatanId = ID kegiatan eksternal yang sudah disetujui pimpinan.
 * POST /api/mahasiswa/izin-pa { kegiatanId, peranId }
 */
export async function mintaPersetujuanDosenEksternal(kegiatanId, peranId) {
  if (!kegiatanId) throw new Error('kegiatanId diperlukan.')
  const body = {
    kegiatanId: Number(kegiatanId),
  }
  if (peranId) {
    body.peranId = Number(peranId)
  }
  const res = await post('/api/mahasiswa/izin-pa', body)
  emitUpdate('persetujuan')
  return res?.data || res
}

/**
 * Minta persetujuan Dosen PA untuk kegiatan internal.
 * Prefer partisipasiId (kontrak BE baru); fallback kegiatanId.
 * POST /api/mahasiswa/izin-pa { partisipasiId } | { kegiatanId, peranId? }
 */
export async function mintaPersetujuanDosenInternal({ partisipasiId, kegiatanId, peranId } = {}) {
  const body = {}
  if (partisipasiId) body.partisipasiId = String(partisipasiId)
  else if (kegiatanId) {
    body.kegiatanId = Number(kegiatanId)
    if (peranId) body.peranId = Number(peranId)
  } else {
    throw new Error('partisipasiId atau kegiatanId diperlukan.')
  }
  const res = await post('/api/mahasiswa/izin-pa', body)
  emitUpdate('persetujuan')
  return res?.data || res
}

/**
 * POST /api/mahasiswa/izin-pa
 * Body: { kegiatanId, peranId, kategoriId?, penyelenggara?, tanggalPelaksanaan? }
 */
export async function mintaPersetujuanDosen(data = {}) {
  if (!data?.kegiatanId) {
    throw new Error('API membutuhkan kegiatanId untuk mengajukan izin PA.')
  }
  if (!data?.peranId && !data?.peranVerifId) {
    throw new Error('API membutuhkan peranId untuk mengajukan izin PA.')
  }
  const body = {
    kegiatanId: Number(data.kegiatanId),
    peranId: Number(data.peranId ?? data.peranVerifId),
    ...(data.kategoriId ? { kategoriId: Number(data.kategoriId) } : {}),
    ...(data.penyelenggara ? { penyelenggara: data.penyelenggara } : {}),
    ...(data.tanggalPelaksanaan || data.tanggal
      ? { tanggalPelaksanaan: data.tanggalPelaksanaan || data.tanggal }
      : {}),
  }
  const res = await post('/api/mahasiswa/izin-pa', body)
  emitUpdate('persetujuan')
  return res?.data || res
}

/** GET /api/mahasiswa/izin-pa — raw (tanpa normalize, untuk PersetujuanDosen.jsx) */
export async function getIzinPAMahasiswa(params = {}) {
  const res = await get('/api/mahasiswa/izin-pa', params)
  const data = res?.data || res
  return Array.isArray(data) ? data : []
}

/** GET /api/mahasiswa/izin-pa */
export async function getPersetujuanMahasiswa(params = {}) {
  const res = await get('/api/mahasiswa/izin-pa', params)
  const data = res?.data || res
  return Array.isArray(data) ? data.map(normalizePersetujuan) : []
}

export async function getPersetujuanDosen(params = {}) {
  const res = await get('/api/dosen/persetujuan', params)
  const data = res?.data || res
  return Array.isArray(data) ? data.map(normalizePersetujuan) : []
}

export async function setujuiTolak(id, status, alasan) {
  const res = await put(`/api/dosen/persetujuan/${id}`, { status, alasan })
  emitUpdate('persetujuan')
  return res?.data || res
}

/** PUT /api/dosen/persetujuan-bulk — Dosen PA menyetujui beberapa izin (status diajukan) sekaligus */
export async function setujuiTolakBulk(ids) {
  const res = await put('/api/dosen/persetujuan-bulk', { ids: (ids || []).map(String) })
  emitUpdate('persetujuan')
  return res?.data || res
}

export async function getPendingPersetujuanCount() {
  const list = await getPersetujuanDosen({ status: 'pending' })
  return list.length
}

export async function getKegiatanEksternalTerdaftar(params = {}) {
  const res = await get('/api/mahasiswa/kegiatan-eksternal/terdaftar', params)
  return res?.data || []
}
