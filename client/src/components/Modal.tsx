import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  className?: string
}

/** 居中弹窗：点击遮罩或按 Esc 关闭 */
export default function Modal({ open, onClose, children, title, className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className={`relative max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${className}`}>
        {title && <h3 className="mb-4 text-lg font-bold text-slate-800">{title}</h3>}
        {children}
      </div>
    </div>
  )
}
