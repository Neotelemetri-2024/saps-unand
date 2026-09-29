function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/** Primitive DaisyUI skeleton. */
export function Skeleton({ className = '', ...props }) {
  return <div className={cx('skeleton', className)} aria-hidden {...props} />
}

export function StatCardSkeleton() {
  return (
    <div className="card bg-base-100 p-5" aria-hidden>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  )
}

export function StatCardSkeletonGrid({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 280, variant = 'bar' }) {
  if (variant === 'donut') {
    return (
      <div className="flex flex-col items-center gap-4 py-4" style={{ minHeight: height }} aria-hidden>
        <Skeleton className="h-44 w-44 rounded-full" />
        <div className="w-full max-w-xs space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
    )
  }

  if (variant === 'radar') {
    const diameter = Math.round(height * 0.8)
    return (
      <div className="flex items-center justify-center py-4" style={{ minHeight: height }} aria-hidden>
        <Skeleton className="rounded-full" style={{ height: diameter, width: diameter }} />
      </div>
    )
  }

  const bars = [42, 78, 55, 90, 48, 72, 60]
  return (
    <div className="flex w-full flex-col justify-end gap-3" style={{ height }} aria-hidden>
      <div className="flex h-full items-end gap-2 px-2">
        {bars.map((pct, i) => (
          <Skeleton key={i} className="w-full rounded-md" style={{ height: `${pct}%` }} />
        ))}
      </div>
      <Skeleton className="mx-2 h-3 w-32" />
    </div>
  )
}

export function RankListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-md border border-base-300 p-4">
          <Skeleton className="mx-auto h-3 w-20" />
          <Skeleton className="mx-auto mt-3 h-7 w-16" />
          <Skeleton className="mt-3 h-1.5 w-full" />
          <Skeleton className="mx-auto mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function ListItemSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NotifListSkeleton({ rows = 4 }) {
  return (
    <ul className="divide-y divide-base-300" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="py-4 first:pt-0 last:pb-0">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-4/5" />
        </li>
      ))}
    </ul>
  )
}

export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="card bg-base-100 p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}
