import assert from 'node:assert/strict';
import { createSertifikatPdf, hitungKategoriSaps, paginateAchievements } from './generatorSertifikat.service';

function fixture(itemCount: number) {
  return {
    nama: 'Nama Mahasiswa Sangat Panjang Untuk Pemeriksaan Tata Letak Sertifikat',
    tempatTanggalLahir: '-',
    nim: '2211513000',
    fakultas: 'Fakultas dengan Nama Sangat Panjang untuk Pengujian Tata Letak',
    prodi: 'Program Studi Sistem Informasi dengan Nama Panjang',
    totalKredit: itemCount * 10,
    kategoriStatus: hitungKategoriSaps(itemCount * 10),
    rekapBidang: [
      { no: 1, nama: 'Penalaran Talenta dan Moral', kredit: itemCount * 10 },
      { no: 2, nama: 'Kewirausahaan', kredit: 0 },
    ],
    rincianCapaian: itemCount
      ? [{
          nama: '1. Penalaran Talenta dan Moral dengan Nama Panjang',
          items: Array.from({ length: itemCount }, (_, index) => ({
            nama: `Sub capaian panjang untuk pengujian wrapping dan pagination nomor ${index + 1}`,
            poin: 10,
          })),
        }]
      : [],
  };
}

async function run() {
  assert.equal(hitungKategoriSaps(0), 'CUKUP AKTIF');
  assert.equal(hitungKategoriSaps(250), 'AKTIF');
  assert.equal(hitungKategoriSaps(500), 'SANGAT AKTIF');

  for (const count of [0, 1, 30, 90, 180]) {
    const data = fixture(count);
    const pages = paginateAchievements(data);
    const rendered = pages.flatMap((page) => page.columns).flatMap((column) => column)
      .reduce((sum, group) => sum + group.items.length, 0);
    assert.equal(rendered, count);
    assert.ok(pages.length >= 1);
    assert.equal(pages[pages.length - 1].hasSignature, true);
    if (pages.length > 1) {
      assert.equal(pages[0].hasSignature, false);
    }
    const validationUrl = `https://studentconnect.unand.ac.id/sertifikat/validasi/${'a'.repeat(48)}`;
    const first = await createSertifikatPdf(data, validationUrl);
    const second = await createSertifikatPdf(data, validationUrl);
    assert.equal(first.subarray(0, 4).toString(), '%PDF');
    assert.equal(second.subarray(0, 4).toString(), '%PDF');
    assert.ok(first.length > 10_000);
  }
  console.log('HTML certificate self-check passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
