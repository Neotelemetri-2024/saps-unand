import fs from 'fs';
import path from 'path';
import { MahasiswaSertifikatData } from './generatorSertifikat.service';

export interface AchievementPage {
  pageNumber: number;
  totalPages: number;
  continuation: boolean;
  columns: MahasiswaSertifikatData['rincianCapaian'][];
  hasSignature: boolean;
}

function resolveAsset(...segments: string[]) {
  const candidates = [
    path.join(process.cwd(), ...segments),
    path.join(__dirname, '../../..', ...segments.slice(1)),
    path.join(__dirname, '../..', ...segments.slice(1)),
    path.join(__dirname, '../../assets/sertif', path.basename(segments[segments.length - 1])),
  ];
  const found = candidates.find(fs.existsSync);
  if (!found) throw new Error(`Asset sertifikat tidak ditemukan: ${segments.join('/')}`);
  return found;
}

function dataUrl(file: string, mime: string) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

export function certificateAssets() {
  return {
    cornerBorder: dataUrl(resolveAsset('src', 'assets', 'sertif', 'border-corner.png'), 'image/png'),
    logo: dataUrl(resolveAsset('src', 'assets', 'sertif', 'logo_unand.png'), 'image/png'),
    fontRegular: dataUrl(resolveAsset('node_modules', '@fontsource', 'tinos', 'files', 'tinos-latin-400-normal.woff2'), 'font/woff2'),
    fontBold: dataUrl(resolveAsset('node_modules', '@fontsource', 'tinos', 'files', 'tinos-latin-700-normal.woff2'), 'font/woff2'),
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '-').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]!);
}

function detailsMarkup(columns: MahasiswaSertifikatData['rincianCapaian'][]) {
  return columns.map((groups) => `
    <div class="achievement-column">
      ${groups.map((group) => `
        <section class="achievement-group">
          <h3>${escapeHtml(group.nama)}</h3>
          ${group.items.map((item) => `
            <div class="achievement-row" data-achievement-row>
              <span>${escapeHtml(item.nama.startsWith('Sub-CP') ? item.nama : `Sub-CP : ${item.nama}`)}</span>
              <strong>${escapeHtml(item.poin)}</strong>
            </div>`).join('')}
        </section>`).join('')}
    </div>`).join('');
}

function cornerBorders(asset: string) {
  return `
    <img class="corner-tl" src="${asset}" alt="" aria-hidden="true">
    <img class="corner-tr" src="${asset}" alt="" aria-hidden="true">
    <img class="corner-bl" src="${asset}" alt="" aria-hidden="true">
    <img class="corner-br" src="${asset}" alt="" aria-hidden="true">
  `;
}

function verificationFooterMarkup(qrDataUrl?: string) {
  return `
    <footer class="verification-footer">
      ${qrDataUrl ? `<div class="verification-qr"><img src="${qrDataUrl}" alt="QR validasi sertifikat"><span>Pindai untuk validasi</span></div>` : '<div></div>'}
      <div class="signature">
        <p>a.n Wakil Rektor I<br>Direktur Kemahasiswaan</p>
        <p>Dr. Eng. Ir. Dendi Adi Saputra, M.Eng, S.T., M.T.<br>NIP 198712012012121004</p>
      </div>
    </footer>
  `;
}

