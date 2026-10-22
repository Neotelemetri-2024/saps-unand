import { useEffect, useRef } from 'react'
import ApexCharts from 'apexcharts/dist/apexcharts.esm.js'

/**
 * Thin ApexCharts host — avoids react-apexcharts (prop-types CJS) under Vite.
 */
export default function ApexChart({
  options = {},
  series = [],
  type = 'bar',
  height = 280,
  width = '100%',
}) {
  const elRef = useRef(null)
  const seriesKey = JSON.stringify(series)
  const labelKey = JSON.stringify(options.labels || options.xaxis?.categories || [])
  const colorKey = JSON.stringify(options.colors || [])
  const themeKey = options.tooltip?.theme || options.chart?.background || ''
  const radarSize = options.plotOptions?.radar?.size

  useEffect(() => {
    const el = elRef.current
    if (!el) return undefined

    const chart = new ApexCharts(el, {
      ...options,
      series,
      chart: {
        ...(options.chart || {}),
        type,
        height,
        width,
      },
    })
    chart.render()

    return () => {
      chart.destroy()
    }
    // Snapshot keys keep the instance in sync without depending on a new options object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional serialized snapshots
  }, [type, height, width, seriesKey, labelKey, colorKey, themeKey, radarSize])

  return <div ref={elRef} />
}
