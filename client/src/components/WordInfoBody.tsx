import { useState } from 'react'
import type { WordView } from '../api/types'
import AudioButton from './AudioButton'

/** 单词详情展示：单词、音标、发音、汉语释义（含词性）、用法（短语）、例句。
 *  rich 模式：例句超 3 条时提供"查看更多例句"；showHead=false 时不显示单词/音标头部（详情页头部已展示，避免重复） */
export default function WordInfoBody({ w, rich = false, showHead = true }: { w: WordView; rich?: boolean; showHead?: boolean }) {
  const [showAllPhrases, setShowAllPhrases] = useState(false)
  const [showAllSentences, setShowAllSentences] = useState(false)
  const sentences = showAllSentences ? w.sentences : w.sentences.slice(0, 3)
  return (
    <div>
      {showHead && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl font-bold text-slate-800">{w.word}</span>
          {(w.phoneticUs || w.phoneticUk) && (
            <span className="font-mono text-lg text-slate-400">/{(w.phoneticUs ?? w.phoneticUk) as string}/</span>
          )}
          <AudioButton text={w.word} />
        </div>
      )}
      <section className="mt-4">
        <h4 className="text-sm font-semibold text-slate-600">汉语释义（合并多本词书）</h4>
        <div className="mt-1 space-y-1 text-slate-700">
          {w.translations.map((t, ti) => {
            // 一个释义条目可能含多个义项（以"；"分隔），拆成逐行展示
            const senses = t.translation.split('；').map((s) => s.trim()).filter(Boolean)
            return senses.map((s, si) => (
              <div key={`${ti}-${si}`} className="flex items-start gap-1.5">
                {si === 0 && t.type && (
                  <span className="mt-0.5 shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs italic text-indigo-500">
                    {t.type}
                  </span>
                )}
                <span>{s}</span>
              </div>
            ))
          })}
        </div>
      </section>
      {w.phrases.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-semibold text-slate-600">用法（短语搭配）</h4>
          <div className="mt-1 space-y-0.5 text-sm text-slate-600">
            {(showAllPhrases ? w.phrases : w.phrases.slice(0, 3)).map((p, i) => (
              <div key={i} className="flex gap-3">
                <span className="shrink-0 font-medium">{p.phrase}</span>
                <span className="text-slate-400">{p.translation}</span>
              </div>
            ))}
          </div>
          {w.phrases.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllPhrases((v) => !v)}
              className="mt-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700"
            >
              {showAllPhrases ? '收起' : '查看更多用法'}
            </button>
          )}
        </section>
      )}
      {w.sentences.length > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-semibold text-slate-600">例句</h4>
          <div className="mt-1 space-y-1.5 text-sm">
            {sentences.map((s, i) => (
              <div key={i}>
                <div className="flex items-start gap-2 text-slate-700">
                  <AudioButton text={s.sentence} className="h-6 w-6 p-0.5" />
                  <span>{s.sentence}</span>
                </div>
                {s.translation && <div className="ml-8 text-slate-400">{s.translation}</div>}
              </div>
            ))}
          </div>
          {rich && w.sentences.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllSentences((v) => !v)}
              className="mt-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700"
            >
              {showAllSentences ? '收起' : '查看更多例句'}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
