"""把 OCR 出来的真题文本整理成网页可用的结构化 JSON。

输入：scripts/.paper-work/setN/page-*.txt（tesseract 结果）
输出：scripts/.paper-work/content/setN.json
用法：python scripts/paper-tools/build_content.py
"""
import glob
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORK = os.path.join(ROOT, "scripts", ".paper-work")
OUT = os.path.join(WORK, "content")

FOOTER_RE = re.compile(r"^[\s+\-•]*\d*\s*[+\-]?\s*2026\b")
NOISE_RE = re.compile(r"^[\s+\-•|]*$")


def load_page_lines(txt_path: str) -> list[dict]:
    """读取同名的 .lines.json（tesseract 行级坐标）；没有就退回纯文本。"""
    json_path = txt_path[:-4] + ".lines.json"
    if os.path.exists(json_path):
        return json.load(open(json_path, encoding="utf-8"))
    return [{"text": raw.rstrip("\n"), "x0": None} for raw in open(txt_path, encoding="utf-8")]


def load_text(set_no: int) -> str:
    files = sorted(glob.glob(os.path.join(WORK, f"set{set_no}", "page-*.txt")))
    lines: list[str] = []
    for f in files:
        kept = []
        for item in load_page_lines(f):
            s = item.get("text", "").strip()
            if not s or NOISE_RE.match(s) or FOOTER_RE.match(s):
                continue
            # 页眉的乱码中文标题：没有小写字母、且不含常见英文词
            if not re.search(r"[a-z]", s) and len(s) < 60:
                continue
            kept.append({**item, "text": s})

        xs = [k["x0"] for k in kept if k.get("x0") is not None]
        margin = min(xs) if xs else None
        for k in kept:
            x0 = k.get("x0")
            # 段首行缩进约 60px；Section B 的 A) B) 标签也单独成段
            indented = margin is not None and x0 is not None and x0 >= margin + 60
            labelled = re.match(r"^(?:[A-P]|0)\)\s", k["text"]) is not None
            if (indented or labelled) and lines and lines[-1] != "":
                lines.append("")
            # OCR 常把段落标签 O 认成数字 0
            text = re.sub(r"^0\)\s", "O) ", k["text"])
            lines.append(text)
    return "\n".join(lines)


def one_line(text: str) -> str:
    text = re.sub(r"(?<=[A-Za-z])-\s*\n\s*(?=[a-z])", "", text)  # 行尾连字符
    return re.sub(r"\s+", " ", text).strip()


def fix_ocr_start(text: str) -> str:
    """修掉题号后 OCR 粘上的 1/I（如 “1t is” → “It is”，“1In” → “In”）。"""
    if re.match(r"^1[A-Z]", text):
        return text[1:]
    if re.match(r"^1[a-z]", text):
        return "I" + text[1:]
    return text


def split_sections(text: str) -> dict[str, str]:
    marks = [
        ("writing", r"Part\s*(?:I|1|\])\s*Writing"),
        ("listening", r"Part\s*II\s*Listening Comprehension"),
        ("reading", r"Part\s*III\s*Reading Comprehension"),
        ("translation", r"Part\s*IV\s*Translation"),
    ]
    found = []
    for key, pat in marks:
        m = re.search(pat, text)
        if m:
            found.append((m.start(), key))
    found.sort()
    out = {}
    for i, (pos, key) in enumerate(found):
        end = found[i + 1][0] if i + 1 < len(found) else len(text)
        out[key] = text[pos:end]
    return out


def split_sections_abc(text: str) -> dict[str, str]:
    out = {}
    marks = [(m.start(), m.group(1)) for m in re.finditer(r"(?m)^Section\s+([ABC])\s*[.．]?\s*$", text)]
    for i, (pos, key) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        out[key] = text[pos:end]
    return out


def parse_options(block: str) -> list[dict]:
    marks = [(m.start(), m.end(), m.group(1)) for m in re.finditer(r"([A-D])\)\s*", block)]
    if not marks:
        return []
    opts: dict[str, str] = {}
    for i, (s, e, key) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(block)
        text = re.sub(r"\s+", " ", block[e:end]).strip().rstrip(" .")
        if key not in opts:
            opts[key] = text
    return [{"key": k, "text": opts[k]} for k in sorted(opts)]


