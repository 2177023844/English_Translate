import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// 项目根目录：本文件位于 server/src（开发）或 server/dist（生产），向上两级即根目录
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = path.resolve(__dirname, '../..')

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  DATABASE_PATH: z.string().default('server/data/app.db'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('环境变量配置错误:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2))
  process.exit(1)
}

export const config = parsed.data

/** 解析数据库路径：相对路径一律以项目根目录为基准 */
export function resolveDbPath(dbPath: string): string {
  return path.isAbsolute(dbPath) ? dbPath : path.join(ROOT_DIR, dbPath)
}
