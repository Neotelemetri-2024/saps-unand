import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import PublicChrome, { PublicLoading, PublicStatus } from '../components/PublicChrome'
import logoUnand from '../assets/logo_unand.png'
import { getValidasiSertifikat } from '../services/sertifikatService'

export default function SertifikatValidasi() {
  const { token } = useParams()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) return
    getValidasiSertifikat(token)
      .then(setResult)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <PublicLoading />
  if (notFound || !result) {
    return <PublicStatus title="Sertifikat tidak ditemukan" description="Kode validasi tidak terdaftar atau tautan tidak berlaku." actions={<Link to="/login" className="btn btn-primary btn-sm">Kembali ke situs</Link>} />
  }

  const { data, valid } = result
  return (
    <PublicChrome>
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12 sm:px-6">
        <section className="w-full overflow-hidden rounded-lg border border-base-300 bg-base-100">
          <header className="flex items-center gap-4 border-b border-base-300 px-5 py-5 sm:px-8">
            <img src={logoUnand} alt="Universitas Andalas" className="h-14 w-14 object-contain" />
            <div>
              <p className="text-sm font-semibold text-primary">Universitas Andalas</p>
              <h1 className="text-2xl font-extrabold text-base-content">Validasi Sertifikat SAPS</h1>
            </div>
          </header>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className={`flex items-start gap-3 rounded-md border p-4 ${valid ? 'border-success/30 bg-success/10' : 'border-error/30 bg-error/10'}`}>
              {valid ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-error" />}
              <div>
                <h2 className="font-bold text-base-content">{valid ? 'Sertifikat valid' : 'Sertifikat telah dicabut'}</h2>
                <p className="mt-1 text-sm text-base-content/70">{valid ? 'Dokumen ini tercatat sebagai sertifikat resmi SAPS Universitas Andalas.' : 'Dokumen ini tidak lagi dinyatakan berlaku oleh penerbit.'}</p>
              </div>
            </div>

            <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                ['Nama mahasiswa', data.nama],
                ['NIM', data.nim],
                ['Program studi', data.prodi || '-'],
                ['Fakultas', data.fakultas],
                ['Total kredit', data.totalKredit],
                ['Kategori SAPS', data.kategoriStatus],
                ['Diterbitkan', new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.diterbitkanAt))],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-base-content/60">{label}</dt>
                  <dd className="mt-1 font-semibold text-base-content">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <footer className="flex items-center gap-2 border-t border-base-300 px-5 py-4 text-sm text-base-content/60 sm:px-8">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Data berasal dari snapshot saat sertifikat diterbitkan.
          </footer>
        </section>
      </main>
    </PublicChrome>
  )
}
