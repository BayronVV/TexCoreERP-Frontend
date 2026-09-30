import { apiRequest } from '../../api/client'

export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_FILES = 10
export const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const ALLOWED = new Set(ACCEPT.split(','))

// Revisión previa para avisar rápido; el backend vuelve a validar por contenido.
export function checkFile(file) {
  if (!ALLOWED.has(file.type)) return `${file.name}: solo se aceptan fotos JPG, PNG, WEBP o PDF.`
  if (file.size > MAX_BYTES) return `${file.name}: pesa más de 5 MB.`
  return null
}

export async function uploadEvidence(kind, id, files) {
  if (!files.length) return
  const body = new FormData()
  files.forEach((file) => body.append('archivos', file))
  await apiRequest(`/api/inventario/${kind}/${id}/evidencias/`, { method: 'POST', body })
}

// El archivo exige sesión, así que se baja con el token y se abre como blob.
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
