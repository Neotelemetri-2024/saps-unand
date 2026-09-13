import fs from 'fs';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { AchievementPage, renderCertificateHtml } from './sertifikatTemplate';

export interface MahasiswaSertifikatData {
  nama: string;
  tempatTanggalLahir: string;
  nim: string;
  fakultas: string;
  prodi?: string;
  totalKredit: number;
  kategoriStatus: string;
  rekapBidang: Array<{ no: number; nama: string; kredit: number }>;
  rincianCapaian: Array<{ nama: string; items: Array<{ nama: string; poin: number }> }>;
}

export function hitungKategoriSaps(totalKredit: number): string {
  if (totalKredit >= 500) return 'SANGAT AKTIF';
  if (totalKredit >= 250) return 'AKTIF';
  return 'CUKUP AKTIF';
}

function itemCost(name: string) {
  return Math.max(1, Math.ceil(name.length / 58));
}

function groupCost(group: { nama: string; items: Array<{ nama: string; poin: number }> }) {
  return itemCost(group.nama) + 1 + group.items.reduce((sum, it) => sum + itemCost(it.nama), 0);
}

function splitGroupsIntoColumns(
  groups: MahasiswaSertifikatData['rincianCapaian'],
  capacities: number[],
): { columns: MahasiswaSertifikatData['rincianCapaian'][]; remaining: MahasiswaSertifikatData['rincianCapaian'] } {
  const columns: MahasiswaSertifikatData['rincianCapaian'][] = capacities.map(() => []);
  let colIdx = 0;
  let used = 0;

  const pending = groups.map((g) => ({
    nama: g.nama,
    items: [...g.items],
  }));

  while (pending.length > 0 && colIdx < capacities.length) {
    const current = pending[0];
    const capacity = capacities[colIdx];
    const headingCost = itemCost(current.nama) + 1;
    const available = capacity - used - headingCost;

    if (available < 1 && used > 0) {
      colIdx += 1;
      used = 0;
      continue;
    }

    if (colIdx >= capacities.length) break;

    let consumed = 0;
    let count = 0;
    for (const item of current.items) {
      const cost = itemCost(item.nama);
      if (consumed + cost > Math.max(1, available) && count > 0) break;
      consumed += cost;
      count += 1;
    }

    const chunk = current.items.splice(0, count);
    if (chunk.length > 0) {
      columns[colIdx].push({
        nama: current.nama,
        items: chunk,
      });
      used += headingCost + consumed;
    }

    if (current.items.length === 0) {
      pending.shift();
    } else {
      colIdx += 1;
      used = 0;
    }
  }

  return { columns, remaining: pending };
}

export function paginateAchievements(data: MahasiswaSertifikatData): AchievementPage[] {
  if (data.rincianCapaian.length === 0) {
    return [{
      pageNumber: 1,
      totalPages: 1,
      continuation: false,
      columns: [[], []],
      hasSignature: true,
    }];
  }

  // Cek apakah kurikulum standard (<= 4 capaian) muat di 1 halaman dalam 2 kolom seimbang:
  // Kolom 1: Capaian 1 & 2 (1. Pondasi & 2. Penguatan)
  // Kolom 2: Capaian 3 & 4 (3. Pemantapan & 4. Aktualisasi di bawahnya)
  if (data.rincianCapaian.length <= 4) {
    let col0: MahasiswaSertifikatData['rincianCapaian'] = [];
    let col1: MahasiswaSertifikatData['rincianCapaian'] = [];

    if (data.rincianCapaian.length === 4) {
      col0 = [data.rincianCapaian[0], data.rincianCapaian[1]];
      col1 = [data.rincianCapaian[2], data.rincianCapaian[3]];
    } else if (data.rincianCapaian.length === 3) {
      col0 = [data.rincianCapaian[0], data.rincianCapaian[1]];
      col1 = [data.rincianCapaian[2]];
    } else if (data.rincianCapaian.length === 2) {
      col0 = [data.rincianCapaian[0]];
      col1 = [data.rincianCapaian[1]];
    } else if (data.rincianCapaian.length === 1) {
      col0 = [data.rincianCapaian[0]];
    }

    const cost0 = col0.reduce((sum, g) => sum + groupCost(g), 0);
    const cost1 = col1.reduce((sum, g) => sum + groupCost(g), 0);

    // Muat di 1 halaman jika cost0 <= 20 dan cost1 <= 16 (memberi ruang untuk tanda tangan & QR di bawah kolom 2)
    if (cost0 <= 20 && cost1 <= 16) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        continuation: false,
        columns: [col0, col1],
        hasSignature: true,
      }];
    }
  }

  // Jika kurikulum berubah atau rincian capaian berlebih:
  // Halaman 1 memuat rincian capaian yang muat, tanda tangan dan QR dipindahkan ke halaman selanjutnya
  const pages: AchievementPage[] = [];
  let pending = data.rincianCapaian;

  // Halaman 1 (tanpa tanda tangan karena tanda tangan & QR dipindahkan ke halaman berikutnya)
  const p1 = splitGroupsIntoColumns(pending, [22, 22]);
  pages.push({
    pageNumber: 1,
    totalPages: 1,
    continuation: false,
    columns: p1.columns,
    hasSignature: false,
  });
  pending = p1.remaining;

  let pageNum = 2;
  while (pending.length > 0) {
    const nextSplit = splitGroupsIntoColumns(pending, [24, 15]);
    pages.push({
      pageNumber: pageNum,
      totalPages: pageNum,
      continuation: true,
      columns: nextSplit.columns,
      hasSignature: false,
    });
    pending = nextSplit.remaining;
    pageNum += 1;
  }

  const total = pages.length;
  for (const p of pages) {
    p.totalPages = total;
  }
  pages[pages.length - 1].hasSignature = true;

  return pages;
}

function systemChromePath() {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    configured,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value));
  return candidates.find(fs.existsSync);
}

export async function createSertifikatPdf(data: MahasiswaSertifikatData, validationUrl?: string): Promise<Buffer> {
  const pages = paginateAchievements(data);
  const qrDataUrl = validationUrl ? await QRCode.toDataURL(validationUrl, { margin: 1, width: 240 }) : undefined;
  const expectedRows = data.rincianCapaian.reduce((sum, group) => sum + group.items.length, 0);
  const renderedRows = pages.flatMap((page) => page.columns).flatMap((column) => column)
    .reduce((sum, group) => sum + group.items.length, 0);
  if (renderedRows !== expectedRows) throw new Error('Pagination sertifikat kehilangan atau menduplikasi rincian capaian.');

  const executablePath = systemChromePath();
  const browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderCertificateHtml(data, pages, qrDataUrl), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const actualRows = await page.$$eval('[data-achievement-row]', (rows: Element[]) => rows.length);
    if (actualRows !== expectedRows) throw new Error('Template HTML kehilangan atau menduplikasi rincian capaian.');
    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
