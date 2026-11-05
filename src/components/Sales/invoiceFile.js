import { apiRequest } from '../../api/client'

/** Descarga el PDF de una factura con la sesión del usuario y lo guarda como «FV-0001.pdf». */
export async function downloadInvoicePdf(invoice) {
  const blob = await apiRequest(`/api/ventas/facturas/${invoice.id}/pdf/`, { blob: true })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoice.numero}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
