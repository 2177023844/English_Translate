import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, extractError } from '../api/client'
import type { WordDetail } from '../api/types'
import AudioButton from '../components/AudioButton'
import WordInfoBody from '../components/WordInfoBody'

/** 单词详情页：最上方搜索栏，下方单词丰富信息 + ⭐ 收藏 */
export default function TranslateDetail() {
  const { wordId } = useParams()
  const id = Number(wordId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [showAllForms, setShowAllForms] = useState(false)

  const detailQ = useQuery({
    queryKey: ['word-detail', id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async () => (await api.get<{ word: WordDetail }>(`/words/${id}`)).data.word,
  })

  const favM = useMutation({
    mutationFn: async (isFavorite: boolean) =>
      (await api.put(`/words/${id}/favorite`, { isFavorite })).data,
    onSuccess: (_d, isFavorite) => {
      // 缓存数据就是 WordDetail 本身，直接展开更新（之前多包一层导致渲染崩溃白屏）
      queryClient.setQueryData(['word-detail', id], (prev: WordDetail | undefined) =>
        prev ? { ...prev, isFavorite } : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      setMessage(isFavorite ? '已加入生词本 ⭐' : '已从生词本移除')
      setTimeout(() => setMessage(null), 2000)
    },
    onError: (e) => setMessage(extractError(e)),
  })

  const submit = () => {
    const v = input.trim()
    if (v) navigate(`/translate?q=${encodeURIComponent(v)}`)
  }

  const w = detailQ.data

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* 最上方搜索栏 */}
      <div className="flex items-center gap-3">
        <Link to="/translate" className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
          ← 返回
        </Link>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="输入汉语或英语继续查询…"
          className="w-full rounded-xl border-2 border-slate-200 px-5 py-2.5 text-base text-slate-800 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim()}
          className="shrink-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          查询
        </button>
      </div>

      {/* 单词信息 */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {detailQ.isLoading && <p className="py-10 text-center text-sm text-slate-400">加载中…</p>}
        {detailQ.isError && <p className="py-10 text-center text-sm text-red-500">单词不存在或已失效</p>}
        {w && (
          <>
            {/* 头部：单词 + ⭐收藏 + 音标 + 发音 + 词书来源 */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-4xl font-bold text-slate-800">{w.word}</span>
              <button
                type="button"
                onClick={() => !favM.isPending && favM.mutate(!w.isFavorite)}
                title={w.isFavorite ? '取消收藏' : '收藏到生词本'}
                className={`text-3xl transition-transform hover:scale-110 ${
                  w.isFavorite ? '' : 'opacity-40 grayscale'
                }`}
              >
                ⭐
              </button>
              {(w.phoneticUs || w.phoneticUk) && (
                <span className="font-mono text-xl text-slate-400">/{(w.phoneticUs ?? w.phoneticUk) as string}/</span>
              )}
              <AudioButton text={w.word} />
              {message && <span className="text-sm text-green-600">{message}</span>}
            </div>
            {w.bookNames.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {w.bookNames.map((b) => (
                  <span key={b} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-500">
                    收录于「{b}」
                  </span>
                ))}
              </div>
            )}

            {/* 丰富信息：含义与词性 → 用法搭配 → 例句 → 变形词（头部已在页面顶部展示，避免重复） */}
            <div className="mt-5 border-t border-slate-100 pt-5">
              <WordInfoBody w={w} rich showHead={false} />
              {w.derivedForms.length > 0 && (
                <section className="mt-4">
                  <h4 className="text-sm font-semibold text-slate-600">该单词的其他变形</h4>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(showAllForms ? w.derivedForms : w.derivedForms.slice(0, 3)).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => navigate(`/translate?q=${encodeURIComponent(f)}`)}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 font-mono text-sm text-indigo-600 transition-colors hover:bg-indigo-100"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  {w.derivedForms.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllForms((v) => !v)}
                      className="mt-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700"
                    >
                      {showAllForms ? '收起' : '查看更多变形'}
                    </button>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
