# TexCore — Frontend

Interfaz web del ERP TexCore.

**Stack:** Node 20.19+ · React 19 · Vite 8

## Estructura

```
frontend/
├── public/          # Archivos estáticos servidos tal cual
├── src/
│   ├── api/         # Cliente HTTP: toda llamada al backend pasa por aquí
│   ├── App.jsx      # Vista temporal de Sprint 0 (estado de conexión)
│   ├── main.jsx     # Punto de entrada
│   └── index.css    # Estilos base
├── index.html
├── vite.config.js
└── .env.example     # Plantilla de variables de entorno
```

Hoy solo existe una vista de verificación: muestra si el backend
(`/api/health/`) y la base de datos (`/api/health/db/`) responden. Las
pantallas reales llegan a partir del Sprint 1.

## Levantar en local

Requiere el backend corriendo en http://localhost:8000 (ver `../backend/README.md`).

```powershell
cd frontend
npm install
copy .env.example .env.local     # Linux/macOS: cp .env.example .env.local
npm run dev
```

Abre http://localhost:5173.

## Scripts

| Comando           | Qué hace |
|-------------------|----------|
| `npm run dev`     | Servidor de desarrollo con recarga en caliente. |
| `npm run build`   | Genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve `dist/` para probar el build. |
| `npm run lint`    | Revisa el código con oxlint. |

## Variables de entorno

| Variable       | Por defecto             | Descripción |
|----------------|-------------------------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | URL base del backend. |

Todo lo que empieza por `VITE_` queda visible en el navegador: nunca pongas
secretos aquí. El acceso a la base de datos lo hace **solo** el backend.

## Despliegue

`npm run build` genera archivos estáticos en `dist/` que se pueden servir
desde cualquier hosting estático (Vercel, Netlify, Nginx, ...). Define
`VITE_API_URL` con la URL pública del backend **antes** de compilar, y agrega
el dominio del frontend a `CORS_ALLOWED_ORIGINS` en el backend.
