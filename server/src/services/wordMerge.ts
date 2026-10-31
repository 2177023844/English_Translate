/** 跨词书合并单词数据（详情/搜索共用） */

export interface MergedWord {
  id: number
  word: string
  phoneticUs: string | null
  phoneticUk: string | null
  translations: { translation: string; type?: string }[]
  phrases: { phrase: string; translation?: string }[]
  sentences: { sentence: string; translation?: string }[]
}

export interface WordRow {
  phonetic_us: string | null
  phonetic_uk: string | null
  translations: string
  phrases: string
  sentences: string
}

/** 翻译条目过滤（中文搜索时只保留命中条目） */
export function filterTranslationsBy(
  list: { translation: string; type?: string }[],
  keyword: string,
): { translation: string; type?: string }[] {
  return list.filter((t) => t.translation.includes(keyword))
}

/**
 * 合并同一单词在多本词书中的数据：
 * - 释义按词性合并、按"词组"去重（忽略标点与顺序）
 * - 短语/例句去重
 */
export function mergeWordRows(wordId: number, word: string, rows: WordRow[]): MergedWord {
  let phoneticUs: string | null = null
  let phoneticUk: string | null = null
  const translations: { translation: string; type?: string }[] = []
  const phrases: { phrase: string; translation?: string }[] = []
  const sentences: { sentence: string; translation?: string }[] = []
  const seenP = new Set<string>()
  const seenS = new Set<string>()
  const stripPunct = (s: string) => s.replace(/[，。；、：\s]/g, '')
  // 按词性分别去重：同一中文释义在 n / vt 两个词性下都要保留
  const seenTokensByType = new Map<string, Set<string>>()

  for (const r of rows) {
    if (!phoneticUs && r.phonetic_us) phoneticUs = r.phonetic_us
    if (!phoneticUk && r.phonetic_uk) phoneticUk = r.phonetic_uk
    for (const t of JSON.parse(r.translations) as { translation: string; type?: string }[]) {
      const key = t.type ?? ''
      let seenTokens = seenTokensByType.get(key)
      if (!seenTokens) {
        seenTokens = new Set<string>()
        seenTokensByType.set(key, seenTokens)
      }
      const existing = translations.find((o) => (o.type ?? '') === key)
      const kept: string[] = []
      for (const raw of t.translation.split('；')) {
        const part = raw.trim()
        if (!part) continue
        const tokens = part.split(/[，、]/).map(stripPunct).filter(Boolean)
        if (tokens.length > 0 && tokens.every((tk) => seenTokens!.has(tk))) continue
        tokens.forEach((tk) => seenTokens!.add(tk))
        kept.push(part)
      }
      if (kept.length === 0) continue
      if (existing) {
        const all = existing.translation.split('；').concat(kept).map((s) => s.trim()).filter(Boolean)
        existing.translation = [...new Set(all)].join('；')
      } else {
        translations.push({ translation: kept.join('；'), type: t.type })
      }
    }
    for (const p of JSON.parse(r.phrases) as { phrase: string; translation?: string }[]) {
      const key = (p.phrase ?? '').trim()
      if (key && !seenP.has(key)) {
        seenP.add(key)
        phrases.push({ phrase: key, translation: p.translation })
      }
    }
    for (const s of JSON.parse(r.sentences) as { sentence: string; translation?: string }[]) {
      const key = (s.sentence ?? '').trim()
      if (key && !seenS.has(key)) {
        seenS.add(key)
        sentences.push({ sentence: key, translation: s.translation })
      }
    }
  }

  return { id: wordId, word, phoneticUs, phoneticUk, translations, phrases, sentences }
}