def parse_questions(segment: str) -> list[dict]:
    starts = list(re.finditer(r"(?m)^(\d{1,2})\.\s+", segment))
    questions = []
    for i, m in enumerate(starts):
        no = int(m.group(1))
        end = starts[i + 1].start() if i + 1 < len(starts) else len(segment)
        block = one_line(segment[m.end():end])
        opt_marks = list(re.finditer(r"([A-D])\)\s*", block))
        stem = block[: opt_marks[0].start()].strip() if opt_marks else block
        stem = re.sub(r"^Questions?\s+\d+\s*(?:to|and)\s*\d+.*?heard\s*", "", stem).strip()
        options = parse_options(block)
        if not options:
            continue
        questions.append({"no": no, "stem": stem, "options": options})
    return questions


def pick_range(questions: list[dict], lo: int, hi: int) -> list[dict]:
    return [q for q in questions if lo <= q["no"] <= hi]


def parse_word_bank(text: str) -> list[str]:
    seen: dict[str, str] = {}
    for m in re.finditer(r"([A-O0-9])\s*\)\s*([A-Za-z][A-Za-z'-]*)", text):
        letter = {"0": "O", "1": "I"}.get(m.group(1), m.group(1))
        if "A" <= letter <= "O":
            seen.setdefault(letter, m.group(2))
    return [seen[k] for k in sorted(seen)]


def clean_passage(text: str) -> str:
    # 行尾连字符只在同一段内合并，避免跨段粘连
    text = re.sub(r"(?<=[A-Za-z])-\n[ \t]*(?=[a-z])", "", text)
    paragraphs = []
    for para in re.split(r"\n\s*\n", text):
        para = re.sub(r"\s+", " ", para).strip()
        if not para:
            continue
        para = re.sub(r"\([^)]*[^\x00-\x7f][^)]*\)", "", para)
        para = re.sub(r"\s+([.,;:!?])", r"\1", para)
        paragraphs.append(para.strip())
    return "\n\n".join(paragraphs)


def fmt_blank(text: str) -> str:
    """把 OCR 里五花八门的填空标记统一成 __(26)__。"""
    return re.sub(r"_{1,}\s*(\d{1,2})(?:\s*_{1,})?", r"__(\1)__", text)


def strip_directions(text: str) -> str:
    """去掉文章开头印刷的 Directions / Questions xx to xx 说明。"""
    text = text.strip()
    m = re.match(r"(?is)^[^A-Za-z0-9]*Directions:.*?Answer Sheet 2\b", text)
    if m:
        text = text[m.end():]
        # 选词填空的说明还有半句 “with a single line through the centre.”
        text = re.sub(
            r"^\.?\s*with a single line through the cent(?:er|re)\.",
            "",
            text,
            flags=re.I,
        )
    text = re.sub(
        r"(?i)^[\s.:;]*You may not use any of the words in the bank more than once\.\s*",
        "",
        text,
    )
    text = re.sub(
        r"(?is)^[^A-Za-z0-9]*Questions?\s+\d+\s*(?:to|and)\s*\d+\s+are based on the following passage\.\s*",
        "",
        text,
    )
    return text.strip().lstrip(".·•:; ").strip()


ANSWERS = {
    1: {
        "listening": "CBADBDCAABCDDBABDCADACCBD",
        "cloze": "NAIKFOCGJD",
        "matching": "CIELAFJBDG",
        "reading": "DADCBABCAD",
    },
    2: {
        "listening": "ADCBDBCADCABCBDABDDCABCAD",
        "cloze": "NILGFDJMAC",
        "matching": "FLAHOEKMCI",
        "reading": "BCDBABDACD",
    },
    3: {
        "listening": "",
        "cloze": "ILFNGCOAJM",
        "matching": "DJAEGCKFBH",
        "reading": "CDADACBDBA",
    },
}

