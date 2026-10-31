import { Router } from 'express'
import { db } from '../db.js'
import { filterTranslationsBy, mergeWordRows, type WordRow } from '../services/wordMerge.js'

export const translateRouter = Router()

/** GET /api/translate/suggest?q= — 英文前缀联想。
 *  按覆盖词书数量排序（四级/六级/考研都收录的排最前），返回单词/词性/汉语/等级 */
translateRouter.get('/suggest', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  if (!q || /[一-鿿]/.test(q)) {
    res.json({ suggestions: [] })
    return
  }
  const rows = db
    .prepare(
      `SELECT w.word, wb.code, wb.name,
         (SELECT w2.translations FROM words w2 WHERE w2.word = w.word LIMIT 1) AS translations
       FROM words w
       JOIN word_books wb ON wb.id = w.book_id
       WHERE w.word LIKE ?
       LIMIT 20000`,
    )
    .all(`${q}%`) as { word: string; code: string; name: string; translations: string }[]

  const byWord = new Map<
    string,
    { word: string; bookCodes: string[]; bookNames: string[]; first: { translation: string; type?: string } | null }
  >()
  for (const r of rows) {
    const e = byWord.get(r.word)
    if (e) {
      if (!e.bookCodes.includes(r.code)) {
        e.bookCodes.push(r.code)
        e.bookNames.push(r.name)
      }
    } else {
      const list = JSON.parse(r.translations) as { translation: string; type?: string }[]
      byWord.set(r.word, {
        word: r.word,
        bookCodes: [r.code],
        bookNames: [r.name],
        first: list[0] ?? null,
      })
    }
  }

  const suggestions = [...byWord.values()]
    .sort((a, b) => b.bookCodes.length - a.bookCodes.length || a.word.localeCompare(b.word))
    .slice(0, 10)
    .map((s) => ({
      word: s.word,
      type: s.first?.type ?? null,
      translation: s.first?.translation ?? '',
      bookCount: s.bookCodes.length,
      bookNames: s.bookNames,
    }))
  res.json({ suggestions })
})

type Row = WordRow & { id: number; word: string }

/** GET /api/translate/search?q= — 输入汉语或英语查询单词
 *  - 英语：精确匹配 → 前缀匹配 → 包含匹配（按相关度排序）
 *  - 汉语：释义包含关键词，按匹配质量排序（整条释义相同 > 释义开头 > 释义中间），只保留命中义项 */
translateRouter.get('/search', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  if (!q) {
    res.json({ results: [] })
    return
  }
  const isChinese = /[一-鿿]/.test(q)

  const byWord = new Map<string, { id: number; rows: Row[] }>()
  const addRows = (rows: Row[]) => {
    for (const r of rows) {
      const entry = byWord.get(r.word)
      if (entry) entry.rows.push(r)
      else byWord.set(r.word, { id: r.id, rows: [r] })
    }
  }
  const selectSql =
    'SELECT id, word, phonetic_us, phonetic_uk, translations, phrases, sentences FROM words'

  if (isChinese) {
    // 先按释义质量评分排序
    const rows = db
      .prepare(`${selectSql} WHERE translations LIKE ? LIMIT 300`)
      .all(`%${q}%`) as Row[]
    const scoreOf = (r: Row): number => {
      let best = 2
      for (const t of JSON.parse(r.translations) as { translation: string }[]) {
        const text = t.translation.trim()
        if (text === q) return 0
        if (text.startsWith(q)) best = Math.min(best, 1)
      }
      return best
    }
    const scored = rows.map((r) => ({ r, s: scoreOf(r) })).sort((a, b) => a.s - b.s || a.r.word.localeCompare(b.r.word))
    for (const { r } of scored.slice(0, 60)) addRows([r])
  } else {
    // 英语：精确 → 前缀 → 包含
    addRows(db.prepare(`${selectSql} WHERE word = ?`).all(q) as Row[])
    addRows(db.prepare(`${selectSql} WHERE word LIKE ? LIMIT 80`).all(`${q}%`) as Row[])
    if (byWord.size < 40) {
      addRows(db.prepare(`${selectSql} WHERE word LIKE ? LIMIT 40`).all(`%${q}%`) as Row[])
    }
  }

  const results = [...byWord.entries()].slice(0, 50).map(([word, { id, rows }]) => {
    const merged = mergeWordRows(id, word, rows)
    // 中文搜索：只保留命中关键词的释义
    if (isChinese) merged.translations = filterTranslationsBy(merged.translations, q)
    return merged
  })

  res.json({ results })
})
