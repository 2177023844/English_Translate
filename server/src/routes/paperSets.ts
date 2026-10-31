import { Router } from 'express'
import { db } from '../db.js'

export const paperSetsRouter = Router()

interface SetRow {
  id: number
  paper_id: number
  set_no: number
  title: string
  content: string | null
  level: string
  year: number
  session: string
}

/** GET /api/paper-sets/:setId — 某一套试卷的结构化内容（目录 + 文章 + 题目） */
paperSetsRouter.get('/:setId', (req, res) => {
  const row = db
    .prepare(
      `SELECT s.id, s.paper_id, s.set_no, s.title, s.content,
              p.level, p.year, p.session
       FROM paper_sets s JOIN papers p ON p.id = s.paper_id
       WHERE s.id = ?`,
    )
    .get(Number(req.params.setId)) as SetRow | undefined
  if (!row) {
    res.status(404).json({ error: '该套试卷不存在' })
    return
  }

  let content: unknown = null
  if (row.content) {
    try {
      content = JSON.parse(row.content)
    } catch {
      res.status(500).json({ error: '试卷内容格式有误，请重新导入' })
      return
    }
  }

  res.json({
    set: {
      id: row.id,
      paper_id: row.paper_id,
      set_no: row.set_no,
      title: row.title,
      level: row.level,
      year: row.year,
      session: row.session,
      content,
    },
  })
})
