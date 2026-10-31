import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, extractError } from '../api/client'
import type { OverviewStats, Question, ReviewCard, Settings, StudySubmitResult, WordView } from '../api/types'
import QuizPanel, { pickEncourage, type QuizFeedback } from '../components/QuizPanel'
import StartScreen from '../components/StartScreen'
import { toDayStr } from '../components/StudyCalendar'
import { useTts } from '../hooks/useTts'

const STARTED_KEY = () => `started-review-${toDayStr(new Date())}`

/** 同一单词在本次会话中最多出现次数（含首次；答错越多重推越多） */
const MAX_OCCURRENCES = 10

/** 复习页：与学习一致的选择题形式（答对→Good、答错/不认识→Again、跳过→Easy） */
export default function Review() {
  const queryClient = useQueryClient()
  const { speak } = useTts()
  const [started, setStarted] = useState(() => localStorage.getItem(STARTED_KEY()) !== null)

  const [queue, setQueue] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [skipCount, setSkipCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [favSet, setFavSet] = useState<Set<number>>(new Set())
  const [advancing, setAdvancing] = useState(false)
  const [finished, setFinished] = useState(false)
  const [round, setRound] = useState(0)
  const [lastRemaining, setLastRemaining] = useState(0)

  const queueRef = useRef<number[]>([])
  const posRef = useRef(0)
  const occRef = useRef(new Map<number, number>())
  const wordStartRef = useRef(Date.now())
  useEffect(() => {
    queueRef.current = queue
    posRef.current = pos
  }, [queue, pos])

  const settingsQ = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<{ settings: Settings }>('/settings')).data.settings,
  })
  const settings: Settings = settingsQ.data ?? {
    dailyGroups: 2,
    dailyReviewLimit: 200,
    accent: 'us',
    autoPlayAudio: true,
    studyMode: 'zh2en',
    groupSize: 10,
    spellingEnabled: false,
  }
  const mode = settings.studyMode

  // 每次取一组（groupSize）到期词，学完可继续下一组
  const overviewQ = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => (await api.get<OverviewStats>('/stats/overview')).data,
  })

  const queueQ = useQuery({
    queryKey: ['review-queue', settings.groupSize, round],
    staleTime: 0,
    queryFn: async () => {
      const data = (
        await api.get<{ queue: ReviewCard[]; remainingToday: number }>('/review/queue', {
          params: { limit: settings.groupSize },
        })
      ).data
      setLastRemaining(data.remainingToday)
      return data.queue
    },
  })

  const wordById = useMemo(
    () => new Map((queueQ.data ?? []).map((c) => [c.word.id, c.word])),
    [queueQ.data],
  )

  // 重置本组会话（今日累计计数保留，跨组统计）
  const resetSession = useCallback((ids: number[]) => {
    setQueue(ids)
    setPos(0)
    occRef.current = new Map(ids.map((id) => [id, 1]))
    setFeedback(null)
    setFinished(false)
    setAdvancing(false)
    wordStartRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (queueQ.data) resetSession(queueQ.data.map((c) => c.word.id))
  }, [queueQ.data, resetSession])

  // 复习完成时刷新相关缓存
  useEffect(() => {
    if (finished) {
      queryClient.invalidateQueries({ queryKey: ['due-count'] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
      queryClient.invalidateQueries({ queryKey: ['stats-daily'] })
    }
  }, [finished, queryClient])

  const currentWordId = queue[pos]
  const current: WordView | undefined = currentWordId !== undefined ? wordById.get(currentWordId) : undefined

  // 每个单词第几次出现（每次出现都重新出题：选项顺序与干扰项内容随机变化）
  const appearanceRef = useRef(new Map<number, number>())
  const [appearance, setAppearance] = useState(0)
  useEffect(() => {
    if (currentWordId === undefined) return
    const n = (appearanceRef.current.get(currentWordId) ?? 0) + 1
    appearanceRef.current.set(currentWordId, n)
    setAppearance(n)
  }, [currentWordId])

  // 每次出现单独生成一道新题
  const questionQ = useQuery({
    queryKey: ['review-question', mode, currentWordId, appearance],
    enabled: currentWordId !== undefined,
    queryFn: async () => {
      const resp = await api.post<{ questions: Question[] }>('/study/questions', {
        wordIds: [currentWordId!],
        mode,
      })
      return resp.data.questions[0] ?? null
    },
  })
  const currentQuestion: Question | null | undefined = questionQ.data

  /** 立即进入下一题 */
  const advanceNow = useCallback(() => {
    setFeedback(null)
    const p = posRef.current
    if (p + 1 >= queueRef.current.length) {
      setFinished(true)
    } else {
      setPos(p + 1)
    }
    wordStartRef.current = Date.now()
  }, [])

  /** 延迟自动进入下一题（跳过/不认识 使用） */
  const scheduleAdvance = useCallback(
    (ms: number) => {
      setAdvancing(true)
      setTimeout(() => {
        setAdvancing(false)
        advanceNow()
      }, ms)
    },
    [advanceNow],
  )

  // 答错/不认识：把单词排到本组末尾重新出现（每错一次排一次，最多出现 MAX_OCCURRENCES 次）
  const reQueue = useCallback((wordId: number, times: number) => {
    const occ = occRef.current.get(wordId) ?? 1
    if (occ >= MAX_OCCURRENCES) return
    const n = Math.min(times, MAX_OCCURRENCES - occ)
    occRef.current.set(wordId, occ + n)
    const q = [...queueRef.current]
    for (let i = 0; i < n; i++) q.push(wordId)
    setQueue(q)
  }, [])

  // ---- 作答 ----
  const answerM = useMutation({
    mutationFn: async (choiceIndex: number) => {
      // 防止新题还没加载时，把点击算到上一道题上
      const q = currentQuestion
      if (!q || q.wordId !== currentWordId) throw new Error('题目已切换，请重新作答')
      const opt = q.options[choiceIndex]
      const durationMs = Date.now() - wordStartRef.current
      return (
        await api.post<StudySubmitResult>('/study/answer', {
          wordId: q.wordId,
          mode: q.mode,
          choiceWordId: q.mode === 'zh2en' ? opt.wordId : undefined,
          choiceTranslation: q.mode === 'en2zh' ? opt.text : undefined,
          durationMs,
          context: 'review',
        })
      ).data
    },
    onSuccess: (data, choiceIndex) => {
      if (!currentQuestion || !current) return
      setAttempts((a) => a + 1)
      if (data.isCorrect) {
        setCorrectCount((c) => c + 1)
        setFeedback({ kind: 'correct', text: '回答正确！' })
        // 学习时间：自动读一遍发音，等用户点"下一个"
        speak(current.word)
      } else {
        setFeedback({ kind: 'wrong', text: `${pickEncourage()}！`, chosenIndex: choiceIndex })
        reQueue(currentQuestion.wordId, 1)
      }
    },
    onError: (e) => setFeedback({ kind: 'error', text: extractError(e) }),
  })

  // ---- 跳过（认识） ----
  const skipM = useMutation({
    mutationFn: async () => {
      const durationMs = Date.now() - wordStartRef.current
      return (
        await api.post<{ record: unknown }>('/study/skip', {
          wordId: current!.id,
          durationMs,
          context: 'review',
        })
      ).data
    },
    onSuccess: () => {
      setSkipCount((c) => c + 1)
      setFeedback({ kind: 'skip', text: '已标记为认识，之后只在复习中出现' })
      scheduleAdvance(400)
    },
    onError: (e) => setFeedback({ kind: 'error', text: extractError(e) }),
  })

  // ---- 不认识 ----
  const unknownM = useMutation({
    mutationFn: async () => {
      const durationMs = Date.now() - wordStartRef.current
      return (
        await api.post<{ record: unknown }>('/study/unknown', {
          wordId: current!.id,
          durationMs,
          context: 'review',
        })
      ).data
    },
    onSuccess: () => {
      if (!current) return
      setUnknownCount((c) => c + 1)
      setAttempts((a) => a + 1)
      setFeedback({ kind: 'unknown', text: '已标记为不认识，将重点推送学习' })
      reQueue(current.id, 2)
      scheduleAdvance(900)
    },
    onError: (e) => setFeedback({ kind: 'error', text: extractError(e) }),
  })

  // ---- 收藏 ----
  const favM = useMutation({
    mutationFn: async (wordId: number) =>
      (await api.put(`/words/${wordId}/favorite`, { isFavorite: !favSet.has(wordId) })).data,
    onSuccess: (_d, wordId) => {
      setFavSet((s) => {
        const next = new Set(s)
        if (next.has(wordId)) next.delete(wordId)
        else next.add(wordId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
    onError: (e) => setFeedback({ kind: 'error', text: extractError(e) }),
  })

  // ---- 渲染 ----

  // 今日还未开始复习 → 开始界面
  if (!started && overviewQ.isLoading) return <p className="py-16 text-center text-slate-400">加载中…</p>
  if (!started && (overviewQ.data?.reviewedToday ?? 0) === 0) {
    return (
      <StartScreen
        icon="🔄"
        module="复习"
        onStart={() => {
          localStorage.setItem(STARTED_KEY(), '1')
          setStarted(true)
        }}
      />
    )
  }

  if (queueQ.isLoading) return <p className="py-16 text-center text-slate-400">加载中…</p>
  if (queueQ.isError) return <p className="py-16 text-center text-red-500">复习队列加载失败</p>

  if (finished || queue.length === 0) {
    const summary = (
      <>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-green-50 p-3">
            <div className="text-lg font-bold text-green-600">{correctCount}</div>
            <div className="text-xs text-slate-400">答对</div>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <div className="text-lg font-bold text-blue-600">{skipCount}</div>
            <div className="text-xs text-slate-400">跳过(认识)</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-lg font-bold text-amber-600">{unknownCount}</div>
            <div className="text-xs text-slate-400">不认识</div>
          </div>
        </div>
      </>
    )

    // 本组复习完，今日额度还有剩余 → 可继续下一组
    if (finished && lastRemaining > 0) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-4 text-2xl font-bold text-slate-800">本组复习完成</h2>
          <p className="mt-2 text-slate-500">今日还能复习 {lastRemaining} 个单词</p>
          {summary}
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQueue([])
                setPos(0)
                setFeedback(null)
                setFinished(false)
                setRound((r) => r + 1)
              }}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              继续下一组 →
            </button>
            <Link to="/" className="rounded-lg bg-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-300">
              返回首页
            </Link>
          </div>
        </div>
      )
    }

    // 今日复习额度用完 / 无到期单词
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-4 text-2xl font-bold text-slate-800">今日复习完成</h2>
        <p className="mt-2 text-slate-500">
          {queue.length === 0 && attempts === 0 ? '暂无到期单词，去学点新词吧' : `共练习 ${attempts} 次`}
        </p>
        {summary}
        <div className="mt-6 flex justify-center gap-3">
          {settings.spellingEnabled && (
            <Link to="/spell" className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700">
              拼写今天学过或复习过的单词 →
            </Link>
          )}
          <Link to="/" className="rounded-lg bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  if (!current) return null

  const isFav = favSet.has(current.id)
  const pending = answerM.isPending || skipM.isPending || unknownM.isPending
  const showNext = feedback?.kind === 'correct' || feedback?.kind === 'wrong'

  return (
    <div className="mx-auto w-full">
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <Link to="/" className="hover:text-indigo-600">
          ← 返回
        </Link>
        <span>
          第 {pos + 1} / {queue.length} 张 · 答对 {correctCount}
        </span>
      </div>

      <QuizPanel
        question={currentQuestion}
        mode={mode}
        word={current}
        feedback={feedback}
        advancing={advancing}
        pending={pending}
        isFav={isFav}
        autoPlayAudio={settings.autoPlayAudio}
        showNext={showNext}
        onNext={advanceNow}
        onAnswer={(i) => !pending && !showNext && answerM.mutate(i)}
        onSkip={() => !pending && !showNext && skipM.mutate()}
        onToggleFav={() => favM.mutate(current.id)}
        onUnknown={() => !pending && !showNext && unknownM.mutate()}
        onPlayAudio={() => speak(current.word)}
      />
    </div>
  )
}
