import { Router } from 'express'
import { db } from '../db.js'
import { toWordView } from '../utils.js'

export const favoritesRouter = Router()

/** GET /api/favorites?bookId= — 生词本列表 */
favoritesRouter.get('/', (req, res) => {
  const userId = req.userId!
  const bookId = req.query.bookId ? Number(req.query.bookId) : null
  const rows = db
    .prepare(
      `SELECT w.*, lr.is_favorite, wb.name AS book_name, lr.updated_at AS fav_time
       FROM learning_records lr
       JOIN words w ON w.id = lr.word_id
       JOIN word_books wb ON wb.id = w.book_id
       WHERE lr.user_id = ? AND lr.is_favorite = 1 ${bookId ? 'AND w.book_id = ?' : ''}
       ORDER BY lr.updated_at DESC`,
    )
    .all(userId, ...(bookId ? [bookId] : [])) as Record<string, unknown>[]
  res.json({
    favorites: rows.map((r) => ({
      ...toWordView(r),
      bookName: r.book_name,
      favoritedAt: r.fav_time,
    })),
  })
})
