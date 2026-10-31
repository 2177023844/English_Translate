import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DISPLAY_QUOTES } from '../data/quotes'

function pickIndex(exclude = -1): number {
  if (DISPLAY_QUOTES.length <= 1) return 0
  let i = Math.floor(Math.random() * DISPLAY_QUOTES.length)
  if (i === exclude) i = (i + 1) % DISPLAY_QUOTES.length
  return i
}

/** 淡出时长：与 CSS transition 保持一致，保证句子切换顺滑 */
const FADE_OUT_MS = 300

/**
 * 右下角「好词好句」：纯文字直接浮在页面右下角，无边框、无出处、无按钮。
 * 每次刷新 / 切换界面随机展示一句英文名言及其中文翻译；
 * 切换时先淡出、换句后再淡入，过渡顺滑。
 */
export default function QuoteCard() {
  const { pathname } = useLocation()
  const [index, setIndex] = useState(() => pickIndex())
  const [visible, setVisible] = useState(false)
  const lastPath = useRef(pathname)
  const timer = useRef<number | undefined>(undefined)

  // 首次加载：淡入
  useEffect(() => {
    timer.current = window.setTimeout(() => setVisible(true), 60)
    return () => window.clearTimeout(timer.current)
  }, [])

  // 切换界面：先淡出，换一句后再淡入
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    setVisible(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setIndex((i) => pickIndex(i))
      setVisible(true)
    }, FADE_OUT_MS)
  }, [pathname])

  const q = DISPLAY_QUOTES[index]

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed bottom-6 right-6 z-40 max-w-[min(32rem,calc(100vw_-_2rem))] text-right transition-all duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {/* 严格两行：英文一行、中文一行，超长省略兜底 */}
      <p className="truncate font-serif text-[0.8rem] italic leading-normal text-slate-600 [text-shadow:0_1px_3px_rgba(255,255,255,0.9)]">
        {q.en}
      </p>
      <p className="mt-1 truncate text-xs italic leading-normal text-slate-400 [text-shadow:0_1px_3px_rgba(255,255,255,0.9)]">
        {q.zh}
      </p>
    </div>
  )
}
