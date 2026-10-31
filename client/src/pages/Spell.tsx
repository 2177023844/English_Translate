import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { WordView } from '../api/types'
import AudioButton from '../components/AudioButton'
import StartScreen from '../components/StartScreen'
import { toDayStr } from '../components/StudyCalendar'
import { useTts } from '../hooks/useTts'

interface SpellFeedback {
  kind: 'correct' | 'wrong'
  text: string
}

/** 拼错时，同一单词最多出现次数 */
const MAX_OCCURRENCES = 2

const STARTED_KEY = () => `started-spell-${toDayStr(new Date())}`

/** 拼写测试页：给出汉语+词性，拼写今天学过/复习过的单词 */
export default function Spell() {
  const { speak } = useTts()
  const [started, setStarted] = useState(() => localStorage.getItem(STARTED_KEY()) !== null)
  const [words, setWords] = useState<WordView[]>([])
  const [queue, setQueue] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState<SpellFeedback | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [finished, setFinished] = useState(false)

  const queueRef = useRef<number[]>([])
  const posRef = useRef(0)
  const occRef = useRef(new Map<number, number>())
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    queueRef.current = queue
    posRef.current = pos
  }, [queue, pos])

  const wordsQ = useQuery({
    queryKey: ['spell-words'],
    staleTime: 0,
    queryFn: async () => (await api.get<{ words: WordView[] }>('/spell/words')).data.words,
  })

  useEffect(() => {
    if (wordsQ.data) {
      setWords(wordsQ.data)
      setQueue(wordsQ.data.map((w) => w.id))
      setPos(0)
      occRef.current = new Map()
      setFeedback(null)
      setTyped('')
      setCorrectCount(0)
      setAttempts(0)
      setFinished(false)
    }
  }, [wordsQ.data])

  const wordById = useMemo(() => new Map(words.map((w) => [w.id, w])), [words])
  const currentWordId = queue[pos]
  const current: WordView | undefined = currentWordId !== undefined ? wordById.get(currentWordId) : undefined

  const advanceNow = useCallback(() => {
    setFeedback(null)
    setTyped('')
    const p = posRef.current
    if (p + 1 >= queueRef.current.length) {
      setFinished(true)
    } else {
      setPos(p + 1)
    }
    inputRef.current?.focus()
  }, [])

  // 拼错：把单词插回队列末尾再拼一次
  const reQueue = useCallback((wordId: number) => {
    const occ = occRef.current.get(wordId) ?? 0
    if (occ >= MAX_OCCURRENCES) return
    occRef.current.set(wordId, occ + 1)
    const q = [...queueRef.current]
    q.push(wordId)
    setQueue(q)
  }, [])

  const submit = () => {
    if (!current || !typed.trim()) return
    const correct = typed.trim().toLowerCase() === current.word.toLowerCase()
    setAttempts((a) => a + 1)
    if (correct) {
      setCorrectCount((c) => c + 1)
      setFeedback({ kind: 'correct', text: '拼写正确！' })
      speak(current.word)
    } else {
      const ph = current.phoneticUs ? ` /${current.phoneticUs}/` : ''
      setFeedback({ kind: 'wrong', text: `正确答案：${current.word}${ph}` })
      reQueue(current.id)
    }
  }

  // 作答后 Enter 进入下一题
  useEffect(() => {
    if (!feedback) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        advanceNow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, advanceNow])

  // ---- 渲染 ----

  // 今日还未开始拼写 → 开始界面
  if (!started) {
    return (
      <StartScreen
        icon="✍️"
        module="拼写"
        onStart={() => {
          localStorage.setItem(STARTED_KEY(), '1')
          setStarted(true)
        }}
      />
    )
  }

  if (wordsQ.isLoading) return <p className="py-16 text-center text-slate-400">加载中…</p>

  if (finished) {
    const accuracy = attempts > 0 ? Math.round((correctCount / attempts) * 100) : 0
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-4 text-2xl font-bold text-slate-800">拼写测试完成</h2>
        <p className="mt-2 text-slate-500">共拼写 {attempts} 次，拼对 {correctCount} 个单词</p>
        {attempts > 0 && <p className="mt-1 text-slate-400">正确率 {accuracy}%</p>}
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="rounded-lg bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-slate-400">今天还没有学过或复习过单词，先去学习吧</p>
        <div className="mt-6 flex justify-center">
          <Link to="/" className="rounded-lg bg-indigo-600 px-5 py-2 text-sm text-white hover:bg-indigo-700">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  if (!current) return null

  const showNext = feedback !== null

  return (
    <div className="mx-auto w-full">
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <Link to="/" className="hover:text-indigo-600">
          ← 返回
        </Link>
        <span>
          第 {pos + 1} / {queue.length} 个 · 拼对 {correctCount}
        </span>
      </div>

      <div
        className={`mx-auto flex aspect-[3/4] w-full max-w-[calc((100vh_-_10rem)*3/4)] flex-col overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition-colors sm:p-8 ${
          feedback?.kind === 'correct'
            ? 'animate-flash-green border-green-300'
            : feedback?.kind === 'wrong'
              ? 'animate-shake border-red-300'
              : 'border-slate-200'
        }`}
      >
        {/* 题干：汉语 + 词性 */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-2 text-center">
          <p className="mb-4 shrink-0 text-sm font-medium tracking-wide text-slate-400">写出对应的英文单词</p>
          <div className="space-y-2">
            {current.translations.slice(0, 4).map((t, i) => (
              <div key={i} className="flex items-center justify-center gap-2.5 text-2xl leading-snug text-slate-900 sm:text-3xl">
                {t.type && (
                  <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-sm italic text-indigo-500">{t.type}</span>
                )}
                <span className="font-medium">{t.translation}</span>
              </div>
            ))}
          </div>
          {feedback?.kind === 'wrong' && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-lg font-semibold text-red-500">{feedback.text}</span>
              <AudioButton text={current.word} />
            </div>
          )}
        </div>

        {/* 输入区 */}
        {!showNext && (
          <div className="shrink-0">
            <div className="flex items-center justify-center gap-3">
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="输入单词拼写…"
                className="w-full max-w-md rounded-xl border-2 border-slate-200 px-4 py-2.5 font-mono text-xl text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!typed.trim()}
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                提交
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">Enter 提交</p>
          </div>
        )}

        {/* 反馈 + 下一个 */}
        {showNext && (
          <div className="flex min-h-10 shrink-0 items-center justify-center gap-4">
            {feedback.kind === 'correct' && (
              <span className="font-semibold text-green-600">{feedback.text}</span>
            )}
            <button
              type="button"
              onClick={advanceNow}
              className="rounded-lg bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              下一个 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
