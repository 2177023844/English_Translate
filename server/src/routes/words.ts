import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { validateBody } from '../middleware/validate.js'
import { isDerived } from '../services/distractors.js'
import { mergeWordRows, type WordRow } from '../services/wordMerge.js'

export const wordsRouter = Router()

/** GET /api/words/:wordId — 单词完整信息（弹窗/详情页用），合并多本词书释义；
 *  附带收藏状态与词书来源 */
wordsRouter.get('/:wordId', (req, res) => {
  const wordId = Number(req.params.wordId)
  if (!Number.isInteger(wordId) || wordId <= 0) {
    res.status(400).json({ error: '单词 ID 无效' })
    return
  }
  const row = db.prepare('SELECT id, word FROM words WHERE id = ?').get(wordId) as
    | { id: number; word: string }
    | undefined
  if (!row) {
    res.status(404).json({ error: '单词不存在' })
    return
  }
  const rows = db
    .prepare('SELECT phonetic_us, phonetic_uk, translations, phrases, sentences FROM words WHERE word = ?')
    .all(row.word) as WordRow[]
  const bookRows = db
    .prepare(
      `SELECT DISTINCT wb.name FROM words w JOIN word_books wb ON wb.id = w.book_id
       WHERE w.word = ? ORDER BY wb.sort_order`,
    )
    .all(row.word) as { name: string }[]
  const fav = db
    .prepare('SELECT is_favorite FROM learning_records WHERE user_id = ? AND word_id = ?')
    .get(req.userId!, wordId) as { is_favorite: number } | undefined

  const merged = mergeWordRows(row.id, row.word, rows)

  // 该单词的其他变形（词根 + 常见后缀，如 attract → attractive/attraction）
  const cands = db
    .prepare(`SELECT DISTINCT word FROM words WHERE word LIKE ? || '%' OR ? LIKE word || '%'`)
    .all(row.word, row.word) as { word: string }[]
  const derivedForms = cands
    .map((c) => c.word)
    .filter((c) => c !== row.word && isDerived(row.word, c))
    .sort((a, b) => a.length - b.length)
    .slice(0, 12)

  // 规则变形：按词性生成（名词→复数；动词→时态；形容词→比较级）；
  // 常见不规则词跳过，避免 childs/sheeps/goed 之类的错误形式
  if (!IRREGULAR_WORDS.has(row.word)) {
    const types = new Set(
      merged.translations.map((t) => t.type).filter(Boolean).flatMap((t) => String(t).split('&')),
    )
    for (const f of regularInflections(row.word, types)) {
      if (!derivedForms.includes(f)) derivedForms.push(f)
    }
  }

  res.json({
    word: {
      ...merged,
      bookNames: bookRows.map((b) => b.name),
      isFavorite: (fav?.is_favorite ?? 0) === 1,
      derivedForms,
    },
  })
})

/** 常见不规则变形词：跳过规则生成，避免错误形式（childs/sheeps/goed 等） */
const IRREGULAR_WORDS = new Set([
  'child', 'man', 'woman', 'foot', 'tooth', 'mouse', 'person', 'people', 'sheep', 'deer', 'fish',
  'go', 'be', 'have', 'do', 'make', 'take', 'give', 'come', 'see', 'know', 'get', 'find', 'think',
  'say', 'tell', 'become', 'leave', 'feel', 'bring', 'begin', 'keep', 'hold', 'write', 'stand',
  'hear', 'let', 'mean', 'run', 'pay', 'sit', 'speak', 'lie', 'lead', 'read', 'grow', 'lose',
  'fall', 'send', 'build', 'understand', 'draw', 'break', 'spend', 'cut', 'cost', 'hit', 'put',
  'set', 'meet', 'buy', 'fight', 'catch', 'teach', 'sing', 'drive', 'ride', 'rise', 'choose',
  'eat', 'drink', 'sleep', 'fly', 'throw', 'wear', 'win', 'forget', 'forgive', 'hide', 'beat',
  'bite', 'blow', 'swim', 'dig', 'stick', 'ring', 'shake', 'shoot', 'steal', 'sweep', 'wake',
  'weep', 'hurt', 'quit', 'burst', 'cast', 'shed', 'spread', 'bear', 'bend', 'bet', 'bid',
  'bind', 'bleed', 'breed', 'burn', 'creep', 'deal', 'dream', 'feed', 'flee', 'freeze', 'grind',
  'hang', 'kneel', 'lay', 'lean', 'leap', 'light', 'mistake', 'overcome', 'prove', 'seek', 'sell',
  'sew', 'shave', 'shine', 'shrink', 'shut', 'sink', 'slide', 'smell', 'sow', 'spin', 'spit',
  'split', 'spring', 'sting', 'stink', 'stride', 'strike', 'swear', 'swell', 'swing', 'tear',
  'thrive', 'tread', 'upset', 'weave', 'wind', 'withdraw', 'wring', 'good', 'bad', 'far', 'little',
  'many', 'much',
])