TRANSLATION_CN = {
    1: [
        "中国有句老话：“一日为师，终身为父”。在中国人的观念里，老师不仅传授知识，更教给学生做人的道理。",
        "在古代，学生初次见老师时要举行隆重的仪式，足见老师地位之高。",
        "为弘扬尊师的优良传统，中国从1985年开始将每年的9月10日定为教师节。在这一天，学生以各种方式表达对老师的敬意。",
        "尊师是中华民族的传统美德，在当今社会得到了发扬光大。",
    ],
    2: [
        "餐桌礼仪（dining etiquette）是中华传统文化的重要组成部分，蕴含着热情有礼的待客之道。",
        "为了招待客人，主人会根据客人的口味和喜好准备丰富精致的菜肴。",
        "就餐座位的安排非常讲究，主人坐在正对大门的位置，在主人身边就座的是最重要的客人。",
        "进餐时主人会不时地为客人添酒加菜。这种独特的餐桌礼仪已延续了数千年，对促进和谐的人际交往起到了重要作用。",
    ],
    3: [
        "在中国传统文化中，亲朋好友之间互赠礼物是人际交往的一种重要礼节（etiquette）。",
        "赠送礼物不仅是物质的馈赠，更是情感的表达，是维系人际关系的重要纽带。",
        "一份精心挑选、符合接受者喜好的礼物，往往能加深彼此的感情。",
        "中国人遵循“礼尚往来”（mutually exchanging courtesies）的传统，接受礼物时会表达谢意，并适时回赠礼物，以增进彼此的融洽关系。",
    ],
}

DIRECTIONS = {
    "listening-a": "In this section, you will hear three news reports. At the end of each news report, you will hear two or three questions.",
    "listening-b": "In this section, you will hear two long conversations. At the end of each conversation, you will hear four questions.",
    "listening-c": "In this section, you will hear three passages. At the end of each passage, you will hear three or four questions.",
    "reading-a": "In this section, there is a passage with ten blanks. You are required to select one word for each blank from a list of choices given in a word bank following the passage.",
    "reading-b": "In this section, you are going to read a passage with ten statements attached to it. Identify the paragraph from which the information is derived.",
    "reading-c": "There are 2 passages in this section. Each passage is followed by some questions. For each of them there are four choices marked A), B), C) and D).",
}


def build_listening(text: str, ans: str) -> list[dict]:
    secs = split_sections_abc(text)
    meta = {
        "A": ("listening-a", "Section A", "新闻报道", 1, 7),
        "B": ("listening-b", "Section B", "长对话", 8, 15),
        "C": ("listening-c", "Section C", "听力篇章", 16, 25),
    }
    modules = []
    for key in ["A", "B", "C"]:
        seg = secs.get(key, "")
        if not seg:
            continue
        mod_id, section, title, lo, hi = meta[key]
        body = re.sub(r"^Section\s+[ABC]\s*", "", seg, count=1).strip()
        qs = pick_range(parse_questions(body), lo, hi)
        for q in qs:
            i = q["no"] - 1
            if 0 <= i < len(ans):
                q["answer"] = ans[i]
        modules.append(
            {
                "id": mod_id,
                "part": "Part II",
                "name": "Listening",
                "section": section,
                "title": f"{title}（{lo}–{hi} 题）",
                "kind": "listening",
                "directions": DIRECTIONS[mod_id],
                "questions": qs,
            }
        )
    return modules


