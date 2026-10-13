import React, { useState } from 'react'
import styles from './Production.module.css'

const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

export default function SettlementApprovalModal({ order, onClose, onConfirm }) {
  const [approverName, setApproverName] = useState('Mariana Giraldo (Costos y Presupuestos)')
  const [auditNotes, setAuditNotes] = useState('Conciliación de rollos de denim y remesas de satélite verificadas conforme.')
  const [confirmedCheck, setConfirmedCheck] = useState(true)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!confirmedCheck) return
    onConfirm({ approverName, auditNotes })
  }

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <h3>Aprobar Liquidación de Orden {order.codigo}</h3>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar modal">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <p className={styles.subtitle} style={{ marginBottom: '1rem' }}>
              Al aprobar esta liquidación, se fijan los costos contables de Materiales y Mano de Obra para el cierre del lote <strong>{order.lote}</strong>.
            </p>

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.86rem' }}>
                <span style={{ color: '#64748b' }}>Referencia:</span>
                <strong>{order.referencia}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.86rem' }}>
                <span style={{ color: '#64748b' }}>Costo Total Liquidado:</span>
                <strong style={{ color: '#0a1038' }}>{formatCOP(order.resumen.totales.real)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                <span style={{ color: '#64748b' }}>Costo Unitario Real:</span>
                <strong style={{ color: '#0f766e' }}>{formatCOP(order.resumen.totales.costo_unitario_real)} / und</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Responsable de Aprobación
                </label>
                <input
                  type="text"
                  required
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Observaciones de Cierre Contable
                </label>
                <textarea
                  rows="3"
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className={styles.searchInput}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={confirmedCheck}
                  onChange={(e) => setConfirmedCheck(e.target.checked)}
                />
                Confirmo que revisé las mermas de tela y los pagos de satélites.
              </label>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!confirmedCheck}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              Confirmar y Aprobar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
