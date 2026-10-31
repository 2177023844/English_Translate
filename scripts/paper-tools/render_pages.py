"""
把 PDF 每一页渲染成 PNG，供 OCR 使用。

用法：
  python scripts/paper-tools/render_pages.py <pdf> <输出目录> [dpi]

依赖：pip install pymupdf
"""
import os
import sys

import pymupdf


def main() -> None:
    if len(sys.argv) < 3:
        print("用法: python render_pages.py <pdf> <输出目录> [dpi]")
        sys.exit(1)
    src, out_dir = sys.argv[1], sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    os.makedirs(out_dir, exist_ok=True)
    doc = pymupdf.open(src)
    for index, page in enumerate(doc):
        target = os.path.join(out_dir, f"page-{index + 1:02d}.png")
        page.get_pixmap(dpi=dpi).save(target)
    print(f"[render] {len(doc)} 页 -> {out_dir} ({dpi} dpi)")


if __name__ == "__main__":
    main()
