import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Book, OverviewStats } from '../api/types'
import BookCard from '../components/BookCard'
import StartScreen from '../components/StartScreen'
import { toDayStr } from '../components/StudyCalendar'

const STARTED_KEY = () => `started-study-${toDayStr(new Date())}`

/** 学习页：选择词书（原首页功能）；今日未开始时先展示开始界面 */
export default function StudyList() {
  const [started, setStarted] = useState(() => localStorage.getItem(STARTED_KEY()) !== null)
  const booksQ = useQuery({
    queryKey: ['books'],
    queryFn: async () => (await api.get<{ books: Book[] }>('/books')).data.books,
  })
  const overviewQ = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => (await api.get<OverviewStats>('/stats/overview')).data,
  })

  // 今日还未开始学习 → 开始界面
  if (!started && (overviewQ.data?.learnedToday ?? 0) === 0) {
    return (
      <StartScreen
        icon="📚"
        module="学习"
        onStart={() => {
          localStorage.setItem(STARTED_KEY(), '1')
          setStarted(true)
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">选择词书</h1>
        <p className="mt-1 text-sm text-slate-500">四六级与考研英语词汇，选择题学习 + FSRS 间隔复习</p>
      </div>
      {booksQ.isLoading && <p className="text-sm text-slate-400">加载中…</p>}
      {booksQ.isError && <p className="text-sm text-red-500">词书加载失败，请确认后端已启动</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {booksQ.data?.map((b) => <BookCard key={b.id} book={b} />)}
      </div>
      {booksQ.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
          暂无词书。请先在项目根目录运行 <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run seed</code> 导入词库。
        </div>
      )}
    </div>
  )
}
