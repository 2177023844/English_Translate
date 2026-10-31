/** 公共工具函数 */

/** 业务统一按北京时间（UTC+8）划分自然日，避免服务器部署在 UTC 时区时错位 */
export const DAY_MS = 24 * 3600 * 1000
export const APP_TZ_OFFSET_MS = 8 * 3600 * 1000

/** 今日（北京时间）零点，epoch ms */
export function startOfTodayMs(now: number = Date.now()): number {
  return Math.floor((now + APP_TZ_OFFSET_MS) / DAY_MS) * DAY_MS - APP_TZ_OFFSET_MS
}

/** N 天前（北京时间）零点，epoch ms */
export function startOfDaysAgoMs(days: number): number {
  return startOfTodayMs() - days * DAY_MS
}

/** 北京时间日期字符串 yyyy-MM-dd */
export function toDayString(ms: number): string {
  const d = new Date(ms + APP_TZ_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 解析 YYYY-MM-DD 为北京时间零点（epoch ms）；无效日期返回 null */
export function parseDayMs(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const ms = Date.UTC(year, month - 1, day) - APP_TZ_OFFSET_MS
  if (Number.isNaN(ms)) return null
  // Date.UTC 会把 2026-02-31 归一化成 3 月，这里回读校验
  const d = new Date(ms + APP_TZ_OFFSET_MS)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return null
  }
  return ms
}

/** words 表行 → 前端统一视图（JSON 列解析） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toWordView(row: any) {
  return {
    id: row.id as number,
    word: row.word as string,
    phoneticUs: row.phonetic_us ?? null,
    phoneticUk: row.phonetic_uk ?? null,
    translations: JSON.parse(row.translations || '[]'),
    phrases: JSON.parse(row.phrases || '[]'),
    sentences: JSON.parse(row.sentences || '[]'),
  }
}
