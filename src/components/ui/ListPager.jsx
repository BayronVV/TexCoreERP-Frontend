import styles from '../Inventory/Inventory.module.css'

/**
 * Barra reutilizable de conteo de registros encontrados y navegación por páginas (TE-177).
 */
export default function ListPager({
  count = 0,
  page = 1,
  pageSize = 50,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  noun = 'registros',
}) {
  const safeCount = Number(count || 0)
  const safePage = Math.max(1, Number(page || 1))
  const safePages = Math.max(1, Number(totalPages || 1))
  const start = safeCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = safeCount === 0 ? 0 : Math.min(safeCount, safePage * pageSize)

  return (
    <div className={styles.pagerBar} role="navigation" aria-label="Paginación de resultados">
      <span className={styles.muted}>
        {safeCount === 0
          ? `0 ${noun} encontrados`
          : `Mostrando ${start}–${end} de ${safeCount.toLocaleString('es-CO')} ${noun}`}
      </span>
      <div className={styles.pagerControls}>
        {onPageSizeChange && (
          <label className={styles.pagerSize}>
            Por página
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label="Registros por página"
            >
              {[25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Anterior
        </button>
        <span className={styles.pagerPage}>
          Página {safePage} de {safePages}
        </span>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={safePage >= safePages || safeCount === 0}
          onClick={() => onPageChange(safePage + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
