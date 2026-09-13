import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, X, ChevronDown } from 'lucide-react'
import DatePickerInput from './ui/DatePickerInput'
import ConfirmModal from './ui/ConfirmModal'
import { createKegiatan, updateKegiatan, getKegiatanById, ajukanKegiatan } from '../services/kegiatanService'
import { getKurikulumAktif } from '../services/kurikulumService'
import { getKategoriKegiatan, getSkalaKegiatan } from '../services/matriksService'
import PemetaanCapaianKurikulumSection from './PemetaanCapaianKurikulumSection'
import { getCurrentUser } from '../services/authService'
import { batalBtnClass } from './ui/buttonStyles'

const EMPTY_FORM = {
  nama: '',
  kategoriId: '',
  skalaId: '',
  deskripsi: '',
  tanggalMulai: null,
  tanggalSelesai: null,
  lokasi: '',
  kuota: '',
  tanpaPersetujuanPa: false,
  selectedKurikulumIds: [],
  selectedCapaianIds: [],
  alokasi: [],
}

function EventForm({ editItem, onCancel, onSaved, asal = 'universitas' }) {
  const isEdit = !!editItem
  const currentUser = getCurrentUser()
  const role = currentUser?.role || ""
  const isPimpinan = role === "pimpinan_ditmawa" || role === "pimpinan_utama"
  const canSkipPa =
    (asal === 'universitas' && (role === 'admin_ditmawa' || role === 'pimpinan_ditmawa')) ||
    (asal === 'kurikuler_ukmf' && role === 'admin_fakultas')
  const [loading, setLoading] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [showAjukanConfirm, setShowAjukanConfirm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [kurikulumList, setKurikulumList] = useState([])
  const [loadingKur, setLoadingKur] = useState(true)
  const [kategoriList, setKategoriList] = useState([])
  const [skalaList, setSkalaList] = useState([])

  // Muat data master saat komponen dipasang
  useEffect(() => {
    Promise.all([getKurikulumAktif(), getKategoriKegiatan()])
      .then(([kur, kat]) => {
        const list = Array.isArray(kur) ? kur : (kur ? [kur] : [])
        setKurikulumList(list)
        setKategoriList(Array.isArray(kat) ? kat : [])
        if (!isEdit) {
          setForm((prev) => ({
            ...prev,
            selectedKurikulumIds: list.map((k) => k.id),
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingKur(false))
  }, [])

  // Saat mode edit, ambil detail lengkap kegiatan (termasuk alokasi capaian)
  useEffect(() => {
    if (!editItem) return
    setLoadingEdit(true)
    getKegiatanById(editItem.id)
      .then((detail) => {
        if (!detail) return
        const alokasi = (detail.kegiatanCapaian || detail.alokasi || []).map((a) => ({
          subCapaianId: Number(a.subCapaianId ?? a.id),
          alokasiPersen: Number(a.alokasiPersen ?? a.alokasiPoin ?? 100),
        }))
        const capaianIds = [
          ...new Set(
            (detail.kegiatanCapaian || [])
              .map((a) => a.subCapaian?.capaian?.id ?? a.capaianId)
              .filter(Boolean)
          ),
        ]
        const existingKurikulumIds = [
          ...new Set(
            (detail.kegiatanCapaian || [])
              .map((a) => a.subCapaian?.capaian?.kurikulumId)
              .filter(Boolean)
          ),
        ]
        const fallbackKurikulumId = detail.kurikulumId ? [detail.kurikulumId] : []
        const kurikulumIds = existingKurikulumIds.length > 0 ? existingKurikulumIds : fallbackKurikulumId

        setForm({
          nama: detail.nama || '',
          kategoriId: detail.kategoriId ?? detail.kategori?.id ?? '',
          skalaId: detail.skalaId ?? detail.skala?.id ?? '',
          deskripsi: detail.deskripsi || '',
          tanggalMulai: detail.tanggalMulai ? new Date(detail.tanggalMulai) : null,
          tanggalSelesai: detail.tanggalSelesai ? new Date(detail.tanggalSelesai) : null,
          lokasi: detail.lokasi || '',
          kuota: detail.kuota ?? '',
          tanpaPersetujuanPa: Boolean(detail.tanpaPersetujuanPa),
          selectedKurikulumIds: kurikulumIds.length > 0 ? kurikulumIds : (kurikulumList.map((k) => k.id)),
          selectedCapaianIds: capaianIds,
          alokasi,
        })
      })
      .catch((err) => {
        toast.error('Gagal memuat data kegiatan', { description: err.message })
      })
      .finally(() => setLoadingEdit(false))
  }, [editItem])

  useEffect(() => {
    if (!form.kategoriId) {
      setSkalaList([])
      return
    }
    getSkalaKegiatan(form.kategoriId)
      .then((ska) => setSkalaList(Array.isArray(ska) ? ska : []))
      .catch(() => setSkalaList([]))
  }, [form.kategoriId])

  const toISODate = (d) => {
    if (!d) return null
    if (typeof d === 'string') return d
    return d.toISOString().split('T')[0]
  }

  const validateForm = () => {
    if (!form.nama || !form.kategoriId || !form.skalaId || !form.deskripsi || !form.tanggalMulai || !form.lokasi || !form.kuota) {
      toast.error('Lengkapi semua field yang wajib diisi.')
      return false
    }
    if (form.tanggalMulai && form.tanggalSelesai && new Date(form.tanggalSelesai) < new Date(form.tanggalMulai)) {
      toast.error('Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.')
      return false
    }
    if (kurikulumList.length === 0) {
      toast.error('Tidak ada kurikulum aktif.')
      return false
    }
    for (const kur of kurikulumList) {
      const kurSubIds = (kur.capaian || []).flatMap((c) => (c.subCapaian || []).map((sc) => sc.id))
      const kurAlokasi = form.alokasi.filter((a) => kurSubIds.includes(a.subCapaianId))
      if (kurAlokasi.length === 0) {
        toast.error(`Pilih minimal satu sub-capaian untuk ${kur.nama}`)
        return false
      }
      const sum = kurAlokasi.reduce((s, a) => s + (a.alokasiPersen || 0), 0)
      if (Math.abs(sum - 100) > 0.01) {
        toast.error(`Total bobot untuk ${kur.nama} harus tepat 100%. Saat ini: ${sum}%`)
        return false
      }
    }
    return true
  }

  const buildPayload = () => ({
    nama: form.nama,
    kategoriId: Number(form.kategoriId),
    skalaId: Number(form.skalaId),
    asal,
    deskripsi: form.deskripsi || undefined,
    lokasi: form.lokasi || undefined,
    kuota: Number(form.kuota) || undefined,
    tanggalMulai: toISODate(form.tanggalMulai),
    tanggalSelesai: toISODate(form.tanggalSelesai),
    tanpaPersetujuanPa: canSkipPa && form.tanpaPersetujuanPa,
    alokasi: form.alokasi,
  })

  const handleSimpanDraft = async () => {
    if (!validateForm()) return
    setLoading(true)
    try {
      const payload = buildPayload()
      if (isEdit) {
        await updateKegiatan(editItem.id, payload)
        toast.success('Draft event berhasil diperbarui!')
      } else {
        await createKegiatan(payload)
        toast.success('Draft tersimpan!', {
          description: 'Kirim event dari Event Global setelah siap. Setelah dikirim tidak dapat diedit.',
        })
      }
      onSaved?.()
    } catch (err) {
      toast.error('Gagal menyimpan event', { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleAjukanSekarang = async () => {
    setShowAjukanConfirm(false)
    if (!validateForm()) return
    setLoading(true)
    try {
      const payload = buildPayload()
      const id = isEdit ? editItem.id : (await createKegiatan(payload))?.id
      if (isEdit) {
        await updateKegiatan(editItem.id, payload)
      }
      await ajukanKegiatan(id)
      if (isPimpinan) {
        toast.success('Event berhasil dipublikasikan dan langsung aktif!', {
          description: 'Kegiatan telah aktif dan peserta dapat didaftarkan.',
        })
      } else {
        toast.success('Event berhasil diajukan!', {
          description: 'Event telah dikirim dan menunggu persetujuan. Setelah dikirim tidak dapat diedit.',
        })
      }
      onSaved?.()
    } catch (err) {
      toast.error(isPimpinan ? 'Gagal mempublikasikan event' : 'Gagal mengajukan event', { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        isOpen={showAjukanConfirm}
        message={
          isPimpinan
            ? 'Publikasikan kegiatan ini agar langsung aktif dan dapat diakses mahasiswa?'
            : 'Setelah diajukan, event tidak dapat diedit. Lanjutkan?'
        }
        confirmText={isPimpinan ? 'Ya, Publikasikan' : 'Ya, Ajukan'}
        cancelText="Batal"
        onConfirm={handleAjukanSekarang}
        onCancel={() => setShowAjukanConfirm(false)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost btn-sm text-base-content"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-extrabold text-base-content">{isEdit ? 'Edit Event' : 'Buat Event'}</h2>
        <p className="mt-1 text-sm text-base-content/60">Isi detail kegiatan dan simpan sebagai draft. Kirim dari daftar setelah siap.</p>
      </div>

      {loadingEdit && (
        <div className="card bg-base-100 p-4 text-sm text-base-content/60">
          Memuat data event…
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
        <div className="card bg-base-100 p-6">
          <p className="text-sm text-base-content/60">Lengkapi informasi kegiatan terlebih dahulu</p>

          <h3 className="mt-3 text-base font-semibold text-base-content">Informasi Kegiatan</h3>

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Jenis Kegiatan <span className="text-error">*</span>
              </label>
              <select
                value={form.kategoriId}
                onChange={(e) => setForm((p) => ({ ...p, kategoriId: e.target.value, skalaId: '' }))}
                className="select w-full"
                required
              >
                <option value="">-- Pilih jenis kegiatan --</option>
                {kategoriList.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.nama || opt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Nama Kegiatan <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.nama}
                onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                placeholder="Masukkan nama kegiatan"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Skala Kegiatan <span className="text-error">*</span>
              </label>
              <select
                value={form.skalaId}
                onChange={(e) => setForm((p) => ({ ...p, skalaId: e.target.value }))}
                className="select w-full"
                required
                disabled={!form.kategoriId}
              >
                <option value="">Pilih skala kegiatan</option>
                {skalaList.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.nama || opt.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-base-content">
                Deskripsi Kegiatan <span className="text-error">*</span>
              </label>
              <textarea
                value={form.deskripsi}
                onChange={(e) => setForm((p) => ({ ...p, deskripsi: e.target.value }))}
                placeholder="Tujuan, agenda, dan manfaat kegiatan"
                rows={4}
                maxLength={500}
                className="textarea w-full"
              />
              <p className="mt-1 text-right text-xs text-base-content/50">{form.deskripsi.length}/500</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DatePickerInput
                label="Tanggal Mulai"
                value={form.tanggalMulai}
                onChange={(date) => setForm((prev) => ({ ...prev, tanggalMulai: date }))}
                required
                placeholder="Pilih tanggal"
              />
              <DatePickerInput
                label="Tanggal Selesai"
                value={form.tanggalSelesai}
                onChange={(date) => setForm((prev) => ({ ...prev, tanggalSelesai: date }))}
                minDate={form.tanggalMulai || undefined}
                placeholder="Pilih tanggal"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-base-content">
                  Lokasi <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={form.lokasi}
                  onChange={(e) => setForm((p) => ({ ...p, lokasi: e.target.value }))}
                  placeholder="Gedung / tempat kegiatan..."
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-base-content">
                  Kuota Peserta <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  value={form.kuota}
                  onChange={(e) => setForm((p) => ({ ...p, kuota: e.target.value }))}
                  placeholder="Masukkan jumlah peserta"
                  min={1}
                  className="input w-full"
                  required
                />
              </div>
            </div>

            {canSkipPa && (
              <div className="flex items-start justify-between gap-5 border-t border-base-300 pt-5">
                <div>
                  <label htmlFor="tanpa-persetujuan-pa" className="text-sm font-semibold text-base-content">
                    Tanpa Persetujuan Dosen PA
                  </label>
                  <p className="mt-1 text-sm text-base-content/60">
                    Jika aktif, poin dapat cair setelah kehadiran dan peran peserta lengkap tanpa menunggu izin Dosen PA.
                  </p>
                </div>
                <input
                  id="tanpa-persetujuan-pa"
                  type="checkbox"
                  className="toggle toggle-primary mt-0.5 shrink-0"
                  checked={form.tanpaPersetujuanPa}
                  onChange={(e) => setForm((prev) => ({ ...prev, tanpaPersetujuanPa: e.target.checked }))}
                />
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 p-6">
          <h3 className="text-base font-semibold text-base-content">Pemetaan Capaian Kurikulum</h3>
          <p className="mt-0.5 mb-5 text-sm text-base-content/60">
            Tentukan capaian kurikulum yang dicapai melalui kegiatan ini
          </p>

          {loadingKur ? (
            <p className="text-sm text-base-content/50">Memuat kurikulum…</p>
          ) : kurikulumList.length === 0 ? (
            <p className="text-sm text-error">Kurikulum aktif tidak ditemukan. Hubungi Admin.</p>
          ) : (
            <PemetaanCapaianKurikulumSection
              kurikulumList={kurikulumList}
              selectedKurikulumIds={form.selectedKurikulumIds}
              setSelectedKurikulumIds={(ids) =>
                setForm((p) => ({
                  ...p,
                  selectedKurikulumIds: typeof ids === 'function' ? ids(p.selectedKurikulumIds) : ids,
                }))
              }
              selectedCapaianIds={form.selectedCapaianIds}
              setSelectedCapaianIds={(cids) =>
                setForm((p) => ({
                  ...p,
                  selectedCapaianIds: typeof cids === 'function' ? cids(p.selectedCapaianIds) : cids,
                }))
              }
              alokasi={form.alokasi}
              setAlokasi={(aloks) =>
                setForm((p) => ({
                  ...p,
                  alokasi: typeof aloks === 'function' ? aloks(p.alokasi) : aloks,
                }))
              }
            />
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading || loadingEdit}
            onClick={handleSimpanDraft}
            className="btn btn-outline btn-primary"
          >
            {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Draft'}
          </button>
          <button
            type="button"
            disabled={loading || loadingEdit}
            onClick={() => { if (validateForm()) setShowAjukanConfirm(true) }}
            className="btn btn-primary"
          >
            {loading ? (isPimpinan ? 'Mempublikasikan...' : 'Mengirim...') : (isPimpinan ? 'Publikasikan Sekarang' : 'Ajukan Sekarang')}
          </button>
          <button type="button" onClick={onCancel} className={batalBtnClass}>
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}

export default EventForm
