/**
 * 词库导入脚本（幂等）：从 KyleBing/english-vocabulary（BSD-3-Clause）下载
 * full_line_jsonl/sentence/正序/*.jsonl，归一化后写入 words 表，并种子 owner 用户。
 *
 * 用法：
 *   npm run seed                    # 全部词书（sources.json）
 *   npm run seed -- --books CET4,CET6   # 仅指定词书
 *   npm run seed -- --offline       # 不下载，仅使用本地缓存
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// 复用 server 的配置与迁移（tsx 可直接导入 TS 源文件）
import { db, runMigrations } from '../server/src/db.ts'
import { ROOT_DIR } from '../server/src/config.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, '.cache')

/** 已知源数据错误的释义清单（人工维护，见 overrides.json） */
const OVERRIDES = JSON.parse(fs.readFileSync(path.join(__dirname, 'overrides.json'), 'utf8')) as Record<
  string,
  { dropTranslations?: string[] }
>
const SOURCE_ATTRIBUTION = 'KyleBing/english-vocabulary (BSD-3-Clause) — https://github.com/KyleBing/english-vocabulary'
const BASE_URL = 'https://cdn.jsdelivr.net/gh/KyleBing/english-vocabulary@master/full_line_jsonl/sentence/正序/'
/** full 版数据集：例句与短语更丰富，用于补充基础数据 */
const FULL_URL = 'https://cdn.jsdelivr.net/gh/KyleBing/english-vocabulary@master/full_line_jsonl/full/正序/'

interface EnrichData {
  sentences: { sentence: string; translation?: string }[]
  phrases: { phrase: string; translation?: string }[]
}

interface WordLine {
  word: string
  us?: string
  uk?: string
  translations?: { translation: string; type?: string }[]
  phrases?: { phrase: string; translation?: string }[]
  sentences?: { sentence: string; translation?: string }[]
}

/** 词性标准化：统一缩写、去除杂质、拆分组合词性并去重（如 vi&vi&n → vi&n） */
const TYPE_MAP: Record<string, string> = {
  a: 'adj', ad: 'adv', adjective: 'adj', adverb: 'adv', verb: 'v',
  interjection: 'int', interj: 'int', inter: 'int',
  n: 'n', v: 'v', vt: 'vt', vi: 'vi', adj: 'adj', adv: 'adv',
  prep: 'prep', conj: 'conj', pron: 'pron', num: 'num', art: 'art', aux: 'aux', int: 'int', abbr: 'abbr',
}

function normalizeTranslationType(raw?: string): string | undefined {
  if (!raw) return undefined
  // 去掉括号注释等杂质（如 "(缩作OK)a&ad"、"(亦作...)"）
  const cleaned = raw.trim().replace(/（.*?）|\(.*?\)/g, '').trim()
  if (!cleaned) return undefined
  const parts = cleaned
    .split(/[&\s]+/)
    .map((p) => TYPE_MAP[p.toLowerCase()] ?? undefined)
    .filter((p): p is string => !!p)
  if (parts.length === 0) return undefined
  return [...new Set(parts)].join('&')
}

