import { Link } from 'react-router-dom'
import type { Book } from '../api/types'
import ProgressBar from './ProgressBar'

interface BookCardProps {
  book: Book
}

/** 词书卡片：名称、进度条、待复习角标、开始学习入口 */
export default function BookCard({ book }: BookCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{book.name}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            共 {book.word_count} 词 · 已学 {book.learned_count} 词
          </p>
        </div>
        {book.due_count > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
            待复习 {book.due_count}
          </span>
        )}
      </div>
      <ProgressBar value={book.learned_count} max={book.word_count} className="mt-4" />
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {book.word_count > 0 ? Math.round((book.learned_count / book.word_count) * 100) : 0}%
        </span>
        <Link
          to={`/study/${book.id}`}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          开始学习
        </Link>
      </div>
    </div>
  )
}
