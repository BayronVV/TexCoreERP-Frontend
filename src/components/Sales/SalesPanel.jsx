import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import { formatDate, todayISO } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import salesStyles from './Sales.module.css'
import { dayResume, INVOICE_NOTICE, money } from './sales'

// Ventas · Panel: el aviso de que la factura es un comprobante interno, el resumen del día y las últimas facturas.
export default function SalesPanel() {
  const { can } = useAuth()
  const [invoices, setInvoices] = useState(null)
  const [loadError, setLoadError] = useState('')
  const today = todayISO()

  useEffect(() => {
    apiGet('/api/ventas/facturas/?limit=200').then(setInvoices).catch((error) => setLoadError(error.message))
  }, [])

  const resume = dayResume(invoices, today)

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Panel de ventas</h1>
        <p className={styles.subtitle}>Las ventas son contraentrega: la transportadora recauda y gira después, así que cada factura queda por cobrar.</p>
      </header>

      <p className={salesStyles.notice} role="note">{INVOICE_NOTICE} Se genera un PDF descargable de cada factura.</p>
      {loadError && <p className={styles.formError}>{loadError}</p>}

      <div className={salesStyles.kpis}>
        <div className={salesStyles.kpi}><span>Facturas de hoy</span><strong>{resume.emitidasHoy}</strong></div>
        <div className={salesStyles.kpi}><span>Vendido hoy</span><strong>{money(resume.vendidoHoy)}</strong></div>
        <div className={salesStyles.kpi}><span>Por cobrar</span><strong>{money(resume.porCobrar)}</strong></div>
        <div className={salesStyles.kpi}><span>Anuladas hoy</span><strong>{resume.anuladasHoy}</strong></div>
      </div>

      <div className={salesStyles.actions}>
        {can('ventas.gestionar') && <Link to="/ventas/nueva" className={styles.primaryBtn}>Nueva venta</Link>}
        <Link to="/ventas/facturas" className={styles.secondaryBtn}>Ver facturas</Link>
        <Link to="/ventas/clientes" className={styles.secondaryBtn}>Clientes</Link>
        <Link to="/ventas/precios" className={styles.secondaryBtn}>Precios</Link>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Últimas facturas</h2>
        {invoices && invoices.length === 0 && <p className={styles.empty}>Todavía no hay facturas. Las que emitas aparecen aquí.</p>}
        {invoices && invoices.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th className={styles.num}>Total</th><th>Estado</th></tr></thead>
              <tbody>
                {invoices.slice(0, 8).map((invoice) => (
                  <tr key={invoice.id} className={invoice.estado === 'ANULADA' ? salesStyles.rowVoided : ''}>
                    <td><strong>{invoice.numero}</strong></td>
                    <td>{formatDate(invoice.fecha)}</td>
                    <td>{invoice.cliente_nombre}</td>
                    <td className={styles.num}>{money(invoice.total)}</td>
                    <td>{invoice.estado === 'ANULADA' ? 'Anulada' : 'Por cobrar'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
