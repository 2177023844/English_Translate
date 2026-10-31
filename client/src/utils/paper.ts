import type { PaperSession } from '../api/types'

/** 场次显示名：四六级分上下半年，考研分英语（一）/（二） */
export const SESSION_LABEL: Record<PaperSession, string> = {
  H1: '上半年',
  H2: '下半年',
  A: '英语（一）',
  B: '英语（二）',
}
