import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DailyStat, OverviewStats, Settings, WordView } from '../api/types'
import AudioButton from '../components/AudioButton'
import Modal from '../components/Modal'
import StudyCalendar, { toDayStr, type DayStatus } from '../components/StudyCalendar'

const CAL_DAYS = 120

/** 日历颜色数据（首页多个浮窗共用，TanStack Query 自动共享缓存） */
function useCalendarData() {
  const dailyQ = useQuery({
    queryKey: ['stats-daily', CAL_DAYS, 'calendar'],
    queryFn: async () =>
      (await api.get<{ daily: DailyStat[] }>('/stats/daily', { params: { days: CAL_DAYS } })).data.daily,
  })
  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: Settings }>('/settings')).data.settings,
  })
  const plan = (settingsQ.data?.dailyGroups ?? 2) * (settingsQ.data?.groupSize ?? 10)
  const statusMap = useMemo(() => {
    const m = new Map<string, DayStatus>()
    for (const d of dailyQ.data ?? []) {
      m.set(d.date, { newCount: d.newCount, completed: d.newCount >= plan })
    }
    return m
  }, [dailyQ.data, plan])
  return { statusMap }
}

function CalendarLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-red-500" /> 完成任务
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-yellow-300" /> 未完成学习目标
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-slate-200" /> 未学习
      </span>
    </div>
  )
}

/** 打卡天数浮窗：日历展示 */
function CalendarTip() {
  const { statusMap } = useCalendarData()
  return (
    <div className="w-80">
      <StudyCalendar statusMap={statusMap} readonly />
      <CalendarLegend />
    </div>
  )
}

/** 已累计学习词数浮窗：柱状图 + 右上角日期选择 + 右下角总数 */
function ChartTip() {
  const [end, setEnd] = useState(() => toDayStr(new Date()))
  const today = toDayStr(new Date())
  const overviewQ = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => (await api.get<OverviewStats>('/stats/overview')).data,
  })
  const dailyQ = useQuery({
    queryKey: ['stats-daily', 7, end],
    queryFn: async () =>
      (await api.get<{ daily: DailyStat[] }>('/stats/daily', { params: { days: 7, end } })).data.daily,
  })
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dailyQ.data || !chartRef.current) return
    let disposed = false
    let chart: import('echarts').ECharts | null = null
    void import('echarts').then((echarts) => {
      if (disposed || !chartRef.current) return
      chart = echarts.init(chartRef.current)
      // 连续 7 天，横坐标显示日期
      const dates = dailyQ.data!.map((d) => d.date.slice(5))
      chart.setOption({
        grid: { left: 36, right: 16, top: 24, bottom: 24 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', minInterval: 1 },
        series: [
          {
            type: 'bar',
            data: dailyQ.data!.map((d) => d.newCount),
            itemStyle: { color: '#6366f1' },
            barMaxWidth: 32,
            // 柱子顶部显示数量
            label: { show: true, position: 'top', fontSize: 12, fontWeight: 'bold', color: '#6366f1' },
          },
        ],
      })
    })
    const onResize = () => chart?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      chart?.dispose()
    }
  }, [dailyQ.data])

  return (
    <div className="w-[520px]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">每日学习单词数（新学）</span>
        <input
          type="date"
          value={end}
          max={today}
          onChange={(e) => e.target.value && setEnd(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div ref={chartRef} className="h-56 w-full" />
      <div className="mt-1 text-right text-sm text-slate-500">
        总学习数：<span className="font-bold text-indigo-600">{overviewQ.data?.totalLearned ?? 0}</span>
      </div>
    </div>
  )
}

/** 今日学习数/复习数浮窗：单词列表 + 右上角彩色日历选择日期 */
function WordsTip({ kind }: { kind: 'learn' | 'review' }) {
  const [date, setDate] = useState(() => toDayStr(new Date()))
  const { statusMap } = useCalendarData()
  const wordsQ = useQuery({
    queryKey: ['stats-words', kind, date],
    queryFn: async () =>
      (await api.get<{ words: WordView[] }>('/stats/words', { params: { date, kind } })).data.words,
  })

  return (
    <div className="flex w-[800px] max-w-[90vw] gap-4">
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-medium text-slate-600">
          {date} {kind === 'learn' ? '学习' : '复习'}的单词（{wordsQ.data?.length ?? 0} 个）
        </p>
        {wordsQ.data?.length === 0 && <p className="py-8 text-center text-xs text-slate-400">这一天没有记录</p>}
        <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
          {wordsQ.data?.map((w) => (
            <li key={w.id} className="rounded-lg bg-slate-50 px-3 py-2">
              {/* 单词 + 音标完整展示（不截断、不横向滚动） */}
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold text-slate-700">{w.word}</span>
                {(w.phoneticUs || w.phoneticUk) && (
                  <span className="break-all font-mono text-sm text-slate-400">
                    /{(w.phoneticUs ?? w.phoneticUk) as string}/
                  </span>
                )}
                <AudioButton text={w.word} className="ml-auto h-7 w-7 shrink-0 p-1" />
              </div>
              {/* 释义：完整换行展示 */}
              <p className="mt-0.5 text-sm leading-snug text-slate-500">
                {w.translations.map((t, i) => (
                  <span key={i}>
                    {t.type && <span className="mr-1 italic text-slate-400">{t.type}</span>}
                    {t.translation}
                    {i < w.translations.length - 1 && '；'}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="shrink-0 border-l border-slate-100 pl-3">
        <StudyCalendar statusMap={statusMap} selected={date} onSelect={setDate} />
        <CalendarLegend />
      </div>
    </div>
  )
}

/** 首页：四个展示卡片居中排列（点击打开弹窗查看详情） */
export default function Dashboard() {
  const overviewQ = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => (await api.get<OverviewStats>('/stats/overview')).data,
  })
  const overview = overviewQ.data
  const [active, setActive] = useState<string | null>(null)

  const tiles = [
    {
      label: '打卡天数',
      value: `${overview?.streakDays ?? 0} 天`,
      icon: '🔥',
      tip: <CalendarTip />,
    },
    {
      label: '已累积学习词数',
      value: `${overview?.totalLearned ?? 0} 词`,
      icon: '📖',
      tip: <ChartTip />,
    },
    {
      label: '今日学习数',
      value: `${overview?.learnedToday ?? 0} 词`,
      icon: '✨',
      tip: <WordsTip kind="learn" />,
    },
    {
      label: '今日复习数',
      value: `${overview?.reviewedToday ?? 0} 词`,
      icon: '🔄',
      tip: <WordsTip kind="review" />,
    },
  ]

  const activeTile = tiles.find((t) => t.label === active)

  return (
    <div className="flex min-h-[calc(100vh-13rem)] flex-col items-center justify-center">
      <div className="grid w-full max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(t.label)}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
          >
            <div className="text-3xl">{t.icon}</div>
            <div className="mt-2 text-2xl font-bold text-slate-800">{t.value}</div>
            <div className="mt-1 text-sm text-slate-400">{t.label}</div>
          </button>
        ))}
      </div>

      <Modal open={active !== null} onClose={() => setActive(null)} title={activeTile?.label}>
        {activeTile?.tip}
        {/* 右侧交互：等不及了，去学习 */}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-3">
          <Link
            to="/study"
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            ⚡ 等不及了，去学习 →
          </Link>
        </div>
      </Modal>
    </div>
  )
}
