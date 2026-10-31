import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { PaperSession, PaperSummary } from '../api/types'
import { SESSION_LABEL } from '../utils/paper'

const LEVELS = [
  { code: 'CET4', name: '四级', en: 'CET-4', icon: '📘', desc: '大学英语四级考试' },
  { code: 'CET6', name: '六级', en: 'CET-6', icon: '📗', desc: '大学英语六级考试' },
  { code: 'KY', name: '考研英语', en: 'NETEM', icon: '🎓', desc: '英语（一）/ 英语（二）' },
] as const

const SESSION_ORDER: Record<string, PaperSession[]> = {
  CET4: ['H1', 'H2'],
  CET6: ['H1', 'H2'],
  KY: ['A', 'B'],
}

/** 试卷：先选等级，再按年份选择上半年/下半年（考研为英语一/英语二）的试卷 */
export default function Papers() {
  const { level } = useParams<{ level?: string }>()
  const navigate = useNavigate()
  const papersQ = useQuery({
    queryKey: ['papers'],
    queryFn: async () => (await api.get<{ papers: PaperSummary[] }>('/papers')).data.papers,
  })
  const papers = papersQ.data ?? []
  const current = LEVELS.find((l) => l.code === level)

  if (level && !current) return <Navigate to="/papers" replace />

  // ---- 等级选择 ----
  if (!current) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="pt-10 text-center">
          <h1 className="text-2xl font-bold text-slate-800">历年真题</h1>
          <p className="mt-1 text-sm text-slate-500">选择考试等级，查看 2000 年至今的历年试卷</p>
        </div>

        {papersQ.isLoading ? (
          <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {LEVELS.map((l) => {
              const list = papers.filter((p) => p.level === l.code)
              const readyCount = list.filter((p) => p.ready === 1).length
              return (
                <Link
                  key={l.code}
                  to={`/papers/${l.code}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
                >
                  <div className="text-3xl">{l.icon}</div>
                  <div className="mt-2 text-xl font-bold text-slate-800">{l.name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {l.en} · {l.desc}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-500">{list.length} 套试卷</span>
                    <span className={readyCount > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                      已收录 {readyCount}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ---- 年份 / 场次选择 ----
  const list = papers.filter((p) => p.level === current.code)
  const years = [...new Set(list.map((p) => p.year))].sort((a, b) => b - a)
  const readyCount = list.filter((p) => p.ready === 1).length

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link to="/papers" className="text-sm text-slate-400 transition-colors hover:text-indigo-600">
        ← 全部等级
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{current.name}历年真题</h1>
          <p className="mt-1 text-sm text-slate-500">
            {current.en} · 2000–{years[0] ?? ''} 年 · 共 {list.length} 套
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          已收录 {readyCount} / {list.length}
        </span>
      </div>

      {papersQ.isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((year) => {
            const items = list.filter((p) => p.year === year)
            return (
              <div key={year} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-800">{year} 年</span>
                  <span className="text-xs text-slate-400">
                    {items.filter((p) => p.ready === 1).length}/{items.length} 套
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SESSION_ORDER[current.code].map((session) => {
                    const paper = items.find((p) => p.session === session)
                    if (!paper) return null
                    const ready = paper.ready === 1
                    return (
                      <button
                        key={session}
                        type="button"
                        onClick={() => navigate(`/papers/${current.code}/${year}/${session}`)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          ready
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <span>{SESSION_LABEL[session]}</span>
                        <span
                          className={`text-[0.65rem] ${ready ? 'text-indigo-400' : 'text-slate-400'}`}
                        >
                          {ready ? '已收录' : '未收录'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
