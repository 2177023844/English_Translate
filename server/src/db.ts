import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config, ROOT_DIR, resolveDbPath } from './config.js'

const dbPath = resolveDbPath(config.DATABASE_PATH)
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/** 极简迁移 runner：按文件名顺序执行 migrations/*.sql，已应用的版本记录在 schema_migrations */
export function runMigrations(): void {
  const dir = path.join(ROOT_DIR, 'server', 'migrations')
  if (!fs.existsSync(dir)) {
    throw new Error(`迁移目录不存在: ${dir}`)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch()*1000)
  )`)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  const appliedStmt = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
  const markStmt = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)')
  for (const file of files) {
    const version = file.replace(/\.sql$/, '')
    if (appliedStmt.get(version)) continue
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    db.transaction(() => {
      db.exec(sql)
      markStmt.run(version)
    })()
    console.log(`[db] 迁移已应用: ${file}`)
  }
}