export function renderCertificateHtml(data: MahasiswaSertifikatData, pages: AchievementPage[], qrDataUrl?: string) {
  const assets = certificateAssets();
  const recapRows = data.rekapBidang.map((row) => `
    <tr><td>${row.no}</td><td>${escapeHtml(row.nama)}</td><td>${row.kredit}</td></tr>`).join('');

  const pagesHtml = pages.map((page, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const corners = cornerBorders(assets.cornerBorder);
    const watermark = `<img class="certificate-watermark" src="${assets.logo}" alt="" aria-hidden="true">`;
    const footer = page.hasSignature ? verificationFooterMarkup(qrDataUrl) : '';

    if (isFirstPage) {
      return `
      <article class="certificate-page">
        ${corners}
        ${watermark}
        <main class="certificate-content">
          <header class="header">
            <img class="header-logo" src="${assets.logo}" alt="Logo Universitas Andalas">
            <div class="university">
              <h1>UNIVERSITAS ANDALAS</h1>
              <p>Keputusan Rektor N0(232263/UN/16.3/KM/SAPS/2026</p>
            </div>
            <span aria-hidden="true"></span>
          </header>
          <div class="rule"></div>
          <div class="title">
            <h2>SERTIFIKAT STUDENT ACTIVITIES PERFORMANCE SYSTEM (SAPS)</h2>
          </div>
          <div class="main-grid">
            <section class="left-column">
              <h2 class="section-title">Identitas Capaian Pemegang</h2>
              <div class="identity">
                <span>Nama</span><b>:</b><span>${escapeHtml(data.nama)}</span>
                <span>Tempat/Tanggal Lahir</span><b>:</b><span>${escapeHtml(data.tempatTanggalLahir)}</span>
                <span>Nomor Induk Mahasiswa</span><b>:</b><span>${escapeHtml(data.nim)}</span>
                <span>Fakultas</span><b>:</b><span>${escapeHtml(data.fakultas)}</span>
                <span>Program Studi</span><b>:</b><span>${escapeHtml(data.prodi)}</span>
              </div>
              <h2 class="section-title">Rekapitulasi Poin SAPS</h2>
              <table class="recap">
                <thead><tr><th>No</th><th>Bidang capaian</th><th>Kredit</th></tr></thead>
                <tbody>${recapRows}<tr class="recap-total"><td colspan="2">TOTAL</td><td>${escapeHtml(data.totalKredit)}</td></tr></tbody>
              </table>
              <div class="category">KATEGORI : ${escapeHtml(data.kategoriStatus)}</div>
            </section>
            <section class="right-column">
              <h2 class="section-title">Rincian Capaian</h2>
              <div class="achievement-grid">${detailsMarkup(page.columns)}</div>
            </section>
          </div>
          ${footer}
        </main>
      </article>`;
    }

    return `
    <article class="certificate-page">
      ${corners}
      ${watermark}
      <main class="certificate-content">
        <header class="header">
          <img class="header-logo" src="${assets.logo}" alt="Logo Universitas Andalas">
          <div class="university">
            <h1>UNIVERSITAS ANDALAS</h1>
            <p>Keputusan Rektor N0(232263/UN/16.3/KM/SAPS/2026</p>
          </div>
          <span aria-hidden="true"></span>
        </header>
        <div class="rule"></div>
        <div class="title">
          <h2>SERTIFIKAT STUDENT ACTIVITIES PERFORMANCE SYSTEM (SAPS)</h2>
          <p style="font-size:10pt;font-weight:700;margin:2mm 0 0">RINCIAN CAPAIAN (LANJUTAN)</p>
        </div>
        <div class="continuation-grid">
          ${detailsMarkup(page.columns)}
        </div>
        ${footer}
      </main>
    </article>`;
  }).join('');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
    @font-face{font-family:Tinos;src:url('${assets.fontRegular}') format('woff2');font-weight:400}
    @font-face{font-family:Tinos;src:url('${assets.fontBold}') format('woff2');font-weight:700}
    @page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Tinos,serif;color:#111;background:#FCFBF9}
    .certificate-page{position:relative;width:297mm;height:210mm;overflow:hidden;break-after:page;page-break-after:always;background:#FCFBF9}
    .certificate-page:last-child{break-after:auto;page-break-after:auto}
    
    .corner-tl{position:absolute;top:0;left:0;width:50mm;height:50mm;transform:scaleY(-1);z-index:0;pointer-events:none}
    .corner-tr{position:absolute;top:0;right:0;width:50mm;height:50mm;transform:scale(-1,-1);z-index:0;pointer-events:none}
    .corner-bl{position:absolute;bottom:0;left:0;width:50mm;height:50mm;z-index:0;pointer-events:none}
    .corner-br{position:absolute;bottom:0;right:0;width:50mm;height:50mm;transform:scaleX(-1);z-index:0;pointer-events:none}

    .certificate-watermark{position:absolute;left:50%;top:53%;width:75mm;height:90mm;object-fit:contain;transform:translate(-50%,-50%);opacity:.06;z-index:1;pointer-events:none}
    .certificate-content{position:relative;z-index:2;height:100%;padding:12mm 16mm 10mm}
    .header{display:grid;grid-template-columns:20mm 1fr 20mm;align-items:center;height:24mm}.header-logo{width:15mm;height:18mm;object-fit:contain;justify-self:center}.university{text-align:center}.university h1{font-size:20pt;line-height:1;margin:0;font-weight:700}.university p{font-size:9pt;margin:2mm 0 0}.rule{border-top:1.4pt solid #111;border-bottom:.6pt solid #111;height:1.5mm;margin:1.5mm 0 5mm}
    .title{text-align:center;margin:0 0 9mm}.title h2{font:700 15.5pt Arial,sans-serif;margin:0;letter-spacing:0.3px}
    
    .main-grid{display:grid;grid-template-columns:114mm 1fr;gap:10mm;min-height:105mm}.left-column,.right-column{min-width:0}.section-title{font:700 10.5pt Arial,sans-serif;margin:0 0 3.5mm;text-transform:uppercase;letter-spacing:0.2px}
    .identity{display:grid;grid-template-columns:41mm 3mm minmax(0,1fr);font-size:9.5pt;line-height:1.44;margin-bottom:5mm}.identity span{overflow-wrap:anywhere}.recap{width:100%;border-collapse:collapse;font-size:9.5pt;table-layout:fixed}.recap th,.recap td{border:.6pt solid #777;padding:2.2mm 2.5mm;vertical-align:middle;overflow-wrap:anywhere}.recap th{text-align:left;font-weight:700}.recap th:first-child,.recap td:first-child{width:10mm;text-align:center}.recap th:last-child,.recap td:last-child{width:19mm;text-align:center}.recap tbody tr{height:9mm}.recap-total td{font-weight:700;text-align:center}.category{font-weight:700;font-size:10pt;margin-top:5mm}
    
    .achievement-grid{display:grid;grid-template-columns:1fr 1fr;gap:7mm;font-size:8.5pt;line-height:1.28}.achievement-column{min-width:0}.achievement-group{break-inside:avoid;margin:0 0 3.5mm}.achievement-group h3{font-size:1.05em;margin:0 0 1.2mm;overflow-wrap:anywhere}.achievement-row{display:grid;grid-template-columns:minmax(0,1fr) 9mm;gap:2mm;padding-left:2.5mm;break-inside:avoid}.achievement-row span{overflow-wrap:anywhere}.achievement-row strong{text-align:right}
    
    .continuation-grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm;font-size:8.5pt;line-height:1.28;margin-top:4mm}
    
    .verification-footer{position:absolute;right:18mm;bottom:10mm;display:grid;grid-template-columns:25mm 58mm;align-items:end;gap:5mm;min-height:35mm;font-size:9pt;line-height:1.25}.verification-qr{text-align:center;font-size:6.5pt}.verification-qr img{display:block;width:23mm;height:23mm;margin:0 auto 1mm}.signature p{margin:0}.signature p+p{margin-top:10mm}
  </style></head><body>
    ${pagesHtml}
  </body></html>`;
}
