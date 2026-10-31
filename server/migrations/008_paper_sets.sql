-- 同一场考试可能有多套试卷（如 2026 年 6 月四级第 1/2/3 套），每套单独存结构化内容
CREATE TABLE IF NOT EXISTS paper_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  set_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (paper_id, set_no)
);

CREATE INDEX IF NOT EXISTS idx_paper_sets_paper ON paper_sets (paper_id, set_no);

-- 文件可归属到具体某一套；为空表示属于整场考试
ALTER TABLE paper_files ADD COLUMN set_id INTEGER REFERENCES paper_sets(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_paper_files_set ON paper_files (set_id);
