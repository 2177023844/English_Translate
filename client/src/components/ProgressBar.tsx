interface ProgressBarProps {
  value: number
  max: number
  className?: string
}

/** 进度条 */
export default function ProgressBar({ value, max, className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
