import { useCallback, useEffect, useRef } from 'react'

type Lang = 'en' | 'zh'

/**
 * 浏览器 TTS（speechSynthesis）：无需 API Key。
 * 英文优先 Google 语音，中文优先微软/Google 中文语音，找不到则用默认语音。
 */
export function useTts() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Chrome 语音列表异步加载，监听变化刷新缓存
  useEffect(() => {
    if (!supported) return
    const load = () => {
      const vs = window.speechSynthesis.getVoices()
      if (vs.length) voicesRef.current = vs
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  const speak = useCallback(
    (text: string, lang: Lang = 'en', rate = 0.9): boolean => {
      if (!supported) return false
      const voices = window.speechSynthesis.getVoices()
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === 'en' ? 'en-US' : 'zh-CN'
      u.rate = rate
      if (lang === 'en') {
        u.voice =
          voices.find((v) => v.lang === 'en-US' && /google/i.test(v.name)) ??
          voices.find((v) => v.lang.startsWith('en')) ??
          null
      } else {
        u.voice =
          voices.find((v) => v.lang.startsWith('zh') && /google|xiaoxiao|huihui|tingting/i.test(v.name)) ??
          voices.find((v) => v.lang.startsWith('zh')) ??
          null
      }
      window.speechSynthesis.speak(u)
      return true
    },
    [supported],
  )

  return { speak, supported }
}
