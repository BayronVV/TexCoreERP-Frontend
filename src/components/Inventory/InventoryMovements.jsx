import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../api/client';
import styles from './InventoryMovements.module.css';

const entryFields = [
  { key: 'material', label: 'Materia prima / insumo', type: 'text', placeholder: 'Ej. Tela algodón 180 gr' },
  { key: 'supplier', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor' },
  { key: 'purchaseOrder', label: 'Orden de compra', type: 'text', placeholder: 'OC-00123' },
  { key: 'quantity', label: 'Cantidad', type: 'number', placeholder: '150' },
  { key: 'unit', label: 'Unidad', type: 'select', options: ['kg', 'm', 'rollos', 'cajas'] },
  { key: 'lot', label: 'Lote / código', type: 'text', placeholder: 'L-2026-01' },
  { key: 'entryDate', label: 'Fecha de ingreso', type: 'date' },
  { key: 'responsible', label: 'Responsable', type: 'text', placeholder: 'Nombre del almacenero' },
];

const exitFields = [
  { key: 'material', label: 'Materia prima / insumo', type: 'text', placeholder: 'Ej. Hilo polyester' },
  { key: 'destination', label: 'Destino', type: 'select', options: ['Tintorería', 'Corte', 'Confección', 'Control de calidad'] },
  { key: 'productionOrder', label: 'Orden de producción', type: 'text', placeholder: 'OP-0154' },
  { key: 'quantity', label: 'Cantidad', type: 'number', placeholder: '80' },
  { key: 'lot', label: 'Lote / código', type: 'text', placeholder: 'L-2026-03' },
  { key: 'exitDate', label: 'Fecha de salida', type: 'date' },
  { key: 'responsible', label: 'Responsable', type: 'text', placeholder: 'Nombre del operario' },
  { key: 'unit', label: 'Unidad', type: 'select', options: ['kg', 'm', 'rollos', 'unidades'] },
];

const getDefaultFormData = (mode) => {
  const fields = mode === 'entry' ? entryFields : exitFields;
  return fields.reduce((acc, field) => {
    acc[field.key] = '';
    return acc;
  }, {});
};

const inventoryRows = [
  { item: 'Tela algodón 180 gr', stock: 28, threshold: 40, unit: 'm' },
  { item: 'Hilo poliéster', stock: 64, threshold: 50, unit: 'kg' },
  { item: 'Botón de camisa', stock: 110, threshold: 80, unit: 'cajas' },
  { item: 'Cierre industrial', stock: 18, threshold: 30, unit: 'rollos' },
];

const InventoryMovements = () => {
  const [mode, setMode] = useState('entry');
  const [stockActual, setStockActual] = useState(120);
  const [formData, setFormData] = useState(getDefaultFormData('entry'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentFields = mode === 'entry' ? entryFields : exitFields;
  const criticalItems = inventoryRows.filter((row) => row.stock <= row.threshold).length;
  const lowStockWarning = stockActual <= 40;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => {
    const payload = {
      item_id: 1,
      movement_type: mode === 'entry' ? 'INGRESO' : 'SALIDA',
      quantity: Number(formData.quantity || 0),
      reference: mode === 'entry' ? formData.purchaseOrder || 'OC-SIN-REFERENCIA' : formData.productionOrder || 'OP-SIN-REFERENCIA',
      notes: formData.observations || '',
    };

    return payload;
  };

  const saveMovement = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('No hay sesión activa. Inicia sesión para guardar el movimiento.');
    }

    const payload = buildPayload();

    const endpoint = `${API_URL}/api/inventory/movements/`;

    return axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  };

  const validateStockBeforeSubmit = () => {
    if (mode === 'exit') {
      const quantity = Number(formData.quantity || 0);

      if (quantity > stockActual) {
        const message = `La salida supera el stock disponible. Stock actual: ${stockActual} unidades.`;
        setError(message);
        alert(message);
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!validateStockBeforeSubmit()) {
      return;
    }

    setSaving(true);

    try {
      await saveMovement();

      if (mode === 'exit') {
        setStockActual((prev) => Math.max(0, prev - Number(formData.quantity || 0)));
      } else {
        setStockActual((prev) => prev + Number(formData.quantity || 0));
      }

      alert(mode === 'entry' ? 'Ingreso registrado correctamente.' : 'Salida registrada correctamente.');
      setFormData(getDefaultFormData(mode));
    } catch (err) {
      console.error('Error guardando movimiento:', err);
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'No se pudo guardar el movimiento. Revisa la conexión con el backend.';
      setError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError('');
    setFormData(getDefaultFormData(newMode));
  };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>Inventario</p>
          <h1>Movimientos de almacén</h1>
        </div>
        <button type="button" className={styles.primaryButton}>
          Exportar
        </button>
      </header>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Entradas hoy</span>
          <strong>18</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Salidas hoy</span>
          <strong>12</strong>
        </div>
        <div className={`${styles.summaryCard} ${lowStockWarning ? styles.summaryCardAlert : ''}`}>
          <span>Stock actual</span>
          <strong>{stockActual}</strong>
        </div>
      </div>

      <div className={`${styles.alertBanner} ${lowStockWarning ? styles.alertBannerActive : ''}`}>
        <div className={styles.alertContent}>
          <span className={styles.alertDot} aria-hidden="true" />
          <div>
            <strong>{lowStockWarning ? 'Alerta de stock crítico' : 'Todo en orden'}</strong>
            <p>
              {lowStockWarning
                ? `El stock disponible está por debajo del mínimo recomendado. Hay ${criticalItems} insumos con nivel bajo.`
                : 'No hay indicadores de riesgo en el inventario actual.'}
            </p>
          </div>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.headerRow}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabButton} ${mode === 'entry' ? styles.tabButtonActive : ''}`}
              onClick={() => handleModeChange('entry')}
            >
              Ingreso (Compras)
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${mode === 'exit' ? styles.tabButtonActive : ''}`}
              onClick={() => handleModeChange('exit')}
            >
              Salida (Producción)
            </button>
          </div>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.formGrid} onSubmit={handleSubmit}>
          {currentFields.map((field) => (
            <div key={field.key} className={styles.fieldGroup}>
              <label htmlFor={field.key}>{field.label}</label>

              {field.type === 'select' ? (
                <select
                  id={field.key}
                  value={formData[field.key]}
                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                >
                  <option value="">Selecciona</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  id={field.key}
                  rows="3"
                  value={formData[field.key] || ''}
                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                  placeholder={field.placeholder || ''}
                />
              ) : (
                <input
                  id={field.key}
                  type={field.type}
                  value={formData[field.key] || ''}
                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                  placeholder={field.placeholder || ''}
                />
              )}
            </div>
          ))}

          <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
            <label htmlFor="observations">Observaciones</label>
            <textarea
              id="observations"
              rows="3"
              value={formData.observations || ''}
              onChange={(event) => handleFieldChange('observations', event.target.value)}
              placeholder={mode === 'entry' ? 'Detalle adicional del ingreso' : 'Detalle del traslado a producción'}
            />
          </div>

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setFormData(getDefaultFormData(mode))}
            >
              Limpiar
            </button>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? 'Guardando...' : mode === 'entry' ? 'Guardar ingreso' : 'Registrar salida'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableHeader}>
          <h2>Inventario por materia prima</h2>
          <span className={styles.tableBadge}>Indicadores</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Stock</th>
                <th>Umbral</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map((row) => {
                const isCritical = row.stock <= row.threshold;

                return (
                  <tr key={row.item} className={isCritical ? styles.rowCritical : ''}>
                    <td>{row.item}</td>
                    <td>
                      {row.stock} {row.unit}
                    </td>
                    <td>{row.threshold} {row.unit}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${isCritical ? styles.statusBadgeDanger : styles.statusBadgeOk}`}>
                        {isCritical ? 'Crítico' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default InventoryMovements;
