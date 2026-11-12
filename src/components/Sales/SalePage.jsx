import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from '../Finished/Finished.module.css'
import { variantMatrix } from '../Finished/finished'
import salesStyles from './Sales.module.css'
import ClientForm from './ClientForm'
import { downloadInvoicePdf } from './invoiceFile'
import {
  cartRows, cartTotals, INVOICE_NOTICE, maxDiscountFor, money, saleBody, saleConfirmation, saleProblems, variantIndex,
} from './sales'

/**
 * Ventas · Nueva venta (punto de venta), ruta `/ventas/nueva` (`ventas.gestionar`). Se elige el cliente y, por referencia, las prendas de cada
 * talla y color (la matriz muestra lo disponible); cada línea lleva el descuento del vendedor, hasta el máximo del tipo de cliente y sin bajar del
 * costo de fábrica. Los totales se calculan igual que en el servidor, que valida y descuenta el inventario.
 * Endpoints: `GET /api/terminado/existencias/`, `/api/ventas/clientes/`, `/api/ventas/metadatos/`, `/api/ventas/precios/` y `POST /api/ventas/facturas/`.
 */
export default function SalePage() {
  const notify = useToast()
  const [meta, setMeta] = useState(null)
  const [clients, setClients] = useState([])
  const [references, setReferences] = useState([])
  const [prices, setPrices] = useState({})
  const [clientId, setClientId] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [cart, setCart] = useState({})
  const [carrier, setCarrier] = useState('')
  const [guide, setGuide] = useState('')
  const [notes, setNotes] = useState('')
  const [token, setToken] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)

  const loadStock = useCallback(() => {
    apiGet('/api/terminado/existencias/').then(setReferences).catch((error) => setLoadError(error.message))
  }, [])
  const loadClients = useCallback(() => {
    apiGet('/api/ventas/clientes/?activo=true&limit=200').then(setClients).catch((error) => setLoadError(error.message))
  }, [])

  useEffect(() => {
    apiGet('/api/ventas/metadatos/').then(setMeta).catch((error) => setLoadError(error.message))
    apiGet('/api/ventas/precios/').then((rows) => setPrices(Object.fromEntries(rows.map((row) => [row.referencia, row])))).catch((error) => setLoadError(error.message))
    loadStock()
    loadClients()
  }, [loadStock, loadClients])

  const client = clients.find((item) => String(item.id) === String(clientId)) ?? null
  const index = useMemo(() => variantIndex(references), [references])
  const rows = useMemo(() => cartRows({ cart, index, prices, client, meta }), [cart, index, prices, client, meta])
  const totals = cartTotals(rows)
  const problems = saleProblems({ client, rows })
  const reference = references.find((item) => String(item.referencia) === String(referenceId))
  const matrix = useMemo(() => {
    const variants = (reference?.colores ?? []).flatMap((row) => Object.entries(row.tallas).map(([talla, cell]) => ({ id: cell.variante, talla, color: row.color })))
    return variantMatrix(variants)
  }, [reference])

  const setField = (variantId, field, value) => setCart((current) => ({ ...current, [variantId]: { ...current[variantId], [field]: value } }))
  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  const submit = async (event) => {
    event.preventDefault()
    if (problems.length) return setErrors({ detail: problems[0] })
    if (!window.confirm(saleConfirmation(rows, totals, client))) return
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest('/api/ventas/facturas/', { method: 'POST', body: saleBody({ client, rows, transportadora: carrier, numeroGuia: guide, observaciones: notes, token }) })
      const withoutGuide = !guide.trim()
      notify(withoutGuide ? `Factura ${saved.numero} generada. Inventario descontado. Anota la guía cuanto antes en Envíos → Por despachar.` : `Factura ${saved.numero} generada. Inventario descontado.`)
      setLastInvoice({ ...saved, sinGuia: withoutGuide })
      setCart({})
      setNotes('')
      setGuide('')
      setToken(crypto.randomUUID())
      loadStock()
    } catch (error) {
      setErrors(fieldErrors(error))
      if (error.status === 400 || error.status === 409) loadStock() // el stock pudo cambiar: se recarga lo disponible
    } finally {
      setSaving(false)
    }
  }

  const pdf = async () => {
    try {
      await downloadInvoicePdf(lastInvoice)
    } catch (error) {
      setErrors({ detail: error.message })
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Nueva venta</h1>
        <p className={styles.subtitle}>Factura POS contraentrega: al confirmar se descuenta el inventario y se genera el PDF de la factura.</p>
      </header>

      <p className={salesStyles.notice} role="note">{INVOICE_NOTICE}</p>
      {loadError && <p className={styles.formError}>{loadError}</p>}

      {lastInvoice && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Factura {lastInvoice.numero} generada</h2>
          <p>Total a pagar contraentrega: <strong>{money(lastInvoice.total)}</strong> · {lastInvoice.unidades} prendas para {lastInvoice.cliente_nombre}.</p>
          {lastInvoice.sinGuia && <p className={salesStyles.notice} role="note">Esta factura quedó sin número de guía: anótala cuanto antes en Envíos → Por despachar.</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={pdf}>Descargar PDF</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setLastInvoice(null)}>Cerrar</button>
          </div>
        </section>
      )}

      <form onSubmit={submit} noValidate>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>1. Cliente</h2>
          <div className={salesStyles.clientBar}>
            <label className={styles.field}>
              Cliente
              <select value={clientId} onChange={(event) => setClientId(event.target.value)} aria-label="Cliente">
                <option value="">Elige el cliente</option>
                {clients.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo_documento} {item.documento}</option>)}
              </select>
              {err('cliente')}
            </label>
            <button type="button" className={styles.secondaryBtn} onClick={() => setCreatingClient(true)}>Nuevo cliente</button>
          </div>
          {client && (
            <p className={salesStyles.hint}>
              {client.tipo_nombre}: precio {meta?.tipos_cliente.find((item) => item.codigo === client.tipo)?.lista_precios} · descuento máximo {maxDiscountFor(client.tipo, meta)} % · {client.ciudad}, {client.direccion}
            </p>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>2. Prendas</h2>
          <label className={styles.field}>
            Referencia
            <select value={referenceId} onChange={(event) => setReferenceId(event.target.value)} aria-label="Referencia">
              <option value="">Elige la referencia</option>
              {references.map((item) => <option key={item.referencia} value={item.referencia}>{item.codigo} · {item.nombre}</option>)}
            </select>
          </label>
          {reference && prices[reference.referencia]?.precio_detal == null && <p className={styles.formError}>Esta referencia no tiene precio de venta: pídele al Gerente que lo registre.</p>}
          {reference && (
            <div className={finishedStyles.matrixWrap}>
              <table className={finishedStyles.matrix}>
                <thead><tr><th>Color</th>{matrix.sizes.map((size) => <th key={size}>Talla {size}</th>)}</tr></thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.color}>
                      <th scope="row">{row.color}</th>
                      {matrix.sizes.map((size) => {
                        const variant = row.cells[size]
                        if (!variant) return <td key={size} className={finishedStyles.cellMissing}>—</td>
                        const available = index[variant.id]?.disponible ?? 0
                        return (
                          <td key={size} className={available === 0 ? finishedStyles.cellZero : ''}>
                            <input
                              className={salesStyles.qtyInput} value={cart[variant.id]?.cantidad ?? ''} inputMode="numeric" placeholder="0" disabled={available === 0}
                              onChange={(event) => setField(variant.id, 'cantidad', event.target.value)} aria-label={`Cantidad talla ${size} ${row.color}`}
                            />
                            <span className={salesStyles.avail}>hay {available}</span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {err('lineas')}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>3. Detalle de la factura</h2>
          {rows.length === 0 && <p className={styles.empty}>Escribe cantidades en la matriz: las prendas de todas las referencias que elijas quedan en esta factura.</p>}
          {rows.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Prenda</th><th className={styles.num}>Cant.</th><th className={styles.num}>Precio</th><th className={styles.num}>Desc. %</th><th className={styles.num}>Base</th><th className={styles.num}>IVA</th><th className={styles.num}>Total</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.variante}>
                      <td>{row.codigo} · {row.talla} · {row.color}</td>
                      <td className={styles.num}>{row.cantidad ?? row.textoCantidad}</td>
                      <td className={styles.num}>{row.precio == null ? '—' : money(row.precio)}</td>
                      <td className={styles.num}>
                        <input className={salesStyles.disc} value={cart[row.variante]?.descuento ?? ''} inputMode="numeric" placeholder="0" onChange={(event) => setField(row.variante, 'descuento', event.target.value)} aria-label={`Descuento ${row.codigo} ${row.talla} ${row.color}`} />
                      </td>
                      <td className={styles.num}>{row.montos ? money(row.montos.base) : '—'}</td>
                      <td className={styles.num}>{row.montos ? money(row.montos.iva) : '—'}</td>
                      <td className={styles.num}>{row.montos ? money(row.montos.total) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.some((row) => row.problemas.length) && (
            <ul className={salesStyles.problems} role="alert">
              {rows.flatMap((row) => row.problemas).map((text) => <li key={text}>{text}</li>)}
            </ul>
          )}
          <div className={salesStyles.totals}>
            <div><span>Subtotal ({totals.unidades} prendas)</span><span>{money(totals.subtotal)}</span></div>
            <div><span>Descuento</span><span>−{money(totals.descuento)}</span></div>
            <div><span>Base gravable</span><span>{money(totals.base)}</span></div>
            <div><span>IVA {meta?.iva_tarifa ?? 19} %</span><span>{money(totals.iva)}</span></div>
            <div className={salesStyles.grand}><span>Total a pagar</span><span>{money(totals.total)}</span></div>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>4. Despacho y guía de envío</h2>
          <p className={salesStyles.notice} role="note">La guía se genera en la transportadora antes de facturar: escribe aquí el número. Si aún no la tienes, anótala después en Envíos → Por despachar.</p>
          <div className={styles.grid}>
            <label className={styles.field}>
              Transportadora (opcional)
              <select value={carrier} onChange={(event) => setCarrier(event.target.value)} aria-label="Transportadora">
                <option value="">Por definir</option>
                {(meta?.transportadoras ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
              </select>
              {err('transportadora')}
            </label>
            <label className={styles.field}>
              Número de guía
              <input value={guide} onChange={(event) => setGuide(event.target.value)} maxLength={40} placeholder="Número que te dio la transportadora" />
            </label>
            <label className={styles.field}>
              Observaciones (opcional)
              <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
            </label>
          </div>
          <p className={salesStyles.hint}>Pago: contraentrega. El valor a recaudar es el total de la factura y queda por cobrar hasta que la transportadora lo gire.</p>
        </section>

        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        {err('token')}
        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn} disabled={saving || problems.length > 0} title={problems[0] ?? ''}>
            {saving ? 'Facturando…' : `Facturar ${money(totals.total)}`}
          </button>
        </div>
      </form>

      {creatingClient && (
        <ClientForm
          meta={meta} onClose={() => setCreatingClient(false)}
          onSaved={(saved) => { setCreatingClient(false); loadClients(); setClientId(String(saved.id)) }}
        />
      )}
    </div>
  )
}
