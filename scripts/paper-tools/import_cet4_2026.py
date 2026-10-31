"""把 2026 年 6 月四级三套真题导入数据库（可重复执行）。

前置：
  1. python scripts/paper-tools/build_content.py 生成 content/setN.json
  2. 原始 PDF / 听力音频放在 SRC_DIR 下

用法：python scripts/paper-tools/import_cet4_2026.py [源目录]
默认源目录：D:/real_English
"""
import json
import os
import re
import shutil
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC_DIR = sys.argv[1] if len(sys.argv) > 1 else r"D:/real_English"
CONTENT_DIR = os.path.join(ROOT, "scripts", ".paper-work", "content")
DB_PATH = os.path.join(ROOT, "server", "data", "app.db")
PAPERS_DIR = os.path.join(ROOT, "server", "data", "papers")

LEVEL, YEAR, SESSION = "CET4", 2026, "H1"

# 文件名 → (套号, 分类)；分类决定存储名和排序
PATTERNS = [
    (re.compile(r"2026\.06四级真题第(\d)套"), "真题", "pdf", "application/pdf"),
    (re.compile(r"2026年6月英语四级解析第(\d)套"), "解析", "pdf", "application/pdf"),
    (re.compile(r"26年6月四级听力音频第(\d)套"), "听力", "mp3", "audio/mpeg"),
]

CATEGORY_ORDER = {"真题": 0, "解析": 1, "听力": 2}


def main() -> None:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    paper = con.execute(
        "SELECT id, title FROM papers WHERE level=? AND year=? AND session=?",
        (LEVEL, YEAR, SESSION),
    ).fetchone()
    if not paper:
        raise SystemExit(f"数据库里没有 {LEVEL} {YEAR} {SESSION} 这场考试，请先建好 papers 行")
    paper_id = paper["id"]

    # 1) 结构化内容
    sets = {}
    for n in [1, 2, 3]:
        path = os.path.join(CONTENT_DIR, f"set{n}.json")
        if not os.path.exists(path):
            raise SystemExit(f"缺少 {path}，先运行 build_content.py")
        content = json.load(open(path, encoding="utf-8"))
        con.execute(
            """INSERT INTO paper_sets (paper_id, set_no, title, content)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(paper_id, set_no) DO UPDATE SET
                 title = excluded.title,
                 content = excluded.content,
                 updated_at = datetime('now')""",
            (paper_id, n, content["title"], json.dumps(content, ensure_ascii=False)),
        )
        sets[n] = con.execute(
            "SELECT id FROM paper_sets WHERE paper_id=? AND set_no=?", (paper_id, n)
        ).fetchone()["id"]
    print(f"[import] paper #{paper_id} 写入 {len(sets)} 套结构化内容")

    # 2) 文件：复制到 server/data/papers/p{id}/ 并登记
    target_dir = os.path.join(PAPERS_DIR, f"p{paper_id}")
    os.makedirs(target_dir, exist_ok=True)

    sources = {}
    for name in os.listdir(SRC_DIR):
        for pattern, category, ext, mime in PATTERNS:
            m = pattern.search(name)
            if m:
                sources[(int(m.group(1)), category)] = (name, ext, mime)
                break
    if not sources:
        raise SystemExit(f"{SRC_DIR} 下没有找到本场考试的文件")

    for n in sorted(sets):
        for category in CATEGORY_ORDER:
            item = sources.get((n, category))
            if not item:
                if category == "听力" and n == 3:
                    continue  # 第 3 套没有听力
                print(f"[import] 警告：缺少第 {n} 套的{category}文件")
                continue
            name, ext, mime = item
            stored = f"set{n}_{category}.{ext}"
            shutil.copy2(os.path.join(SRC_DIR, name), os.path.join(target_dir, stored))
            rel_path = f"p{paper_id}/{stored}"
            con.execute(
                "DELETE FROM paper_files WHERE paper_id=? AND rel_path=?", (paper_id, rel_path)
            )
            con.execute(
                """INSERT INTO paper_files (paper_id, name, rel_path, mime, size, sort_order, set_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    paper_id,
                    name,
                    rel_path,
                    mime,
                    os.path.getsize(os.path.join(target_dir, stored)),
                    n * 10 + CATEGORY_ORDER[category],
                    sets[n],
                ),
            )
            print(f"[import] set{n} {category}: {name}")

    # 主文件指向第 1 套真题 PDF
    first = f"p{paper_id}/set1_真题.pdf"
    con.execute("UPDATE papers SET file_path=?, updated_at=datetime('now') WHERE id=?", (first, paper_id))
    con.execute("UPDATE papers SET source='2026年6月四级真题' WHERE id=?", (paper_id,))
    con.commit()
    con.close()
    print("[import] 完成")


if __name__ == "__main__":
    main()
