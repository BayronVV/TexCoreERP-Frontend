import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { formatDateTime } from '../Security/logs'
import { formatMoney } from '../Inventory/money'
import inv from '../Inventory/Inventory.module.css'
import styles from './Trace.module.css'
import { differenceText, formatDay, formatDuration, formatUnits, ORIGIN, searchMessage, stepStatus, tracePath } from './trace'

const STATUS_LABEL = { ok: 'Cumplido', pendiente: 'Pendiente', 'sin-acceso': 'Sin acceso', alerta: 'Revisar' }

/**
 * Trazabilidad de punta a punta (HU 7.6): búsqueda única por código y ficha de un lote o de una factura.
 * Solo lectura: los bloques sin permiso llegan del servidor como `{acceso: false}` y aquí se pintan como «Sin acceso».
 */
export default function TracePage() {
  const { codigo, numero } = useParams()
  const kind = numero ? 'factura' : codigo ? 'lote' : null
  const code = numero ?? codigo ?? ''
  const [params] = useSearchParams()
  const asked = kind ? '' : (params.get('codigo') ?? '').trim() // «Trazabilidad» desde una orden: se busca al abrir

  return (
    <div className={inv.page}>
      <header className={inv.pageHeader}>
        <p className={inv.eyebrow}>Trazabilidad</p>
        <h1>Trazabilidad de punta a punta</h1>
        <p className={inv.subtitle}>
          Sigue un lote desde la orden hasta el producto terminado, o una venta desde la factura hasta el recaudo. Solo consulta:
          cada paso lleva a la pantalla donde se registró.
        </p>
      </header>
      <SearchBox key={code || asked} initial={code || asked} autoSearch={Boolean(asked)} />
      {kind && <Trace key={`${kind}:${code}`} kind={kind} code={code} />}
    </div>
  )
}

