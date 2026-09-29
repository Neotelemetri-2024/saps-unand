/**
 * Shared ApexCharts wrappers. Props stay the same so dashboard pages
 * can swap implementations without changing their data layer.
 */
import ApexChart from './ApexChart'
import { useAppearance } from '../../lib/appearance'
import { isDarkTheme } from '../../constants/theme'

const BRAND_LIGHT = '#48a757'

function useChartSkin() {
  const { theme } = useAppearance()
  const dark = isDarkTheme(theme)
  return {
    fontFamily: 'DM Sans, system-ui, sans-serif',
    foreColor: dark ? '#f1f5f9' : '#1e293b',
    muted: dark ? '#94a3b8' : '#64748b',
    grid: dark ? '#334155' : '#e5e7eb',
    tooltipTheme: dark ? 'dark' : 'light',
  }
}

function baseChart(skin, extras = {}) {
  return {
    fontFamily: skin.fontFamily,
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 400 },
    ...extras,
  }
}

function formatLabel(label) {
  return String(label ?? '').replace(/\n/g, ' ')
}

function wrapRadarLabel(label, maxChars = 18) {
  const words = String(label || '').replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.join('\n') || '-'
}

export function StackedBarChart({ labels = [], datasets = [], height = 300, horizontal = false }) {
  const skin = useChartSkin()
  const categories = labels.map(formatLabel)
  const series = datasets.map((ds) => ({
    name: ds.label,
    data: ds.data,
  }))
  const colors = datasets.map((ds) => ds.color).filter(Boolean)

  const options = {
    chart: baseChart(skin, { stacked: true, type: 'bar' }),
    colors: colors.length ? colors : undefined,
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 3,
        columnWidth: '55%',
        barHeight: '62%',
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    xaxis: {
      categories,
      labels: { style: { fontSize: '10px', colors: skin.muted }, rotate: horizontal ? 0 : -35 },
      axisBorder: { color: skin.grid },
      axisTicks: { color: skin.grid },
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: skin.muted } },
    },
    grid: { borderColor: skin.grid, strokeDashArray: 3 },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      labels: { colors: skin.foreColor },
    },
    tooltip: { theme: skin.tooltipTheme, shared: true, intersect: false },
  }

  return (
    <ApexChart options={options} series={series} type="bar" height={height} width="100%" />
  )
}

export function GroupedBarChart({ labels = [], datasets = [], height = 280 }) {
  const skin = useChartSkin()
  const categories = labels.map(formatLabel)
  const series = datasets.map((ds) => ({
    name: ds.label,
    data: ds.data,
  }))
  const colors = datasets.map((ds) => ds.color).filter(Boolean)

  const options = {
    chart: baseChart(skin, { type: 'bar' }),
    colors: colors.length ? colors : undefined,
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: '55%' },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    xaxis: {
      categories,
      labels: { style: { fontSize: '10px', colors: skin.muted } },
      axisBorder: { color: skin.grid },
    },
    yaxis: {
      min: 0,
      labels: { style: { fontSize: '10px', colors: skin.muted } },
    },
    grid: { borderColor: skin.grid, strokeDashArray: 3 },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      labels: { colors: skin.foreColor },
    },
    tooltip: { theme: skin.tooltipTheme, shared: true, intersect: false },
  }

  return (
    <ApexChart options={options} series={series} type="bar" height={height} width="100%" />
  )
}

export function LineChart({ labels = [], datasets = [], height = 280 }) {
  const skin = useChartSkin()
  const categories = labels.map(formatLabel)
  const series = datasets.map((ds) => ({
    name: ds.label,
    data: ds.data,
  }))
  const colors = datasets.map((ds) => ds.color).filter(Boolean)

  const options = {
    chart: baseChart(skin, { type: 'line' }),
    colors: colors.length ? colors : undefined,
    stroke: { width: 2, curve: 'smooth' },
    markers: { size: 4 },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { fontSize: '10px', colors: skin.muted } },
      axisBorder: { color: skin.grid },
    },
    yaxis: {
      min: 0,
      labels: {
        style: { fontSize: '10px', colors: skin.muted },
        formatter: (val) => `${val}`,
      },
    },
    grid: { borderColor: skin.grid, strokeDashArray: 3 },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      labels: { colors: skin.foreColor },
    },
    tooltip: { theme: skin.tooltipTheme, shared: true, intersect: false },
  }

  return (
    <ApexChart options={options} series={series} type="line" height={height} width="100%" />
  )
}

export function VerticalBarChart({
  labels = [],
  values = [],
  color = BRAND_LIGHT,
  colors,
  height = 240,
}) {
  const skin = useChartSkin()
  const palette = Array.isArray(colors) ? colors : [color]
  const distributed = Array.isArray(colors)

  const options = {
    chart: baseChart(skin, { type: 'bar' }),
    colors: palette,
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '50%',
        distributed,
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    xaxis: {
      categories: labels.map(formatLabel),
      labels: { style: { fontSize: '9px', colors: skin.muted }, rotate: -35 },
      axisBorder: { color: skin.grid },
    },
    yaxis: {
      min: 0,
      labels: { style: { fontSize: '10px', colors: skin.muted } },
    },
    grid: { borderColor: skin.grid, strokeDashArray: 3 },
    legend: { show: false },
    tooltip: { theme: skin.tooltipTheme },
  }

  return (
    <ApexChart
      options={options}
      series={[{ name: 'Nilai', data: values }]}
      type="bar"
      height={height}
      width="100%"
    />
  )
}

