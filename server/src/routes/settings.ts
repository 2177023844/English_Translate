import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'

export const settingsRouter = Router()

function getSettings(userId: number) {
  return (
    db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) ?? {
      user_id: userId,
      daily_groups: 2,
      daily_review_limit: 200,
      accent: 'us',
      auto_play_audio: 1,
      study_mode: 'zh2en',
      group_size: 10,
      spelling_enabled: 0,
    }
  )
}

function toResponse(s: Record<string, unknown>) {
  return {
    settings: {
      dailyGroups: s.daily_groups,
      dailyReviewLimit: s.daily_review_limit,
      accent: s.accent,
      autoPlayAudio: s.auto_play_audio === 1,
      studyMode: s.study_mode,
      groupSize: s.group_size,
      spellingEnabled: s.spelling_enabled === 1,
    },
  }
}

/** 词书最大单词数（设置上限 = 一本词书的内容数量） */
function maxBookWords(): number {
  const row = db.prepare('SELECT COALESCE(MAX(word_count), 0) AS m FROM word_books').get() as { m: number }
  return Math.max(5, row.m)
}

/** GET /api/settings */
settingsRouter.get('/', (req, res) => {
  res.json({ ...toResponse(getSettings(req.userId!) as Record<string, unknown>), maxBookWords: maxBookWords() })
})

/** PUT /api/settings — 每天学习组数（1 组起，上限 = 词书单词数/每组数量）；
 *  每天复习单词数 5 ~ 词书单词数；每组学习数量 1 ~ 词书单词数 */
settingsRouter.put('/', (req, res) => {
  const userId = req.userId!
  const maxWords = maxBookWords()
  const putSchema = z
    .object({
      dailyGroups: z.number().int().min(1).max(100000),
      dailyReviewLimit: z.number().int().min(5).max(maxWords),
      groupSize: z.number().int().min(1).max(maxWords),
      accent: z.enum(['us', 'uk']),
      autoPlayAudio: z.boolean(),
      studyMode: z.enum(['zh2en', 'en2zh']),
      spellingEnabled: z.boolean(),
    })
    .superRefine((v, ctx) => {
      // 每天学习总量 = 组数 × 每组数量，不能超过词书内容数量
      const maxGroups = Math.max(1, Math.ceil(maxWords / v.groupSize))
      if (v.dailyGroups > maxGroups) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dailyGroups'],
          message: `每组 ${v.groupSize} 个单词，每天最多 ${maxGroups} 组`,
        })
      }
    })
  const result = putSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: '参数错误', details: result.error.flatten() })
    return
  }
  const { dailyGroups, dailyReviewLimit, groupSize, accent, autoPlayAudio, studyMode, spellingEnabled } = result.data
  db.prepare(
    `INSERT INTO user_settings (user_id, daily_groups, daily_review_limit, accent, auto_play_audio, study_mode, group_size, spelling_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       daily_groups = excluded.daily_groups,
       daily_review_limit = excluded.daily_review_limit,
       accent = excluded.accent,
       auto_play_audio = excluded.auto_play_audio,
       study_mode = excluded.study_mode,
       group_size = excluded.group_size,
       spelling_enabled = excluded.spelling_enabled`,
  ).run(userId, dailyGroups, dailyReviewLimit, accent, autoPlayAudio ? 1 : 0, studyMode, groupSize, spellingEnabled ? 1 : 0)
  res.json({ ...toResponse(getSettings(userId) as Record<string, unknown>), maxBookWords: maxWords })
})
