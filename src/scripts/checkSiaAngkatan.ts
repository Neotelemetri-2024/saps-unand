/**
 * CLI Script: Cek Sebaran Angkatan & Status Langsung dari API SIA UNAND
 * -------------------------------------------------------------------
 * Script ini mengambil data mentah dari endpoint `/saps/list-mahasiswa` dan
 * merekapitulasi jumlah mahasiswa per angkatan beserta rincian statusnya
 * (Aktif, Cuti, Lulus, dll) dan jenjangnya (S1/D4/D3 vs Pascasarjana).
 */
import 'dotenv/config';
import { siaFetch } from '../services/sia/siaClient.service';
import { isMahasiswaS1D4D3 } from '../services/sia/siaSync.service';

async function main() {
  console.log('🔍 Menghubungi API SIA UNAND: /saps/list-mahasiswa ...\n');

  try {
    const response = await siaFetch<any>('/saps/list-mahasiswa');
    if (!response || !Array.isArray(response.data)) {
      console.error('❌ Gagal: Respon dari API SIA bukan array atau kosong.', response);
      return;
    }

    const rawList = response.data;
    console.log(`📊 Total baris data mentah di API SIA: ${rawList.length} mahasiswa\n`);

    const angkatanMap = new Map<
      string,
      { total: number; s1d4d3: number; pasca: number; statuses: Map<string, number> }
    >();

    for (const m of rawList) {
      const nim = (m.mhsNiu || m.mhsNim || '').trim();
      let rawAngkatan = (m.mhsAngkatan || '').toString().trim();
      
      // Jika angkatan kosong, ekstrak dari 2 digit pertama NIM jika NIM 10 digit
      if (!rawAngkatan && nim.length >= 2 && /^\d+$/.test(nim)) {
        rawAngkatan = `20${nim.substring(0, 2)}`;
      }
      if (!rawAngkatan) rawAngkatan = 'NULL';

      const rawStatus = (m.mhsStatus || (m as any).status || (m as any).statusMhs || 'tanpa_status')
        .toString()
        .trim()
        .toLowerCase();
      const isS1 = isMahasiswaS1D4D3(m);

      if (!angkatanMap.has(rawAngkatan)) {
        angkatanMap.set(rawAngkatan, { total: 0, s1d4d3: 0, pasca: 0, statuses: new Map() });
      }

      const entry = angkatanMap.get(rawAngkatan)!;
      entry.total++;
      if (isS1) entry.s1d4d3++;
      else entry.pasca++;

      const countStatus = entry.statuses.get(rawStatus) || 0;
      entry.statuses.set(rawStatus, countStatus + 1);
    }

    const sortedAngkatan = Array.from(angkatanMap.keys()).sort();

    console.log('📋 HASIL SEBARAN ANGKATAN DARI API SIA UNAND:');
    console.log('----------------------------------------------------------------------------------------------------');
    console.log(
      `| ${'Angkatan'.padEnd(10)} | ${'Total'.padStart(8)} | ${'S1/D4/D3'.padStart(9)} | ${'Pasca'.padStart(8)} | Status Mahasiswa`
    );
    console.log('----------------------------------------------------------------------------------------------------');

    for (const a of sortedAngkatan) {
      const data = angkatanMap.get(a)!;
      const statusStr = Array.from(data.statuses.entries())
        .map(([st, c]) => `${st}: ${c}`)
        .join(', ');
      console.log(
        `| ${a.padEnd(10)} | ${String(data.total).padStart(8)} | ${String(data.s1d4d3).padStart(9)} | ${String(data.pasca).padStart(8)} | ${statusStr}`
      );
    }
    console.log('----------------------------------------------------------------------------------------------------\n');
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan saat memeriksa API SIA:', err.message || err);
  }
}

main();
