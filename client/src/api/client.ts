import axios from 'axios'

/** axios 实例：开发环境经 Vite 代理，生产环境同源，均为 /api 前缀 */
export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

/** 后端返回 {error, details} 时抛出带中文信息的 Error */
export function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
    if (e.code === 'ECONNABORTED') return '请求超时，请重试'
    return e.message
  }
  return String(e)
}
