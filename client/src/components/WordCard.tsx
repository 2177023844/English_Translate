import { useState } from 'react'
import type { WordView } from '../api/types'
import AudioButton from './AudioButton'

interface WordCardProps {
  word: WordView
  accent?: 'us' | 'uk'
  /** 是否显示英文单词本身（学习模式隐藏，复习/生词本显示） */
  showWord?: boolean
}

/** 单词卡片：释义 + 音标 + 发音 + 例句/短语（可折叠） */
export default function WordCard({ word, accent = 'us', showWord = false }: WordCardProps) {
  const [expanded, setExpanded] = useState(false)
  const phonetic = accent === 'uk' ? word.phoneticUk : word.phoneticUs
  const hasExtra = word.sentences.length > 0 || word.phrases.length > 0

  return (
    <div className="w-full">
      {showWord && (
        <div className="mb-1 text-center text-3xl font-bold text-slate-800">{word.word}</div>
      )}
      {phonetic && <div className="mb-2 text-center font-mono text-lg text-slate-500">/{phonetic}/</div>}
      <div className="text-center text-xl leading-relaxed text-slate-800">
        {word.translations.slice(0, 4).map((t, i) => (
          <div key={i} className="flex items-center justify-center gap-2">
            {t.type && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs italic text-slate-500">{t.type}</span>
            )}
            <span>{t.translation}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1">
        <AudioButton text={word.word} title="播放发音" />
        <AudioButton text={word.translations[0]?.translation ?? ''} lang="zh" title="播放中文释义" />
        {hasExtra && (
          <button
            type="button"
            className="rounded-full px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : '例句'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
          {word.sentences.slice(0, 3).map((s, i) => (
            <div key={`s${i}`}>
              <div className="flex items-start gap-2 text-slate-700">
                <AudioButton text={s.sentence} className="h-6 w-6 p-0.5" title="播放例句" />
                <span>{s.sentence}</span>
              </div>
              {s.translation && <div className="ml-8 text-slate-400">{s.translation}</div>}
            </div>
          ))}
          {word.phrases.length > 0 && (
            <div className="rounded bg-slate-50 p-2">
              {word.phrases.slice(0, 3).map((p, i) => (
                <div key={`p${i}`} className="flex justify-between gap-4 py-0.5">
                  <span className="font-medium text-slate-600">{p.phrase}</span>
                  <span className="text-slate-400">{p.translation}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
