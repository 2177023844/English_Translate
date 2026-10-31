import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs'

/**
 * ts-fsrs 唯一触点：卡片调度与 DB 行序列化都集中在这里。
 * 注意：Card.due 为 Date，入库时统一转为 epoch ms（SQLite 无日期类型）。
 * learning_steps 必须持久化，否则学习阶段的步骤推进会重置。
 */

export const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
})

export { Rating, createEmptyCard, type Card, type Grade }

/** 与 learning_records 表对应的持久化字段（state 为字符串名） */
export interface RecordFields {
  state: string
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: number | null
}

const stateToName = (s: State): string => State[s]

function nameToState(name: string): State {
  const s = State[name as keyof typeof State]
  if (s === undefined) throw new Error(`未知卡片状态: ${name}`)
  return s
}

/** 新词卡片 */
export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now)
}

/** DB 行 → Card（每次调度前必须重新水合，避免使用过期内存卡片） */
export function rowToCard(r: RecordFields): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: nameToState(r.state),
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  }
}

/** Card → DB 行字段 */
export function cardToRow(c: Card): RecordFields {
  return {
    state: stateToName(c.state),
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    last_review: c.last_review ? c.last_review.getTime() : null,
  }
}

/** 按评分推进卡片，返回新卡片 */
export function applyRating(card: Card, rating: Grade, now: Date = new Date()): Card {
  return scheduler.next(card, now, rating).card
}
