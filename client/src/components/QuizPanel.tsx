import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Question, StudyMode, WordView } from '../api/types'
import Modal from './Modal'
import WordInfoBody from './WordInfoBody'

export interface QuizFeedback {
  kind: 'correct' | 'wrong' | 'skip' | 'unknown' | 'error'
  text: string
  chosenIndex?: number
}

/** 单词详情浮窗：汉语、词性、音标、发音、用法（短语）、例句 */
function WordInfoModal({ wordId, onClose }: { wordId: number; onClose: () => void }) {
  const infoQ = useQuery({
    queryKey: ['word-info', wordId],
    queryFn: async () => (await api.get<{ word: WordView }>(`/words/${wordId}`)).data.word,
  })
  const w = infoQ.data
  return (
    <Modal open onClose={onClose} className="w-[640px] max-w-[92vw]">
      {infoQ.isLoading && <p className="py-10 text-center text-sm text-slate-400">加载中…</p>}
      {w && <WordInfoBody w={w} />}
    </Modal>
  )
}

/** 答错鼓励语（随机轮换） */
export const ENCOURAGE_MSGS = [
  '别灰心，再记一次就记住了',
  '没关系，多练几次就会了',
  '加油，这个单词一定能拿下',
  '差一点点，下次一定对',
  '坚持就是胜利，再来',
]

export function pickEncourage(): string {
  return ENCOURAGE_MSGS[Math.floor(Math.random() * ENCOURAGE_MSGS.length)]
}

interface QuizPanelProps {
  question: Question | null | undefined
  mode: StudyMode
  word: WordView
  feedback: QuizFeedback | null
  advancing: boolean
  pending: boolean
  isFav: boolean
  autoPlayAudio: boolean
  /** 作答后显示"下一个"按钮，等用户学习完再手动继续 */
  showNext: boolean
  onNext: () => void
  onAnswer: (idx: number) => void
  onSkip: () => void
  onToggleFav: () => void
  onUnknown: () => void
  onPlayAudio: () => void
}

/**
 * 四选一题目面板（学习/复习共用）：长宽比约 4:3，题干居中醒目，选项大按钮。
 * 快捷键 1-4 选择答案。
 */
