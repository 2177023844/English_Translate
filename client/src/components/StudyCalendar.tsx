import { useState } from 'react'

export interface DayStatus {
  newCount: number
  completed: boolean
}

export function toDayStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface StudyCalendarProps {
  /** date → 当日学习状态 */
  statusMap: Map<string, DayStatus>
  selected?: string
  onSelect?: (date: string) => void
  /** 只读展示（无选中态、不可点击） */
  readonly?: boolean
}

/**
 * 学习日历：完成任务标红、学了但未完成任务标黄、未学习为普通。
 * 周一开始；可切换月份；onSelect 提供时日期可点击。
 */
export default function StudyCalendar({ statusMap, selected, onSelect, readonly = false }: StudyCalendarProps) {
  const today = toDayStr(new Date())
  const init = selected ? new Date(selected) : new Date()
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() })

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const startWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7 // 周一=0
  const cells: (string | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDayStr(new Date(view.y, view.m, i + 1))),
  ]

  const changeMonth = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  const dayClass = (d: string) => {
    const st = statusMap.get(d)
    const future = d > today
    let cls = 'flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors '
    if (st?.completed) cls += 'bg-red-500 font-semibold text-white '
    else if (st && st.newCount > 0) cls += 'bg-yellow-300 font-medium text-yellow-900 '
    else cls += 'text-slate-500 '
    if (future) cls += 'opacity-40 '
    if (d === selected) cls += 'ring-2 ring-indigo-500 '
    if (!readonly && onSelect) cls += 'cursor-pointer hover:ring-2 hover:ring-indigo-300 '
    return cls
  }

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {view.y}年{view.m + 1}月
        </span>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <span key={w} className="py-1 text-xs text-slate-400">
            {w}
          </span>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <span key={`b${i}`} />
          ) : (
            <button
              key={d}
              type="button"
              disabled={readonly || !onSelect}
              onClick={() => onSelect?.(d)}
              className={dayClass(d)}
            >
              {Number(d.slice(8))}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
