import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { getCurrentUser } from '../../services/authService'
import { downloadSertifikatPdf, getSertifikatPdf } from '../../services/sertifikatService'

export default function GenerateSertifikat() {
  const user = getCurrentUser()
  const [loading, setLoading] = useState(false)
  const [certificate, setCertificate] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await getSertifikatPdf()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setCertificate(result)
      setPreviewUrl(URL.createObjectURL(result.blob))
    } catch (error) {
      toast.error('Gagal membuat sertifikat', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
      <div className="space-y-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="btn btn-primary min-h-11 px-5 text-sm sm:min-h-0"
          >
            {loading ? <span className="loading loading-spinner loading-sm" /> : null}
            {loading ? 'Membuat Sertifikat…' : certificate ? 'Generate Ulang Sertifikat' : 'Generate Sertifikat'}
          </button>
          <p className="text-sm text-base-content/60">
            Buat sertifikat aktivitas mahasiswa dari data SAPS Anda secara otomatis.
          </p>
        </div>

        {previewUrl ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => downloadSertifikatPdf(certificate)}
                className="btn btn-primary min-h-11 gap-2 px-4 text-sm sm:min-h-0"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>

            <section className="overflow-hidden rounded-md border border-base-300 bg-base-100">
              <iframe
                src={previewUrl}
                title="Preview Sertifikat SAPS"
                className="h-[70vh] min-h-[520px] w-full bg-base-200"
              />
            </section>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
