import React from 'react'
import styles from './Laundry.module.css'

export default function RemissionDocModal({ remission, onClose, onPrint }) {
  if (!remission) return null

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <h3>Guía de Remisión Oficial — {remission.codigo}</h3>
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
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>NIT: 901.450.789-2 • Confección y Ensamble de Jeans</p>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Medellín, Colombia • Planta Central</p>
              </div>
              <div className={styles.docConsecutive}>
                <h4>{remission.codigo}</h4>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Fecha: {remission.fecha_emision}</p>
                <p style={{ fontSize: '0.82rem', color: '#0369a1', fontWeight: 700 }}>
                  Retorno Estimado: {remission.fecha_entrega_estimada}
                </p>
              </div>
            </div>

            {/* Datos de la Lavandería y Transporte */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <div>
                <p style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Destino / Proveedor Lavandería</p>
                <p style={{ fontWeight: 800, color: '#0a1038' }}>{remission.lavanderia_nombre}</p>
                <p style={{ color: '#475569' }}>Contacto: {remission.contacto_lavanderia || 'Jefe de Planta'}</p>
              </div>
              <div>
                <p style={{ color: '#64748b', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>Logística & Transporte</p>
                <p style={{ fontWeight: 700, color: '#0a1038' }}>{remission.transportador_nombre || 'Conductor asignado'}</p>
                <p style={{ color: '#475569' }}>Vehículo: {remission.vehiculo_placa || 'Placa N/A'} • {remission.tulas_bultos} Tulas ({remission.peso_kg || 0} kg)</p>
              </div>
            </div>

            {/* Tabla de Lotes Ensamblados Remitidos */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0a1038', marginBottom: '0.5rem' }}>
              Detalle de Lotes Ensamblados Despachados a Lavado
            </h4>
            <div className={styles.tableContainer} style={{ marginBottom: '1rem' }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Lote / OP</th>
                    <th>Referencia Prenda</th>
                    <th>Proceso / Receta de Lavado</th>
                    <th className={styles.numeric}>Prendas</th>
                  </tr>
                </thead>
                <tbody>
                  {remission.lotes_detalle.map((lote) => (
                    <tr key={lote.id}>
                      <td>
                        <strong>{lote.codigo_lote}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{lote.op_codigo}</span>
                      </td>
                      <td>
                        <strong>{lote.referencia}</strong>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{lote.ficha_tecnica} • {lote.color_crudo}</span>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${styles.pillInLaundry}`}>
                          {lote.receta_nombre || remission.receta_nombre}
                        </span>
                        {lote.instrucciones_especiales && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#0369a1', marginTop: '0.2rem' }}>
                            Nota: {lote.instrucciones_especiales}
                          </span>
                        )}
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {lote.cantidad_a_enviar} und
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                    <td colSpan={3}>Total Prendas Remitidas:</td>
                    <td className={styles.numeric} style={{ color: '#0284c7', fontSize: '1.05rem' }}>
                      {remission.total_prendas} prendas
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {remission.observaciones && (
              <p style={{ fontSize: '0.82rem', color: '#475569', background: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                <strong>Observaciones de planta:</strong> {remission.observaciones}
              </p>
            )}

            {/* Firmas de Responsabilidad */}
            <div className={styles.signaturesRow}>
              <div className={styles.signBox}>
                <strong>Entrega Planta (TexCore)</strong>
                <p>{remission.responsable_despacho}</p>
              </div>
              <div className={styles.signBox}>
                <strong>Transportador</strong>
                <p>{remission.transportador_nombre || 'Firma Conductor'}</p>
              </div>
              <div className={styles.signBox}>
                <strong>Recibe Lavandería</strong>
                <p>Firma y Sello Recibido</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} style={{ width: 'auto' }} onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: 'auto' }} onClick={onPrint || (() => window.print())}>
            🖨️ Imprimir Guía de Remisión Física
          </button>
        </div>
      </div>
    </div>
  )
}
