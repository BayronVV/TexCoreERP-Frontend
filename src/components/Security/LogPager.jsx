import styles from './Security.module.css'

const PAGE_SIZE = 50

/** Paginador de las listas de accesos y auditoría. */
export default function LogPager({ count, page, setPage }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  return (
    <div className={styles.pager}>
      <span className={styles.muted}>{count} registros</span>
      <button type="button" className={styles.secondaryBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {pages}
      </span>
      <button type="button" className={styles.secondaryBtn} disabled={page >= pages} onClick={() => setPage(page + 1)}>
        Siguiente
      </button>
    </div>
  )
}
