import { db } from '../db.js'

/**
 * 选择题干扰项生成：
 * - 拼写接近：与正确单词编辑距离 1~2、长度差 ≤1（如 cost/cast）
 * - 意思接近：汉语释义字符集 Jaccard 相似（如 element 元素 / factor 因素）
 * 歧义过滤：与正确词存在完全相同释义的词不能作为干扰项（否则也是正确答案）。
 * 按词书内存缓存（词库导入后基本不变）。
 */

export interface WordMeta {
  id: number
  word: string
  phoneticUs: string | null
  translations: { translation: string; type?: string }[]
}

interface PoolEntry {
  id: number
  word: string
  phoneticUs: string | null
  translations: { translation: string; type?: string }[]
  texts: string[]
  charSet: Set<string>
  primaryType: string | null
  firstTranslation: { translation: string; type?: string }
}

const poolCache = new Map<number, PoolEntry[]>()

function normalizeText(s: string): string {
  return s.trim()
}

function loadPool(bookId: number): PoolEntry[] {
  const cached = poolCache.get(bookId)
  if (cached) return cached
  const rows = db
    .prepare('SELECT id, word, phonetic_us, translations FROM words WHERE book_id = ?')
    .all(bookId) as { id: number; word: string; phonetic_us: string | null; translations: string }[]
  const pool: PoolEntry[] = rows.map((r) => {
    const translations = JSON.parse(r.translations) as { translation: string; type?: string }[]
    const texts = translations.map((t) => normalizeText(t.translation))
    const charSet = new Set<string>()
    for (const t of texts) {
      for (const ch of t) {
        if (/[一-鿿]/.test(ch)) charSet.add(ch)
      }
    }
    return {
      id: r.id,
      word: r.word,
      phoneticUs: r.phonetic_us,
      translations,
      texts,
      charSet,
      primaryType: translations[0]?.type ?? null,
      firstTranslation: translations[0] ?? { translation: '' },
    }
  })
  poolCache.set(bookId, pool)
  return pool
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...Array(n).fill(0)]
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = curr
  }
  return prev[n]
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 随机抽取 n 个（不足则全量返回） */
function sample<T>(arr: T[], n: number): T[] {
  return shuffle([...arr]).slice(0, n)
}

/** 歧义过滤：干扰词与正确词存在相同释义则排除 */
function isAmbiguous(c: PoolEntry, w: PoolEntry): boolean {
  return c.texts.some((t) => w.texts.includes(t))
}

/** 常见派生/屈折后缀 */
const DERIVED_SUFFIXES = [
  's', 'es', 'ed', 'ing', 'er', 'est', 'ly', 'ion', 'tion', 'ation', 'sion', 'ment', 'ness',
  'able', 'ible', 'ive', 'al', 'ical', 'ic', 'y', 'en', 'ence', 'ance', 'ant', 'ent',
  'ous', 'ful', 'less', 'ity', 'ism', 'ist', 'ize', 'ise', 'ish', 'ship', 'hood', 'or',
]

/** 变形词判断：
 *  1. 一个词是另一个词加常见后缀（如 attract/attractive、obvious/obviously、act/actor）
 *  2. 共享词干、双方词尾均为常见后缀（如 attractive/attraction → attract+ive/ion） */
export function isDerived(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length >= 3 && long.startsWith(short) && DERIVED_SUFFIXES.includes(long.slice(short.length))) {
    return true
  }
  const minLen = Math.min(a.length, b.length)
  for (let s = 3; s < minLen; s++) {
    if (a.slice(0, s) === b.slice(0, s)) {
      const ra = a.slice(s)
      const rb = b.slice(s)
      if (ra && rb && DERIVED_SUFFIXES.includes(ra) && DERIVED_SUFFIXES.includes(rb)) return true
    }
  }
  return false
}

