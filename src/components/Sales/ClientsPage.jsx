import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import styles from '../Inventory/Inventory.module.css'
import ClientForm from './ClientForm'

/**
 * Ventas · Clientes, ruta `/ventas/clientes` (`ventas.ver`). Registrar, modificar y activar/desactivar exige `ventas.gestionar`;
 * un cliente no se borra, se desactiva. Su tipo decide el precio de lista y el descuento máximo.
 * Endpoints: `GET /api/ventas/clientes/`, `GET /api/ventas/metadatos/` y `PATCH /api/ventas/clientes/:id/`.
 */
export default function ClientsPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('ventas.gestionar')
  const [clients, setClients] = useState(null)
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (search.trim()) params.set('q', search.trim())
    if (type) params.set('tipo', type)
    apiGet(`/api/ventas/clientes/?${params}`).then((data) => (setClients(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [search, type])

  useEffect(() => {
    apiGet('/api/ventas/metadatos/').then(setMeta).catch((error) => setLoadError(error.message))
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const toggle = async (client) => {
    try {
      await apiRequest(`/api/ventas/clientes/${client.id}/`, { method: 'PATCH', body: { activo: !client.activo } })
      notify(client.activo ? 'Cliente desactivado.' : 'Cliente activado.')
      load()
    } catch (error) {
      setLoadError(error.message)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Clientes</h1>
        <p className={styles.subtitle}>
          A quién se le vende. El tipo de cliente decide el precio de lista (detal o mayorista) y el descuento máximo que se le puede dar.
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por nombre, código o documento" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar clientes" />
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todos los tipos</option>
            {(meta?.tipos_cliente ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
          </select>
          {canManage && <button type="button" className={styles.primaryBtn} onClick={() => setEditing({})}>Nuevo cliente</button>}
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {clients && clients.length === 0 && <p className={styles.empty}>{search || type ? 'Ningún cliente coincide con el filtro.' : 'Todavía no hay clientes registrados.'}</p>}
        {clients && clients.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Código</th><th>Nombre</th><th>Documento</th><th>Tipo</th><th>Ciudad</th><th>Teléfono</th><th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td><strong>{client.codigo}</strong></td>
                    <td>{client.nombre}</td>
                    <td>{client.tipo_documento} {client.documento}{client.dv ? `-${client.dv}` : ''}</td>
                    <td>{client.tipo_nombre} · máx. {client.descuento_maximo} %</td>
                    <td>{client.ciudad}</td>
                    <td>{client.telefono}</td>
                    <td>{client.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      {canManage && (
                        <>
                          <button type="button" className={styles.linkBtn} onClick={() => setEditing(client)}>Editar</button>{' '}
                          <button type="button" className={styles.linkBtn} onClick={() => toggle(client)}>{client.activo ? 'Desactivar' : 'Activar'}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <ClientForm client={editing.id ? editing : null} meta={meta} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}
