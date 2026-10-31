/** cloudflared 公共工具：多源下载 + 定位可执行文件 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CACHE_DIR = path.resolve(__dirname, '..', '.cache')

export function exePath() {
  const exeName = os.platform() === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  return path.join(CACHE_DIR, exeName)
}

/** 多源下载（GitHub 直连 + 镜像加速），每个源重试 2 次 */
export async function downloadWithFallbacks(urls, dest) {
  let lastErr
  for (const url of urls) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`  下载: ${url.slice(0, 70)}…`)
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 120000)
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
        clearTimeout(timer)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        fs.writeFileSync(dest, buf)
        if (os.platform() !== 'win32') fs.chmodSync(dest, 0o755)
        return
      } catch (e) {
        lastErr = e
        console.log(`  失败（第 ${attempt} 次）: ${e.message}`)
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }
  throw lastErr
}

/** 确保 cloudflared 可用（缺失则自动下载） */
export async function ensureCloudflared() {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const dest = exePath()
  if (fs.existsSync(dest)) return dest

  const platform = os.platform()
  const arch = os.arch()
  const archSuffix = arch === 'arm64' ? '-arm64' : '-amd64'
  const direct =
    platform === 'win32'
      ? `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows${archSuffix}.exe`
      : platform === 'darwin'
        ? `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin${archSuffix}.tgz`
        : `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${archSuffix === '-amd64' ? 'amd64' : 'arm64'}`
  if (direct.endsWith('.tgz')) {
    throw new Error('暂不支持自动解压 tgz，请手动下载 cloudflared 到 ' + dest)
  }
  console.log('首次使用，正在下载 cloudflared（约 40MB）…')
  const mirrorUrls = [
    direct,
    `https://ghfast.top/${direct}`,
    `https://gh-proxy.com/${direct}`,
    `https://ghproxy.net/${direct}`,
  ]
  await downloadWithFallbacks(mirrorUrls, dest)
  console.log('cloudflared 已就绪 ✓')
  return dest
}
