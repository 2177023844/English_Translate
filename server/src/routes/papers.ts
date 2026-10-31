import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { ROOT_DIR } from '../config.js'
import { db } from '../db.js'

export const papersRouter = Router()

const PAPERS_DIR = path.join(ROOT_DIR, 'server', 'data', 'papers')
/** 上传先落到临时目录，再移到 p{id}/，避免大文件全部堆在内存里 */
const TMP_DIR = path.join(PAPERS_DIR, '.tmp')
fs.mkdirSync(TMP_DIR, { recursive: true })
// 上次进程异常退出可能留下临时文件，启动时清理
try {
  for (const f of fs.readdirSync(TMP_DIR)) fs.unlinkSync(path.join(TMP_DIR, f))
} catch {
  // 清理失败不影响启动
}

/** 可上传/预览的文件类型（pdf、多页图片、听力音频、文本） */
const ALLOWED_EXT = new Set([
  'pdf', 'docx',
  'md', 'txt', 'json',
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'mp3', 'm4a', 'wav',
])
const TEXT_EXT = new Set(['md', 'txt', 'json'])
const MAX_FILE_SIZE = 30 * 1024 * 1024
const MAX_FILES = 20
/** 单次请求总大小上限（磁盘落盘也防止一次传几百 MB） */
const MAX_TOTAL_SIZE = 200 * 1024 * 1024

interface PaperFileRow {
  id: number
  paper_id: number
  name: string
  rel_path: string
  mime: string | null
  size: number
  sort_order: number
  created_at: string
}

/** 「已收录」判定：有正文、有主文件、有文件，或某一套已有结构化内容 */
const READY_SQL = `CASE WHEN (content IS NOT NULL AND content <> '') OR file_path IS NOT NULL
  OR EXISTS (SELECT 1 FROM paper_files pf WHERE pf.paper_id = papers.id)
  OR EXISTS (SELECT 1 FROM paper_sets ps WHERE ps.paper_id = papers.id
             AND ps.content IS NOT NULL AND ps.content <> '')
  THEN 1 ELSE 0 END`

const fileExt = (name: string) => path.extname(name).slice(1).toLowerCase()

/** 只保留文件名本身，去掉目录和特殊字符，避免路径穿越与非法文件名 */
function safeFileName(raw: string): string {
  const base = path.basename(raw).replace(/[^\w.\-一-龥]/g, '_').replace(/_+/g, '_')
  const trimmed = base.replace(/^[._]+/, '')
  return trimmed.slice(0, 120) || 'file'
}

/** 修复 multipart 文件名编码：busboy 默认按 latin1 解析，中文名会变乱码 */
function decodeFileName(raw: string): string {
  if (!/[\u0080-ÿ]/.test(raw)) return raw
  const bytes = Buffer.from(raw, 'latin1')
  const utf8 = bytes.toString('utf8')
  if (!utf8.includes('�')) return utf8
  // 浏览器一律发 UTF-8；少数命令行工具（Windows GBK 终端）会发 GBK，这里兜底
  try {
    const gbk = new TextDecoder('gbk').decode(bytes)
    if (!gbk.includes('�')) return gbk
  } catch {
    // 运行环境不支持 gbk 时保留原串
  }
  return raw
}

/** 把 rel_path 安全解析到 PAPERS_DIR 内 */
function resolveFile(relPath: string): string | null {
  const abs = path.resolve(PAPERS_DIR, relPath)
  if (abs !== PAPERS_DIR && !abs.startsWith(PAPERS_DIR + path.sep)) return null
  return abs
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ext = fileExt(decodeFileName(file.originalname))
    if (!ALLOWED_EXT.has(ext)) {
      cb(new Error(`不支持的文件类型：${ext ? '.' + ext : '未知'}`))
      return
    }
    cb(null, true)
  },
})

/** 把 multer 的错误翻译成中文，避免统一错误处理返回 500 */
function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  const declared = Number(req.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > MAX_TOTAL_SIZE) {
    res.status(413).json({
      error: `一次上传总大小不能超过 ${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)} MB`,
    })
    return
  }
  upload.array('files', MAX_FILES)(req, res, (err: unknown) => {
    if (!err) {
      next()
      return
    }
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `单个文件不能超过 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB`
          : err.code === 'LIMIT_FILE_COUNT'
            ? `一次最多上传 ${MAX_FILES} 个文件`
            : `上传失败：${err.message}`
      res.status(400).json({ error: message })
      return
    }
    res.status(400).json({ error: err instanceof Error ? err.message : '上传失败' })
  })
}

