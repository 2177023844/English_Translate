import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type {
  PaperDetail,
  PaperSession as PaperSessionCode,
  PaperSetDetail,
  PaperSummary,
} from '../api/types'
import PaperDetailModal from '../components/PaperDetailModal'
import { SESSION_LABEL } from '../utils/paper'

const LEVEL_NAME: Record<string, string> = { CET4: '四级', CET6: '六级', KY: '考研英语' }

function fileIcon(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return '📄'
  if (['mp3', 'm4a', 'wav'].includes(ext)) return '🎧'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return '🖼️'
  return '📎'
}

/** 某一场考试的试卷：先看目录（模块标题），再进入具体题目 */
export default function PaperSession() {
  const { level = '', year = '', session = '' } = useParams()
  const [pickedSetId, setPickedSetId] = useState<number | null>(null)
  const [filesOpen, setFilesOpen] = useState(false)

  const papersQ = useQuery({
    queryKey: ['papers'],
    queryFn: async () => (await api.get<{ papers: PaperSummary[] }>('/papers')).data.papers,
  })
  const paper =
    papersQ.data?.find(
      (p) => p.level === level && p.year === Number(year) && p.session === session,
    ) ?? null

  const detailQ = useQuery({
    queryKey: ['paper', paper?.id],
    queryFn: async () =>
      (await api.get<{ paper: PaperDetail }>(`/papers/${paper!.id}`)).data.paper,
    enabled: paper !== null,
  })
  const detail = detailQ.data
  const sets = detail?.sets ?? []
  const activeSet =
    sets.find((s) => s.id === pickedSetId) ??
    sets.find((s) => s.hasContent === 1) ??
    sets[0] ??
    null

  const setQ = useQuery({
    queryKey: ['paper-set', activeSet?.id],
    queryFn: async () =>
      (await api.get<{ set: PaperSetDetail }>(`/paper-sets/${activeSet!.id}`)).data.set,
    enabled: activeSet !== null && activeSet.hasContent === 1,
  })
  const content = setQ.data?.content

  if (!papersQ.isLoading && !paper) return <Navigate to="/papers" replace />

  const sessionLabel = SESSION_LABEL[session as PaperSessionCode] ?? session
  const files = detail?.files ?? []

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        to={`/papers/${level}`}
        className="text-sm text-slate-400 transition-colors hover:text-indigo-600"
      >
        ← {LEVEL_NAME[level] ?? level}历年真题
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {year} 年 {sessionLabel} · {LEVEL_NAME[level] ?? level}真题
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {sets.length > 0 ? `共 ${sets.length} 套` : '尚未解析'} · 先选模块，再进入题目
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFilesOpen(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          试卷文件 / 上传
        </button>
      </div>

      {papersQ.isLoading || detailQ.isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
      ) : (
        <>
          {/* 多套切换 */}
          {sets.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {sets.map((s) => {
                const active = s.id === activeSet?.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPickedSetId(s.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    第 {s.set_no} 套
                    {s.hasContent === 0 && (
                      <span className={`ml-1 text-xs ${active ? 'text-indigo-200' : 'text-slate-400'}`}>
                        未解析
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* 目录 */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold tracking-wide text-slate-400">目录</h2>
            {activeSet && activeSet.hasContent === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm text-slate-500">这一套还没有解析出题目内容。</p>
                <p className="mt-1 text-xs text-slate-400">
                  可以先在「试卷文件 / 上传」中上传 PDF、听力音频和解析。
                </p>
              </div>
            ) : setQ.isLoading ? (
              <p className="py-10 text-center text-sm text-slate-400">加载目录…</p>
            ) : content ? (
              <div className="mt-3 space-y-2">
                {content.modules.map((module) => {
                  const nos = module.questions.map((q) => Number(q.no)).filter((n) => !Number.isNaN(n))
                  const range = nos.length
                    ? `${Math.min(...nos)}–${Math.max(...nos)} 题`
                    : module.kind === 'writing'
                      ? '写作'
                      : module.kind === 'translation'
                        ? '翻译'
                        : ''
                  return (
                    <Link
                      key={module.id}
                      to={`/papers/sets/${activeSet?.id}/${module.id}`}
                      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600">
                        {module.part.replace('Part ', '')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-400">
                          {module.part}
                          {module.section ? ` · ${module.section}` : ''}
                        </div>
                        <div className="truncate font-medium text-slate-800">{module.title}</div>
                      </div>
                      <div className="shrink-0 text-xs text-slate-400">{range}</div>
                      <span className="shrink-0 text-slate-300 transition-colors group-hover:text-indigo-500">
                        →
                      </span>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                暂无目录
              </p>
            )}
          </section>

          {/* 文件 */}
          {files.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold tracking-wide text-slate-400">试卷文件</h2>
              <ul className="mt-3 space-y-1.5">
                {files.map((file) => {
                  const set = sets.find((s) => s.id === file.set_id)
                  return (
                    <li
                      key={file.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <span>{fileIcon(file.name)}</span>
                      <a
                        href={`/api/papers/files/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-indigo-600 hover:underline"
                      >
                        {file.name}
                      </a>
                      {set && (
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] text-slate-500">
                          第 {set.set_no} 套
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <PaperDetailModal paper={filesOpen ? paper : null} onClose={() => setFilesOpen(false)} />
    </div>
  )
}
