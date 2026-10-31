import { db } from '../db.js'

/** 试卷等级与场次说明 */
export const PAPER_LEVELS = [
  { code: 'CET4', name: '四级', fullName: '大学英语四级考试' },
  { code: 'CET6', name: '六级', fullName: '大学英语六级考试' },
  { code: 'KY', name: '考研英语', fullName: '考研英语（一 / 二）' },
] as const

const FIRST_YEAR = 2000
/** 最近一次可查询到的考试：四级/六级 2026 年 6 月，考研英语 2026 年（2025 年 12 月考） */
const LAST_CET_YEAR = 2026
const LAST_KY_YEAR = 2026

const SESSION_NAMES: Record<string, string> = {
  H1: '上半年',
  H2: '下半年',
  A: '英语（一）',
  B: '英语（二）',
}

export function paperTitle(level: string, year: number, session: string): string {
  const levelName = level === 'CET4' ? '四级' : level === 'CET6' ? '六级' : '考研'
  if (level === 'KY') return `${year} 年考研${SESSION_NAMES[session]}真题`
  return `${year} 年${SESSION_NAMES[session]} ${levelName}真题`
}

/**
 * 幂等补齐试卷目录（只写元数据，不下载任何试卷内容）。
 * 覆盖 2000 年至最近一次考试的历次试卷：
 * - 四级 / 六级：每年上半年 + 下半年（2026 年下半年尚未举行）
 * - 考研英语：2000 年起每年英语（一）；英语（二）自 2010 年起
 */
export function ensurePaperCatalog(): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO papers (level, year, session, title) VALUES (?, ?, ?, ?)',
  )
  const tx = db.transaction(() => {
    for (const level of ['CET4', 'CET6'] as const) {
      for (let year = FIRST_YEAR; year <= LAST_CET_YEAR; year++) {
        insert.run(level, year, 'H1', paperTitle(level, year, 'H1'))
        if (year < LAST_CET_YEAR) insert.run(level, year, 'H2', paperTitle(level, year, 'H2'))
      }
    }
    for (let year = FIRST_YEAR; year <= LAST_KY_YEAR; year++) {
      insert.run('KY', year, 'A', paperTitle('KY', year, 'A'))
      if (year >= 2010) insert.run('KY', year, 'B', paperTitle('KY', year, 'B'))
    }
  })
  tx()
}
