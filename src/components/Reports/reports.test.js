import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeFilterCount,
  buildExportMatrix,
  buildReportQueryParams,
  EXPORT_SCHEMAS,
  filterReferencesByJeanType,
  getActiveTabRows,
  matrixToCsvString,
  money,
} from './reports.js'

describe('Lógica de reportes gerenciales y exportación Excel/CSV', () => {
  it('buildReportQueryParams arma solo los filtros con valor no vacío', () => {
    assert.equal(buildReportQueryParams({}), '')
    assert.equal(
      buildReportQueryParams({
        desde: '2026-10-01',
        hasta: '2026-10-31',
        tipo_jean: 'SKINNY',
        estado_orden: '',
        referencia: '4',
      }),
      '?desde=2026-10-01&hasta=2026-10-31&tipo_jean=SKINNY&referencia=4',
    )
  })

  it('activeFilterCount cuenta únicamente filtros activos', () => {
    assert.equal(activeFilterCount({ desde: '', hasta: '' }), 0)
    assert.equal(
      activeFilterCount({
        desde: '2026-01-01',
        tipo_jean: 'MOM',
        estado_orden: 'COMPLETADA',
        estado_cobro: '   ',
      }),
      3,
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

  it('getActiveTabRows retorna el arreglo correspondiente a la pestaña seleccionada', () => {
    const sample = {
      consolidado_tipo_jean: [{ tipo_jean: 'SKINNY' }],
      ordenes_produccion: [{ codigo: 'OP-0001' }, { codigo: 'OP-0002' }],
      ventas_por_referencia: [{ referencia_codigo: 'REF-0001' }],
      ventas_detalle: [{ numero_factura: 'FV-0001' }],
    }
    assert.equal(getActiveTabRows(sample, 'consolidado').length, 1)
    assert.equal(getActiveTabRows(sample, 'produccion').length, 2)
    assert.equal(getActiveTabRows(sample, 'ventas_ref').length, 1)
    assert.equal(getActiveTabRows(sample, 'ventas_det').length, 1)
    assert.deepEqual(getActiveTabRows(null, 'produccion'), [])
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
})

