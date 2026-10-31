import type { NextFunction, Request, Response } from 'express'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number
    }
  }
}

/** 单用户固定 ID：种子脚本写入的 owner 用户 */
export const DEFAULT_USER_ID = 1

/**
 * 单用户占位中间件（预留认证位）。
 * 当前固定注入 owner 用户；将来接入注册/登录时，仅需在此处解析 token 并设置 req.userId，
 * 其余路由代码无需改动。
 */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  req.userId = DEFAULT_USER_ID
  next()
}
