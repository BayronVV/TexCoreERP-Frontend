import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import styles from '../Inventory/Inventory.module.css'
import shipStyles from './Shipping.module.css'
import GuideBadge from './GuideBadge'
import { colorKey, deliveredNotice, money, totalFreight } from './shipping'

// Envíos · Panel: el semáforo de las guías, las facturas que aún no tienen guía (lo más urgente), las novedades abiertas y las
// devoluciones por vendedor con su flete (que se le descuenta al vendedor: aquí solo se muestra).
export default function ShippingPanel() {
  const { can } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    apiGet('/api/envios/resumen/').then(setSummary).catch((error) => setLoadError(error.message))
  }, [])

  const noGuide = summary?.sin_guia
  const returns = summary?.devoluciones_por_vendedor ?? []
  const delivered = summary?.por_cobrar_entregadas ?? 0

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Envíos</p>
        <h1>Panel de envíos</h1>
        <p className={styles.subtitle}>El estado de cada guía de un vistazo: gris por despachar, azul en tránsito, amarillo con novedad, verde entregada y rojo devuelta.</p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {noGuide && noGuide.total > 0 && (
        <div className={`${shipStyles.alert} ${noGuide.vencidas > 0 ? shipStyles.alertVencida : shipStyles.alertAtencion}`} role="alert">
          <div>
            <strong>{noGuide.total} {noGuide.total === 1 ? 'factura sin guía' : 'facturas sin guía'}</strong>
            <p>
              Anota la guía lo antes posible.
              {noGuide.vencidas > 0 && ` ${noGuide.vencidas} ya ${noGuide.vencidas === 1 ? 'está vencida' : 'están vencidas'}.`}
              {noGuide.con_atencion > 0 && ` ${noGuide.con_atencion} ${noGuide.con_atencion === 1 ? 'pide' : 'piden'} atención.`}
            </p>
          </div>
          <Link to="/envios/pendientes" className={styles.primaryBtn}>Ir a «Por despachar»</Link>
        </div>
      )}
      {noGuide && noGuide.total === 0 && <p className={`${shipStyles.alert} ${shipStyles.alertOk}`}>Todas las facturas tienen su guía anotada.</p>}

      {summary && (
        <div className={shipStyles.cards}>
          {summary.estados.map((state) => (
            <Link key={state.codigo} to={`/envios/guias?estado=${state.codigo}`} className={`${shipStyles.stateCard} ${shipStyles[`top${colorKey(state.color).replace(/^./, (c) => c.toUpperCase())}`]}`}>
              <span>{state.nombre}</span>
              <strong>{state.cantidad}</strong>
            </Link>
          ))}
        </div>
      )}

      {delivered > 0 && (
        <p className={`${shipStyles.alert} ${shipStyles.alertOk}`}>
          <span>{deliveredNotice(delivered)}</span>
          <Link to="/ventas/cartera" className={styles.secondaryBtn}>Ir a Cartera</Link>
        </p>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Novedades abiertas</h2>
        {summary && summary.novedades.length === 0 && <p className={styles.empty}>No hay guías con novedad.</p>}
        {summary && summary.novedades.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Factura</th><th>Cliente</th><th>Transportadora y guía</th><th>Novedad</th><th>Estado</th></tr></thead>
              <tbody>
                {summary.novedades.map((guide) => (
                  <tr key={guide.id}>
                    <td><strong>{guide.factura_numero}</strong></td>
                    <td>{guide.cliente_nombre}<div className={styles.muted}>{guide.cliente_ciudad}</div></td>
                    <td>{guide.transportadora_nombre}<div className={styles.muted}>{guide.numero_guia}</div></td>
                    <td>{guide.novedad || '—'}</td>
                    <td><GuideBadge color={guide.color} name={guide.estado_nombre} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.muted}><Link className={styles.textLink} to="/envios/guias?estado=EN_NOVEDAD">Ver las guías con novedad</Link></p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Devoluciones por vendedor</h2>
        <p className={styles.muted}>El flete de una devolución se le descuenta al vendedor. Aquí solo se muestra.</p>
        {summary && returns.length === 0 && <p className={styles.empty}>No hay devoluciones.</p>}
        {returns.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Vendedor</th><th className={styles.num}>Guías devueltas</th><th className={styles.num}>Flete a descontar</th></tr></thead>
              <tbody>
                {returns.map((row) => (
                  <tr key={row.vendedor}>
                    <td>{row.vendedor || '—'}</td>
                    <td className={styles.num}>{row.guias}</td>
                    <td className={styles.num}>{money(row.flete)}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td className={styles.num}><strong>{returns.reduce((total, row) => total + (row.guias || 0), 0)}</strong></td>
                  <td className={styles.num}><strong>{money(totalFreight(returns))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={styles.actions}>
        <Link to="/envios/guias" className={styles.secondaryBtn}>Ver todas las guías</Link>
        <Link to="/envios/pendientes" className={styles.secondaryBtn}>Por despachar</Link>
        {can('envios.gestionar') && <Link to="/envios/relaciones" className={styles.primaryBtn}>Relaciones de despacho</Link>}
      </div>
    </div>
  )
}
