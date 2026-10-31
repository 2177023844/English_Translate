import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config, ROOT_DIR } from './config.js'
import { runMigrations } from './db.js'
import { attachUser } from './middleware/attachUser.js'
import { booksRouter } from './routes/books.js'
import { studyRouter } from './routes/study.js'
import { reviewRouter } from './routes/review.js'
import { favoritesRouter } from './routes/favorites.js'
import { wordsRouter } from './routes/words.js'
import { statsRouter } from './routes/stats.js'
import { settingsRouter } from './routes/settings.js'
import { spellRouter } from './routes/spell.js'
import { translateRouter } from './routes/translate.js'
import { papersRouter } from './routes/papers.js'
import { paperSetsRouter } from './routes/paperSets.js'
import { ensurePaperCatalog } from './services/paperCatalog.js'

runMigrations()
ensurePaperCatalog()

const app = express()
// Nginx 反代后正确识别客户端 IP（限流日志用）
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json())

// 全站 API 轻量限流（个人站防滥用；将来认证路由可再加更严限流）
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: Date.now() })
})

// 单用户占位中间件（预留认证位）：所有业务路由经此注入 userId
app.use('/api', attachUser)
app.use('/api/books', booksRouter)
app.use('/api/words', wordsRouter)
app.use('/api/study', studyRouter)
app.use('/api/review', reviewRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/stats', statsRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/spell', spellRouter)
app.use('/api/translate', translateRouter)
app.use('/api/papers', papersRouter)
app.use('/api/paper-sets', paperSetsRouter)
// 预留：将来接入认证时在此挂载 /api/auth 路由

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 生产环境：同源托管前端构建产物 + SPA 回退
if (config.NODE_ENV === 'production') {
  const clientDist = path.join(ROOT_DIR, 'client', 'dist')
  app.use(express.static(clientDist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

// 统一错误处理（Express 5 会捕获 async 错误）
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] 未处理错误:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

app.listen(config.PORT, () => {
  console.log(`[server] http://localhost:${config.PORT} (${config.NODE_ENV})`)
})
