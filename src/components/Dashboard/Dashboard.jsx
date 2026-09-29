import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, apiGet } from '../../api/client';
import { useAuth } from '../../auth/session';
import styles from './Dashboard.module.css';

const demoAlerts = [
  { id: 1, name: 'Tela algodón 180 gr', stock: '18', unit: 'm', severity: 'warning', message: 'Stock por debajo del mínimo recomendado.' },
  { id: 2, name: 'Hilo poliéster', stock: '0', unit: 'kg', severity: 'critical', message: 'Sin stock disponible.' },
];

const InventoryMovementForms = ({ role }) => {
  const [formType, setFormType] = useState('entry');

  return (
    <section className={styles.inventoryPanel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.sectionEyebrow}>Inventario</p>
          <h3>Movimientos de almacén</h3>
        </div>

        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${formType === 'entry' ? styles.toggleBtnActive : ''}`}
            onClick={() => setFormType('entry')}
          >
            Ingreso (Compras)
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${formType === 'exit' ? styles.toggleBtnActive : ''}`}
            onClick={() => setFormType('exit')}
          >
            Salida (Producción)
          </button>
        </div>
      </div>

      {formType === 'entry' ? (
        <form className={styles.formGrid}>
          <div className={styles.fieldGroup}>
            <label>Materia prima / insumo</label>
            <input type="text" placeholder="Ej. Tela algodón 180 gr" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Proveedor</label>
            <input type="text" placeholder="Nombre del proveedor" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Orden de compra</label>
            <input type="text" placeholder="OC-00123" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Cantidad</label>
            <input type="number" placeholder="150" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Unidad</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona</option>
              <option value="kg">kg</option>
              <option value="m">m</option>
              <option value="rollos">rollos</option>
              <option value="cajas">cajas</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label>Lote / código</label>
            <input type="text" placeholder="L-2026-01" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Fecha de ingreso</label>
            <input type="date" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Responsable</label>
            <input type="text" placeholder="Nombre del almacenero" />
          </div>

          <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
            <label>Observaciones</label>
            <textarea rows="3" placeholder="Detalle adicional del ingreso" />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryBtn}>Limpiar</button>
            <button type="submit" className={styles.primaryBtn}>Guardar ingreso</button>
          </div>
        </form>
      ) : (
        <form className={styles.formGrid}>
          <div className={styles.fieldGroup}>
            <label>Materia prima / insumo</label>
            <input type="text" placeholder="Ej. Hilo polyester" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Destino</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona</option>
              <option value="tintoreria">Tintorería</option>
              <option value="corte">Corte</option>
              <option value="confeccion">Confección</option>
              <option value="control_calidad">Control de calidad</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label>Orden de producción</label>
            <input type="text" placeholder="OP-0154" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Cantidad</label>
            <input type="number" placeholder="80" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Lote / código</label>
            <input type="text" placeholder="L-2026-03" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Fecha de salida</label>
            <input type="date" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Responsable</label>
            <input type="text" placeholder="Nombre del operario" />
          </div>

          <div className={styles.fieldGroup}>
            <label>Unidad</label>
            <select defaultValue="">
              <option value="" disabled>Selecciona</option>
              <option value="kg">kg</option>
              <option value="m">m</option>
              <option value="rollos">rollos</option>
              <option value="unidades">unidades</option>
            </select>
          </div>

          <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
            <label>Observaciones</label>
            <textarea rows="3" placeholder="Detalle del traslado a producción" />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryBtn}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn}>Registrar salida</button>
          </div>
        </form>
      )}
    </section>
  );
};

const Dashboard = ({ forceInventoryView = false }) => {
  const { user, can } = useAuth();
  const role = user.role;
  const canReviewUsers = can('seguridad.gestionar');
  const canSeeInventory = can('inventario.ver');
  const canMoveInventory = can('inventario.gestionar');
  const [alerts, setAlerts] = useState([]);
  const [alertsError, setAlertsError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!canSeeInventory) return;
    const token = localStorage.getItem('access_token');

    fetch(`${API_URL}/api/inventory/alerts/`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudo cargar la información de alertas.');
        }
        const payload = await response.json();
        setAlerts(payload.alerts || []);
      })
      .catch(() => {
        setAlerts(demoAlerts);
        setAlertsError('Mostrando alertas de ejemplo mientras no hay respuesta del backend.');
      });
  }, [canSeeInventory]);

  // Registros que esperan que un administrador les asigne rol.
  useEffect(() => {
    if (!canReviewUsers) return;
    apiGet('/api/users/?role=PENDING')
      .then((users) => setPendingCount(users.filter((u) => u.is_active).length))
      .catch(() => setPendingCount(0));
  }, [canReviewUsers]);

  return (
    <div className={styles.mainContent}>
      <div className={styles.welcome}>
        <h1>Hola, {user.first_name || user.full_name}</h1>
        <p>{user.role_name}</p>
      </div>

      {pendingCount > 0 && (
        <Link to="/seguridad/usuarios" className={styles.pendingCard}>
          <strong>
            {pendingCount} {pendingCount === 1 ? 'solicitud de acceso pendiente' : 'solicitudes de acceso pendientes'}
          </strong>
          <span>Revisar y asignar rol →</span>
        </Link>
      )}

      {forceInventoryView ? (
        <InventoryMovementForms role={role || 'ALMACENISTA'} />
      ) : (
        <>
          {canSeeInventory && alerts.length > 0 && (
            <section className={styles.alertPanel}>
              <div className={styles.alertHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Alertas</p>
                  <h3>Indicadores de inventario</h3>
                </div>
                <span className={styles.alertCounter}>{alerts.length}</span>
              </div>

              {alertsError && <p className={styles.alertWarning}>{alertsError}</p>}

              <div className={styles.alertList}>
                {alerts.map((alert) => (
                  <div
                    key={alert.id ?? `${alert.name}-${alert.stock}`}
                    className={`${styles.alertItem} ${alert.severity === 'critical' ? styles.alertItemCritical : styles.alertItemWarning}`}
                  >
                    <div className={styles.alertIcon} aria-hidden="true">!</div>
                    <div className={styles.alertText}>
                      <strong>{alert.name}</strong>
                      <p>{alert.message}</p>
                      <span>
                        Stock: {alert.stock} {alert.unit || ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {canMoveInventory && (
            <InventoryMovementForms role={role} />
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
