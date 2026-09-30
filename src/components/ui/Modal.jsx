import { useEffect, useId, useRef } from 'react'
import styles from './ui.module.css'

export default function Modal({ title, onClose, children, wide = false }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement
    // Foco en el primer campo del formulario (o en el diálogo si no hay campos).
    const firstField = dialogRef.current.querySelector('input, select, textarea')
    ;(firstField ?? dialogRef.current).focus()

    const onKey = (event) => event.key === 'Escape' && onCloseRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus?.focus?.()
    }
  }, [])

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`${styles.modal} ${wide ? styles.modalWide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
