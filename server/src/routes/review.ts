import { Router } from 'express'
import { db } from '../db.js'
import { startOfTodayMs, toWordView } from '../utils.js'

export const reviewRouter = Router()

/** GET /api/review/queue?limit= — 到期卡片队列（due 升序，实时查询不物化）。
 *  受每日复习上限约束：今日已复习的数量会从可用额度中扣除，并返回 remainingToday。 */
reviewRouter.get('/queue', (req, res) => {
  const userId = req.userId!
  const requested = Math.min(Math.max(Number(req.query.limit) || 10, 1), 2000)

  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as
    | { daily_review_limit: number }
    | undefined
  const dailyLimit = settings?.daily_review_limit ?? 200
  const todayStart = startOfTodayMs()
  const reviewedToday = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM review_logs
         WHERE user_id = ? AND rating IN ('Again','Hard','Good','Easy') AND created_at >= ?`,
      )
      .get(userId, todayStart) as { c: number }
  ).c
  const remaining = Math.max(0, dailyLimit - reviewedToday)
  const limit = Math.min(requested, remaining)
  if (limit <= 0) {
    res.json({ queue: [], remainingToday: 0 })
    return
  }

  const rows = db
    .prepare(
      `SELECT lr.id AS record_id, lr.state, lr.due, lr.stability, lr.difficulty, lr.elapsed_days,
              lr.scheduled_days, lr.reps, lr.lapses, lr.last_review, lr.is_favorite,
              w.id, w.word, w.phonetic_us, w.phonetic_uk, w.translations, w.phrases, w.sentences
       FROM learning_records lr
       JOIN words w ON w.id = lr.word_id
       WHERE lr.user_id = ? AND lr.state != 'New' AND lr.due <= ?
       ORDER BY lr.due ASC LIMIT ?`,
    )
    .all(userId, Date.now(), limit) as Record<string, unknown>[]
  res.json({
    queue: rows.map((r) => ({
      record: {
        id: r.record_id, state: r.state, due: r.due, stability: r.stability, difficulty: r.difficulty,
        elapsedDays: r.elapsed_days, scheduledDays: r.scheduled_days, reps: r.reps, lapses: r.lapses,
        lastReview: r.last_review, isFavorite: r.is_favorite,
      },
      word: toWordView(r),
    })),
    remainingToday: remaining - rows.length,
  })
})

/** GET /api/review/due-count — 待复习数量（导航角标） */
reviewRouter.get('/due-count', (req, res) => {
  const userId = req.userId!
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM learning_records
       WHERE user_id = ? AND state != 'New' AND due <= ?`,
    )
    .get(userId, Date.now()) as { c: number }
  res.json({ count: row.c })
})
