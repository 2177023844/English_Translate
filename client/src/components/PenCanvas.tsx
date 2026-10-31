import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

const STROKE_COLOR = '#e11d48'

interface Props {
  /** 是否处于批注模式：开启后画布接收指针事件 */
  active: boolean
  /** 值变化时清空笔迹（切换题目或点击清除） */
  resetKey: string | number
  children: ReactNode
}

/** 在内容上叠一层透明画布，用于自由圈画；画布高度跟随内容，随内容一起滚动 */
export default function PenCanvas({ active, resetKey, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)

  function prepare(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const dpr = window.devicePixelRatio || 1
    const width = wrap.clientWidth
    const height = wrap.clientHeight
    if (width === 0 || height === 0) return null

    const nextW = Math.round(width * dpr)
    const nextH = Math.round(height * dpr)
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = STROKE_COLOR
    return ctx
  }

  function clear() {
    const wrap = wrapRef.current
    const ctx = prepare()
    if (wrap && ctx) ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight)
  }

  // 内容尺寸变化（批改后卡片变高、窗口缩放）时重新适配画布，并保留已有笔迹
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    prepare()
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      // prepare() 在尺寸变化时会重建画布，先把旧笔迹留下来，尺寸变了再画回去
      const oldW = canvas.width
      const oldH = canvas.height
      const snapshot = document.createElement('canvas')
      snapshot.width = oldW
      snapshot.height = oldH
      const sctx = snapshot.getContext('2d')
      if (sctx && oldW > 0 && oldH > 0) sctx.drawImage(canvas, 0, 0)

      const ctx = prepare()
      if (!ctx || !sctx) return
      if (canvas.width !== oldW || canvas.height !== oldH) {
        const dpr = window.devicePixelRatio || 1
        ctx.drawImage(snapshot, 0, 0, snapshot.width / dpr, snapshot.height / dpr)
      }
    })
    observer.observe(wrap)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  function toLocal(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active) return
    const ctx = prepare()
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toLocal(e)
    drawingRef.current = true
    lastRef.current = p
    ctx.beginPath()
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
    ctx.fillStyle = STROKE_COLOR
    ctx.fill()
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!active || !drawingRef.current) return
    const ctx = prepare()
    const last = lastRef.current
    if (!ctx) return
    const p = toLocal(e)
    if (last) {
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    lastRef.current = p
  }

  function endStroke(e: ReactPointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false
    lastRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {children}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        className={`absolute left-0 top-0 z-20 ${
          active ? 'pointer-events-auto cursor-crosshair touch-none' : 'pointer-events-none'
        }`}
      />
    </div>
  )
}