function SearchBox({ initial, autoSearch }) {
  const navigate = useNavigate()
  const [text, setText] = useState(initial)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(autoSearch)
  const [error, setError] = useState('')

  const run = useCallback(async (value) => {
    setError('')
    setResult(null)
    if (!value.trim()) {
      setResult({ tipo: null, codigo: '' })
      return
    }
    setBusy(true)
    try {
      const found = await apiGet(`/api/trazabilidad/buscar/?codigo=${encodeURIComponent(value.trim())}`)
      if (found.tipo === 'lote' || found.tipo === 'factura') navigate(tracePath(found.tipo, found.codigo))
      else setResult(found)
    } catch {
      setError('No se pudo hacer la búsqueda. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }, [navigate])

  useEffect(() => {
    if (!autoSearch) return undefined
    let alive = true
    apiGet(`/api/trazabilidad/buscar/?codigo=${encodeURIComponent(initial)}`)
      .then((found) => {
        if (!alive) return
        if (found.tipo === 'lote' || found.tipo === 'factura') navigate(tracePath(found.tipo, found.codigo), { replace: true })
        else setResult(found)
      })
      .catch(() => alive && setError('No se pudo hacer la búsqueda. Intenta de nuevo.'))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [autoSearch, initial, navigate])

  const submit = (event) => {
    event.preventDefault()
    run(text)
  }

  return (
    <section className={inv.card}>
      <form className={styles.search} onSubmit={submit} role="search">
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="OP-0007, OP-0007-L01, FV-0009, RD-0001 o número de guía"
          aria-label="Código a buscar"
        />
        <button type="submit" className={inv.primaryBtn} disabled={busy}>{busy ? 'Buscando…' : 'Ver trazabilidad'}</button>
      </form>
      <p className={inv.muted}>Busca por orden de producción, lote, inspección, ingreso, factura, relación de despacho o guía.</p>
      {error && <p className={inv.dangerText} role="alert">{error}</p>}
      {result && (
        <div className={styles.searchResult} role="status">
          <p>{searchMessage(result)}</p>
          {result.opciones?.length > 0 && (
            <ul className={styles.options}>
              {result.opciones.map((option) => (
                <li key={option.codigo}>
                  <Link className={inv.textLink} to={tracePath(option.tipo, option.codigo)}>{option.codigo}</Link>
                  <span className={inv.muted}> · {option.detalle}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function Trace({ kind, code }) {
  const [state, setState] = useState({ data: null, error: '' })

  useEffect(() => {
    const path = kind === 'factura' ? 'facturas' : 'lotes'
    apiGet(`/api/trazabilidad/${path}/${encodeURIComponent(code)}/`)
      .then((data) => setState({ data, error: '' }))
      .catch((err) => setState({
        data: null,
        error: err?.status === 404
          ? `No encontramos ${kind === 'factura' ? 'ninguna factura' : 'ningún lote'} con el código «${code}».`
          : 'No se pudo cargar la trazabilidad. Intenta de nuevo.',
      }))
  }, [kind, code])

  if (state.error) return <section className={inv.card}><p className={inv.empty} role="status">{state.error}</p></section>
  if (!state.data) return <section className={inv.card}><p className={inv.empty}>Cargando trazabilidad…</p></section>
  return kind === 'factura' ? <InvoiceTrace data={state.data} /> : <LotTrace data={state.data} />
}

// ------------------------------------------------------------------------------------------------------ piezas

function Step({ title, status, origin, children }) {
  return (
    <li className={`${styles.step} ${styles[`step-${status}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.stepBody}>
        <div className={styles.stepHead}>
          <h3>{title}</h3>
          <span className={`${styles.status} ${styles[`status-${status}`]}`}>{STATUS_LABEL[status]}</span>
          {origin && status !== 'sin-acceso' && <Link className={inv.textLink} to={origin}>Ir a la pantalla</Link>}
        </div>
        {status === 'sin-acceso' ? <p className={inv.muted}>Tu rol no tiene acceso a este módulo.</p> : children}
      </div>
    </li>
  )
}

function Facts({ items }) {
  return (
    <dl className={styles.facts}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
      ))}
    </dl>
  )
}

function Table({ head, rows, empty }) {
  if (!rows.length) return <p className={inv.muted}>{empty}</p>
  return (
    <div className={inv.tableWrap}>
      <table className={inv.table}>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((cells, i) => <tr key={i}>{cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

const blockStatus = (block, done) => (!block?.acceso ? 'sin-acceso' : done ? 'ok' : 'pendiente')

// --------------------------------------------------------------------------------------------------------- lote

function Reconciliation({ steps }) {
  return (
    <section className={inv.card} aria-label="Conciliación de cantidades">
      <h2 className={inv.cardTitle}>¿Cuadran las cantidades?</h2>
      <ol className={styles.strip}>
        {steps.map((step) => {
          const status = stepStatus(step)
          return (
            <li key={step.paso} className={`${styles.stripStep} ${styles[`strip-${status}`]}`}>
              <span className={styles.stripLabel}>{step.etiqueta}</span>
              <strong className={styles.stripValue}>
                {status === 'sin-acceso' ? 'Sin acceso' : status === 'pendiente' ? 'Pendiente' : formatUnits(step.cantidad)}
              </strong>
              {differenceText(step) && <span className={styles.stripNote}>{differenceText(step)}</span>}
            </li>
          )
        })}
      </ol>
      <p className={inv.muted}>
        Una diferencia está justificada cuando la explica un registro: merma o dañadas en la recepción de lavandería, marras en calidad.
      </p>
    </section>
  )
}

function LotTrace({ data }) {
  const { referencia, orden, materiales, etapas, lavanderia, calidad, ingreso } = data
  const stagesDone = etapas.acceso && etapas.items.length > 0 && etapas.items.every((s) => s.estado === 'COMPLETADA')
  return (
    <>
      <section className={inv.card}>
        <Facts items={[
          ['Lote', data.codigo],
          ['Referencia', `${data.referencia_codigo} · ${data.referencia_nombre}`],
          orden.acceso && ['Estado del lote', orden.estado_lote_nombre],
          orden.acceso && ['Prendas del lote', formatUnits(orden.cantidad_lote)],
        ]} />
      </section>
      <Reconciliation steps={data.conciliacion} />

      <ol className={styles.timeline}>
        <Step title="Referencia y ficha técnica" status={blockStatus(referencia, true)} origin={ORIGIN.referencia()}>
          {referencia.acceso && (
            <Facts items={[
              ['Referencia', `${referencia.codigo} · ${referencia.nombre}`],
              ['Ficha técnica', !referencia.ficha.acceso ? 'Sin acceso' : referencia.ficha.existe ? `Lavado ${referencia.ficha.lavado || '—'}` : 'Sin ficha'],
              referencia.ficha.acceso && referencia.ficha.existe && ['Actualizada', `${formatDay(referencia.ficha.actualizada)} · ${referencia.ficha.actualizada_por || '—'}`],
            ]} />
          )}
        </Step>

        <Step title="Orden de producción" status={blockStatus(orden, true)} origin={orden.acceso ? ORIGIN.orden(orden.codigo) : null}>
          {orden.acceso && (
            <>
              <Facts items={[
                ['Orden', orden.codigo],
                ['Fecha', formatDay(orden.fecha)],
                ['Estado', orden.estado_orden_nombre],
                ['Prendas de la orden', formatUnits(orden.cantidad_orden)],
                ['Creada por', orden.creado_por],
              ]} />
              <Table head={['Talla', 'Color', 'Prendas']} rows={orden.tallas.map((t) => [t.talla, t.color, formatUnits(t.cantidad)])} empty="Sin tallas planificadas." />
            </>
          )}
        </Step>

        <Step title="Materiales consumidos" status={blockStatus(materiales, materiales.lineas?.length > 0)} origin={ORIGIN.materiales()}>
          {materiales.acceso && (
            <>
              <p className={inv.muted}>Salida {materiales.orden_salida} del {formatDay(materiales.fecha)}. Las compras listadas son las recibidas antes de la salida: el sistema no registra de qué compra exacta salió cada material.</p>
              <Table
                head={['Material', 'Cantidad', 'Compras previas']}
                rows={materiales.lineas.map((line) => [
                  `${line.producto_codigo} · ${line.producto_nombre}`,
                  `${formatUnits(line.cantidad)} ${line.unidad}`,
                  !line.compras_previas.acceso ? 'Sin acceso a compras' : line.compras_previas.items.length === 0 ? 'Sin compras registradas antes de la salida' : (
                    <ul key="compras" className={styles.compact}>
                      {line.compras_previas.items.map((p, i) => (
                        <li key={i}>
                          {formatDay(p.fecha)} · {p.proveedor || 'Proveedor sin registrar'}
                          {p.orden_compra && <> · {p.orden_compra.startsWith('OC-') && p.recepcion ? <Link className={inv.textLink} to={ORIGIN.ordenCompra(p.orden_compra)}>{p.orden_compra}</Link> : p.orden_compra}</>}
                          {p.lote_proveedor && <> · lote {p.lote_proveedor}</>}
                        </li>
                      ))}
                    </ul>
                  ),
                ])}
                empty="La orden no tiene materiales."
              />
            </>
          )}
        </Step>

        <Step title="Etapas de producción" status={blockStatus(etapas, stagesDone)} origin={ORIGIN.etapas(data.codigo)}>
          {etapas.acceso && (
            <Table
              head={['Etapa', 'Estado', 'Inicio y fin', 'Tiempo neto', 'Responsable', 'Operarios y máquinas']}
              rows={etapas.items.map((s) => [
                s.etapa_nombre, s.estado_nombre,
                s.inicio ? `${formatDateTime(s.inicio)}${s.fin ? ` → ${formatDateTime(s.fin)}` : ''}` : '—',
                formatDuration(s.tiempo_neto_segundos),
                s.responsable || '—',
                s.asignaciones.length ? s.asignaciones.map((a) => [a.operario, a.maquina].filter(Boolean).join(' / ')).join(', ') : '—',
              ])}
              empty="El lote no tiene etapas."
            />
          )}
        </Step>

        <Step title="Lavandería" status={blockStatus(lavanderia, lavanderia.recepciones?.length > 0)} origin={lavanderia.recepciones?.length ? ORIGIN.recepcion() : ORIGIN.remision()}>
          {lavanderia.acceso && (
            <>
              <Table
                head={['Remisión', 'Fecha', 'Lavandería', 'Receta', 'Enviadas', 'Estado']}
                rows={lavanderia.remisiones.map((r) => [r.codigo, formatDay(r.fecha), r.lavanderia, r.receta || '—', formatUnits(r.enviadas), r.estado_nombre])}
                empty="El lote no se ha enviado a lavandería."
              />
              {lavanderia.remisiones.length > 0 && (
                <Table
                  head={['Recepción', 'Fecha', 'Enviadas', 'Conformes', 'Merma', 'Dañadas', 'Motivo']}
                  rows={lavanderia.recepciones.map((r) => [
                    r.codigo, formatDay(r.fecha), formatUnits(r.enviadas), formatUnits(r.recibidas_conformes), formatUnits(r.merma),
                    formatUnits(r.danadas), [r.motivo_merma, r.tipo_dano].filter(Boolean).join(' · ') || '—',
                  ])}
                  empty="La lavandería todavía no ha devuelto el lote."
                />
              )}
            </>
          )}
        </Step>

        <Step title="Inspección de calidad" status={blockStatus(calidad, Boolean(calidad.inspeccion))} origin={calidad.inspeccion ? ORIGIN.inspeccion(calidad.inspeccion.codigo) : null}>
          {calidad.acceso && (calidad.inspeccion ? (
            <>
              <Facts items={[
                ['Inspección', calidad.inspeccion.codigo],
                ['Fecha', formatDay(calidad.inspeccion.fecha)],
                ['Inspector', calidad.inspeccion.inspector],
                ['Recibidas', formatUnits(calidad.inspeccion.recibidas)],
                ['Aptas', formatUnits(calidad.inspeccion.aptas)],
                ['Marras', formatUnits(calidad.inspeccion.marras)],
              ]} />
              <Table head={['Defecto', 'Prendas']} rows={calidad.inspeccion.defectos.map((d) => [d.defecto, formatUnits(d.cantidad)])} empty="Sin marras." />
            </>
          ) : <p className={inv.muted}>El lote todavía no se ha inspeccionado.</p>)}
        </Step>

        <Step title="Ingreso a producto terminado" status={blockStatus(ingreso, ingreso.items?.length > 0)} origin={ORIGIN.ingreso(data.codigo)}>
          {ingreso.acceso && (ingreso.items.length ? ingreso.items.map((entry) => (
            <div key={entry.codigo} className={styles.group}>
              <p><strong>{entry.codigo}</strong> · {formatDay(entry.fecha)} · recibió {entry.recibido_por || '—'}{entry.ubicacion && ` · ${entry.ubicacion}`}</p>
              <Table head={['Talla', 'Color', 'Prendas']} rows={entry.lineas.map((l) => [l.talla, l.color, formatUnits(l.cantidad)])} empty="Sin prendas." />
            </div>
          )) : <p className={inv.muted}>Las prendas del lote todavía no ingresan al inventario final.</p>)}
        </Step>
      </ol>
    </>
  )
}

// ------------------------------------------------------------------------------------------------------ factura

function InvoiceTrace({ data }) {
  const { venta, existencias, envio, cobro } = data
  const current = envio.acceso ? envio.guias.find((g) => g.vigente) : null
  return (
    <>
      <section className={inv.card}>
        <Facts items={[
          ['Factura', data.numero],
          ['Fecha', formatDay(data.fecha)],
          venta.acceso && ['Cliente', venta.cliente],
          cobro.acceso && ['Cobro', cobro.estado_cobro_nombre],
        ]} />
      </section>

      <ol className={styles.timeline}>
        <Step title="Venta" status={blockStatus(venta, true)} origin={ORIGIN.factura(data.numero)}>
          {venta.acceso && (
            <>
              <Facts items={[
                ['Cliente', `${venta.cliente} · ${venta.cliente_documento}`],
                ['Ciudad', venta.cliente_ciudad],
                ['Vendedor', venta.vendedor],
                ['Estado', venta.estado_nombre],
                ['Pago', venta.modalidad_pago],
                ['Total', formatMoney(venta.total)],
              ]} />
              <Table
                head={['Referencia', 'Talla', 'Color', 'Prendas', 'Total']}
                rows={venta.lineas.map((l) => [`${l.referencia_codigo} · ${l.referencia_nombre}`, l.talla, l.color, formatUnits(l.cantidad), formatMoney(l.total)])}
                empty="Sin prendas."
              />
            </>
          )}
        </Step>

        <Step title="Salida del inventario" status={blockStatus(existencias, existencias.movimientos?.length > 0)} origin={ORIGIN.movimientos(data.numero)}>
          {existencias.acceso && (
            <>
              <Table
                head={['Fecha', 'Movimiento', 'Referencia', 'Talla', 'Color', 'Prendas', 'Saldo después']}
                rows={existencias.movimientos.map((m) => [formatDateTime(m.fecha), m.tipo_nombre, m.referencia, m.talla, m.color, formatUnits(m.cantidad), formatUnits(m.saldo_despues)])}
                empty="La factura no generó movimientos de inventario."
              />
              <h4 className={styles.subhead}>Lotes que alimentaron ese stock</h4>
              <p className={inv.muted}>El producto terminado se lleva por talla y color, no por lote: estos son los lotes que ingresaron cada talla y color hasta la fecha de la factura, no «el lote de esta prenda».</p>
              <Table
                head={['Talla y color', 'Lotes']}
                rows={existencias.lotes_de_origen.map((row) => [
                  `${row.referencia} · ${row.talla} · ${row.color}`,
                  row.lotes.length === 0 ? 'Ningún ingreso de producción (stock heredado o de ajustes)' : (
                    <span key="lotes">
                      {row.lotes.map((lot, i) => (
                        <span key={`${lot.ingreso}-${i}`}>
                          {i > 0 && ', '}
                          <Link className={inv.textLink} to={tracePath('lote', lot.lote)}>{lot.lote}</Link> ({formatDay(lot.fecha)}, {formatUnits(lot.cantidad)})
                        </span>
                      ))}
                      {row.total_lotes > row.lotes.length && <span className={inv.muted}> y {row.total_lotes - row.lotes.length} más</span>}
                    </span>
                  ),
                ])}
                empty="Sin prendas."
              />
            </>
          )}
        </Step>

        <Step title="Envío" status={blockStatus(envio, current?.estado === 'ENTREGADA' || current?.estado === 'DEVUELTA')} origin={current ? ORIGIN.guia(current.numero_guia) : null}>
          {envio.acceso && (envio.guias.length ? envio.guias.map((guide) => (
            <div key={`${guide.numero_guia}-${guide.estado}`} className={styles.group}>
              <p>
                <strong>Guía {guide.numero_guia}</strong> · {guide.transportadora} · {guide.estado_nombre}
                {!guide.vigente && <span className={inv.muted}> (reemplazada)</span>}
                {guide.relacion && <> · relación {guide.relacion}</>}
              </p>
              {guide.novedad && <p className={inv.muted}>Novedad: {guide.novedad}</p>}
              <Table
                head={['Fecha', 'Cambio', 'Origen', 'Usuario', 'Nota']}
                rows={guide.eventos.map((e) => [formatDateTime(e.fecha), `${e.estado_antes_nombre || '—'} → ${e.estado_despues_nombre}`, e.origen_nombre, e.usuario || '—', e.nota || '—'])}
                empty="Sin eventos registrados."
              />
            </div>
          )) : <p className={inv.muted}>La factura no tiene guía (entrega en mano o recogida en bodega).</p>)}
        </Step>

        <Step title="Cobro" status={blockStatus(cobro, cobro.estado_cobro && cobro.estado_cobro !== 'POR_COBRAR')} origin={ORIGIN.cartera(data.numero)}>
          {cobro.acceso && (
            <>
              <Facts items={[
                ['Estado', cobro.estado_cobro_nombre],
                ['Fecha', cobro.fecha_cobro ? formatDateTime(cobro.fecha_cobro) : '—'],
                ['Registró', cobro.cobrado_por],
                cobro.motivo_devolucion && ['Motivo de la devolución', cobro.motivo_devolucion],
              ]} />
              <Table
                head={['Fecha', 'Movimiento', 'Monto', 'Usuario', 'Nota']}
                rows={cobro.movimientos.map((m) => [formatDateTime(m.fecha), m.tipo_nombre, formatMoney(m.monto), m.usuario, m.observaciones || '—'])}
                empty="Sin movimientos de cartera: el recaudo sigue pendiente."
              />
            </>
          )}
        </Step>
      </ol>
    </>
  )
}
