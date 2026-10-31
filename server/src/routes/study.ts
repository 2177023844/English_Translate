import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { validateBody } from '../middleware/validate.js'
import { applyRating, cardToRow, newCard, Rating, rowToCard, type Grade, type RecordFields } from '../services/fsrs.js'
import { buildQuestions } from '../services/distractors.js'

export const studyRouter = Router()

/**
 * 推进/创建学习记录并写日志（所有学习动作的统一入口）。
 * 学习(study)：correct→Learn/1、wrong→Learn/0、unknown→Learn/0、skip→Skip/1
 * 复习(review)：correct→Good、wrong/unknown→Again、skip→Easy
 * 复习日志用 FSRS 评分，统计页和每日复习额度据此区分学习/复习。
 */
function advanceRecord(
  userId: number,
  word: { id: number; book_id: number },
  grade: Grade,
  log: { rating: string; isCorrect: number; typedText?: string; durationMs?: number },
): RecordFields {
  const existing = db
    .prepare('SELECT * FROM learning_records WHERE user_id = ? AND word_id = ?')
    .get(userId, word.id) as RecordFields & { id: number } | undefined
  const card = existing ? rowToCard(existing) : newCard()
  const next = applyRating(card, grade)
  const fields = cardToRow(next)
  const now = Date.now()

  const update = db.prepare(
    `UPDATE learning_records SET state=?, due=?, stability=?, difficulty=?, elapsed_days=?,
       scheduled_days=?, learning_steps=?, reps=?, lapses=?, last_review=?, updated_at=? WHERE id=?`,
  )
  const insert = db.prepare(
    `INSERT INTO learning_records
       (user_id, word_id, book_id, state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertLog = db.prepare(
    `INSERT INTO review_logs (user_id, word_id, book_id, rating, typed_text, is_correct, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  db.transaction(() => {
    if (existing) {
      update.run(
        fields.state, fields.due, fields.stability, fields.difficulty, fields.elapsed_days,
        fields.scheduled_days, fields.learning_steps, fields.reps, fields.lapses, fields.last_review, now, existing.id,
      )
    } else {
      insert.run(
        userId, word.id, word.book_id, fields.state, fields.due, fields.stability, fields.difficulty,
        fields.elapsed_days, fields.scheduled_days, fields.learning_steps, fields.reps, fields.lapses, fields.last_review, now,
      )
    }
    insertLog.run(
      userId, word.id, word.book_id, log.rating, log.typedText ?? null, log.isCorrect, log.durationMs ?? null, now,
    )
  })()

  return fields
}

function getWordOr404(wordId: number) {
  return db.prepare('SELECT id, word, book_id FROM words WHERE id = ?').get(wordId) as
    | { id: number; word: string; book_id: number }
    | undefined
}

// ==================== 选择题学习 ====================

const questionsSchema = z.object({
  wordIds: z.array(z.number().int().positive()).min(1).max(500),
  mode: z.enum(['zh2en', 'en2zh']),
})

/** POST /api/study/questions — 批量生成四选一题目（干扰项：拼写接近 + 意思接近；支持跨词书） */
studyRouter.post('/questions', validateBody(questionsSchema), (req, res) => {
  const { wordIds, mode } = req.body as z.infer<typeof questionsSchema>
  const questions = buildQuestions(wordIds, mode)
  res.json({ questions })
})

const contextSchema = z.enum(['study', 'review']).optional().default('study')

const answerSchema = z.object({
  wordId: z.number().int().positive(),
  mode: z.enum(['zh2en', 'en2zh']),
  choiceWordId: z.number().int().positive().optional(),
  choiceTranslation: z.string().max(200).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  /** 学习(study) 或 复习(review)：决定日志用 Learn/Skip 还是 FSRS 评分 */
  context: contextSchema,
})

/** POST /api/study/answer — 选择题作答（服务端判定） */
studyRouter.post('/answer', validateBody(answerSchema), (req, res) => {
  const userId = req.userId!
  const { wordId, mode, choiceWordId, choiceTranslation, durationMs, context } =
    req.body as z.infer<typeof answerSchema>
  const word = getWordOr404(wordId)
  if (!word) {
    res.status(404).json({ error: '单词不存在' })
    return
  }

  let correct = false
  if (mode === 'zh2en') {
    correct = choiceWordId === wordId
  } else {
    const row = db.prepare('SELECT translations FROM words WHERE id = ?').get(wordId) as
      | { translations: string }
      | undefined
    const texts = (JSON.parse(row?.translations ?? '[]') as { translation: string }[]).map((t) =>
      t.translation.trim(),
    )
    correct = texts.includes((choiceTranslation ?? '').trim())
  }

  const fields = advanceRecord(userId, word, correct ? Rating.Good : Rating.Again, {
    // 复习动作写 FSRS 评分，学习动作保留 Learn（统计/每日复习额度据此区分）
    rating: context === 'review' ? (correct ? 'Good' : 'Again') : 'Learn',
    isCorrect: correct ? 1 : 0,
    durationMs,
  })
  res.json({ isCorrect: correct, correctWord: word.word, record: fields })
})

const unknownSchema = z.object({
  wordId: z.number().int().positive(),
  durationMs: z.number().int().nonnegative().optional(),
  context: contextSchema,
})

/** POST /api/study/unknown — 不认识：FSRS 记 Again（近期会再次推送复习） */
studyRouter.post('/unknown', validateBody(unknownSchema), (req, res) => {
  const userId = req.userId!
  const { wordId, durationMs, context } = req.body as z.infer<typeof unknownSchema>
  const word = getWordOr404(wordId)
  if (!word) {
    res.status(404).json({ error: '单词不存在' })
    return
  }
  const fields = advanceRecord(userId, word, Rating.Again, {
    rating: context === 'review' ? 'Again' : 'Learn',
    isCorrect: 0,
    durationMs,
  })
  res.json({ record: fields })
})

const skipSchema = z.object({
  wordId: z.number().int().positive(),
  durationMs: z.number().int().nonnegative().optional(),
  context: contextSchema,
})

/** POST /api/study/skip — 跳过（认识）：FSRS 记 Easy，数天后仅出现在复习（测试） */
studyRouter.post('/skip', validateBody(skipSchema), (req, res) => {
  const userId = req.userId!
  const { wordId, durationMs, context } = req.body as z.infer<typeof skipSchema>
  const word = getWordOr404(wordId)
  if (!word) {
    res.status(404).json({ error: '单词不存在' })
    return
  }
  const fields = advanceRecord(userId, word, Rating.Easy, {
    rating: context === 'review' ? 'Easy' : 'Skip',
    isCorrect: 1,
    durationMs,
  })
  res.json({ record: fields })
})
