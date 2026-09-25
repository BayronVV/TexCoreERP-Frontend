import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api/client';
import AdminPanel from './AdminPanel';
import Sidebar from '../Sidebar/Sidebar';
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
  const [role, setRole] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsError, setAlertsError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    const token = localStorage.getItem('access_token');

    if (!token) {
      navigate('/login');
      return;
    }

    setRole(userRole);

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
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  if (!role) return <div>Loading...</div>;

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <h2>TexCoreERP Dashboard</h2>
        <div className={styles.userInfo}>
          <span className={styles.roleBadge}>{role}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
        </div>
      </header>
      
      <div className={styles.body}>
        {role !== 'PENDING' && <Sidebar role={role} />}

        <main className={styles.mainContent}>
          {forceInventoryView ? (
            <InventoryMovementForms role={role || 'ALMACENISTA'} />
          ) : (
            <>
              {alerts.length > 0 && (
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

              {role === 'ADMIN' && <AdminPanel />}

              {(role === 'ALMACENISTA' || role === 'PRODUCCION') && (
                <InventoryMovementForms role={role} />
              )}

              {role === 'PENDING' && (
                <div className={styles.messageCard}>
                  <h3>Account Pending</h3>
                  <p>Your account is currently pending approval. Please wait until an Administrator assigns you a role.</p>
                </div>
              )}

              {role !== 'ADMIN' && role !== 'PENDING' && role !== 'ALMACENISTA' && role !== 'PRODUCCION' && (
                <div className={styles.messageCard}>
                  <h3>Bienvenido, {role}</h3>
                  <p>Este es tu panel personalizado según tu rol asignado en el sistema.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
