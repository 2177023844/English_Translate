import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { PaperDetail, PaperQuestion, PaperSetDetail } from '../api/types'
import PenCanvas from '../components/PenCanvas'

const SPLIT_KINDS = new Set(['reading', 'listening', 'cloze', 'matching'])

function isCompact(question: PaperQuestion): boolean {
  return question.options.length > 0 && question.options.every((o) => !o.text.trim())
}

interface QuestionCardProps {
  question: PaperQuestion
  index: number
  selected?: string
  isGraded: boolean
  hint?: string
  onChoose: (key: string) => void
  onGrade: () => void
}

function QuestionCard({
  question,
  index,
  selected,
  isGraded,
  hint,
  onChoose,
  onGrade,
}: QuestionCardProps) {
  const compact = isCompact(question)
  const many = question.options.length > 6
  const gridClass = many
    ? 'mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5'
    : compact
      ? 'mt-3 flex flex-wrap gap-2'
      : 'mt-3 space-y-2'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          第 {index + 1} 题 · 题号 {question.no}
        </span>
        {isGraded && <span className="text-emerald-600">已批改</span>}
      </div>

      <p className="mt-1.5 text-[0.95rem] font-medium leading-7 text-slate-800">
        {question.stem || `第 ${question.no} 题`}
      </p>

      <div className={gridClass}>
        {question.options.map((option) => {
          const chosen = selected === option.key
          const correct = isGraded && question.answer === option.key
          const wrong = isGraded && chosen && question.answer !== option.key
          const cls = correct
            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
            : wrong
              ? 'border-red-400 bg-red-50 text-red-700'
              : chosen
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChoose(option.key)}
              disabled={isGraded}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-default ${
                many || compact ? 'min-w-[3rem] text-center' : 'w-full text-left'
              } ${cls}`}
            >
              <span className="font-semibold">{option.key}</span>
              {option.text && <span className="ml-1.5">{option.text}</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {hint && <span className="text-amber-600">{hint}</span>}
        </span>
        <button
          type="button"
          onClick={onGrade}
          disabled={isGraded}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          批改此题
        </button>
      </div>

      {isGraded && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          {selected === question.answer ? (
            <p className="text-emerald-600">✓ 回答正确</p>
          ) : (
            <p className="text-red-500">✗ 回答错误，正确答案：{question.answer}</p>
          )}
          {question.explanation && (
            <p className="mt-2 text-xs leading-6 text-slate-500">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PaperModule() {
  const { setId = '', moduleId = '' } = useParams()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [graded, setGraded] = useState<Record<string, boolean>>({})
  const [hints, setHints] = useState<Record<string, string>>({})
  const [pen, setPen] = useState(false)
  const [clearTick, setClearTick] = useState(0)

  const setQ = useQuery({
    queryKey: ['paper-set', Number(setId)],
    queryFn: async () => (await api.get<{ set: PaperSetDetail }>(`/paper-sets/${setId}`)).data.set,
    enabled: setId !== '',
  })
  const set = setQ.data
  const module = set?.content?.modules.find((m) => m.id === moduleId) ?? null

  const paperQ = useQuery({
    queryKey: ['paper', set?.paper_id],
    queryFn: async () =>
      (await api.get<{ paper: PaperDetail }>(`/papers/${set!.paper_id}`)).data.paper,
    enabled: set != null,
  })

  useEffect(() => {
    setAnswers({})
    setGraded({})
    setHints({})
    setPen(false)
    setClearTick(0)
  }, [module?.id])

  const questions = module?.questions ?? []

  const audioFile = paperQ.data?.files.find(
    (f) => f.mime?.startsWith('audio/') && (f.set_id === set?.id || f.set_id == null),
  )

  if (setQ.isLoading) {
    return <p className="py-16 text-center text-sm text-slate-400">加载中…</p>
  }
  if (!set || !module) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-sm text-slate-500">找不到这个模块。</p>
        <Link to="/papers" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          ← 返回试卷列表
        </Link>
      </div>
    )
  }

  const backTo = `/papers/${set.level}/${set.year}/${set.session}`
  const split = SPLIT_KINDS.has(module.kind)
  const answeredCount = Object.keys(answers).length

  function choose(question: PaperQuestion, key: string) {
    const qKey = String(question.no)
    if (graded[qKey]) return
    setAnswers((prev) => ({ ...prev, [qKey]: key }))
    setHints((prev) => ({ ...prev, [qKey]: '' }))
  }

  function grade(question: PaperQuestion) {
    const qKey = String(question.no)
    if (!question.answer) {
      setHints((prev) => ({ ...prev, [qKey]: '这套试卷暂未录入答案。' }))
      return
    }
    if (!answers[qKey]) {
      setHints((prev) => ({ ...prev, [qKey]: '请先选择一个答案。' }))
      return
    }
    setGraded((prev) => ({ ...prev, [qKey]: true }))
    setHints((prev) => ({ ...prev, [qKey]: '' }))
  }

  const header = (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          to={backTo}
          className="shrink-0 text-sm text-slate-400 transition-colors hover:text-indigo-600"
        >
          ← 返回目录
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-800">{module.title}</h1>
          <p className="truncate text-xs text-slate-400">
            {set.title} · {module.part}
            {module.section ? ` · ${module.section}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {pen && (
          <button
            type="button"
            onClick={() => setClearTick((t) => t + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-red-300 hover:text-red-500"
          >
            清除批注
          </button>
        )}
        <button
          type="button"
          onClick={() => setPen((p) => !p)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            pen
              ? 'bg-rose-500 text-white shadow-sm hover:bg-rose-600'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-500'
          }`}
        >
          ✏️ {pen ? '批注中' : '批注'}
        </button>
      </div>
    </div>
  )

  if (!split) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <PenCanvas active={pen} resetKey={`${module.id}-${clearTick}`}>
              {module.directions && (
                <p className="whitespace-pre-wrap text-[0.95rem] leading-7 text-slate-700">
                  {module.directions}
                </p>
              )}
              {module.passage && (
                <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-7 text-slate-700">
                  {module.passage}
                </p>
              )}
            </PenCanvas>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* 左：文章 / 听力材料 */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <PenCanvas active={pen} resetKey={`${module.id}-${clearTick}`}>
              {module.kind === 'listening' && (
                <div className="mb-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-400">听力材料</p>
                  {audioFile ? (
                    <audio
                      controls
                      src={`/api/papers/files/${audioFile.id}`}
                      className="mt-2 w-full"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">暂未上传这一套的听力音频。</p>
                  )}
                </div>
              )}
              {module.directions && (
                <p className="mb-5 text-sm italic leading-6 text-slate-400">{module.directions}</p>
              )}
              {module.passage && (
                <div className="whitespace-pre-wrap text-[0.95rem] leading-7 text-slate-700">
                  {module.passage}
                </div>
              )}
              {module.wordBank && module.wordBank.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-400">词库</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
                    {module.wordBank.map((word, i) => (
                      <span key={word}>
                        {String.fromCharCode(65 + i)}. {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </PenCanvas>
          </div>
        </section>

        {/* 右：全部题目 */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <PenCanvas active={pen} resetKey={`${module.id}-${clearTick}`}>
              <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-400">
                <span>共 {questions.length} 题</span>
                <span>
                  已答 {answeredCount} / {questions.length}
                </span>
              </div>
              {questions.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">这一部分暂无题目。</p>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => {
                    const qKey = String(question.no)
                    return (
                      <QuestionCard
                        key={qKey}
                        question={question}
                        index={index}
                        selected={answers[qKey]}
                        isGraded={!!graded[qKey]}
                        hint={hints[qKey]}
                        onChoose={(key) => choose(question, key)}
                        onGrade={() => grade(question)}
                      />
                    )
                  })}
                </div>
              )}
            </PenCanvas>
          </div>
        </section>
      </div>
    </div>
  )
}
