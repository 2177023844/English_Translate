-- 一套试卷可以包含多个文件：试卷 PDF、答题卡、听力音频、多页扫描图等
CREATE TABLE IF NOT EXISTS paper_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rel_path TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_paper_files_paper ON paper_files (paper_id, sort_order);

-- 把此前通过导入脚本写入的单个原文件纳入文件表
INSERT INTO paper_files (paper_id, name, rel_path, sort_order)
SELECT id, file_path, file_path, 0
FROM papers
WHERE file_path IS NOT NULL AND file_path <> '';
