import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeFilterCount,
  buildExportMatrix,
  buildReportQueryParams,
  colombiaTodayISO,
  EXPORT_SCHEMAS,
  filterReferencesByJeanType,
  getActiveTabRows,
  matrixToCsvString,
  money,
  quickRangeDates,
  shiftIsoDays,
} from './reports.js'

describe('Lógica de reportes gerenciales, devoluciones y zona horaria Colombia (TE-177)', () => {
  it('colombiaTodayISO y quickRangeDates usan hora de Colombia sin adelantarse después de las 7 p. m.', () => {
    // 2026-11-27 01:30 UTC corresponde al 2026-11-26 20:30 en Colombia (UTC-5)
    const lateNightColombia = new Date('2026-11-27T01:30:00Z')
    assert.equal(colombiaTodayISO(lateNightColombia), '2026-11-26')
    assert.deepEqual(quickRangeDates(7, lateNightColombia), {
      desde: '2026-11-19',
      hasta: '2026-11-26',
    })
    assert.deepEqual(quickRangeDates('month', lateNightColombia), {
      desde: '2026-11-01',
      hasta: '2026-11-26',
    })
    assert.deepEqual(quickRangeDates(null, lateNightColombia), {
      desde: '',
      hasta: '',
    })
    assert.equal(shiftIsoDays('2026-03-01', -1), '2026-02-28')
  })

  it('buildReportQueryParams arma solo los filtros con valor no vacío incluyendo vendedor y transportadora', () => {
    assert.equal(buildReportQueryParams({}), '')
    assert.equal(
      buildReportQueryParams({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        tipo_jean: 'SKINNY',
        estado_orden: '',
        referencia: '4',
        vendedor: '9',
        transportadora: 'INTERRAPIDISIMO',
      }),
      '?desde=2026-10-01&hasta=2026-10-31&tipo_jean=SKINNY&referencia=4&vendedor=9&transportadora=INTERRAPIDISIMO',
    )
  })

  it('activeFilterCount cuenta únicamente filtros activos', () => {
    assert.equal(activeFilterCount({ desde: '', hasta: '' }), 0)
    assert.equal(
      activeFilterCount({
        desde: '2026-01-01',
        tipo_jean: 'MOM',
        estado_orden: 'COMPLETADA',
        vendedor: '3',
        transportadora: 'ENVIA',
        estado_cobro: '   ',
      }),
      5,
    )
  })

  it('filterReferencesByJeanType filtra el listado de referencias según el tipo de jean', () => {
    const refs = [
      { id: 1, codigo: 'REF-0001', ajuste: 'SKINNY' },
      { id: 2, codigo: 'REF-0002', ajuste: 'RECTO' },
      { id: 3, codigo: 'REF-0003', ajuste: 'SKINNY' },
    ]
    assert.equal(filterReferencesByJeanType(refs, '').length, 3)
    assert.deepEqual(
      filterReferencesByJeanType(refs, 'SKINNY').map((r) => r.id),
      [1, 3],
    )
  })

  it('getActiveTabRows incluye la pestaña devoluciones por vendedor', () => {
    const sample = {
      consolidado_tipo_jean: [{ tipo_jean: 'SKINNY' }],
      ordenes_produccion: [{ codigo: 'OP-0001' }, { codigo: 'OP-0002' }],
      ventas_por_referencia: [{ referencia_codigo: 'REF-0001' }],
      ventas_detalle: [{ numero_factura: 'FV-0001' }],
      devoluciones_por_vendedor: [{ vendedor_id: 5, vendedor_nombre: 'Ana', guias_devueltas: 2, flete_vendedor: 21000 }],
    }
    assert.equal(getActiveTabRows(sample, 'consolidado').length, 1)
    assert.equal(getActiveTabRows(sample, 'produccion').length, 2)
    assert.equal(getActiveTabRows(sample, 'ventas_ref').length, 1)
    assert.equal(getActiveTabRows(sample, 'ventas_det').length, 1)
    assert.equal(getActiveTabRows(sample, 'devoluciones').length, 1)
    assert.deepEqual(getActiveTabRows(null, 'devoluciones'), [])
  })

  it('buildExportMatrix arma la matriz de devoluciones por vendedor para Excel y CSV', () => {
    const rows = [
      {
        vendedor_nombre: 'Carlos Ruiz',
        guias_devueltas: 2,
        flete_vendedor: 21000,
      },
    ]
    const matrix = buildExportMatrix(rows, EXPORT_SCHEMAS.devoluciones.columns)
    assert.deepEqual(matrix, [
      ['Vendedor', 'Guías Devueltas', 'Flete a Cargo ($)'],
      ['Carlos Ruiz', 2, 21000],
    ])
    const csv = matrixToCsvString(matrix)
    assert.ok(csv.includes('Carlos Ruiz,2,21000'))
  })

  it('buildExportMatrix construye encabezados y filas de datos para SheetJS / CSV', () => {
    const rows = [
      {
        codigo: 'OP-0001',
        fecha_salida: '2026-11-01',
        estado_orden_nombre: 'En proceso',
        referencia_codigo: 'REF-0001',
        referencia_nombre: 'Jean Clásico',
        tipo_jean_nombre: 'Recto',
        responsable: 'Carlos Ruiz',
        prendas_planificadas: 120,
        total_lotes: 2,
        prendas_en_lotes: 120,
        prendas_aptas: 115,
        prendas_marras: 5,
        tasa_calidad_pct: 95.8,
      },
    ]
    const matrix = buildExportMatrix(rows, EXPORT_SCHEMAS.produccion.columns)
    assert.equal(matrix.length, 2)
    assert.equal(matrix[0][0], 'Código Orden')
    assert.equal(matrix[1][0], 'OP-0001')
    assert.equal(matrix[1][7], 120)
    assert.equal(matrix[1][12], 95.8)
  })

  it('matrixToCsvString escapa comillas y comas e incluye BOM UTF-8', () => {
    const csv = matrixToCsvString([
      ['Referencia', 'Cliente'],
      ['REF-0001', 'Moda, "El Jean" S.A.S.'],
    ])
    assert.ok(csv.startsWith('\uFEFFReferencia,Cliente'))
    assert.ok(csv.includes('"Moda, ""El Jean"" S.A.S."'))
  })

  it('money formatea valores numéricos en pesos colombianos', () => {
    assert.ok(money(150000).startsWith('$'))
  })

  it('TE-187: totales exportados en Excel/CSV coinciden con KPIs antes y después de pago/devolución', () => {
    const report = {
      kpis: {
        ingresos_totales: 428400,
        recaudado_periodo: 214200,
        pendiente_recaudo_periodo: 0,
        devoluciones_guias: 1,
        flete_devoluciones_total: 14000,
      },
      ventas_detalle: [
        { numero_factura: 'FV-0001', fecha: '2026-11-27', cliente_nombre: 'A', cliente_tipo_nombre: 'Mayorista', vendedor_nombre: 'Ana', transportadora: 'ENVIA', estado_cobro_nombre: 'Pagado', referencia_codigo: 'REF-1', referencia_nombre: 'Jean 1', tipo_jean_nombre: 'Recto', talla: '30', color: 'Azul', unidades: 2, subtotal: 200000, descuento: 20000, base_gravable: 180000, iva: 34200, total: 214200 },
        { numero_factura: 'FV-0002', fecha: '2026-11-27', cliente_nombre: 'B', cliente_tipo_nombre: 'Mayorista', vendedor_nombre: 'Ana', transportadora: 'ENVIA', estado_cobro_nombre: 'Devolución', referencia_codigo: 'REF-1', referencia_nombre: 'Jean 1', tipo_jean_nombre: 'Recto', talla: '32', color: 'Azul', unidades: 2, subtotal: 200000, descuento: 20000, base_gravable: 180000, iva: 34200, total: 214200 },
      ],
      devoluciones_por_vendedor: [
        { vendedor_id: 7, vendedor_nombre: 'Ana', guias_devueltas: 1, flete_vendedor: 14000 },
      ],
    }
    const detMatrix = buildExportMatrix(getActiveTabRows(report, 'ventas_det'), EXPORT_SCHEMAS.ventas_det.columns)
    const devMatrix = buildExportMatrix(getActiveTabRows(report, 'devoluciones'), EXPORT_SCHEMAS.devoluciones.columns)
    const totalCol = detMatrix[0].indexOf('Total ($)')
    const exportedSalesTotal = detMatrix.slice(1).reduce((acc, row) => acc + row[totalCol], 0)
    const exportedDevCount = devMatrix.slice(1).reduce((acc, row) => acc + row[1], 0)
    const exportedDevFreight = devMatrix.slice(1).reduce((acc, row) => acc + row[2], 0)

    assert.equal(exportedSalesTotal, report.kpis.ingresos_totales)
    assert.equal(exportedDevCount, report.kpis.devoluciones_guias)
    assert.equal(exportedDevFreight, report.kpis.flete_devoluciones_total)
  })
})
