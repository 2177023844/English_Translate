/**
 * 对 render_pages.py 生成的 PNG 逐页 OCR，输出同名 .txt。
 *
 * 用法：node scripts/paper-tools/ocr_pages.mjs <页面目录>
 *
 * 依赖：tesseract.js（scripts workspace 的 devDependency）
 * 说明：英文试卷用 eng 模型即可；首次运行会下载约 10MB 语言包。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** 离线语言包目录：把 eng.traineddata 放这里，避免每次联网下载 */
const LANG_DIR = path.resolve(__dirname, '..', '.paper-work', 'tessdata')

const dir = process.argv[2]
if (!dir || !fs.existsSync(dir)) {
  console.error('用法: node ocr_pages.mjs <页面目录>')
  process.exit(1)
}

const pages = fs
  .readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort()

if (pages.length === 0) {
  console.error('[ocr] 目录中没有 PNG：', dir)
  process.exit(1)
}

console.log(`[ocr] 开始识别 ${pages.length} 页…`)
const worker = await createWorker('eng', 1, {
  langPath: LANG_DIR,
  cachePath: LANG_DIR,
  gzip: false,
})
for (const [index, page] of pages.entries()) {
  const started = Date.now()
  const { data } = await worker.recognize(
    path.join(dir, page),
    {},
    { text: true, blocks: true },
  )
  const target = path.join(dir, page.replace(/\.png$/i, '.txt'))
  fs.writeFileSync(target, data.text, 'utf8')
  // 行级坐标：用来判断段落首行缩进（页面上正文行缩进约 60px）
  const lines = []
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        if (line.text.trim()) {
          lines.push({ text: line.text, x0: line.bbox.x0, y0: line.bbox.y0 })
        }
      }
    }
  }
  fs.writeFileSync(target.replace(/\.txt$/i, '.lines.json'), JSON.stringify(lines), 'utf8')
  console.log(
    `[ocr] ${index + 1}/${pages.length} ${page} ${Math.round(
      (Date.now() - started) / 1000,
    )}s ${data.text.length} 字符`,
  )
}
await worker.terminate()
console.log('[ocr] 完成')
