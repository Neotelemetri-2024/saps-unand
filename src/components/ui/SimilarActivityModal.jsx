import { useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, PlusCircle, X, Calendar, Building, Award, Tag } from 'lucide-react'
import { batalBtnClass } from './buttonStyles'

function SimilarActivityModal({
  isOpen,
  similarData,
  onJoin,
  onForceNew,
  onCancel,
  loading = false,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (isOpen) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [isOpen])

  if (!similarData) return null

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom sm:modal-middle bg-black/40 backdrop-blur-xs transition-all duration-200"
      onClose={onCancel}
      onCancel={(e) => {
        e.preventDefault()
        onCancel?.()
      }}
    >
      <div className="modal-box relative max-w-xl p-5 sm:p-6 rounded-2xl shadow-2xl border border-amber-200/60 bg-base-100 text-left">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn btn-ghost btn-circle btn-xs absolute right-3 top-3 text-base-content/40 hover:text-base-content"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pb-3 border-b border-base-200">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-base-content">
              Kegiatan Serupa Ditemukan
            </h3>
            <p className="text-xs sm:text-sm text-base-content/70 mt-0.5 leading-relaxed">
              Sistem mendeteksi kegiatan serupa sudah terdaftar untuk periode tahun{' '}
              <strong className="text-amber-700">{similarData.tahun || 'ini'}</strong>.
            </p>
          </div>
        </div>

        {/* Card Kegiatan Yang Sudah Ada */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-bold text-sm sm:text-base text-amber-950">
              {similarData.nama}
            </h4>
            {similarData.status && (
              <span className="badge badge-warning badge-sm shrink-0 font-medium capitalize">
                {similarData.status}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-900/90 pt-1">
            <div className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>Penyelenggara: <strong>{similarData.penyelenggara || '-'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>Tahun: <strong>{similarData.tahun || '-'}</strong></span>
            </div>
            {similarData.skalaNama && (
              <div className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>Skala: <strong>{similarData.skalaNama}</strong></span>
              </div>
            )}
            {similarData.kategoriNama && (
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                <span>Jenis: <strong>{similarData.kategoriNama}</strong></span>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-base-content/70 leading-relaxed">
          Apakah kegiatan yang Anda ikuti adalah kegiatan yang sama di atas? Memilih untuk bergabung akan mencegah duplikasi master kegiatan dan memudahkan proses validasi.
        </p>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse sm:items-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => onJoin(similarData.id)}
            className="btn btn-primary btn-sm sm:btn-md gap-1.5 w-full sm:w-auto"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? 'Memproses…' : 'Gunakan Kegiatan Ini (Gabung)'}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onForceNew}
            className="btn btn-outline btn-warning btn-sm sm:btn-md gap-1.5 w-full sm:w-auto"
          >
            <PlusCircle className="h-4 w-4" />
            Bukan, Tetap Ajukan Baru
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className={`${batalBtnClass} w-full sm:w-auto text-center sm:mr-auto`}
          >
            Periksa Kembali
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" disabled={loading}>close</button>
      </form>
    </dialog>
  )
}

export default SimilarActivityModal
