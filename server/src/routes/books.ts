import { Router } from 'express'
import { db } from '../db.js'
import { startOfTodayMs, toWordView } from '../utils.js'

export const booksRouter = Router()

/** GET /api/books — 词书列表（含当前用户已学/待复习数） */
booksRouter.get('/', (req, res) => {
  const userId = req.userId!
  const now = Date.now()
  const rows = db
    .prepare(
      `SELECT wb.id, wb.code, wb.name, wb.description, wb.word_count, wb.sort_order,
        (SELECT COUNT(*) FROM learning_records lr WHERE lr.user_id = ? AND lr.book_id = wb.id AND lr.state != 'New') AS learned_count,
        (SELECT COUNT(*) FROM learning_records lr WHERE lr.user_id = ? AND lr.book_id = wb.id AND lr.state != 'New' AND lr.due <= ?) AS due_count
       FROM word_books wb ORDER BY wb.sort_order`,
    )
    .all(userId, userId, now)
  res.json({ books: rows })
})

/** GET /api/books/:bookId/words/new?limit=&extra=1 — 未学新词，受每日新词限额约束；
 *  extra=1 时忽略每日限额（"再学一组"），仍受词书剩余未学词限制。 */
booksRouter.get('/:bookId/words/new', (req, res) => {
  const userId = req.userId!
  const bookId = Number(req.params.bookId)
  if (!Number.isInteger(bookId) || bookId <= 0) {
    res.status(400).json({ error: '词书 ID 无效' })
    return
  }
  const requested = Math.min(Math.max(Number(req.query.limit) || 20, 1), 500)
  const isExtra = req.query.extra === '1' || req.query.extra === 'true'
  /** 只取剩余额度/剩余词数，不返回单词（断点续学页面用来恢复进度提示） */
  const isMeta = req.query.meta === '1' || req.query.meta === 'true'

  // 未学词：没有学习记录，或者只有一条收藏产生的 New 空记录（收藏不算已学）
  const unlearnedCond = "(lr.id IS NULL OR (lr.state = 'New' AND lr.reps = 0))"
  const unlearned = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM words w
         LEFT JOIN learning_records lr ON lr.word_id = w.id AND lr.user_id = ?
         WHERE w.book_id = ? AND ${unlearnedCond}`,
      )
      .get(userId, bookId) as { c: number }
  ).c

  let limit = requested
  let remaining = 0
  if (!isExtra) {
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as
      | { daily_groups: number; group_size: number }
      | undefined
    // 每日学习总量（词数）= 每天组数 × 每组数量
    const dailyLimit = (settings?.daily_groups ?? 2) * (settings?.group_size ?? 10)
    const todayStart = startOfTodayMs()
    // 按“首次学习时间”去重统计：重复作答/重推不会多占额度，答错也能正确占用额度
    const learnedToday = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM (
             SELECT word_id, MIN(created_at) AS first_at
             FROM review_logs WHERE user_id = ? GROUP BY word_id
           ) AS f WHERE f.first_at >= ?`,
        )
        .get(userId, todayStart) as { c: number }
    ).c
    remaining = Math.max(0, dailyLimit - learnedToday)
    limit = Math.min(requested, remaining)
  }

  if (isMeta) {
    res.json({ words: [], remainingToday: remaining, hasMore: unlearned > 0 })
    return
  }
  if (limit <= 0) {
    res.json({ words: [], remainingToday: remaining, hasMore: unlearned > 0 })
    return
  }

  const rows = db
    .prepare(
      `SELECT w.* FROM words w
       LEFT JOIN learning_records lr ON lr.word_id = w.id AND lr.user_id = ?
       WHERE w.book_id = ? AND ${unlearnedCond}
       ORDER BY w.chapter_no ASC LIMIT ?`,
    )
    .all(userId, bookId, limit)
  res.json({
    words: rows.map(toWordView),
    remainingToday: isExtra ? 0 : remaining - rows.length,
    hasMore: unlearned - rows.length > 0,
  })
})