/** GET /api/papers — 试卷目录（按年份倒序，含是否已收录内容） */
papersRouter.get('/', (_req, res) => {
  const papers = db
    .prepare(
      `SELECT id, level, year, session, title, source, ${READY_SQL} AS ready
       FROM papers
       ORDER BY year DESC, session ASC`,
    )
    .all()
  res.json({ papers })
})

/** GET /api/papers/files/:fileId — 试卷文件（PDF / 图片 / 音频 / 文本），支持浏览器内直接打开 */
papersRouter.get('/files/:fileId', (req, res) => {
  const row = db
    .prepare('SELECT name, rel_path FROM paper_files WHERE id = ?')
    .get(Number(req.params.fileId)) as Pick<PaperFileRow, 'name' | 'rel_path'> | undefined
  if (!row) {
    res.status(404).json({ error: '文件不存在' })
    return
  }
  const abs = resolveFile(row.rel_path)
  if (!abs) {
    res.status(403).json({ error: '非法的文件路径' })
    return
  }
  if (!fs.existsSync(abs)) {
    res.status(404).json({ error: '文件已被移动或删除' })
    return
  }
  res.sendFile(abs, {
    headers: {
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    },
  })
})

/** GET /api/papers/:id/file — 兼容旧接口：主文件 */
papersRouter.get('/:id/file', (req, res) => {
  const id = Number(req.params.id)
  const first = db
    .prepare(
      'SELECT rel_path FROM paper_files WHERE paper_id = ? ORDER BY sort_order, id LIMIT 1',
    )
    .get(id) as { rel_path: string } | undefined
  const row =
    first ??
    (db.prepare('SELECT file_path AS rel_path FROM papers WHERE id = ?').get(id) as
      | { rel_path: string | null }
      | undefined)
  if (!row?.rel_path) {
    res.status(404).json({ error: '该试卷尚未导入文件' })
    return
  }
  const abs = resolveFile(row.rel_path)
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: '文件已被移动或删除' })
    return
  }
  res.sendFile(abs)
})

/** GET /api/papers/:id — 单套试卷详情（正文 + 文件列表） */
papersRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  const paper = db
    .prepare(
      `SELECT id, level, year, session, title, source, content, file_path, ${READY_SQL} AS ready
       FROM papers WHERE id = ?`,
    )
    .get(id)
  if (!paper) {
    res.status(404).json({ error: '试卷不存在' })
    return
  }
  const files = db
    .prepare(
      `SELECT id, name, mime, size, set_id, created_at FROM paper_files
       WHERE paper_id = ? ORDER BY sort_order, id`,
    )
    .all(id)
  const sets = db
    .prepare(
      `SELECT id, set_no, title,
         CASE WHEN content IS NOT NULL AND content <> '' THEN 1 ELSE 0 END AS hasContent
       FROM paper_sets WHERE paper_id = ? ORDER BY set_no`,
    )
    .all(id)
  res.json({ paper: { ...paper, files, sets } })
})

