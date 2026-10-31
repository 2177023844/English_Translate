import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

/** 请求体 zod 校验中间件：校验失败返回 400 与字段错误信息 */
export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: '参数错误', details: result.error.flatten() })
      return
    }
    req.body = result.data
    next()
  }
}
