import { Router } from 'express'
import { db } from '../db.js'
import {
  DAY_MS,
  parseDayMs,
  startOfDaysAgoMs,
  startOfTodayMs,
  toDayString,
  toWordView,
} from '../utils.js'

export const statsRouter = Router()

/** 每个单词的首次学习时间（用于“今日新学”去重统计） */
const FIRST_LEARNED_SQL = `SELECT word_id, MIN(created_at) AS first_at
  FROM review_logs WHERE user_id = ? GROUP BY word_id`

const FSRS_RATINGS = "('Again','Hard','Good','Easy')"

/** GET /api/stats/overview — 概览卡片数据 */
statsRouter.get('/overview', (req, res) => {
  const userId = req.userId!
  const now = Date.now()
  const todayStart = startOfTodayMs()

  const totalLearned = (
    db.prepare(`SELECT COUNT(*) AS c FROM learning_records WHERE user_id = ? AND state != 'New'`).get(userId) as { c: number }
  ).c
  const totalDue = (
    db.prepare(`SELECT COUNT(*) AS c FROM learning_records WHERE user_id = ? AND state != 'New' AND due <= ?`).get(userId, now) as { c: number }
  ).c
  // 今日新学：今天首次出现的不同单词数（答错重推不重复计数）
  const learnedToday = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM (${FIRST_LEARNED_SQL}) AS f WHERE f.first_at >= ?`)
      .get(userId, todayStart) as { c: number }
  ).c
  // 今日复习：只统计复习动作产生的 FSRS 评分日志
  const reviewedToday = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM review_logs
         WHERE user_id = ? AND rating IN ${FSRS_RATINGS} AND created_at >= ?`,
      )
      .get(userId, todayStart) as { c: number }
  ).c
  const acc30 = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(is_correct) AS correct FROM review_logs
       WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, startOfDaysAgoMs(30)) as { total: number; correct: number | null }
  const avgAccuracy30d = acc30.total > 0 ? Math.round(((acc30.correct ?? 0) / acc30.total) * 100) : 0

  // 连续打卡：从今天（无记录则从昨天）向前数连续有学习记录的天数
  const dayRows = db
    .prepare(
      `SELECT DISTINCT date(created_at/1000, 'unixepoch', '+8 hours') AS day
       FROM review_logs WHERE user_id = ? ORDER BY day DESC`,
    )
    .all(userId) as { day: string }[]
  const days = new Set(dayRows.map((r) => r.day))
  let streakDays = 0
  let cursorMs = startOfTodayMs()
  if (!days.has(toDayString(cursorMs))) cursorMs -= DAY_MS
  while (days.has(toDayString(cursorMs)) && streakDays < dayRows.length) {
    streakDays++
    cursorMs -= DAY_MS
  }

  res.json({ totalLearned, totalDue, learnedToday, reviewedToday, avgAccuracy30d, streakDays })
})

