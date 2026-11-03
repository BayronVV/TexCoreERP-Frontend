import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../api/client';
import { useAuth } from '../../auth/session';
import { todayISO } from '../Inventory/labels';
import { recentEntries } from '../Finished/finished';
import styles from './Dashboard.module.css';

/**
 * Inicio: saludo, tarjeta con las solicitudes de acceso pendientes (si el rol gestiona usuarios), el aviso de nuevo stock de
 * producto terminado de los últimos 7 días (si el rol puede ver producto terminado) y las alertas de stock mínimo de inventario
 * (si el rol puede ver inventario).
 */
const Dashboard = () => {
  const { user, can } = useAuth();
  const canReviewUsers = can('seguridad.gestionar');
  const canSeeInventory = can('inventario.ver');
  const canSeeFinished = can('producto_terminado.ver');
  const [newStock, setNewStock] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsReady, setAlertsReady] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!canSeeInventory) return;
    apiGet('/api/inventario/alertas/')
      .then((payload) => {
        setAlerts(payload.alerts || []);
        setAlertsReady(true);
      })
      .catch(() => setAlertsError('No se pudieron cargar las alertas de inventario.'));
  }, [canSeeInventory]);

  // Ingresos recientes de producto terminado: el aviso de nuevo stock para quien vende y consulta.
  useEffect(() => {
    if (!canSeeFinished) return;
    apiGet('/api/terminado/ingresos/?limit=20')
      .then((entries) => setNewStock(recentEntries(entries, todayISO(), 7)))
      .catch(() => setNewStock([]));
  }, [canSeeFinished]);

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

      {canSeeFinished && newStock.length > 0 && (
        <Link to="/producto-terminado/existencias" className={styles.stockCard}>
          <strong>Nuevo stock de producto terminado</strong>
          <ul>
            {newStock.slice(0, 5).map((entry) => (
              <li key={entry.id}>{entry.aptas} prendas de {entry.referencia_nombre} · lote {entry.lote_codigo}</li>
            ))}
          </ul>
          <span>Ver existencias →</span>
        </Link>
      )}

      {canSeeInventory && alertsError && <p className={styles.alertWarning}>{alertsError}</p>}

      {canSeeInventory && alertsReady && alerts.length === 0 && (
        <p className={styles.alertOk} role="status">
          Inventario en orden: ningún producto está por debajo de su stock mínimo.
        </p>
      )}

      {canSeeInventory && alerts.length > 0 && (
        <section className={styles.alertPanel}>
          <div className={styles.alertHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Alertas</p>
              <h3>Indicadores de inventario</h3>
            </div>
            <span className={styles.alertCounter}>{alerts.length}</span>
          </div>

          <div className={styles.alertList}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`${styles.alertItem} ${alert.severity === 'critical' ? styles.alertItemCritical : styles.alertItemWarning}`}
              >
                <div className={styles.alertIcon} aria-hidden="true">!</div>
                <div className={styles.alertText}>
                  <strong>{alert.name}</strong>
                  <p>{alert.message}</p>
                  <span>
                    Stock: {Number(alert.stock).toLocaleString('es-CO')} {alert.unit} · Mínimo: {Number(alert.threshold).toLocaleString('es-CO')} {alert.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Link to="/inventario" className={styles.alertLink}>Ir a Inventario →</Link>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
