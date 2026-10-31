import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, extractError } from '../api/client'
import type { Book, OverviewStats, Question, Settings, StudySubmitResult, WordView } from '../api/types'
import ProgressBar from '../components/ProgressBar'
import QuizPanel, { pickEncourage, type QuizFeedback } from '../components/QuizPanel'
import { toDayStr } from '../components/StudyCalendar'
import { useTts } from '../hooks/useTts'

/** 同一单词在本次会话中最多出现次数（含首次；答错越多重推越多） */
const MAX_OCCURRENCES = 10

/** 未完成会话的本地持久化（退出后重新进入可继续学习） */
interface SavedSession {
  date: string
  queue: number[]
  pos: number
  words: WordView[]
  correct: number
  skip: number
  unknown: number
  attempts: number
}

function sessionKey(id: number) {
  return `study-session-${id}`
}

/** 学习页：按设置的学习模式出题（中→英 / 英→中）；跳过/收藏/不认识 操作 */
export default function Study() {
  const { bookId } = useParams()
  const id = Number(bookId)
  const queryClient = useQueryClient()
  const { speak } = useTts()

  // ---- 读取未完成会话（同日有效） ----
  const [savedSession, setSavedSession] = useState<SavedSession | null>(() => {
    try {
      const raw = localStorage.getItem(sessionKey(id))
      if (!raw) return null
      const s = JSON.parse(raw) as SavedSession
      if (s.date !== toDayStr(new Date()) || s.queue.length === 0 || s.pos >= s.queue.length) {
        localStorage.removeItem(sessionKey(id))
        return null
      }
      return s
    } catch {
      return null
    }
  })
  /** 从存档恢复后不再自动取新词（直到进入下一组） */
  const [resumed, setResumed] = useState(false)

  const [words, setWords] = useState<WordView[]>([])
  const [queue, setQueue] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [skipCount, setSkipCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [favSet, setFavSet] = useState<Set<number>>(new Set())
  const [finished, setFinished] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [round, setRound] = useState(0)
  const [lastRemaining, setLastRemaining] = useState(0)
  const [lastHasMore, setLastHasMore] = useState(false)
  /** 额外学习模式：每日额度用完后"再学一组" */
  const [extraMode, setExtraMode] = useState(false)

  const queueRef = useRef<number[]>([])
  const posRef = useRef(0)
  const occRef = useRef(new Map<number, number>())
  const wordStartRef = useRef(Date.now())
  useEffect(() => {
    queueRef.current = queue
    posRef.current = pos
  }, [queue, pos])

  const booksQ = useQuery({
    queryKey: ['books'],
    queryFn: async () => (await api.get<{ books: Book[] }>('/books')).data.books,
  })
  const book = booksQ.data?.find((b) => b.id === id)

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
  /** 每日学习总量（词数）= 组数 × 每组数量 */
  const dailyWordLimit = settings.dailyGroups * settings.groupSize

  // 今日已学（服务端真实数据：退出重进不重置，跨会话累计）
  const overviewQ = useQuery({
    queryKey: ['stats-overview'],
    queryFn: async () => (await api.get<OverviewStats>('/stats/overview')).data,
  })

  // 每次取一组（groupSize）新词，学完可继续下一组；额度用完后可"再学一组"（extra）
  const newWordsQ = useQuery({
    queryKey: ['new-words', id, settings.groupSize, round, extraMode],
    enabled: Number.isInteger(id) && id > 0 && savedSession === null && !resumed,
    staleTime: 0,
    queryFn: async () => {
      const data = (
        await api.get<{ words: WordView[]; remainingToday: number; hasMore: boolean }>(`/books/${id}/words/new`, {
          params: { limit: settings.groupSize, ...(extraMode ? { extra: 1 } : {}) },
        })
      ).data
      setLastRemaining(data.remainingToday)
      setLastHasMore(data.hasMore)
      return data
    },
  })

  // 断点续学：只取今日额度和剩余词数，不重新取词（避免覆盖存档会话）
  const newMetaQ = useQuery({
    queryKey: ['new-words-meta', id, resumed],
    enabled: Number.isInteger(id) && id > 0 && resumed,
    staleTime: 0,
    queryFn: async () =>
      (
        await api.get<{ words: WordView[]; remainingToday: number; hasMore: boolean }>(
          `/books/${id}/words/new`,
          { params: { limit: 1, meta: 1 } },
        )
      ).data,
  })
  useEffect(() => {
    if (newMetaQ.data) {
      setLastRemaining(newMetaQ.data.remainingToday)
      setLastHasMore(newMetaQ.data.hasMore)
    }
  }, [newMetaQ.data])

  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words])

  /** 开始下一组：先清空旧队列，避免新词加载期间还能作答上一组最后一题 */
  const startNextGroup = useCallback((extra: boolean) => {
    setExtraMode(extra)
    setResumed(false)
    setFinished(false)
    setQueue([])
    setPos(0)
    setWords([])
    setFeedback(null)
    setAdvancing(false)
    setRound((r) => r + 1)
  }, [])

  // 重置本组会话（今日累计计数保留，跨组统计）
  const resetSession = useCallback((list: WordView[]) => {
    const ids = list.map((w) => w.id)
    setQueue(ids)
    setPos(0)
    occRef.current = new Map(ids.map((wid) => [wid, 1]))
    setFeedback(null)
    setFinished(false)
    setAdvancing(false)
    wordStartRef.current = Date.now()
  }, [])

  useEffect(() => {
    if (newWordsQ.data) {
      setWords(newWordsQ.data.words)
      resetSession(newWordsQ.data.words)
    }
  }, [newWordsQ.data, resetSession])

  // ---- 会话持久化：进度实时保存；完成后清除 ----
  useEffect(() => {
    if (finished || words.length === 0) return
    const s: SavedSession = {
      date: toDayStr(new Date()),
      queue,
      pos,
      words,
      correct: correctCount,
      skip: skipCount,
      unknown: unknownCount,
      attempts,
    }
    localStorage.setItem(sessionKey(id), JSON.stringify(s))
  }, [queue, pos, words, correctCount, skipCount, unknownCount, attempts, finished, id])

  useEffect(() => {
    if (finished) localStorage.removeItem(sessionKey(id))
  }, [finished, id])

  const resumeSession = useCallback(() => {
    if (!savedSession) return
    setWords(savedSession.words)
    setQueue(savedSession.queue)
    setPos(savedSession.pos)
    setCorrectCount(savedSession.correct)
    setSkipCount(savedSession.skip)
    setUnknownCount(savedSession.unknown)
    setAttempts(savedSession.attempts)
    occRef.current = new Map(savedSession.queue.map((wid) => [wid, 1]))
    setFeedback(null)
    setFinished(false)
    setSavedSession(null)
    setResumed(true)
  }, [savedSession])

  const discardSession = useCallback(() => {
    localStorage.removeItem(sessionKey(id))
    setSavedSession(null)
    setResumed(false)
  }, [id])

  // 学习完成时刷新相关缓存
  useEffect(() => {
    if (finished) {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
      queryClient.invalidateQueries({ queryKey: ['stats-daily'] })
      queryClient.invalidateQueries({ queryKey: ['stats-books'] })
      // 断点续学的额度信息在续学前取的，完成一组后重新取一次
      if (resumed) {
        queryClient.invalidateQueries({ queryKey: ['new-words-meta', id] })
      }
    }
  }, [finished, resumed, id, queryClient])

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
    queryKey: ['study-question', id, mode, currentWordId, appearance],
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

  const scheduleAdvance = useCallback((ms: number) => {
    setAdvancing(true)
    setTimeout(() => {
      setAdvancing(false)
      advanceNow()
    }, ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          context: 'study',
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
      // 不论对错，新词首次作答都计入今日进度
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
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
          context: 'study',
        })
      ).data
    },
    onSuccess: () => {
      setSkipCount((c) => c + 1)
      setFeedback({ kind: 'skip', text: '已标记为认识，之后只在复习中出现' })
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
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
          context: 'study',
        })
      ).data
    },
    onSuccess: () => {
      if (!current) return
      setUnknownCount((c) => c + 1)
      setAttempts((a) => a + 1)
      setFeedback({ kind: 'unknown', text: '已标记为不认识，将重点推送学习' })
      reQueue(current.id, 2)
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] })
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

  if (!Number.isInteger(id) || id <= 0) {
    return <p className="text-red-500">词书 ID 无效</p>
  }
  if (booksQ.data && !book) {
    return <p className="text-red-500">词书不存在</p>
  }

  // 上次未完成的学习会话 → 继续学习界面
  if (savedSession !== null) {
    const remain = savedSession.queue.length - savedSession.pos
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-5xl">📖</div>
        <h2 className="mt-4 text-2xl font-bold text-slate-800">继续学习</h2>
        <p className="mt-2 text-slate-500">
          上次学习「{book?.name ?? '词书'}」中途退出，还剩 {remain} 个单词
        </p>
        <p className="mt-1 text-xs text-slate-400">今日已学进度将自动延续，不会重新累计</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={resumeSession}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            继续学习 →
          </button>
          <button
            type="button"
            onClick={discardSession}
            className="rounded-lg bg-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-300"
          >
            重新开始
          </button>
        </div>
      </div>
    )
  }

  const todayLearned = overviewQ.data?.learnedToday ?? correctCount + skipCount
  const plan = dailyWordLimit
  const planDone = todayLearned >= plan

  if (finished || (newWordsQ.data && words.length === 0 && !newWordsQ.isLoading)) {
    const accuracy = attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0
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
        {attempts > 0 && <p className="mt-2 text-slate-400">正确率 {accuracy}%</p>}
      </>
    )

    // 本组学完，今日额度还有剩余 → 继续下一组
    if (finished && lastRemaining > 0) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-4 text-2xl font-bold text-slate-800">本组学习完成</h2>
          <p className="mt-2 text-slate-500">今日还能学 {lastRemaining} 个单词</p>
          {summary}
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => startNextGroup(false)}
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

    // 今日任务未完成：不显示"今日学习完成"界面
    if (!planDone) {
      const diff = plan - todayLearned
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="text-5xl">📚</div>
          <h2 className="mt-4 text-2xl font-bold text-slate-800">今日任务未完成</h2>
          <p className="mt-2 text-slate-500">
            还差 {diff} 个单词完成今日计划（共 {plan} 词）
          </p>
          {summary}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {lastHasMore && (
              <button
                type="button"
                onClick={() => startNextGroup(true)}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                再学一组单词（{settings.groupSize} 个）→
              </button>
            )}
            <Link to="/study" className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700">
              去选择其他词书
            </Link>
            <Link to="/" className="rounded-lg bg-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-300">
              返回首页
            </Link>
          </div>
          {!lastHasMore && (
            <p className="mt-4 text-xs text-slate-400">这本词书的新词已学完，去其他词书继续学习吧</p>
          )}
        </div>
      )
    }

    // 今日任务完成
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-4 text-2xl font-bold text-slate-800">今日学习完成</h2>
        <p className="mt-2 text-slate-500">
          {words.length === 0 && attempts === 0 ? '今日新词已达上限或全部学完' : `共练习 ${attempts} 次`}
        </p>
        {summary}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {lastHasMore && (
            <button
              type="button"
              onClick={() => {
                setExtraMode(true)
                setResumed(false)
                setFinished(false)
                setRound((r) => r + 1)
              }}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              再学一组单词（{settings.groupSize} 个）→
            </button>
          )}
          {settings.spellingEnabled && (
            <Link to="/spell" className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700">
              拼写今天学过的单词 →
            </Link>
          )}
          <Link to="/" className="rounded-lg bg-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-300">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  if (!current) {
    return <p className="py-16 text-center text-slate-400">加载中…</p>
  }

  const isFav = favSet.has(current.id)
  const pending = answerM.isPending || skipM.isPending || unknownM.isPending
  const showNext = feedback?.kind === 'correct' || feedback?.kind === 'wrong'

  return (
    <div className="mx-auto w-full">
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <Link to="/study" className="hover:text-indigo-600">
          ← {book?.name ?? '词书'}
        </Link>
        <span>
          今日已学 {todayLearned}/{plan} 词 · 答对 {correctCount}
        </span>
      </div>
      <ProgressBar value={todayLearned} max={plan} className="mb-4" />

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
