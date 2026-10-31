import { Link, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/** 顶部导航：带待复习角标 */
export default function NavBar() {
  const { data } = useQuery({
    queryKey: ['due-count'],
    queryFn: async () => (await api.get<{ count: number }>('/review/due-count')).data.count,
    refetchInterval: 30_000,
  })
  const dueCount = data ?? 0

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm transition-colors ${
      isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[max(70vw,1024px)] items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-indigo-600">
          🍮 果冻学英语
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            首页
          </NavLink>
          <NavLink to="/study" className={linkClass}>
            学习
          </NavLink>
          <NavLink to="/review" className={linkClass}>
            复习
            {dueCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">
                {dueCount > 99 ? '99+' : dueCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/favorites" className={linkClass}>
            生词本
          </NavLink>
          <NavLink to="/stats" className={linkClass}>
            统计
          </NavLink>
          <NavLink to="/spell" className={linkClass}>
            拼写
          </NavLink>
          <NavLink to="/translate" className={linkClass}>
            翻译
          </NavLink>
          <NavLink to="/papers" className={linkClass}>
            试卷
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            设置
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
