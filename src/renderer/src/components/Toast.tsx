import React, { useState } from 'react'

export interface Toast {
  id: number
  message: string
  type: ToastType
  exiting: boolean
}

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface UseToastReturn {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => number
  removeToast: (id: number) => void
}

let toastId = 0

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = (id: number): void => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 260)
  }

  const addToast = (message: string, type: ToastType = 'info', duration = 4000): number => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type, exiting: false }])
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }

  return { toasts, addToast, removeToast }
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    '💬'
}

interface ToastContainerProps {
  toasts: Toast[]
  removeToast: (id: number) => void
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps): React.ReactElement {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}${t.exiting ? ' exiting' : ''}`}>
          <span className="toast-icon">{ICONS[t.type] ?? '💬'}</span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
