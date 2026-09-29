import { useId, useState } from 'react'
import { ACCEPT, MAX_FILES, checkFile } from './evidence'
import styles from './Inventory.module.css'

// Foto o PDF de respaldo (factura, remisión, guía). Es opcional.
export default function EvidencePicker({ files, onChange }) {
  const inputId = useId()
  const [problem, setProblem] = useState('')

  const add = (event) => {
    const picked = Array.from(event.target.files)
    event.target.value = ''
    const invalid = picked.map(checkFile).find(Boolean)
    if (invalid) return setProblem(invalid)
    if (files.length + picked.length > MAX_FILES) return setProblem(`Máximo ${MAX_FILES} archivos.`)
    setProblem('')
    onChange([...files, ...picked])
  }

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>Evidencias (foto o PDF)</label>
      <input id={inputId} type="file" accept={ACCEPT} multiple onChange={add} />
      <span className={styles.hint}>Factura, remisión o fotos del material. Hasta 5 MB por archivo.</span>
      {problem && <span className={styles.fieldError}>{problem}</span>}
      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className={styles.fileItem}>
              <span>{file.name}</span>
              <button
                type="button"
                className={`${styles.linkBtn} ${styles.dangerText}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
