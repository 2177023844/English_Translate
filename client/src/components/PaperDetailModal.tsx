import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, extractError } from '../api/client'
import type { PaperDetail, PaperFile, PaperSummary } from '../api/types'
import { SESSION_LABEL } from '../utils/paper'
import Modal from './Modal'

const ACCEPT = '.pdf,.docx,.md,.txt,.json,.png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.wav'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return '📄'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return '🖼️'
  if (['mp3', 'm4a', 'wav'].includes(ext)) return '🎧'
  if (['md', 'txt', 'json'].includes(ext)) return '📝'
  if (ext === 'docx') return '📃'
  return '📎'
}

interface Props {
  paper: PaperSummary | null
  onClose: () => void
}

/** 试卷详情弹窗：查看已收录文件 + 直接上传自己的试卷文件 */
export default function PaperDetailModal({ paper, onClose }: Props) {
  const qc = useQueryClient()
  const id = paper?.id
  const detailQ = useQuery({
    queryKey: ['paper', id],
    queryFn: async () => (await api.get<{ paper: PaperDetail }>(`/papers/${id}`)).data.paper,
    enabled: id != null,
  })
  const detail = id != null ? detailQ.data : undefined
  const files = detail?.files ?? []

  const inputRef = useRef<HTMLInputElement>(null)
  const [staged, setStaged] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busyFileId, setBusyFileId] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function resetOnClose() {
    if (uploading) return
    setStaged([])
    setMsg(null)
    setProgress(0)
    onClose()
  }

  function addStaged(list: FileList | File[] | null) {
    if (!list) return
    const incoming = Array.from(list)
    setStaged((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`))
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}:${f.size}`))]
    })
    setMsg(null)
  }

  async function upload() {
    if (id == null || staged.length === 0 || uploading) return
    setUploading(true)
    setProgress(0)
    setMsg(null)
    const count = staged.length
    try {
      const form = new FormData()
      for (const file of staged) form.append('files', file)
      await api.post(`/papers/${id}/files`, form, {
        timeout: 300_000,
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      setStaged([])
      setMsg({ type: 'ok', text: `已上传 ${count} 个文件` })
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['paper', id] }),
        qc.invalidateQueries({ queryKey: ['papers'] }),
      ])
    } catch (e) {
      setMsg({ type: 'err', text: extractError(e) })
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  async function removeFile(file: PaperFile) {
    if (id == null) return
    if (!window.confirm(`删除「${file.name}」？文件会从网站中移除。`)) return
    setBusyFileId(file.id)
    setMsg(null)
    try {
      await api.delete(`/papers/files/${file.id}`)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['paper', id] }),
        qc.invalidateQueries({ queryKey: ['papers'] }),
      ])
    } catch (e) {
      setMsg({ type: 'err', text: extractError(e) })
    } finally {
      setBusyFileId(null)
    }
  }

  const ready = detail?.ready === 1

  return (
    <Modal
      open={paper !== null}
      onClose={resetOnClose}
      title={paper?.title}
      className="w-[560px] max-w-[94vw]"
    >
      {paper && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>{paper.year} 年</span>
            <span>{SESSION_LABEL[paper.session]}</span>
            <span className={ready ? 'text-emerald-600' : 'text-slate-400'}>
              {ready ? '已收录' : '尚未收录'}
            </span>
            {detail?.source && <span className="text-xs text-slate-400">来源：{detail.source}</span>}
          </div>

          {detailQ.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-400">加载中…</p>
          ) : (
            <div className="mt-4">
              {files.length > 0 ? (
                <ul className="max-h-52 space-y-1.5 overflow-y-auto">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <span>{fileIcon(file.name)}</span>
                      <a
                        href={`/api/papers/files/${file.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-indigo-600 hover:underline"
                        title={file.name}
                      >
                        {file.name}
                      </a>
                      <span className="shrink-0 text-xs text-slate-400">{formatSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file)}
                        disabled={busyFileId === file.id}
                        className="shrink-0 rounded px-1.5 text-xs text-slate-400 transition-colors hover:text-red-500 disabled:opacity-40"
                        aria-label={`删除 ${file.name}`}
                      >
                        {busyFileId === file.id ? '…' : '删除'}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-400">
                  {detail?.content
                    ? '该试卷以文本形式收录在网站中。'
                    : '该套试卷还没有收录内容，可以在下面上传你的试卷文件。'}
                </p>
              )}
            </div>
          )}

          {/* 上传区 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addStaged(e.dataTransfer.files)
            }}
            className={`mt-4 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p className="text-sm text-slate-600">
              把试卷文件拖到这里，或{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-indigo-600 hover:underline"
              >
                选择文件
              </button>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              支持 PDF、图片、MP3 等音频、Markdown / TXT / JSON、DOCX；单个 ≤ 30 MB，一次最多 20 个
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                addStaged(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {staged.length > 0 && (
            <div className="mt-3">
              <ul className="space-y-1">
                {staged.map((file, i) => (
                  <li
                    key={`${file.name}:${file.size}:${i}`}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    <span>{fileIcon(file.name)}</span>
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="text-slate-400">{formatSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => setStaged((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500"
                      aria-label={`移除 ${file.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={upload}
                disabled={uploading}
                className="mt-2 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
              >
                {uploading ? `上传中… ${progress}%` : `上传 ${staged.length} 个文件`}
              </button>
            </div>
          )}

          {msg && (
            <p
              className={`mt-2 text-xs ${
                msg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {msg.text}
            </p>
          )}

          <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-400">
            文件会整份保存在网站里，点击文件名即可在浏览器中打开。试卷作答界面待你确定后再开发。
          </p>
        </>
      )}
    </Modal>
  )
}