def build_reading(text: str, answers: dict) -> list[dict]:
    secs = split_sections_abc(text)
    modules = []

    # --- Section A 选词填空 ---
    seg = secs.get("A", "")
    body = re.sub(r"^Section\s+A\s*", "", seg, count=1).strip()
    bank_pos = re.search(r"(?m)^\s*A\)\s+[A-Za-z]", body)
    passage_raw = body[: bank_pos.start()] if bank_pos else body
    bank = parse_word_bank(body[bank_pos.start():]) if bank_pos else []
    passage = strip_directions(clean_passage(passage_raw))
    cloze_qs = []
    for i, letter in enumerate(answers["cloze"]):
        no = 26 + i
        m2 = re.search(r"[^.]*_{1,}\s*%d\s*(?:_{1,})?[^.]*\." % no, passage)
        stem = m2.group(0).strip().lstrip(":;,.·• ") if m2 else f"第 {no} 空"
        stem = fmt_blank(stem)
        cloze_qs.append(
            {
                "no": no,
                "stem": stem,
                "options": [{"key": chr(ord("A") + j), "text": w} for j, w in enumerate(bank)],
                "answer": letter,
            }
        )
    passage = fmt_blank(passage)
    modules.append(
        {
            "id": "reading-a",
            "part": "Part III",
            "name": "Reading",
            "section": "Section A",
            "title": "选词填空（26–35 题）",
            "kind": "cloze",
            "directions": DIRECTIONS["reading-a"],
            "passage": passage,
            "wordBank": bank,
            "questions": cloze_qs,
        }
    )

    # --- Section B 长篇匹配 ---
    seg = secs.get("B", "")
    body = re.sub(r"^Section\s+B\s*", "", seg, count=1).strip()
    st_first = re.search(r"(?m)^36\.\s*", body)
    passage_raw = body[: st_first.start()] if st_first else body
    st_text = body[st_first.start():] if st_first else ""
    passage = strip_directions(clean_passage(passage_raw))
    statements = []
    for m2 in re.finditer(r"(?m)^(\d{1,2})\.\s*(.+?)(?=\n\d{1,2}\.\s*|\Z)", st_text, re.S):
        no = int(m2.group(1))
        if 36 <= no <= 45:
            statements.append((no, fix_ocr_start(one_line(m2.group(2)))))
    letters = sorted(
        {
            {"0": "O"}.get(x, x)
            for x in re.findall(r"(?<![A-Za-z0-9])([A-P0])\)\s", passage)
        }
    )
    matching_opts = [{"key": k, "text": ""} for k in letters]
    matching_qs = [
        {
            "no": no,
            "stem": stem,
            "options": matching_opts,
            "answer": answers["matching"][no - 36],
        }
        for no, stem in statements
    ]
    modules.append(
        {
            "id": "reading-b",
            "part": "Part III",
            "name": "Reading",
            "section": "Section B",
            "title": "长篇匹配（36–45 题）",
            "kind": "matching",
            "directions": DIRECTIONS["reading-b"],
            "passage": passage,
            "questions": matching_qs,
        }
    )

    # --- Section C 仔细阅读 ---
    seg = secs.get("C", "")
    body = re.sub(r"^Section\s+C\s*", "", seg, count=1).strip()
    parts = re.split(r"Passage\s+(One|Two)", body)
    for i in range(1, len(parts) - 1, 2):
        which = parts[i]
        chunk = parts[i + 1]
        lo, hi = (46, 50) if which == "One" else (51, 55)
        qs = pick_range(parse_questions(chunk), lo, hi)
        for q in qs:
            j = q["no"] - 46
            if 0 <= j < len(answers["reading"]):
                q["answer"] = answers["reading"][j]
        passage = re.split(r"(?m)^(?:46|51)\.\s+", chunk)[0]
        modules.append(
            {
                "id": f"reading-c{1 if which == 'One' else 2}",
                "part": "Part III",
                "name": "Reading",
                "section": "Section C",
                "title": f"仔细阅读 · Passage {which}（{lo}–{hi} 题）",
                "kind": "reading",
                "directions": DIRECTIONS["reading-c"],
                "passage": strip_directions(clean_passage(passage)),
                "questions": qs,
            }
        )
    return modules


def build_set(set_no: int) -> dict:
    text = load_text(set_no)
    sec = split_sections(text)
    ans = ANSWERS[set_no]
    modules = []

    # Part I 写作
    writing = sec.get("writing", "")
    writing = re.sub(r"^Part\s*(?:I|1|\])\s*Writing[^\n]*\n?", "", writing, count=1)
    writing = one_line(writing)
    writing = re.sub(r"^Directions:\s*", "", writing)
    if writing:
        modules.append(
            {
                "id": "writing",
                "part": "Part I",
                "name": "Writing",
                "title": "写作（30 分钟）",
                "kind": "writing",
                "directions": writing,
                "questions": [],
            }
        )

    if set_no != 3:
        modules.extend(build_listening(sec.get("listening", ""), ans["listening"]))

    modules.extend(build_reading(sec.get("reading", ""), ans))

    modules.append(
        {
            "id": "translation",
            "part": "Part IV",
            "name": "Translation",
            "title": "翻译（30 分钟）",
            "kind": "translation",
            "directions": "把下面的中文段落翻译成英文。",
            "passage": "\n".join(TRANSLATION_CN[set_no]),
            "questions": [],
        }
    )

    return {
        "title": f"2026年6月大学英语四级考试（第{set_no}套）",
        "modules": modules,
    }


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for n in [1, 2, 3]:
        data = build_set(n)
        target = os.path.join(OUT, f"set{n}.json")
        with open(target, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        summary = [f"{m['id']}:{len(m['questions'])}" for m in data["modules"]]
        print(f"set{n} modules={len(data['modules'])}  " + " ".join(summary))


if __name__ == "__main__":
    main()
