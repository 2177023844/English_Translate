import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { WordView } from '../api/types'
import WordInfoBody from '../components/WordInfoBody'

interface Suggestion {
  word: string
  type: string | null
  translation: string
  bookCount: number
  bookNames: string[]
}

/** 翻译页：输入汉语或英语查询单词；英文输入时弹出联想下拉；点击结果卡片进入单词详情页 */
export default function Translate() {
  const navigate = useNavigate()
  const [input, setInput] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [suggestText, setSuggestText] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  // 输入防抖 250ms 触发联想
  useEffect(() => {
    const t = setTimeout(() => setSuggestText(input.trim()), 250)
    return () => clearTimeout(t)
  }, [input])

  const suggestQ = useQuery({
    queryKey: ['translate-suggest', suggestText],
    enabled: suggestText.length > 0 && suggestText !== q,
    queryFn: async () =>
      (await api.get<{ suggestions: Suggestion[] }>('/translate/suggest', { params: { q: suggestText } })).data
        .suggestions,
  })

  const searchQ = useQuery({
    queryKey: ['translate-search', q],
    enabled: q.trim().length > 0,
    queryFn: async () =>
      (await api.get<{ results: WordView[] }>('/translate/search', { params: { q } })).data.results,
  })

  const submit = () => {
    const v = input.trim()
    if (v) {
      setQ(v)
      setOpen(false)
      navigate(`/translate?q=${encodeURIComponent(v)}`, { replace: true })
    }
  }

  const pick = (s: Suggestion) => {
    setInput(s.word)
    setQ(s.word)
    setOpen(false)
    setHighlight(-1)
    navigate(`/translate?q=${encodeURIComponent(s.word)}`, { replace: true })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = suggestQ.data ?? []
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (open && items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => (h + 1) % items.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => (h - 1 + items.length) % items.length)
        return
      }
      if (e.key === 'Enter' && highlight >= 0) {
        e.preventDefault()
        pick(items[highlight])
        return
      }
    }
    if (e.key === 'Enter') submit()
  }

  const showDropdown = open && (suggestQ.data?.length ?? 0) > 0

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="pt-10 text-center">
        <h1 className="text-2xl font-bold text-slate-800">翻译查询</h1>
        <p className="mt-1 text-sm text-slate-500">输入汉语或英语单词，查询对应的释义</p>
      </div>

      {/* 搜索栏（英文输入时弹出联想下拉） */}
      <div className="mt-8 flex items-start justify-center gap-3">
        <div className="relative w-full max-w-xl">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setOpen(true)
              setHighlight(-1)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoFocus
            placeholder="输入汉语（如：突然）或英语（如：abruptly）"
            className="w-full rounded-xl border-2 border-slate-200 px-5 py-3 text-lg text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
          {showDropdown && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {suggestQ.data!.map((s, i) => (
                <li key={s.word}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(s)
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                      i === highlight ? 'bg-indigo-50' : ''
                    } hover:bg-indigo-50`}
                  >
                    {/* 单词 · 词性 · 汉语 · 等级 */}
                    <span className="w-40 shrink-0 truncate font-mono font-semibold text-slate-800">{s.word}</span>
                    {s.type ? (
                      <span className="w-14 shrink-0 truncate text-xs italic text-slate-400">{s.type}</span>
                    ) : (
                      <span className="w-14 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{s.translation}</span>
                    <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-500">
                      {s.bookNames.map((n) => n.replace('词汇', '')).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim()}
          className="shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          查询
        </button>
      </div>

      {/* 结果（点击卡片进入详情页） */}
      <div className="mt-8 space-y-4">
        {searchQ.isLoading && <p className="py-8 text-center text-sm text-slate-400">查询中…</p>}
        {searchQ.data?.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">未找到相关单词，换个词试试</p>
        )}
        {searchQ.data?.map((w) => (
          <div
            key={w.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/translate/${w.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/translate/${w.id}`)}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            {/* 阻止卡片内按钮触发跳转 */}
            <div onClick={(e) => e.stopPropagation()}>
              <WordInfoBody w={w} />
            </div>
          </div>
        ))}
      </div>

      {q.trim() === '' && !searchQ.isLoading && (
        <p className="py-12 text-center text-sm text-slate-400">🔍 在搜索栏输入内容开始查询</p>
      )}
    </div>
  )
}
