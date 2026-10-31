import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, extractError } from '../api/client'
import type { Book, Settings } from '../api/types'
import AudioButton from '../components/AudioButton'

/** 设置页：每日学习/复习数量（5 ~ 词书单词数）、每组学习数量、学习模式、口音、自动发音 */
export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: Settings }>('/settings')).data.settings,
  })
  const booksQ = useQuery({
    queryKey: ['books'],
    queryFn: async () => (await api.get<{ books: Book[] }>('/books')).data.books,
  })

  // 上限 = 最大词书单词数（与后端校验一致，至少 5）
  const maxWords = Math.max(5, ...(booksQ.data?.map((b) => b.word_count) ?? [5]))

  const saveM = useMutation({
    mutationFn: async (s: Settings) => (await api.put<{ settings: Settings }>('/settings', s)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data.settings)
      setMessage({ kind: 'ok', text: '已保存' })
      setTimeout(() => setMessage(null), 2000)
    },
    onError: (e) => setMessage({ kind: 'err', text: extractError(e) }),
  })

  if (settingsQ.isLoading) return <p className="py-16 text-center text-slate-400">加载中…</p>
  const settings = settingsQ.data
  if (!settings) return null

  const numberField =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-700 focus:border-indigo-500 focus:outline-none'

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">设置</h1>
      <form
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          saveM.mutate({
            dailyGroups: Number(fd.get('dailyGroups')),
            dailyReviewLimit: Number(fd.get('dailyReviewLimit')),
            groupSize: Number(fd.get('groupSize')),
            accent: String(fd.get('accent')) as 'us' | 'uk',
            autoPlayAudio: fd.get('autoPlayAudio') === 'on',
            studyMode: String(fd.get('studyMode')) as 'zh2en' | 'en2zh',
            spellingEnabled: fd.get('spellingEnabled') === 'on',
          })
        }}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">每天学习几组单词</label>
          <input
            name="dailyGroups"
            type="number"
            min={1}
            max={Math.max(1, Math.ceil(maxWords / settings.groupSize))}
            defaultValue={settings.dailyGroups}
            className={numberField}
          />
          <p className="mt-1 text-xs text-slate-400">
            最少 1 组，最多 {Math.max(1, Math.ceil(maxWords / settings.groupSize))} 组
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">每组学习几个单词</label>
          <input
            name="groupSize"
            type="number"
            min={1}
            max={maxWords}
            defaultValue={settings.groupSize}
            className={numberField}
          />
          <p className="mt-1 text-xs text-slate-400">范围：1 ~ {maxWords} 个；学完一组后休息一下，再继续下一组</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">每天复习多少个单词</label>
          <input
            name="dailyReviewLimit"
            type="number"
            min={5}
            max={maxWords}
            defaultValue={settings.dailyReviewLimit}
            className={numberField}
          />
          <p className="mt-1 text-xs text-slate-400">范围：5 ~ {maxWords}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">学习模式</label>
          <div className="flex gap-4">
            {(
              [
                ['zh2en', '中→英（看释义选单词）'],
                ['en2zh', '英→中（看单词选释义）'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="radio" name="studyMode" value={v} defaultChecked={settings.studyMode === v} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">音标口音</label>
          <div className="flex gap-4">
            {(['us', 'uk'] as const).map((a) => (
              <label key={a} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="radio" name="accent" value={a} defaultChecked={settings.accent === a} />
                {a === 'us' ? '美音' : '英音'}
                <AudioButton text="pronunciation" />
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="autoPlayAudio" defaultChecked={settings.autoPlayAudio} />
          学习时自动播放单词发音
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="spellingEnabled" defaultChecked={settings.spellingEnabled} />
          每天学习/复习结束后，拼写今天学过或复习过的单词
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveM.isPending}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            保存
          </button>
          {message && (
            <span className={`text-sm ${message.kind === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
              {message.text}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
