import { apiRequest } from '../../api/client'

/** Peso máximo por evidencia (igual que el backend). */
export const MAX_BYTES = 5 * 1024 * 1024
/** Máximo de evidencias por movimiento u orden. */
export const MAX_FILES = 10
/** Valor para el atributo `accept` del selector de archivos. */
export const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const ALLOWED = new Set(ACCEPT.split(','))

/**
 * Revisión previa para avisar rápido; el backend vuelve a validar por contenido.
 * @param {File} file
 * @returns {string|null} El mensaje de error, o `null` si el archivo es válido.
 */
export function checkFile(file) {
  if (!ALLOWED.has(file.type)) return `${file.name}: solo se aceptan fotos JPG, PNG, WEBP o PDF.`
  if (file.size > MAX_BYTES) return `${file.name}: pesa más de 5 MB.`
  return null
}

/**
 * Sube evidencias (fotos o PDF) a un movimiento o a una orden.
 * @param {'movimientos'|'ordenes'} kind Tipo de registro.
 * @param {number} id Id del registro.
 * @param {File[]} files Archivos a subir (no hace nada si está vacío).
 */
export async function uploadEvidence(kind, id, files) {
  if (!files.length) return
  const body = new FormData()
  files.forEach((file) => body.append('archivos', file))
  await apiRequest(`/api/inventario/${kind}/${id}/evidencias/`, { method: 'POST', body })
}

/**
 * Abre una evidencia en una pestaña nueva. El archivo exige sesión, así que se baja con el token y se abre como blob.
 * @param {number} id Id de la evidencia.
 */
export async function openEvidence(id) {
  const tab = window.open('', '_blank')
  try {
    const blob = await apiRequest(`/api/inventario/evidencias/${id}/archivo/`, { blob: true })
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    tab?.close()
    throw error
  }
}
