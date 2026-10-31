import { useTts } from '../hooks/useTts'

interface AudioButtonProps {
  text: string
  lang?: 'en' | 'zh'
  className?: string
  title?: string
}

/** 发音按钮（浏览器 TTS） */
export default function AudioButton({ text, lang = 'en', className = '', title = '播放发音' }: AudioButtonProps) {
  const { speak, supported } = useTts()
  if (!supported) return null
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 ${className}`}
      onClick={() => speak(text, lang)}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M13.5 4.06c0-1.34-1.62-2.01-2.56-1.06L6.62 7.31a1.5 1.5 0 0 1-1.06.44H3a2 2 0 0 0-2 2v4.5a2 2 0 0 0 2 2h2.56c.4 0 .78.16 1.06.44l4.32 4.31c.94.95 2.56.28 2.56-1.06V4.06Z" />
        <path d="M16.5 8.25a.75.75 0 0 1 1.28-.53 5.25 5.25 0 0 1 0 8.06.75.75 0 1 1-1.06-1.06 3.75 3.75 0 0 0 0-5.94.75.75 0 0 1-.22-.53Z" />
      </svg>
    </button>
  )
}
