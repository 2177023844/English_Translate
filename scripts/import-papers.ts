/**
 * 试卷导入脚本：把你本地的试卷文件整份存入网站（数据库正文 + server/data/papers 原文件）。
 *
 * 版权提醒：历年真题的著作权归各自主办方/出版方所有。请只导入你本人已合法获得的试卷文件，
 * 不要用本脚本批量抓取、复制未获授权的真题内容。
 *
 * 文件命名：{等级}_{年份}_{场次}.{pdf|docx|md|txt|json|png|jpg|jpeg|webp|gif|mp3|m4a|wav}
 *   CET4_2024_H1.pdf   四级 2024 年上半年
 *   CET6_2023_H2.md    六级 2023 年下半年
 *   KY_2022_A.pdf      考研英语（一）2022 年
 *   KY_2022_B.txt      考研英语（二）2022 年
 *
 * 也可以直接打开网站「试卷」页面，点开某套试卷后把文件拖进去上传。
 *
 * 用法：
 *   npm run import:papers                  # 读取 scripts/papers/
 *   npm run import:papers -- --dir D:\我的试卷
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, runMigrations } from '../server/src/db.ts'
import { ROOT_DIR } from '../server/src/config.ts'
import { ensurePaperCatalog, paperTitle } from '../server/src/services/paperCatalog.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = path.join(__dirname, 'papers')
const OUT_DIR = path.join(ROOT_DIR, 'server', 'data', 'papers')
const NAME_RE =
  /^(CET4|CET6|KY)_(\d{4})_(H1|H2|A|B)\.(pdf|docx|md|txt|json|png|jpg|jpeg|webp|gif|mp3|m4a|wav)$/i
const TEXT_EXT = new Set(['md', 'txt', 'json'])
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
}

const args = process.argv.slice(2)
const dirFlag = args.indexOf('--dir')
const rawDir = dirFlag >= 0 && args[dirFlag + 1] ? args[dirFlag + 1] : null
// 相对路径按项目根目录解析（npm workspace 会把工作目录切到 scripts/）
const inDir = rawDir
  ? path.isAbsolute(rawDir)
    ? rawDir
    : path.resolve(ROOT_DIR, rawDir)
  : DEFAULT_DIR

runMigrations()
ensurePaperCatalog()
fs.mkdirSync(OUT_DIR, { recursive: true })

if (!fs.existsSync(inDir)) {
  console.log(`[papers] 导入目录不存在：${inDir}`)
  console.log('[papers] 请将试卷文件按命名规范放入该目录后重试，例如：CET4_2024_H1.pdf')
  process.exit(0)
}

const files = fs.readdirSync(inDir).filter((f) => NAME_RE.test(f)).sort()
const ignored = fs.readdirSync(inDir).filter((f) => !NAME_RE.test(f) && !f.startsWith('.'))

if (files.length === 0) {
  console.log(`[papers] 目录中没有符合命名规范的文件：${inDir}`)
  console.log('[papers] 命名示例：CET4_2024_H1.pdf、CET6_2023_H2.md、KY_2022_A.pdf')
  process.exit(0)
}

const findStmt = db.prepare(
  'SELECT id, title FROM papers WHERE level = ? AND year = ? AND session = ?',
)
const upsertStmt = db.prepare(
  `INSERT INTO papers (level, year, session, title, content, file_path, source, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
   ON CONFLICT(level, year, session) DO UPDATE SET
     -- 非文本文件 content 为 NULL，不能把之前导入的正文覆盖掉
     content = COALESCE(NULLIF(excluded.content, ''), content),
     file_path = excluded.file_path,
     source = excluded.source,
     updated_at = datetime('now')`,
)
const findFileStmt = db.prepare(
  'SELECT id FROM paper_files WHERE paper_id = ? AND rel_path = ?',
)
const updateFileStmt = db.prepare(
  'UPDATE paper_files SET name = ?, mime = ?, size = ? WHERE id = ?',
)
const maxOrderStmt = db.prepare(
  'SELECT COALESCE(MAX(sort_order), -1) AS m FROM paper_files WHERE paper_id = ?',
)
const insertFileStmt = db.prepare(
  'INSERT INTO paper_files (paper_id, name, rel_path, mime, size, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
)

let imported = 0
for (const file of files) {
  const m = file.match(NAME_RE)
  if (!m) continue
  const level = m[1].toUpperCase()
  const year = Number(m[2])
  const session = m[3].toUpperCase()
  const ext = m[4].toLowerCase()
  const src = path.join(inDir, file)
  const destName = `${level}_${year}_${session}.${ext}`
  const dest = path.join(OUT_DIR, destName)

  // 原文件整份保存到网站数据目录
  fs.copyFileSync(src, dest)

  // 文本类同时写入数据库正文，便于后续试卷界面直接读取
  let content: string | null = null
  if (TEXT_EXT.has(ext)) {
    content = fs.readFileSync(src, 'utf8')
    if (ext === 'json') {
      try {
        JSON.parse(content)
      } catch {
        console.warn(`[papers] ${file} 不是合法 JSON，正文未写入数据库（原文件仍已保存）`)
        content = null
      }
    }
  }

  const existing = findStmt.get(level, year, session) as
    | { id: number; title: string }
    | undefined
  upsertStmt.run(
    level,
    year,
    session,
    existing?.title ?? paperTitle(level, year, session),
    content,
    destName,
    '本地导入',
  )
  const paperId =
    existing?.id ??
    (db.prepare('SELECT id FROM papers WHERE level = ? AND year = ? AND session = ?').get(
      level,
      year,
      session,
    ) as { id: number }).id

  // 同步到 paper_files，网页端文件列表才能看到
  const size = fs.statSync(dest).size
  const fileRow = findFileStmt.get(paperId, destName) as { id: number } | undefined
  if (fileRow) {
    updateFileStmt.run(file, MIME[ext] ?? null, size, fileRow.id)
  } else {
    const maxOrder = (maxOrderStmt.get(paperId) as { m: number }).m
    insertFileStmt.run(paperId, file, destName, MIME[ext] ?? null, size, maxOrder + 1)
  }
  imported++
  console.log(`[papers] ✓ ${level} ${year} ${session} ← ${file}`)
}

console.log(`\n[papers] 完成：导入 ${imported} 套试卷`)
console.log(`[papers] 原文件已保存到：${OUT_DIR}`)
if (ignored.length > 0) {
  console.log(`[papers] 已跳过 ${ignored.length} 个不符合命名规范的文件`)
}