/** GET /api/stats/daily?days=30&end=YYYY-MM-DD — 每日新学/复习/正确率（截至 end 日） */
statsRouter.get('/daily', (req, res) => {
  const userId = req.userId!
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
  const endParam = String(req.query.end ?? '')
  const endMs = endParam ? parseDayMs(endParam) : startOfTodayMs()
  if (endMs === null) {
    res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' })
    return
  }
  const rangeEnd = endMs + DAY_MS
  const rangeStart = endMs - (days - 1) * DAY_MS

  // 新学：按单词首次学习时间去重
  const newRows = db
    .prepare(
      `SELECT date(f.first_at/1000, 'unixepoch', '+8 hours') AS day, COUNT(*) AS new_count
       FROM (${FIRST_LEARNED_SQL}) AS f
       WHERE f.first_at >= ? AND f.first_at < ?
       GROUP BY day`,
    )
    .all(userId, rangeStart, rangeEnd) as { day: string; new_count: number }[]

  // 复习：只统计 FSRS 评分日志
  const reviewRows = db
    .prepare(
      `SELECT date(created_at/1000, 'unixepoch', '+8 hours') AS day, COUNT(*) AS review_count
       FROM review_logs
       WHERE user_id = ? AND rating IN ${FSRS_RATINGS} AND created_at >= ? AND created_at < ?
       GROUP BY day`,
    )
    .all(userId, rangeStart, rangeEnd) as { day: string; review_count: number }[]

  // 正确率：所有作答（含学习新词）
  const accRows = db
    .prepare(
      `SELECT date(created_at/1000, 'unixepoch', '+8 hours') AS day,
         SUM(is_correct) AS correct_count,
         COUNT(*) AS total_count
       FROM review_logs
       WHERE user_id = ? AND created_at >= ? AND created_at < ?
       GROUP BY day`,
    )
    .all(userId, rangeStart, rangeEnd) as {
    day: string
    correct_count: number | null
    total_count: number
  }[]

  const newByDay = new Map(newRows.map((r) => [r.day, r.new_count]))
  const reviewByDay = new Map(reviewRows.map((r) => [r.day, r.review_count]))
  const accByDay = new Map(accRows.map((r) => [r.day, r]))

  // 补齐缺失日期（无记录的天数为 0）
  const result: { date: string; newCount: number; reviewCount: number; accuracy: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = toDayString(endMs - i * DAY_MS)
    const acc = accByDay.get(day)
    result.push({
      date: day,
      newCount: newByDay.get(day) ?? 0,
      reviewCount: reviewByDay.get(day) ?? 0,
      accuracy: acc && acc.total_count > 0 ? Math.round(((acc.correct_count ?? 0) / acc.total_count) * 100) : 0,
    })
  }
  res.json({ daily: result })
})

/** GET /api/stats/words?date=YYYY-MM-DD&kind=learn|review — 某天学习/复习的具体单词 */
statsRouter.get('/words', (req, res) => {
  const userId = req.userId!
  const date = String(req.query.date ?? '')
  if (parseDayMs(date) === null) {
    res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' })
    return
  }
  const kind = req.query.kind === 'review' ? 'review' : 'learn'

  let rows: Record<string, unknown>[]
  if (kind === 'review') {
    rows = db
      .prepare(
        `SELECT w.id, w.word, w.phonetic_us, w.phonetic_uk, w.translations, w.phrases, w.sentences
         FROM review_logs l
         JOIN words w ON w.id = l.word_id
         WHERE l.user_id = ? AND date(l.created_at/1000, 'unixepoch', '+8 hours') = ?
           AND l.rating IN ${FSRS_RATINGS}
         GROUP BY w.id
         ORDER BY MAX(l.created_at) DESC
         LIMIT 300`,
      )
      .all(userId, date) as Record<string, unknown>[]
  } else {
    // 新学：当天首次学习的单词（不论第一次答对还是答错）
    rows = db
      .prepare(
        `SELECT w.id, w.word, w.phonetic_us, w.phonetic_uk, w.translations, w.phrases, w.sentences
         FROM (${FIRST_LEARNED_SQL}) AS f
         JOIN words w ON w.id = f.word_id
         WHERE date(f.first_at/1000, 'unixepoch', '+8 hours') = ?
         ORDER BY f.first_at DESC
         LIMIT 300`,
      )
      .all(userId, date) as Record<string, unknown>[]
  }
  res.json({ words: rows.map(toWordView) })
})

/** GET /api/stats/books — 各词书进度 */
statsRouter.get('/books', (req, res) => {
  const userId = req.userId!
  const rows = db
    .prepare(
      `SELECT wb.id, wb.code, wb.name, wb.word_count,
         COUNT(CASE WHEN lr.state != 'New' THEN 1 END) AS learned_count
       FROM word_books wb
       LEFT JOIN words w ON w.book_id = wb.id
       LEFT JOIN learning_records lr ON lr.word_id = w.id AND lr.user_id = ?
       GROUP BY wb.id ORDER BY wb.sort_order`,
    )
    .all(userId) as { id: number; code: string; name: string; word_count: number; learned_count: number | null }[]
  res.json({
    books: rows.map((r) => ({ ...r, learnedCount: r.learned_count ?? 0 })),
  })
})
