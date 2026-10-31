import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DailyStat, OverviewStats } from '../api/types'
import ProgressBar from '../components/ProgressBar'

interface BooksStat {
  id: number
  code: string
  name: string
  word_count: number
  learnedCount: number
}

/** 统计页：概览卡片 + 30 天折线柱状图（echarts 动态加载）+ 词书进度 */
export default function Stats() {
  const overviewQ = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => (await api.get<OverviewStats>('/stats/overview')).data,
  })
  const dailyQ = useQuery({
    queryKey: ['stats-daily'],
    queryFn: async () => (await api.get<{ daily: DailyStat[] }>('/stats/daily', { params: { days: 30 } })).data.daily,
  })
  const booksQ = useQuery({
    queryKey: ['stats-books'],
    queryFn: async () => (await api.get<{ books: BooksStat[] }>('/stats/books')).data.books,
  })

  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dailyQ.data || !chartRef.current) return
    let disposed = false
    let chart: import('echarts').ECharts | null = null
    void import('echarts').then((echarts) => {
      if (disposed || !chartRef.current) return
      chart = echarts.init(chartRef.current)
      const dates = dailyQ.data!.map((d) => d.date.slice(5))
      chart.setOption({
        grid: { left: 40, right: 40, top: 40, bottom: 24 },
        tooltip: { trigger: 'axis' },
        legend: { top: 0 },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
        yAxis: [
          { type: 'value', name: '数量', minInterval: 1 },
          { type: 'value', name: '正确率%', max: 100 },
        ],
        series: [
          {
            name: '新学',
            type: 'bar',
            data: dailyQ.data!.map((d) => d.newCount),
            itemStyle: { color: '#6366f1' },
            barMaxWidth: 12,
          },
          {
            name: '复习',
            type: 'bar',
            data: dailyQ.data!.map((d) => d.reviewCount),
            itemStyle: { color: '#c7d2fe' },
            barMaxWidth: 12,
          },
          {
            name: '正确率',
            type: 'line',
            yAxisIndex: 1,
            data: dailyQ.data!.map((d) => d.accuracy),
            itemStyle: { color: '#f59e0b' },
            smooth: true,
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

  const overview = overviewQ.data

  const statItems = [
    { label: '累计已学', value: `${overview?.totalLearned ?? 0} 词` },
    { label: '今日待复习', value: `${overview?.totalDue ?? 0} 词` },
    { label: '连续打卡', value: `${overview?.streakDays ?? 0} 天` },
    { label: '30天平均正确率', value: `${overview?.avgAccuracy30d ?? 0}%` },
  ]

  return (
    <div className="mx-auto w-full space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">学习统计</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statItems.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <div className="text-xl font-bold text-indigo-600">{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">近 30 天学习情况</h2>
        <div ref={chartRef} className="h-64 w-full" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-600">各词书进度</h2>
        <div className="space-y-4">
          {booksQ.data?.map((b) => (
            <div key={b.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-700">{b.name}</span>
                <span className="text-slate-400">
                  {b.learnedCount}/{b.word_count}（{b.word_count > 0 ? Math.round((b.learnedCount / b.word_count) * 100) : 0}%）
                </span>
              </div>
              <ProgressBar value={b.learnedCount} max={b.word_count} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
