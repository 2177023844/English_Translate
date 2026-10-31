import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { api } from '../api/client'
import type { Book, FavoriteWord } from '../api/types'
import AudioButton from '../components/AudioButton'
import { toDayStr } from '../components/StudyCalendar'

/** 生词本：收藏的单词列表，支持发音、移除、勾选导出 Excel */
export default function Favorites() {
  const queryClient = useQueryClient()
  const [bookFilter, setBookFilter] = useState<number | ''>('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const booksQ = useQuery({
    queryKey: ['books'],
    queryFn: async () => (await api.get<{ books: Book[] }>('/books')).data.books,
  })
  const favQ = useQuery({
    queryKey: ['favorites', bookFilter],
    queryFn: async () =>
      (await api.get<{ favorites: FavoriteWord[] }>('/favorites', {
        params: bookFilter ? { bookId: bookFilter } : {},
      })).data.favorites,
  })

  const removeM = useMutation({
    mutationFn: async (wordId: number) =>
      (await api.put(`/words/${wordId}/favorite`, { isFavorite: false })).data,
    onSuccess: (_d, wordId) => {
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(wordId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = (favQ.data?.length ?? 0) > 0 && selected.size === favQ.data!.length

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set((favQ.data ?? []).map((w) => w.id)))
  }

  /** 导出勾选单词为 Excel：A 列单词，B 列词性和汉语 */
  const exportExcel = () => {
    const picked = (favQ.data ?? []).filter((w) => selected.has(w.id))
    if (picked.length === 0) return
    const rows: string[][] = [['单词', '词性和汉语']]
    for (const w of picked) {
      for (const t of w.translations) {
        rows.push([w.word, `${t.type ?? ''} ${t.translation}`.trim()])
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 18 }, { wch: 60 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '生词本')
    XLSX.writeFile(wb, `生词本_${toDayStr(new Date())}.xlsx`)
  }

  return (
    <div className="mx-auto w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">生词本</h1>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 accent-indigo-600"
            />
            全选
          </label>
          <span className="text-xs text-slate-400">已选 {selected.size} 个</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">全部词书</option>
            {booksQ.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportExcel}
            disabled={selected.size === 0}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            导出 Excel
          </button>
        </div>
      </div>

      {favQ.isLoading && <p className="text-sm text-slate-400">加载中…</p>}
      {favQ.data?.length === 0 && (
        <p className="py-16 text-center text-slate-400">生词本为空，去学习页把单词收藏进来吧</p>
      )}

      <ul className="space-y-2">
        {favQ.data?.map((w) => (
          <li
            key={w.id}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            {/* 勾选 → 单词 → 音标 → 提示音 → 词书标签 → …… → 汉语及词性（最右） → 移除 */}
            <input
              type="checkbox"
              checked={selected.has(w.id)}
              onChange={() => toggle(w.id)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
            />
            <span className="shrink-0 font-bold text-slate-800">{w.word}</span>
            {(w.phoneticUs || w.phoneticUk) && (
              <span className="shrink-0 font-mono text-sm text-slate-400">
                /{(w.phoneticUs ?? w.phoneticUk) as string}/
              </span>
            )}
            <AudioButton text={w.word} className="shrink-0" />
            <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-500">{w.bookName}</span>
            <p className="min-w-0 flex-1 text-right text-sm leading-snug text-slate-500">
              {w.translations.map((t, i) => (
                <span key={i}>
                  {t.type && <span className="mr-1 italic text-slate-400">{t.type}</span>}
                  {t.translation}
                  {i < w.translations.length - 1 && '；'}
                </span>
              ))}
            </p>
            <button
              type="button"
              onClick={() => removeM.mutate(w.id)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              移除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
