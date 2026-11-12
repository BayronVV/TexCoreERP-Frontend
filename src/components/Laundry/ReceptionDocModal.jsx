import React from 'react'
import styles from './Laundry.module.css'

/**
 * Da formato de pesos colombianos sin decimales.
 * @param {number|string} val Valor numérico (lo no numérico cuenta como cero).
 * @returns {string} Por ejemplo `$ 35.000`.
 */
const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

/**
 * Modal con el acta de cotejo y reingreso de una recepción de lavandería (solo lectura, sin llamadas a la API).
 * @param {object} props
 * @param {object|null} props.reception Recepción a mostrar; con `null` no dibuja nada.
 * @param {function()} props.onClose Cierra el modal.
 * @param {function()} props.onPrint Imprime el acta.
 */
export default function ReceptionDocModal({ reception, onClose, onPrint }) {
  if (!reception) return null

  const lotes = reception.lotes_detalle || []

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalBox} style={{ maxWidth: '900px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h3>Acta Oficial de Cotejo y Reingreso de Lavandería — {reception.codigo}</h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
              Vinculada a la remisión de salida original: <strong>{reception.remision_codigo}</strong>
            </p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar modal">
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.remissionDoc}>
            {/* Cabecera del Documento */}
            <div className={styles.remissionDocHeader}>
              <div className={styles.docCompany}>
                <strong>TexCore<span>ERP</span></strong>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>NIT: 901.450.789-2 • Confección y Lavado Industrial de Jeans</p>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Medellín, Colombia • Planta Central de Producción</p>
              </div>
              <div className={styles.docConsecutive}>
                <h4 style={{ color: '#0284c7' }}>{reception.codigo}</h4>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Fecha Recepción: {reception.fecha_recepcion}</p>
                <p style={{ fontSize: '0.82rem', color: '#475569' }}>
                  Remisión Externa / Factura: <strong>{reception.factura_remision_externa || 'N/A'}</strong>
                </p>
              </div>
            </div>

            {/* Datos de Lavandería y Salida Original */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                background: '#f8fafc',
                padding: '0.85rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                border: '1px solid #e2e8f0',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <p style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Proveedor de Lavandería Externa
                </p>
                <p style={{ fontWeight: 800, color: '#0a1038' }}>{reception.lavanderia_nombre}</p>
                <p style={{ color: '#475569' }}>
                  NIT: {reception.lavanderia_nit || 'No registrado'} • Contacto: {reception.lavanderia_contacto || 'Jefe de Planta'}
                </p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Trazabilidad de Salida Original
                </p>
                <p style={{ fontWeight: 700, color: '#0a1038' }}>
                  Remisión Salida: {reception.remision_codigo}
                </p>
                <p style={{ color: '#475569' }}>
                  Despachada el: {reception.remision_fecha_emision} • Estado: <span style={{ color: '#059669', fontWeight: 700 }}>RETORNADA A PLANTA</span>
                </p>
              </div>
            </div>

            {/* Tabla de Cotejo de Cantidades */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0a1038', marginBottom: '0.5rem' }}>
              Cotejo de Cantidades: Enviadas vs Devueltas Conformes, Mermas y Daños
            </h4>
            <div className={styles.tableContainer} style={{ marginBottom: '1rem' }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Lote / Referencia</th>
                    <th className={styles.numeric}>Enviadas</th>
                    <th className={styles.numeric} style={{ color: '#059669' }}>Conformes</th>
                    <th className={styles.numeric} style={{ color: '#d97706' }}>Mermas</th>
                    <th className={styles.numeric} style={{ color: '#dc2626' }}>Daños</th>
                    <th className={styles.numeric}>Pérdida Financiera</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.codigo_lote}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                          {item.referencia} • {item.op_codigo}
                        </span>
                        {item.cantidad_merma > 0 && (
                          <span style={{ display: 'block', fontSize: '0.74rem', color: '#d97706', marginTop: '0.2rem' }}>
                            ⚠ Merma: {item.motivo_merma}
                          </span>
                        )}
                        {item.cantidad_danada > 0 && (
                          <span style={{ display: 'block', fontSize: '0.74rem', color: '#dc2626', marginTop: '0.15rem' }}>
                            ✕ Daño: {item.tipo_dano}
                          </span>
                        )}
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 700 }}>
                        {item.cantidad_enviada} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 800, color: '#059669' }}>
                        {item.cantidad_recibida_conforme} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 700, color: item.cantidad_merma > 0 ? '#d97706' : '#94a3b8' }}>
                        {item.cantidad_merma} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 700, color: item.cantidad_danada > 0 ? '#dc2626' : '#94a3b8' }}>
                        {item.cantidad_danada} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 800, color: item.costo_perdida > 0 ? '#b91c1c' : '#475569' }}>
                        {formatCOP(item.costo_perdida)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td>Totales Consolidados:</td>
                    <td className={styles.numeric}>{reception.total_enviado} und</td>
                    <td className={styles.numeric} style={{ color: '#059669' }}>{reception.total_recibido_conforme} und</td>
                    <td className={styles.numeric} style={{ color: '#d97706' }}>{reception.total_merma} und</td>
                    <td className={styles.numeric} style={{ color: '#dc2626' }}>{reception.total_danadas} und</td>
                    <td className={styles.numeric} style={{ color: '#b91c1c', fontSize: '1rem' }}>
                      {formatCOP(reception.costo_total_perdida)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Resumen de Liquidación Financiera */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#991b1b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Pérdida Financiera por Terceros
                </p>
                <h4 style={{ margin: '0.2rem 0', fontSize: '1.25rem', color: '#b91c1c', fontWeight: 800 }}>
                  {formatCOP(reception.costo_total_perdida)}
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#7f1d1d' }}>
                  {reception.total_merma + reception.total_danadas} prendas afectadas (asentadas como merma/daño)
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>
                  Servicio de Lavado Liquidado
                </p>
                <h4 style={{ margin: '0.2rem 0', fontSize: '1.25rem', color: '#1d4ed8', fontWeight: 800 }}>
                  {formatCOP(reception.costo_servicio_lavado)}
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e3a8a' }}>
                  Cobro liquidado por {reception.total_recibido_conforme} prendas conformes
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#065f46', textTransform: 'uppercase', fontWeight: 700 }}>
                  Estado de Inventario en Planta
                </p>
                <h4 style={{ margin: '0.2rem 0', fontSize: '1.1rem', color: '#059669', fontWeight: 800 }}>
                  Planta Interna (PLANTA)
                </h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#047857' }}>
                  Prendas devueltas y listas para control de calidad / terminación
                </p>
              </div>
            </div>

            {reception.observaciones && (
              <p style={{ fontSize: '0.82rem', color: '#475569', background: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                <strong>Observaciones de recepción:</strong> {reception.observaciones}
              </p>
            )}

            {/* Firmas de Responsabilidad */}
            <div className={styles.signaturesRow}>
              <div className={styles.signBox}>
                <strong>Recibe en Planta (TexCore)</strong>
                <p>{reception.responsable || 'Coordinador de Calidad'}</p>
              </div>
              <div className={styles.signBox}>
                <strong>Entrega Lavandería / Conductor</strong>
                <p>Firma y Documento</p>
              </div>
              <div className={styles.signBox}>
                <strong>V°B° Gerencia de Producción</strong>
                <p>Liquidación Financiera Aprobada</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ width: 'auto' }} onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: 'auto' }} onClick={onPrint || (() => window.print())}>
            🖨️ Imprimir Acta de Cotejo Física
          </button>
        </div>
      </div>
    </div>
  )
}