/** POST /api/papers/:id/files — 手动上传试卷文件（可一次多个：PDF + 答题卡 + 听力等） */
papersRouter.post('/:id/files', uploadMiddleware, (req, res) => {
  const id = Number(req.params.id)
  const paper = db
    .prepare('SELECT id, content, file_path FROM papers WHERE id = ?')
    .get(id) as { id: number; content: string | null; file_path: string | null } | undefined
  if (!paper) {
    res.status(404).json({ error: '试卷不存在' })
    return
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) {
    res.status(400).json({ error: '请选择要上传的文件' })
    return
  }

  const dir = path.join(PAPERS_DIR, `p${paper.id}`)
  fs.mkdirSync(dir, { recursive: true })

  const maxOrder = (
    db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM paper_files WHERE paper_id = ?')
      .get(paper.id) as { m: number }
  ).m
  const insertFile = db.prepare(
    `INSERT INTO paper_files (paper_id, name, rel_path, mime, size, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const saved: PaperFileRow[] = []
  const moved: string[] = []
  let textContent: string | null = null

  try {
    const write = db.transaction(() => {
      files.forEach((file, i) => {
        const name = decodeFileName(file.originalname)
        const ext = fileExt(name)
        const stored = `${crypto.randomUUID()}_${safeFileName(name)}`
        const destAbs = path.join(dir, stored)
        // 临时文件直接移到正式目录，避免把整个文件读进内存
        fs.renameSync(file.path, destAbs)
        moved.push(destAbs)
        const size = fs.statSync(destAbs).size
        const relPath = `p${paper.id}/${stored}`
        const info = insertFile.run(paper.id, name, relPath, file.mimetype, size, maxOrder + 1 + i)
        saved.push({
          id: Number(info.lastInsertRowid),
          paper_id: paper.id,
          name,
          rel_path: relPath,
          mime: file.mimetype,
          size,
          sort_order: maxOrder + 1 + i,
          created_at: new Date().toISOString(),
        })

        if (TEXT_EXT.has(ext) && size <= 2 * 1024 * 1024) {
          const text = fs.readFileSync(destAbs, 'utf8')
          if (ext === 'json') {
            try {
              JSON.parse(text)
              textContent = text
            } catch {
              // 非法 JSON：文件照常保存，但不作为试卷正文
            }
          } else {
            textContent = text
          }
        }
      })

      db.prepare(
        `UPDATE papers SET
           file_path = COALESCE(file_path, ?),
           content = COALESCE(?, content),
           source = '手动上传',
           updated_at = datetime('now')
         WHERE id = ?`,
      ).run(saved[0]?.rel_path ?? null, textContent, paper.id)
    })
    write()
  } catch (e) {
    // 事务失败时把已经移动的文件和残留临时文件都清理掉
    for (const p of moved) {
      try {
        fs.unlinkSync(p)
      } catch {
        // 忽略清理失败
      }
    }
    for (const f of files) {
      try {
        fs.unlinkSync(f.path)
      } catch {
        // 已移动或已清理
      }
    }
    throw e
  }

  res.json({
    ok: true,
    files: saved.map(({ id, name, mime, size, sort_order, created_at }) => ({
      id,
      name,
      mime,
      size,
      sort_order,
      created_at,
    })),
  })
})

/** DELETE /api/papers/files/:fileId — 删除单个文件，并修正主文件 / 正文 */
papersRouter.delete('/files/:fileId', (req, res) => {
  const row = db
    .prepare('SELECT * FROM paper_files WHERE id = ?')
    .get(Number(req.params.fileId)) as PaperFileRow | undefined
  if (!row) {
    res.status(404).json({ error: '文件不存在' })
    return
  }

  const abs = resolveFile(row.rel_path)
  if (abs && fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs)
    } catch {
      // 文件删不掉也照样移除记录，避免界面卡住
    }
  }

  const remove = db.transaction(() => {
    db.prepare('DELETE FROM paper_files WHERE id = ?').run(row.id)

    const paper = db
      .prepare('SELECT file_path FROM papers WHERE id = ?')
      .get(row.paper_id) as { file_path: string | null } | undefined
    const first = db
      .prepare('SELECT rel_path FROM paper_files WHERE paper_id = ? ORDER BY sort_order, id LIMIT 1')
      .get(row.paper_id) as { rel_path: string } | undefined

    if (paper?.file_path === row.rel_path) {
      db.prepare(`UPDATE papers SET file_path = ?, updated_at = datetime('now') WHERE id = ?`).run(
        first?.rel_path ?? null,
        row.paper_id,
      )
    }

    // 删除的是文本文件且已无其他文本文件时，同步清空正文
    if (TEXT_EXT.has(fileExt(row.name))) {
      const left = db
        .prepare('SELECT name FROM paper_files WHERE paper_id = ?')
        .all(row.paper_id) as { name: string }[]
      if (!left.some((f) => TEXT_EXT.has(fileExt(f.name)))) {
        db.prepare(`UPDATE papers SET content = NULL, updated_at = datetime('now') WHERE id = ?`).run(
          row.paper_id,
        )
      }
    }
  })
  remove()

  // 目录为空时顺手删掉，保持 data/papers 干净
  const dir = resolveFile(`p${row.paper_id}`)
  if (dir && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir)
  }

  res.json({ ok: true })
})
