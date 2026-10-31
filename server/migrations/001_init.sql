-- 初始表结构
-- 说明：全部业务表按 user 维度设计（user_id 外键），为将来接入认证/多用户预留，无需再迁移

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
-- 预留：接入认证时 ALTER TABLE users ADD COLUMN password_hash TEXT / email TEXT

CREATE TABLE word_books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,   -- CET4 / CET6 / KY
  name        TEXT NOT NULL,          -- 四级词汇 / 六级词汇 / 考研词汇
  description TEXT,
  word_count  INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  source      TEXT,                   -- 词库来源与协议署名
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);

CREATE TABLE words (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id      INTEGER NOT NULL REFERENCES word_books(id) ON DELETE CASCADE,
  word         TEXT NOT NULL,
  phonetic_us  TEXT,
  phonetic_uk  TEXT,
  translations TEXT NOT NULL DEFAULT '[]',  -- JSON: [{translation, type}]
  phrases      TEXT NOT NULL DEFAULT '[]',  -- JSON: [{phrase, translation}]
  sentences    TEXT NOT NULL DEFAULT '[]',  -- JSON: [{sentence, translation}]
  chapter_no   INTEGER NOT NULL,            -- 词书内顺序（数据源行号）
  UNIQUE (book_id, word)
);
CREATE INDEX idx_words_book ON words(book_id, chapter_no);

-- FSRS 记忆卡片状态：每 (user, word) 一行。到期队列按 due 实时查询，不物化
CREATE TABLE learning_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id         INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  book_id         INTEGER NOT NULL REFERENCES word_books(id) ON DELETE CASCADE,
  state           TEXT NOT NULL DEFAULT 'New',   -- New | Learning | Review | Relearning
  due             INTEGER NOT NULL DEFAULT 0,    -- epoch ms
  stability       REAL NOT NULL DEFAULT 0,
  difficulty      REAL NOT NULL DEFAULT 0,
  elapsed_days    REAL NOT NULL DEFAULT 0,
  scheduled_days  REAL NOT NULL DEFAULT 0,
  learning_steps  INTEGER NOT NULL DEFAULT 0,    -- 学习阶段步骤索引
  reps            INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  last_review     INTEGER,                       -- epoch ms，可空
  is_favorite     INTEGER NOT NULL DEFAULT 0,    -- 生词本
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()*1000),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()*1000),
  UNIQUE (user_id, word_id)
);
CREATE INDEX idx_records_due ON learning_records(user_id, due);

-- 追加式日志：统计页、每日新词限额、连续打卡 均由此表计算
CREATE TABLE review_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id     INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES word_books(id) ON DELETE CASCADE,
  rating      TEXT NOT NULL,             -- Learn | Again | Hard | Good | Easy
  typed_text  TEXT,
  is_correct  INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()*1000)
);
CREATE INDEX idx_logs_user_time ON review_logs(user_id, created_at);

CREATE TABLE user_settings (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_new_limit    INTEGER NOT NULL DEFAULT 20,
  daily_review_limit INTEGER NOT NULL DEFAULT 200,
  accent             TEXT NOT NULL DEFAULT 'us',   -- us | uk
  auto_play_audio    INTEGER NOT NULL DEFAULT 1
);
