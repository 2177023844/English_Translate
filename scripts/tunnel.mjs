/**
 * 一键内网穿透：构建 → 启动生产服务（3002 端口）→ Cloudflare Tunnel → 输出公网地址
 *
 * 用法：npm run tunnel
 * 停止：Ctrl+C（自动关闭生产服务与隧道）
 * 注意：网站无登录，公网链接任何人可访问，请勿泄露链接；停止后链接即失效
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureCloudflared } from './lib/cloudflared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 3002

// ---- 1. 构建生产版本 ----
console.log('[tunnel] 1/3 构建生产版本…')
const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true })
if (build.status !== 0) {
  console.error('[tunnel] 构建失败，请先排查 npm run build')
  process.exit(1)
}

// ---- 2. 启动生产服务（独立端口，不影响开发环境） ----
console.log(`[tunnel] 2/3 启动生产服务（端口 ${PORT}）…`)
const server = spawn('node', ['server/dist/index.js'], {
  cwd: ROOT,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  stdio: 'inherit',
  shell: true,
})

let serverReady = false
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`)
    if (res.ok) {
      serverReady = true
      break
    }
  } catch {
    // 未就绪，继续等待
  }
  await new Promise((r) => setTimeout(r, 500))
}
if (!serverReady) {
  console.error('[tunnel] 生产服务启动失败，请检查 server/dist 是否构建成功')
  server.kill()
  process.exit(1)
}
console.log('[tunnel] 生产服务已就绪 ✓')

// ---- 3. 准备 cloudflared（缺失则自动下载） ----
const exePath = await ensureCloudflared()
console.log('[tunnel] cloudflared 已就绪 ✓')

// ---- 4. 建立隧道（掉线自动重连；重连后地址会变化并重新打印） ----
console.log('[tunnel] 正在建立隧道…')

let stopping = false
let tunnel = null
let reconnectCount = 0

function startTunnel() {
  tunnel = spawn(exePath, ['tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let urlShown = false
  let outBuf = ''
  const handleOutput = (chunk) => {
    outBuf += chunk.toString()
    if (!urlShown) {
      const m = outBuf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
      if (m) {
        urlShown = true
        console.log('')
        console.log('══════════════════════════════════════════════════════')
        console.log('  🎉 公网访问地址（手机/平板/任何设备浏览器打开）：')
        console.log(`  ${m[0]}`)
        console.log('══════════════════════════════════════════════════════')
        console.log('  提示：')
        console.log('  · 电脑需保持开机、勿睡眠，并保持本窗口运行')
        console.log('  · 网站无登录，请勿把链接发给他人')
        console.log('  · 按 Ctrl+C 停止，链接立即失效')
        console.log('')
      }
    }
  }
  tunnel.stdout.on('data', handleOutput)
  tunnel.stderr.on('data', handleOutput)
  tunnel.on('exit', (code) => {
    if (stopping) return
    reconnectCount++
    console.log(`[tunnel] 隧道断开（第 ${reconnectCount} 次），3 秒后自动重连…`)
    console.log('[tunnel] 提示：重连后地址会变化，请以最新打印的地址为准')
    setTimeout(startTunnel, 3000)
  })
}

startTunnel()

const shutdown = () => {
  console.log('\n[tunnel] 正在关闭…')
  stopping = true
  tunnel?.kill()
  server.kill()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
