import { useCallback, useState } from 'react'
import { ToastContext } from './toastContext'
import styles from './ui.module.css'

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const notify = useCallback((message, type = 'success') => {
    const id = ++nextId
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={styles.toastStack}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[toast.type]}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