/** 为正确词 w 挑选 3 个干扰词：2 个拼写接近 + 1 个意思接近（不足则随机补齐） */
function pickDistractors(w: PoolEntry, pool: PoolEntry[]): PoolEntry[] {
  const spelling: { c: PoolEntry; d: number }[] = []
  const meaning: { c: PoolEntry; j: number }[] = []
  const wl = w.word.length
  const wLower = w.word.toLowerCase()

  for (const c of pool) {
    if (c.id === w.id || isAmbiguous(c, w)) continue
    // 减少变形词（同词根加后缀）作为干扰项
    if (isDerived(c.word, w.word)) continue
    const lenDiff = Math.abs(c.word.length - wl)
    if (lenDiff <= 1) {
      const d = levenshtein(c.word.toLowerCase(), wLower)
      if (d >= 1 && d <= 2) spelling.push({ c, d })
    }
    let inter = 0
    for (const ch of c.charSet) {
      if (w.charSet.has(ch)) inter++
    }
    if (inter > 0) {
      const union = w.charSet.size + c.charSet.size - inter
      const j = inter / union
      // 同词性加权，提高意思接近的置信度
      const score = j + (c.primaryType && c.primaryType === w.primaryType ? 0.15 : 0)
      if (j >= 0.25) meaning.push({ c, j: score })
    }
  }
  spelling.sort((a, b) => a.d - b.d || Math.abs(a.c.word.length - wl) - Math.abs(b.c.word.length - wl))
  meaning.sort((a, b) => b.j - a.j)

  const chosen: PoolEntry[] = []
  const used = new Set<number>()

  // 2 个拼写接近：从编辑距离最近的一档随机抽，不足再从下一档随机补
  const bestD = spelling[0]?.d ?? 2
  const tier1 = spelling.filter((s) => s.d === bestD)
  const tier2 = spelling.filter((s) => s.d === bestD + 1)
  for (const s of sample(tier1, 2).concat(sample(tier2, 2))) {
    if (chosen.length >= 2) break
    if (!used.has(s.c.id)) {
      chosen.push(s.c)
      used.add(s.c.id)
    }
  }

  // 1 个意思接近：从相似度排名靠前的一批里随机抽
  const topMeaning = meaning.slice(0, Math.min(8, meaning.length))
  for (const m of sample(topMeaning, topMeaning.length)) {
    if (chosen.length >= 3) break
    if (!used.has(m.c.id)) {
      chosen.push(m.c)
      used.add(m.c.id)
    }
  }

  // 随机补齐（优先非变形词，实在不够再允许变形词兜底）
  if (chosen.length < 3) {
    const rest = shuffle(
      pool.filter((c) => !used.has(c.id) && c.id !== w.id && !isAmbiguous(c, w) && !isDerived(c.word, w.word)),
    )
    for (const c of rest) {
      if (chosen.length >= 3) break
      chosen.push(c)
      used.add(c.id)
    }
  }
  if (chosen.length < 3) {
    const fallback = shuffle(pool.filter((c) => !used.has(c.id) && c.id !== w.id && !isAmbiguous(c, w)))
    for (const c of fallback) {
      if (chosen.length >= 3) break
      chosen.push(c)
      used.add(c.id)
    }
  }
  return chosen
}

export interface QuestionOption {
  wordId: number
  text: string
  type: string | null
  /** 中→英模式的选项词释义（答错后展示干扰项的汉语与词性） */
  translations?: { text: string; type?: string }[]
}

export interface Question {
  wordId: number
  mode: 'zh2en' | 'en2zh'
  /** 题目：zh2en 为释义列表；en2zh 为单词+音标 */
  prompt: { word?: string; phoneticUs?: string | null; translations?: { text: string; type?: string }[] }
  options: QuestionOption[]
  correctIndex: number
}

function buildOne(w: PoolEntry, mode: 'zh2en' | 'en2zh', pool: PoolEntry[]): Question {
  const distractors = pickDistractors(w, pool)
  if (mode === 'zh2en') {
    // 题干：汉语释义（含词性）；选项：英文单词（携带释义，答错后展示干扰项汉语与词性）
    const options: QuestionOption[] = [
      { wordId: w.id, text: w.word, type: null, translations: w.translations.slice(0, 2).map((t) => ({ text: t.translation, type: t.type })) },
      ...distractors.map((d) => ({
        wordId: d.id,
        text: d.word,
        type: null,
        translations: d.translations.slice(0, 2).map((t) => ({ text: t.translation, type: t.type })),
      })),
    ]
    const shuffled = shuffle(options.map((o, i) => ({ o, i })))
    return {
      wordId: w.id,
      mode,
      prompt: { translations: w.translations.slice(0, 4).map((t) => ({ text: t.translation, type: t.type })) },
      options: shuffled.map((x) => x.o),
      correctIndex: shuffled.findIndex((x) => x.i === 0),
    }
  }
  // en2zh：题干为英文单词；选项为汉语释义（含词性）
  const options: QuestionOption[] = [
    { wordId: w.id, text: w.firstTranslation.translation, type: w.firstTranslation.type ?? null },
    ...distractors.map((d) => ({
      wordId: d.id,
      text: d.firstTranslation.translation,
      type: d.firstTranslation.type ?? null,
    })),
  ]
  const shuffled = shuffle(options.map((o, i) => ({ o, i })))
  return {
    wordId: w.id,
    mode,
    prompt: { word: w.word, phoneticUs: w.phoneticUs },
    options: shuffled.map((x) => x.o),
    correctIndex: shuffled.findIndex((x) => x.i === 0),
  }
}

export function getWordMeta(wordId: number): WordMeta | undefined {
  const row = db
    .prepare('SELECT id, word, phonetic_us, translations FROM words WHERE id = ?')
    .get(wordId) as { id: number; word: string; phonetic_us: string | null; translations: string } | undefined
  if (!row) return undefined
  return { id: row.id, word: row.word, phoneticUs: row.phonetic_us, translations: JSON.parse(row.translations) }
}

/** 批量生成题目：按单词所属词书分组（学习单本、复习可跨词书） */
export function buildQuestions(wordIds: number[], mode: 'zh2en' | 'en2zh'): Question[] {
  if (wordIds.length === 0) return []
  const placeholders = wordIds.map(() => '?').join(',')
  const rows = db
    .prepare(`SELECT id, book_id FROM words WHERE id IN (${placeholders})`)
    .all(...wordIds) as { id: number; book_id: number }[]
  const byBook = new Map<number, number[]>()
  for (const r of rows) {
    const arr = byBook.get(r.book_id) ?? []
    arr.push(r.id)
    byBook.set(r.book_id, arr)
  }
  const questions: Question[] = []
  for (const [bookId, ids] of byBook) {
    const pool = loadPool(bookId)
    const byId = new Map(pool.map((p) => [p.id, p]))
    for (const id of ids) {
      const w = byId.get(id)
      if (w) questions.push(buildOne(w, mode, pool))
    }
  }
  return questions
}
