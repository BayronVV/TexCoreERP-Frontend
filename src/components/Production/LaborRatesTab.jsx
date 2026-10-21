import React, { useState } from 'react'
import { apiRequest } from '../../api/client'
import { formatPesos, localDateISO } from './costSettlement'
import { useAuth } from '../../auth/session'
import styles from './Settlement.module.css'

const STAGES = [
  { code: 'CORTE', name: 'Corte' },
  { code: 'CONFECCION', name: 'Confección' },
  { code: 'TERMINACION', name: 'Terminación' },
]

/**
 * Pestaña «Tarifas por Minuto»: historial de vigencias por etapa y, con `produccion.gestionar`, formulario para registrar una nueva
 * (nunca se edita ni se borra una anterior).
 * @param {{ rates: object[], onReload: () => void, notify: (message: string, type?: string) => void }} props
 */
export default function LaborRatesTab({ rates, onReload, notify }) {
  const { can } = useAuth()
  const canManage = can('produccion.gestionar')

  const [stage, setStage] = useState('CORTE')
  const [minuteRate, setMinuteRate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => localDateISO())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg(null)

    const numRate = parseFloat(minuteRate)
    if (!numRate || numRate <= 0) {
      setErrorMsg('El costo por minuto debe ser un número positivo mayor que cero.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiRequest('/api/produccion/tarifas/', {
        method: 'POST',
        body: {
          etapa: stage,
          costo_minuto: numRate.toFixed(4),
          vigente_desde: effectiveDate || null,
        },
      })
      if (notify) {
        notify('Nueva vigencia de tarifa registrada con éxito.', 'success')
      }
      setMinuteRate('')
      if (onReload) {
        onReload()
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al registrar la tarifa.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarTitleBox}>
          <h2>Tarifas de Mano de Obra por Minuto</h2>
          <p>
            Historial de tarifas vigentes por etapa de producción. Cada etapa se costea con la tarifa vigente a la fecha de fin.
          </p>
        </div>
      </div>

      {canManage && (
        <form onSubmit={handleSubmit} className={styles.rateFormBox}>
          <h3 className={styles.rateFormTitle}>Registrar Nueva Vigencia de Tarifa</h3>
          {errorMsg && <div className={styles.warningBanner}>{errorMsg}</div>}

          <div className={styles.rateFormGrid}>
            <div className={styles.rateFieldGroup}>
              <label htmlFor="stageSelect" className={styles.rateFieldLabel}>
                Etapa Productiva
              </label>
              <select
                id="stageSelect"
                className={styles.selectFilter}
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {STAGES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.rateFieldGroup}>
              <label htmlFor="minuteRateInput" className={styles.rateFieldLabel}>
                Costo por Minuto (COP)
              </label>
              <input
                id="minuteRateInput"
                type="number"
                step="0.0001"
                min="0.0001"
                placeholder="Ej. 250.00"
                className={styles.rateInput}
                value={minuteRate}
                onChange={(e) => setMinuteRate(e.target.value)}
                required
              />
            </div>

            <div className={styles.rateFieldGroup}>
              <label htmlFor="effectiveDateInput" className={styles.rateFieldLabel}>
                Vigente Desde
              </label>
              <input
                id="effectiveDateInput"
                type="date"
                className={styles.rateInput}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>

            <div className={styles.rateFieldBtnBox}>
              <button
                type="submit"
                disabled={isSubmitting}
                className={styles.btnSaveRate}
              >
                {isSubmitting ? 'Guardando...' : '+ Guardar Tarifa'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Costo por Minuto</th>
              <th>Vigente Desde</th>
              <th>Registrado Por</th>
              <th>Fecha de Creación</th>
            </tr>
          </thead>
          <tbody>
            {(!rates || rates.length === 0) ? (
              <tr>
                <td colSpan={5} className={styles.emptyTable}>
                  No hay tarifas de mano de obra registradas.
                </td>
              </tr>
            ) : (
              rates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className={styles.stageTag}>{t.etapa_nombre || t.etapa}</span>
                  </td>
                  <td className={styles.colMoney}>
                    <strong>{formatPesos(parseFloat(t.costo_minuto))}/min</strong>
                  </td>
                  <td>{t.vigente_desde}</td>
                  <td>{t.creado_por_nombre || '—'}</td>
                  <td>{t.created_at ? t.created_at.slice(0, 10) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
