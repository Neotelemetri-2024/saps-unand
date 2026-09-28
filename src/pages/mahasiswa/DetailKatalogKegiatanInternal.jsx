import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import { getCurrentUser, getKurikulumMahasiswa } from '../../services/authService'
import { get, post, del } from '../../services/apiClient'
import {
  InfoRow,
  SectionCard,
  DetailBackButton,
  DetailHeader,
  DecisionNote,
  CurriculumAchievementCard,
  formatTanggal,
} from '../../components/ui/DetailComponents'
import { DetailSkeleton } from '../../components/dashboard/Skeleton'

function normalizeCapaianData(kegiatan, userKurikulumId, userKurikulumNama) {
  if (!kegiatan || !Array.isArray(kegiatan.kegiatanCapaian)) {
    return { kurikulum: userKurikulumNama || '-', capaian: [], subCapaian: [], kegiatanCapaian: [] }
  }

  const allList = kegiatan.kegiatanCapaian

  // Filter ke kurikulum mahasiswa jika tersedia
  let list = allList
  if (userKurikulumId || userKurikulumNama) {
    const filtered = allList.filter((kc) => {
      const kurId = kc.subCapaian?.capaian?.kurikulum?.id ?? kc.capaian?.kurikulum?.id ?? kc.kurikulum?.id
      const kurNama = kc.subCapaian?.capaian?.kurikulum?.nama ?? kc.capaian?.kurikulum?.nama ?? kc.kurikulum?.nama
      if (userKurikulumId && kurId != null) return Number(kurId) === Number(userKurikulumId)
      if (userKurikulumNama && kurNama) return kurNama.trim().toLowerCase() === userKurikulumNama.trim().toLowerCase()
      return false
    })
    // Tampilkan HANYA kurikulum mahasiswa yang dipakai
    list = filtered
  }

  const capaianMap = new Map()
  const subCapaianList = []
  const kurikulumSet = new Set()

  list.forEach((kc) => {
    const cap = kc.subCapaian?.capaian || kc.capaian
    const kurNama = cap?.kurikulum?.nama || kc.kurikulum?.nama || userKurikulumNama || '-'
    const capNama = cap?.nama || cap?.label
    if (kurNama && kurNama !== '-') kurikulumSet.add(kurNama)
    if (capNama) {
      const capKey = `${kurNama}___${capNama}`
      if (!capaianMap.has(capKey)) {
        capaianMap.set(capKey, { label: capNama, kurikulum: kurNama })
      }
    }
    if (kc.subCapaian?.nama || kc.nama) {
      subCapaianList.push({
        label: kc.subCapaian?.nama || kc.nama,
        capaian: capNama || '',
        kurikulum: kurNama,
        persen: kc.alokasiPersen != null ? `${kc.alokasiPersen}%` : '',
      })
    }
  })

  const kurNameResolved =
    userKurikulumNama ||
    Array.from(kurikulumSet).join(', ') ||
    kegiatan.kurikulum?.nama ||
    '-'

  return {
    kurikulum: kurNameResolved,
    capaian: Array.from(capaianMap.values()),
    subCapaian: subCapaianList,
    kegiatanCapaian: list,
  }
}

