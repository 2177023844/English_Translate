/** 与后端 /api 对应的共享类型 */

export interface WordView {
  id: number
  word: string
  phoneticUs: string | null
  phoneticUk: string | null
  translations: { translation: string; type?: string }[]
  phrases: { phrase: string; translation?: string }[]
  sentences: { sentence: string; translation?: string }[]
}

export interface Book {
  id: number
  code: string
  name: string
  description: string | null
  word_count: number
  sort_order: number
  learned_count: number
  due_count: number
}

export interface RecordFields {
  state: string
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  last_review: number | null
}

export interface ReviewCard {
  record: RecordFields & { id: number; isFavorite: number }
  word: WordView
}

export interface Settings {
  dailyGroups: number
  dailyReviewLimit: number
  accent: 'us' | 'uk'
  autoPlayAudio: boolean
  studyMode: 'zh2en' | 'en2zh'
  groupSize: number
  spellingEnabled: boolean
}

export interface OverviewStats {
  totalLearned: number
  totalDue: number
  learnedToday: number
  reviewedToday: number
  avgAccuracy30d: number
  streakDays: number
}

export interface DailyStat {
  date: string
  newCount: number
  reviewCount: number
  accuracy: number
}

export interface FavoriteWord extends WordView {
  bookName: string
  favoritedAt: number
}

export interface WordDetail extends WordView {
  isFavorite: boolean
  bookNames: string[]
  derivedForms: string[]
}

export interface StudySubmitResult {
  isCorrect: boolean
  correctWord: string
  record: RecordFields | null
}

export type StudyMode = 'zh2en' | 'en2zh'

export type PaperLevel = 'CET4' | 'CET6' | 'KY'
export type PaperSession = 'H1' | 'H2' | 'A' | 'B'

export interface PaperSummary {
  id: number
  level: PaperLevel
  year: number
  session: PaperSession
  title: string
  source: string | null
  /** 1 = 已收录试卷内容 */
  ready: 0 | 1
}

export interface PaperFile {
  id: number
  name: string
  mime: string | null
  size: number
  set_id: number | null
  created_at: string
}

export interface PaperSetSummary {
  id: number
  set_no: number
  title: string
  /** 1 = 已解析出结构化内容 */
  hasContent: 0 | 1
}

export interface PaperDetail extends PaperSummary {
  content: string | null
  file_path: string | null
  files: PaperFile[]
  sets: PaperSetSummary[]
}

export interface PaperOption {
  key: string
  text: string
}

export interface PaperQuestion {
  no: number | string
  stem: string
  options: PaperOption[]
  answer?: string
  explanation?: string
}

export type PaperModuleKind =
  | 'writing'
  | 'listening'
  | 'cloze'
  | 'matching'
  | 'reading'
  | 'translation'

export interface PaperModule {
  id: string
  part: string
  name: string
  section?: string
  title: string
  kind: PaperModuleKind
  directions?: string
  passage?: string
  wordBank?: string[]
  questions: PaperQuestion[]
}

export interface PaperSetContent {
  title: string
  modules: PaperModule[]
}

export interface PaperSetDetail {
  id: number
  paper_id: number
  set_no: number
  title: string
  level: PaperLevel
  year: number
  session: PaperSession
  content: PaperSetContent | null
}

export interface QuestionOption {
  wordId: number
  text: string
  type: string | null
  translations?: { text: string; type?: string }[]
}

export interface Question {
  wordId: number
  mode: StudyMode
  prompt: {
    word?: string
    phoneticUs?: string | null
    translations?: { text: string; type?: string }[]
  }
  options: QuestionOption[]
  correctIndex: number
}