export default function QuizPanel({
  question,
  mode,
  word,
  feedback,
  advancing,
  pending,
  isFav,
  autoPlayAudio,
  showNext,
  onNext,
  onAnswer,
  onSkip,
  onToggleFav,
  onUnknown,
  onPlayAudio,
}: QuizPanelProps) {
  const [infoWordId, setInfoWordId] = useState<number | null>(null)
  // 新词自动播放发音
  useEffect(() => {
    if (autoPlayAudio && !advancing) {
      const t = setTimeout(() => onPlayAudio(), 200)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id, advancing, autoPlayAudio])

  // 快捷键：1-4 选答案；作答后 Enter 进入下一题
  useEffect(() => {
    if (!question) return
    const onKey = (e: KeyboardEvent) => {
      if (showNext && e.key === 'Enter') {
        e.preventDefault()
        onNext()
        return
      }
      if (advancing || pending || showNext) return
      const idx = Number(e.key) - 1
      if (idx >= 0 && idx < question.options.length) {
        e.preventDefault()
        onAnswer(idx)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advancing, pending, question, onAnswer, showNext, onNext])

  const optionClass = (idx: number) => {
    const base =
      'flex items-center gap-2.5 rounded-xl border-2 px-4 py-2 text-left transition-colors disabled:opacity-60'
    if (feedback?.kind === 'wrong' && question) {
      if (idx === question.correctIndex) return `${base} border-green-400 bg-green-50`
      if (idx === feedback.chosenIndex) return `${base} border-red-400 bg-red-50`
    }
    return `${base} border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50`
  }

  const cardBorder =
    feedback?.kind === 'correct'
      ? 'animate-flash-green border-green-300'
      : feedback?.kind === 'wrong'
        ? 'animate-shake border-red-300'
        : feedback?.kind === 'unknown'
          ? 'border-amber-300'
          : feedback?.kind === 'skip'
            ? 'border-blue-300'
            : 'border-slate-200'

  // 单词长度自适应字号：超长单词缩小，避免水平溢出被裁剪
  const wordLen = question?.prompt.word?.length ?? 0
  const wordSizeClass =
    wordLen > 14 ? 'text-2xl sm:text-3xl' : wordLen > 9 ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'

  return (
    <div
      className={`mx-auto flex aspect-[3/4] w-full max-w-[calc((100vh_-_10rem)*3/4)] flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition-colors sm:p-7 ${cardBorder}`}
    >
      {/* 题干区：不滚动，内容完整展示 */}
      {mode === 'en2zh' && question ? (
        /* 英→中：单词+音标（长单词自动缩小字号并允许换行） */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-2 text-center">
          <p className="mb-2 shrink-0 text-sm font-medium tracking-wide text-slate-400">选择正确的汉语释义</p>
          <div className={`${wordSizeClass} max-w-full break-all font-bold tracking-wide text-slate-900`}>
            {question.prompt.word}
          </div>
          {question.prompt.phoneticUs && (
            <div className="mt-2 shrink-0 break-all font-mono text-base text-slate-400 sm:text-lg">
              /{question.prompt.phoneticUs}/
            </div>
          )}
        </div>
      ) : (
        /* 中→英：释义（最多展示 3 条，不滚动） */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-2 text-center">
          {mode === 'zh2en' && question && (
            <>
              <p className="mb-3 shrink-0 text-sm font-medium tracking-wide text-slate-400">选择对应的英文单词</p>
              <div className="space-y-1.5">
                {question.prompt.translations?.slice(0, 3).map((t, i) => (
                  <div key={i} className="flex items-center justify-center gap-2.5 text-2xl leading-snug text-slate-900 sm:text-3xl">
                    {t.type && (
                      <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-sm italic text-indigo-500">{t.type}</span>
                    )}
                    <span className="font-medium">{t.text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {!question && <p className="text-lg text-slate-400">题目生成中…</p>}
        </div>
      )}

      {/* 发音行：固定在题干下方，始终完整可见（音标展示于题干中） */}
      {question && (
        <div className="flex shrink-0 items-center justify-center gap-2 pt-1.5">
          <button
            type="button"
            onClick={onPlayAudio}
            className="rounded-lg bg-indigo-50 px-4 py-1.5 text-base text-indigo-600 transition-colors hover:bg-indigo-100"
          >
            🔊 听发音
          </button>
        </div>
      )}

      {/* 选项：竖版单列大按钮，文字完整展示；答错后在干扰项内部展示其汉语与词性 */}
      {question && (
        <div className="mt-2 grid shrink-0 gap-2.5">
          {question.options.map((opt, idx) => {
            // 作答后（无论对错）在干扰项内部展示其汉语与词性
            const showDistractorZh =
              (feedback?.kind === 'wrong' || feedback?.kind === 'correct') &&
              mode === 'zh2en' &&
              idx !== question.correctIndex
            return (
              <button
                key={opt.wordId + opt.text}
                type="button"
                disabled={advancing || pending}
                onClick={() => (showNext ? setInfoWordId(opt.wordId) : onAnswer(idx))}
                className={optionClass(idx)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-base font-bold text-indigo-600">
                  {String.fromCharCode(65 + idx)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 font-mono text-base font-medium text-slate-800 sm:text-lg">{opt.text}</span>
                    {opt.type && (
                      <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs italic text-slate-400">
                        {opt.type}
                      </span>
                    )}
                  </div>
                  {showDistractorZh && opt.translations && opt.translations.length > 0 && (
                    <div className="mt-1 text-left text-xs leading-snug text-slate-500">
                      {opt.translations.map((t, i) => (
                        <div key={i}>
                          {t.type && <span className="mr-1 italic text-slate-400">{t.type}</span>}
                          {t.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 反馈 + 下一题按钮 */}
      <div className="mt-2 flex min-h-8 shrink-0 items-center justify-center gap-4 text-center text-base">
        {feedback?.kind === 'correct' && <span className="font-semibold text-green-600">{feedback.text}</span>}
        {feedback?.kind === 'wrong' && <span className="font-semibold text-red-500">{feedback.text}</span>}
        {feedback?.kind === 'skip' && <span className="font-semibold text-blue-600">{feedback.text}</span>}
        {feedback?.kind === 'unknown' && <span className="font-semibold text-amber-600">{feedback.text}</span>}
        {feedback?.kind === 'error' && <span className="font-semibold text-red-500">{feedback.text}</span>}
        {showNext && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            下一个 →
          </button>
        )}
      </div>

      {/* 操作按钮：跳过 / 收藏 / 不认识 */}
      <div className="mt-1.5 flex shrink-0 items-center justify-center gap-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={advancing || pending || showNext}
          onClick={onSkip}
          className="rounded-xl bg-blue-50 px-6 py-3 text-base font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50"
          title="我认识这个单词，之后只在复习中出现"
        >
          跳过（认识）
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onToggleFav}
          className={`rounded-xl px-6 py-3 text-base font-medium transition-colors disabled:opacity-50 ${
            isFav ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
          title="收藏到生词本"
        >
          {isFav ? '★ 已收藏' : '☆ 收藏'}
        </button>
        <button
          type="button"
          disabled={advancing || pending || showNext}
          onClick={onUnknown}
          className="rounded-xl bg-amber-50 px-6 py-3 text-base font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
          title="我不认识这个单词，学习时会多次推送"
        >
          不认识
        </button>
      </div>

      {/* 作答等待期间点击选项 → 弹出该单词详情 */}
      {infoWordId !== null && <WordInfoModal wordId={infoWordId} onClose={() => setInfoWordId(null)} />}
    </div>
  )
}