/** 生成规则变形：按词性生成（名词→复数；动词→过去式/进行时/三单；形容词→比较级/最高级） */
function regularInflections(word: string, types: Set<string>): string[] {
  const out = new Set<string>()
  const ends = (s: string) => word.endsWith(s)
  const vowelY = /[aeiou]y$/.test(word)
  const groups = word.match(/[aeiouy]+/g)?.length ?? 1
  const cvc = groups === 1 && /[^aeiou][aeiou][^aeiouwxy]$/.test(word)
  const hasN = types.size === 0 || [...types].some((t) => t === 'n')
  const hasV = [...types].some((t) => t === 'v' || t === 'vi' || t === 'vt')
  const hasAdj = [...types].some((t) => t === 'adj')

  if (hasN) {
    // 名词复数
    if (ends('y') && !vowelY) out.add(word.slice(0, -1) + 'ies')
    else if (ends('s') || ends('x') || ends('ch') || ends('sh')) out.add(word + 'es')
    else out.add(word + 's')
  }
  if (hasV) {
    // 动词过去式/过去分词/进行时
    if (ends('e')) {
      out.add(word + 'd')
      out.add(word.slice(0, -1) + 'ing')
    } else if (ends('y') && !vowelY) {
      out.add(word.slice(0, -1) + 'ied')
      out.add(word + 'ing')
    } else if (cvc) {
      const last = word.slice(-1)
      out.add(word + last + 'ed')
      out.add(word + last + 'ing')
    } else {
      out.add(word + 'ed')
      out.add(word + 'ing')
    }
    // 三单
    if (ends('s') || ends('x') || ends('ch') || ends('sh') || ends('o')) out.add(word + 'es')
    else if (ends('y') && !vowelY) out.add(word.slice(0, -1) + 'ies')
    else out.add(word + 's')
  }
  if (hasAdj) {
    for (const f of adjectiveForms(word)) out.add(f)
  }
  return [...out].filter((f) => f && f !== word)
}

/** 形容词比较级/最高级：处理辅音+y、词尾 e、单音节 CVC 双写；多音节长词不硬造 */
function adjectiveForms(word: string): string[] {
  if (word.length < 2) return []
  const groups = word.match(/[aeiouy]+/g)?.length ?? 1
  if (groups > 3 || word.length > 8) return []
  // -ful/-less/-ous/-ive/-ic/-al/-ent/-ant 等多音节后缀通常用 more/most
  if (groups > 1 && /(ful|less|ous|ive|ic|al|ent|ant)$/.test(word)) return []

  if (/[^aeiou]y$/.test(word)) {
    return [word.slice(0, -1) + 'ier', word.slice(0, -1) + 'iest']
  }
  if (/e$/.test(word)) {
    return [word + 'r', word + 'st']
  }
  if (groups === 1 && /[^aeiou][aeiou][^aeiouwxy]$/.test(word)) {
    const last = word.slice(-1)
    return [word + last + 'er', word + last + 'est']
  }
  return [word + 'er', word + 'est']
}

const favoriteSchema = z.object({ isFavorite: z.boolean() })

/** PUT /api/words/:wordId/favorite — 收藏/取消收藏 */
wordsRouter.put('/:wordId/favorite', validateBody(favoriteSchema), (req, res) => {
  const userId = req.userId!
  const wordId = Number(req.params.wordId)
  if (!Number.isInteger(wordId) || wordId <= 0) {
    res.status(400).json({ error: '单词 ID 无效' })
    return
  }
  const word = db.prepare('SELECT id, book_id FROM words WHERE id = ?').get(wordId) as
    | { id: number; book_id: number }
    | undefined
  if (!word) {
    res.status(404).json({ error: '单词不存在' })
    return
  }
  const { isFavorite } = req.body as z.infer<typeof favoriteSchema>

  const existing = db
    .prepare(
      'SELECT id, state, reps FROM learning_records WHERE user_id = ? AND word_id = ?',
    )
    .get(userId, wordId) as { id: number; state: string; reps: number } | undefined

  if (existing) {
    if (!isFavorite && existing.state === 'New' && existing.reps === 0) {
      // 只是收藏、还没真正学过：取消收藏时直接删掉这条空记录，避免留下“假学习记录”
      db.prepare('DELETE FROM learning_records WHERE id = ?').run(existing.id)
    } else {
      db.prepare(
        'UPDATE learning_records SET is_favorite = ?, updated_at = ? WHERE user_id = ? AND word_id = ?',
      ).run(isFavorite ? 1 : 0, Date.now(), userId, wordId)
    }
  } else if (isFavorite) {
    // 未学过的词只建一条 New 空记录存收藏状态；新词队列会把这类记录视为未学
    db.prepare(
      'INSERT INTO learning_records (user_id, word_id, book_id, is_favorite, updated_at) VALUES (?, ?, ?, 1, ?)',
    ).run(userId, wordId, word.book_id, Date.now())
  }

  res.json({ wordId, isFavorite })
})
