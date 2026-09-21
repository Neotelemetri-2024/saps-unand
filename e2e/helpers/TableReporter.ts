import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';

class TableReporter implements Reporter {
  // Simpan hasil test agar bisa direkap di akhir
  private results: { id: string; title: string; browser: string; status: string }[] = [];

  onBegin(config: FullConfig, suite: Suite) {
    console.log('\n==============================================================================');
    console.log('            🚀 MEMULAI ALPHA TESTING - MY UNAND STUDENT CONNECT 🚀');
    console.log('==============================================================================\n');
    console.log(`${'ID TEST'.padEnd(12)} | ${'BROWSER'.padEnd(10)} | ${'SKENARIO & LANGKAH UJI'.padEnd(50)} | STATUS`);
    console.log(''.padEnd(85, '-'));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Ekstrak ID dari judul (misal: TC-AUTH-01)
    const idMatch = test.title.match(/TC-[A-Z]+-\d+/);
    const id = idMatch ? idMatch[0] : '-';
    
    // Hapus ID dari judul agar lebih bersih
    let title = test.title;
    if (idMatch) {
      title = title.replace(id + ':', '').replace(id, '').trim();
    }
    
    const browser = test.parent.project()?.name || 'unknown';

    // Beri warna pada status menggunakan ANSI escape codes
    const reset = "\x1b[0m";
    const green = "\x1b[32m";
    const red = "\x1b[31m";
    const yellow = "\x1b[33m";

    let statusText = `[ ${result.status.toUpperCase()} ]`;
    let coloredStatus = statusText;

    if (result.status === 'passed') {
      coloredStatus = `${green}${statusText}${reset}`;
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      coloredStatus = `${red}${statusText}${reset}`;
    } else {
      coloredStatus = `${yellow}${statusText}${reset}`;
    }

    // Print per baris ke terminal Docker
    console.log(`${id.padEnd(12)} | ${browser.padEnd(10)} | ${title.substring(0, 47).padEnd(47)}... | ${coloredStatus}`);
  }

  onEnd(result: FullResult) {
    console.log('\n==============================================================================');
    console.log(`  EKSEKUSI SELESAI DENGAN STATUS GLOBAL: ${result.status === 'passed' ? '✅ LULUS' : '❌ GAGAL'}`);
    console.log('==============================================================================\n');
  }
}

export default TableReporter;