export function HorizontalBarChart({
  labels = [],
  values = [],
  max = 100,
  color = BRAND_LIGHT,
  height,
}) {
  const skin = useChartSkin()
  const h = height ?? Math.max(200, labels.length * 36)

  const options = {
    chart: baseChart(skin, { type: 'bar' }),
    colors: [color],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '58%',
        dataLabels: { position: 'top' },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${Number(val).toFixed(1)}%`,
      offsetX: 24,
      style: { fontSize: '10px', colors: [skin.foreColor] },
    },
    stroke: { width: 0 },
    xaxis: {
      categories: labels,
      max,
      min: 0,
      labels: { style: { fontSize: '10px', colors: skin.muted }, formatter: (v) => `${v}%` },
      axisBorder: { color: skin.grid },
    },
    yaxis: {
      labels: {
        style: { fontSize: '10px', colors: skin.foreColor, fontWeight: 500 },
        maxWidth: 180,
      },
    },
    grid: { borderColor: skin.grid, strokeDashArray: 3 },
    legend: { show: false },
    tooltip: {
      theme: skin.tooltipTheme,
      y: { formatter: (val) => `${Number(val).toFixed(2)}%` },
    },
  }

  return (
    <ApexChart
      options={options}
      series={[{ name: 'Capaian', data: values }]}
      type="bar"
      height={h}
      width="100%"
    />
  )
}

export function RadarChartCJ({
  labels = [],
  values = [],
  color = BRAND_LIGHT,
  darkBg = false,
  height = 260,
  size,
}) {
  const skin = useChartSkin()
  const rawMax = values.length ? Math.max(...values) : 0
  const needsScale = rawMax > 100
  const scaleMax = needsScale ? Math.ceil((rawMax + 4) / 25) * 25 : 100
  const displayValues = values.map((v) => (needsScale ? Math.min(v, scaleMax) : v))
  const line = darkBg ? 'rgba(255,255,255,0.9)' : color
  const fill = darkBg ? 'rgba(255,255,255,0.22)' : color
  const labelColor = darkBg ? 'rgba(255,255,255,0.85)' : skin.foreColor
  const categories = labels.map((label) => wrapRadarLabel(label))
  const radarSize =
    size ??
    (height <= 220
      ? Math.max(46, Math.round(height * 0.25))
      : Math.max(64, Math.round(height * 0.32)))
  const labelFontSize = height <= 220 ? '11px' : '12px'

  const options = {
    chart: baseChart(skin, {
      type: 'radar',
      background: 'transparent',
      parentHeightOffset: 0,
      offsetY: 0,
    }),
    colors: [line],
    fill: { opacity: 0.28, colors: [fill] },
    stroke: { width: 2, colors: [line] },
    markers: {
      size: 4,
      colors: [darkBg ? '#ffffff' : color],
      strokeColors: line,
      strokeWidth: 1,
    },
    xaxis: {
      categories,
      labels: {
        style: {
          colors: categories.map(() => labelColor),
          fontSize: labelFontSize,
          fontFamily: skin.fontFamily,
          fontWeight: 600,
        },
      },
    },
    yaxis: {
      min: 0,
      max: scaleMax,
      tickAmount: 4,
      show: false,
    },
    plotOptions: {
      radar: {
        size: radarSize,
        polygons: {
          strokeColors: darkBg ? 'rgba(255,255,255,0.22)' : skin.grid,
          connectorColors: darkBg ? 'rgba(255,255,255,0.22)' : skin.grid,
        },
      },
    },
    legend: { show: false },
    tooltip: {
      theme: darkBg ? 'dark' : skin.tooltipTheme,
      y: {
        formatter: (_val, opts) => String(values[opts.dataPointIndex] ?? _val),
      },
    },
  }

  return (
    <div
      className="overflow-visible [&_.apexcharts-canvas]:!overflow-visible [&_.apexcharts-svg]:!overflow-visible"
      style={{ height: height + 24, position: 'relative', width: '100%', minWidth: 0 }}
    >
      <ApexChart
        options={options}
        series={[{ name: 'Poin', data: displayValues }]}
        type="radar"
        height={height}
        width="100%"
      />
    </div>
  )
}

export function DoughnutChart({
  labels = [],
  values = [],
  colors,
  height = 240,
  centerTitle,
  centerValue,
  centerLabel,
}) {
  const skin = useChartSkin()
  const palette = colors?.length ? colors : undefined
  const totalLabel = centerLabel || centerTitle || ''
  const hasCenter = centerValue != null && centerValue !== '' || Boolean(totalLabel)

  const options = {
    chart: baseChart(skin, { type: 'donut' }),
    labels: labels.map(formatLabel),
    colors: palette,
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { theme: skin.tooltipTheme },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          // Label tengah pakai overlay HTML supaya jarak angka & teks tidak mepet
          labels: { show: false },
        },
      },
    },
  }

  return (
    <div className="relative w-full min-w-0" style={{ height }}>
      <ApexChart options={options} series={values} type="donut" height={height} width="100%" />
      {hasCenter && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {centerValue != null && centerValue !== '' && (
            <span className="text-xl font-extrabold leading-none text-base-content sm:text-2xl">
              {String(centerValue)}
            </span>
          )}
          {totalLabel ? (
            <span className="mt-1.5 max-w-[7.5rem] text-[11px] leading-snug text-base-content/60">
              {totalLabel}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