/** 释义文本清洗：去掉混入的音标（如 "实施[kən'dʌkt]"）、杂散字母（如 "方法 A"），压缩空白 */
function normalizeTranslationText(t: string): string {
  return t
    .replace(/\[[^\]]*['ˈˌ][^\]]*\]/g, '')
    .replace(/\s+[A-Z]\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 释义规范化：清洗文本与词性，同词性义项合并去重 */
function normalizeTranslations(
  list?: { translation: string; type?: string }[],
): { translation: string; type?: string }[] {
  const out: { translation: string; type?: string }[] = []
  for (const t of list ?? []) {
    const text = normalizeTranslationText(t.translation)
    if (!text) continue
    const type = normalizeTranslationType(t.type)
    const key = type ?? ''
    const existing = out.find((o) => (o.type ?? '') === key)
    if (existing) {
      const parts = existing.translation.split('；').concat(text.split('；')).map((s) => s.trim()).filter(Boolean)
      existing.translation = [...new Set(parts)].join('；')
    } else {
      out.push({ translation: text, type })
    }
  }
  return out
}

function parseArgs(argv: string[]) {
  const offline = argv.includes('--offline')
  const idx = argv.indexOf('--books')
  const filter = idx >= 0 && argv[idx + 1] ? argv[idx + 1].split(',') : null
  return { offline, filter }
}

async function ensureFile(url: string, cacheFile: string, offline: boolean): Promise<void> {
  if (offline) {
    if (!fs.existsSync(cacheFile)) throw new Error(`离线模式但缓存不存在: ${cacheFile}`)
    return
  }
  if (fs.existsSync(cacheFile)) {
    console.log(`  [缓存] 已存在，跳过下载: ${path.basename(cacheFile)}`)
    return
  }
  console.log(`  [下载] ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`)
  fs.writeFileSync(cacheFile, await res.text())
}

/** 解析 full 版 jsonl：按单词聚合例句与短语 */
function loadFullData(cacheFile: string): Map<string, EnrichData> {
  const map = new Map<string, EnrichData>()
  if (!fs.existsSync(cacheFile)) return map
  for (const line of fs.readFileSync(cacheFile, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const d = JSON.parse(line) as {
        headWord?: string
        content?: { word?: { content?: {
          sentence?: { sentences?: { sContent?: string; sCn?: string }[] }
          phrase?: { phrases?: { pContent?: string; pCn?: string }[] }
        } } }
      }
      const word = (d.headWord ?? '').trim().toLowerCase()
      if (!word) continue
      const c = d.content?.word?.content
      const sentences = (c?.sentence?.sentences ?? [])
        .map((s) => ({ sentence: (s.sContent ?? '').trim(), translation: (s.sCn ?? '').trim() }))
        .filter((s) => s.sentence)
      const phrases = (c?.phrase?.phrases ?? [])
        .map((p) => ({ phrase: (p.pContent ?? '').trim(), translation: (p.pCn ?? '').trim() }))
        .filter((p) => p.phrase)
      const existing = map.get(word)
      if (existing) {
        existing.sentences.push(...sentences)
        existing.phrases.push(...phrases)
      } else {
        map.set(word, { sentences, phrases })
      }
    } catch {
      // 跳过坏行
    }
  }
  return map
}

/** 按文本去重合并（保证幂等） */
function mergeUnique<T extends { sentence: string } | { phrase: string }>(base: T[], extra: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const t of [...base, ...extra]) {
    const k = key(t).trim()
    if (k && !seen.has(k)) {
      seen.add(k)
      out.push(t)
    }
  }
  return out
}

function seedBook(code: string, name: string, sortOrder: number, fullMap: Map<string, EnrichData>): number {
  const cacheFile = path.join(CACHE_DIR, `${code}.jsonl`)
  const lines = fs.readFileSync(cacheFile, 'utf8').split('\n')

  db.prepare(
    `INSERT INTO word_books (code, name, sort_order, source) VALUES (?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET name = excluded.name, source = excluded.source, sort_order = excluded.sort_order`,
  ).run(code, `${name}词汇`, sortOrder, SOURCE_ATTRIBUTION)
  const book = db.prepare('SELECT id FROM word_books WHERE code = ?').get(code) as { id: number }

  const upsert = db.prepare(
    `INSERT INTO words (book_id, word, phonetic_us, phonetic_uk, translations, phrases, sentences, chapter_no)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(book_id, word) DO UPDATE SET
       phonetic_us = excluded.phonetic_us, phonetic_uk = excluded.phonetic_uk,
       translations = excluded.translations, phrases = excluded.phrases,
       sentences = excluded.sentences, chapter_no = excluded.chapter_no`,
  )

  let count = 0
  let errors = 0
  const runBatch = db.transaction((rows: WordLine[]) => {
    for (const r of rows) {
      upsert.run(
        book.id, r.word, r.us ?? null, r.uk ?? null,
        JSON.stringify(r.translations ?? []), JSON.stringify(r.phrases ?? []),
        JSON.stringify(r.sentences ?? []), count,
      )
      count++
    }
  })

  let batch: WordLine[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const obj = JSON.parse(line) as WordLine
      if (!obj.word) { errors++; continue }
      // 词性/音标清洗 + 过滤人名条目（如 "(Afford)人名；(英)阿福德"）+ 应用人工错误清单
      const translations = normalizeTranslations(obj.translations).filter(
        (t) =>
          !/\([^)]*\)\s*人名/.test(t.translation) &&
          !(OVERRIDES[obj.word]?.dropTranslations ?? []).some((d) => t.translation === d),
      )
      // full 版数据补充例句与短语
      const extra = fullMap.get(obj.word)
      batch.push({
        word: obj.word,
        us: obj.us,
        uk: obj.uk,
        translations,
        phrases: mergeUnique(obj.phrases ?? [], extra?.phrases ?? [], (p) => p.phrase),
        sentences: mergeUnique(obj.sentences ?? [], extra?.sentences ?? [], (s) => s.sentence),
      })
      if (batch.length >= 2000) { runBatch(batch); batch = [] }
    } catch {
      errors++
    }
  }
  if (batch.length > 0) runBatch(batch)

  // 词书数量以实际写入的去重单词数为准（源数据里可能存在重复词条）
  const total = (
    db.prepare('SELECT COUNT(*) AS c FROM words WHERE book_id = ?').get(book.id) as { c: number }
  ).c
  db.prepare('UPDATE word_books SET word_count = ? WHERE id = ?').run(total, book.id)
  return total
}

async function main() {
  const { offline, filter } = parseArgs(process.argv.slice(2))
  const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources.json'), 'utf8')) as Record<string, string>

  runMigrations()

  // 种子 owner 用户与默认设置（单用户模式）
  db.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (1, ?)').run('owner')
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (1)').run()

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  console.log(`[seed] 词书来源: ${SOURCE_ATTRIBUTION}\n`)

  let sortOrder = 1
  let failed = false
  for (const [code, name] of Object.entries(sources)) {
    if (filter && !filter.includes(code)) continue
    const url = BASE_URL + encodeURIComponent(name) + '.jsonl'
    try {
      await ensureFile(url, path.join(CACHE_DIR, `${code}.jsonl`), offline)
      // full 版数据（例句/短语更丰富）；离线模式缺失时降级为基础数据
      let fullMap = new Map<string, EnrichData>()
      try {
        const fullCache = path.join(CACHE_DIR, `${code}_full.jsonl`)
        await ensureFile(FULL_URL + encodeURIComponent(name) + '.jsonl', fullCache, offline)
        fullMap = loadFullData(fullCache)
        console.log(`  [full] 丰富数据 ${fullMap.size} 词`)
      } catch (e) {
        console.warn(`  [full] ${code} 丰富数据不可用（使用基础例句）:`, (e as Error).message)
      }
      const count = seedBook(code, name, sortOrder, fullMap)
      console.log(`[seed] ${code} ${name}词汇: ${count} 词`)
    } catch (e) {
      failed = true
      console.error(`[seed] ${code} 失败:`, (e as Error).message)
    }
    sortOrder++
  }

  if (filter) {
    console.log('\n[seed] 完成（仅指定词书）。数据库路径: ' + path.join(ROOT_DIR, 'server/data/app.db'))
  } else {
    console.log('\n[seed] 全部完成。数据库路径: ' + path.join(ROOT_DIR, 'server/data/app.db'))
  }
  if (failed) process.exit(1)
}

main()
