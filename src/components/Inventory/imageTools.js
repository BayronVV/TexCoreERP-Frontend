export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Reduce la foto antes de subirla: una foto de celular pesa varios MB y en el catálogo solo
// se ve en miniatura. Devuelve un JPEG de a lo sumo `maxSide` píxeles por lado.
export async function shrinkImage(file, maxSide = 800, quality = 0.85) {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('Solo se aceptan imágenes JPG, PNG o WEBP.')
  }
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otra foto.')
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff' // los PNG con transparencia quedan sobre blanco
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg',
      quality,
    )
  })
}
