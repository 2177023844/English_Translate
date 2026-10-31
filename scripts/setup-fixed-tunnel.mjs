/**
 * 一键配置固定域名隧道（Cloudflare 命名隧道，地址永久不变、自动重连）
 *
 * 用法：npm run tunnel:fixed -- <域名>   例：npm run tunnel:fixed -- english.example.com
 *
 * 前置条件（本脚本无法代办）：
 *   1. 注册 Cloudflare 免费账号：https://dash.cloudflare.com/sign-up
 *   2. 有一个域名，并已添加到 Cloudflare（域名 DNS 托管到 Cloudflare，状态 Active）
 *
 * 脚本自动完成：构建 → 登录授权 → 创建命名隧道 → 绑定域名 DNS → 写配置 → 启动服务与隧道
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureCloudflared, exePath } from './lib/cloudflared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = 3002
const TUNNEL_NAME = 'guodong-english'
const CONFIG_PATH = path.join(ROOT, 'deploy', 'cloudflared-config.yml')

const hostname = process.argv[2]?.trim()
if (!hostname || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) {
  console.error('用法：npm run tunnel:fixed -- <你的域名>\n例：npm run tunnel:fixed -- english.example.com')
  process.exit(1)
}

// ---- 0. 构建 + 启动生产服务（3002） ----
console.log('[setup] 构建生产版本…')
const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true })
if (build.status !== 0) {
  console.error('[setup] 构建失败')
  process.exit(1)
}
console.log(`[setup] 启动生产服务（端口 ${PORT}）…`)
const server = spawn('node', ['server/dist/index.js'], {
  cwd: ROOT,
  env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  stdio: 'inherit',
  shell: true,
})
let ready = false
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`)
    if (res.ok) { ready = true; break }
  } catch { /* 等待 */ }
  await new Promise((r) => setTimeout(r, 500))
}
if (!ready) {
  console.error('[setup] 生产服务启动失败')
  server.kill()
  process.exit(1)
}

// ---- 1. 准备 cloudflared ----
const exe = await ensureCloudflared()

// ---- 2. 登录授权（首次：浏览器打开 Cloudflare 授权页面） ----
const runInteractive = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(exe, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`命令失败（退出码 ${code}）`))))
  })

const credDir = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '~', '.cloudflared')
if (!fs.existsSync(credDir) || !fs.readdirSync(credDir).some((f) => f === 'cert.pem')) {
  console.log('\n[setup] 第 1 步：登录 Cloudflare（浏览器会打开授权页，请选择你的域名并点授权）…')
  await runInteractive(['tunnel', 'login'])
}

// ---- 3. 创建命名隧道 ----
console.log('[setup] 第 2 步：创建命名隧道…')
if (!fs.readdirSync(credDir).some((f) => f.endsWith('.json'))) {
  await runInteractive(['tunnel', 'create', TUNNEL_NAME])
}
const credFile = fs.readdirSync(credDir).find((f) => f.endsWith('.json'))
if (!credFile) {
  console.error('[setup] 未找到隧道凭证文件，请重新运行')
  server.kill()
  process.exit(1)
}
const tunnelId = credFile.replace(/\.json$/, '')

// ---- 4. 绑定域名 DNS ----
console.log(`[setup] 第 3 步：绑定域名 ${hostname} → 隧道（自动创建 DNS 记录）…`)
await runInteractive(['tunnel', 'route', 'dns', TUNNEL_NAME, hostname])

// ---- 5. 写配置文件 ----
const config = `# 果冻学英语 — Cloudflare 命名隧道配置
tunnel: ${tunnelId}
credentials-file: ${path.join(credDir, credFile).replace(/\\/g, '/')}

ingress:
  - hostname: ${hostname}
    service: http://localhost:${PORT}
  - service: http_status:404
`
fs.writeFileSync(CONFIG_PATH, config)
console.log(`[setup] 配置已写入: ${CONFIG_PATH}`)

// ---- 6. 启动隧道（命名隧道原生自动重连，地址永久固定） ----
console.log(`\n[setup] 启动隧道（Ctrl+C 停止）…`)
const tunnel = spawn(exe, ['tunnel', 'run', '--config', CONFIG_PATH, TUNNEL_NAME], { stdio: 'inherit', shell: process.platform === 'win32' })

const shutdown = () => {
  console.log('\n[setup] 正在关闭…')
  tunnel.kill()
  server.kill()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
tunnel.on('exit', (code) => {
  console.log('[setup] 隧道已退出')
  server.kill()
  process.exit(code ?? 0)
})

console.log('══════════════════════════════════════════════════════')
console.log(`  🎉 固定地址：https://${hostname}`)
console.log('  以后每次启动只需运行：npm run tunnel:fixed -- ' + hostname)
console.log('══════════════════════════════════════════════════════')
