import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/** Mensaje del error cuando se intenta compilar para producción sin la dirección de la API. */
export const MISSING_API_URL_MESSAGE =
  'Falta VITE_API_URL: el build de producción necesita la dirección pública del backend ' +
  '(p. ej. VITE_API_URL=https://texcore-api.onrender.com). Sin ella la web publicada apuntaría a localhost.'

/**
 * Exige VITE_API_URL al compilar para producción. En desarrollo (`vite`) no hace falta:
 * `src/api/client.js` usa el backend local.
 *
 * @param {string} mode Modo de Vite (`production` en `vite build`).
 * @param {Record<string, string>} env Variables VITE_* cargadas.
 */
export function assertApiUrl(mode, env) {
  if (mode === 'production' && !String(env.VITE_API_URL ?? '').trim()) {
    throw new Error(MISSING_API_URL_MESSAGE)
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  assertApiUrl(mode, loadEnv(mode, process.cwd()))
  return {
    plugins: [react()],
    server: { port: 5173 },
  }
})