function DetailKatalogKegiatanInternal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = getCurrentUser()

  const [kegiatan, setKegiatan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [userKurikulum, setUserKurikulum] = useState({
    id: user?.kurikulumId ?? null,
    nama: user?.kurikulumNama ?? null,
  })

  const loadData = async () => {
    try {
      setLoading(true)
      let resolvedKurId = user?.kurikulumId ?? null
      let resolvedKurNama = user?.kurikulumNama ?? null

      if (!resolvedKurId && !resolvedKurNama) {
        try {
          const kurData = await getKurikulumMahasiswa()
          if (kurData?.id || kurData?.nama) {
            resolvedKurId = kurData.id ?? null
            resolvedKurNama = kurData.nama ?? null
          }
        } catch {
          // ignore
        }
      }

      const res = await get(`/api/mahasiswa/kegiatan-internal/katalog/${id}`)
      setKegiatan(res?.data || null)
      
      setUserKurikulum({
        id: resolvedKurId,
        nama: resolvedKurNama,
      })
    } catch (err) {
      toast.error(err.message || 'Gagal memuat detail kegiatan internal')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleDaftar = async () => {
    if (!kegiatan) return
    setActionLoading(true)
    try {
      const res = await post(`/api/mahasiswa/kegiatan-internal/katalog/${kegiatan.id}/daftar`)
      toast.success(res?.message || 'Berhasil mendaftar kegiatan')
      loadData()
    } catch (err) {
      toast.error(err.message || 'Gagal mendaftar kegiatan')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBatalkan = async () => {
    if (!kegiatan) return
    if (!confirm('Apakah Anda yakin ingin membatalkan pendaftaran?')) return
    setActionLoading(true)
    try {
      const res = await del(`/api/mahasiswa/kegiatan-internal/katalog/${kegiatan.id}/daftar`)
      toast.success(res?.message || 'Pendaftaran dibatalkan')
      loadData()
    } catch (err) {
      toast.error(err.message || 'Gagal membatalkan pendaftaran')
    } finally {
      setActionLoading(false)
    }
  }

  const backToList = () => navigate('/mahasiswa/katalog-kegiatan-internal')

  if (loading) {
    return (
      <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
        <DetailSkeleton />
      </DashboardLayout>
    )
  }

  if (!kegiatan) {
    return (
      <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
        <div className="flex flex-col items-center justify-center space-y-4 py-20">
          <p className="text-base-content/60">Data tidak ditemukan.</p>
          <button onClick={backToList} className="btn btn-outline btn-sm">Kembali</button>
        </div>
      </DashboardLayout>
    )
  }

  const tanggalPelaksanaan = formatTanggal(kegiatan.tanggalMulai, kegiatan.tanggalSelesai)
  const kuota = kegiatan.kuota != null ? `${kegiatan.sisaKuota} sisa dari ${kegiatan.kuota} peserta` : '-'

  const capaianData = normalizeCapaianData(kegiatan, userKurikulum.id, userKurikulum.nama)
  
  const statusPendaftaranLabel = {
    belum_daftar: 'Belum Terdaftar',
    menunggu_izin_pa: 'Menunggu Izin Dosen PA',
    disetujui_pa: 'Disetujui Dosen PA',
    terdaftar: 'Terdaftar',
    hadir: 'Hadir',
    selesai: 'Selesai',
  }[kegiatan.statusPendaftaran] || kegiatan.statusPendaftaran

  return (
    <DashboardLayout role="mahasiswa" userName={user?.nama || 'Mahasiswa'} userRole="Mahasiswa">
      <div className="space-y-5">
        <DetailBackButton onClick={backToList} />
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <DetailHeader
            title="Detail Kegiatan Internal"
            description="Informasi lengkap kegiatan internal dan syarat pendaftaran Anda."
            status={statusPendaftaranLabel}
          />
          <div className="flex gap-2">
            {!kegiatan.sudahDaftar && (kegiatan.sisaKuota === null || kegiatan.sisaKuota > 0) && (
              <button 
                onClick={handleDaftar} 
                disabled={actionLoading}
                className="btn btn-primary btn-sm"
              >
                {actionLoading ? <span className="loading loading-spinner loading-xs" /> : 'Daftar Sekarang'}
              </button>
            )}
            {kegiatan.sudahDaftar && ['menunggu_izin_pa', 'terdaftar', 'disetujui_pa'].includes(kegiatan.statusPendaftaran) && (
              <button 
                onClick={handleBatalkan} 
                disabled={actionLoading}
                className="btn btn-error btn-outline btn-sm"
              >
                {actionLoading ? <span className="loading loading-spinner loading-xs" /> : 'Batalkan Pendaftaran'}
              </button>
            )}
          </div>
        </div>

        {kegiatan.izinPA?.alasan && (
          <DecisionNote
            status={kegiatan.izinPA.status}
            alasan={kegiatan.izinPA.alasan}
          />
        )}

        <SectionCard title="Informasi Kegiatan">
          <InfoRow label="Nama Kegiatan" value={kegiatan.nama} />
          <InfoRow label="Penyelenggara" value={kegiatan.penyelenggara} />
          <InfoRow label="Jenis / Kategori" value={kegiatan.kategori} />
          <InfoRow label="Skala" value={kegiatan.skala} />
          <InfoRow label="Tanggal Pelaksanaan" value={tanggalPelaksanaan} />
          <InfoRow label="Lokasi" value={kegiatan.lokasi || '-'} />
          <InfoRow label="Kuota" value={kuota} />
          {kegiatan.deskripsi && kegiatan.deskripsi !== '-' && (
            <InfoRow label="Deskripsi" value={kegiatan.deskripsi} multiline />
          )}
        </SectionCard>

        {kegiatan.sudahDaftar && (
          <SectionCard title="Status Partisipasi Anda">
            <InfoRow label="Status Pendaftaran" value={statusPendaftaranLabel} />
            <InfoRow label="Status Izin Dosen PA" value={kegiatan.izinPA?.status || (kegiatan.tanpaPersetujuanPa ? 'Tidak Perlu Izin' : 'Belum Diajukan')} />
          </SectionCard>
        )}

        {(capaianData.capaian.length > 0 || capaianData.subCapaian.length > 0 || (capaianData.kegiatanCapaian && capaianData.kegiatanCapaian.length > 0)) && (
          <CurriculumAchievementCard
            kurikulum={capaianData.kurikulum}
            capaian={capaianData.capaian}
            subCapaian={capaianData.subCapaian}
            kegiatanCapaian={capaianData.kegiatanCapaian}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

export default DetailKatalogKegiatanInternal
