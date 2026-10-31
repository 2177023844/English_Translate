-- 历年试卷：整份试卷保存在网站数据库中（正文）或 server/data/papers 下（PDF 等文件）
CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK (level IN ('CET4', 'CET6', 'KY')),
  year INTEGER NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('H1', 'H2', 'A', 'B')),
  title TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (level, year, session)
);

CREATE INDEX IF NOT EXISTS idx_papers_level_year ON papers (level, year DESC);
