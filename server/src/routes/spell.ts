import { Router } from 'express'
import { db } from '../db.js'
import { startOfTodayMs, toWordView } from '../utils.js'

export const spellRouter = Router()

/** GET /api/spell/words — 今天学过/复习过的单词（拼写测试用，按最近学习时间排序） */
spellRouter.get('/words', (req, res) => {
  const userId = req.userId!
  const todayStart = startOfTodayMs()
  const rows = db
    .prepare(
      `SELECT w.id, w.word, w.phonetic_us, w.phonetic_uk, w.translations, w.phrases, w.sentences
       FROM review_logs l
       JOIN words w ON w.id = l.word_id
       WHERE l.user_id = ? AND l.created_at >= ?
         AND (l.is_correct = 1 OR l.rating IN ('Again','Hard','Good','Easy'))
       GROUP BY w.id
       ORDER BY MAX(l.created_at) DESC
       LIMIT 300`,
    )
    .all(userId, todayStart) as Record<string, unknown>[]
  res.json({ words: rows.map(toWordView) })
})
