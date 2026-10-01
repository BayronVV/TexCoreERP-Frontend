# TexCore — Frontend

Interfaz web del ERP TexCore.

**Stack:** Node 20.19+ · React 19 · Vite 8

## Estructura

```
frontend/
├── public/          # Archivos estáticos servidos tal cual
├── src/
│   ├── api/         # Cliente HTTP: toda llamada al backend pasa por aquí
│   ├── auth/        # Sesión: AuthProvider (carga /api/auth/me/) y useAuth()
│   ├── components/
│   │   ├── Auth/      # Login, recuperar y restablecer contraseña (HU 1.3)
│   │   ├── Layout/    # Encabezado + menú lateral de las pantallas internas
│   │   ├── Security/  # Usuarios y Roles y permisos (HU 1.4)
│   │   ├── ui/        # Modal, avisos (toasts), RequirePermission
│   │   ├── Inventory/ # Movimientos, catálogo de productos y proveedores (HU 2.1 a 2.4)
│   │   └── ...        # Dashboard, Register, Sidebar
│   ├── config/       # modules.js: módulos del menú (etiquetas y rutas)
│   ├── App.jsx       # Enrutamiento principal
│   ├── main.jsx      # Punto de entrada
│   └── index.css     # Estilos base
├── index.html
├── vite.config.js
└── .env.example     # Plantilla de variables de entorno
```

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

## Permisos en el frontend (HU 1.4)

Al entrar a cualquier pantalla interna, `AuthProvider` pide
`/api/auth/me/` y guarda los permisos del usuario. Con ellos:

- `Sidebar` muestra solo los módulos para los que el usuario tiene
  `<módulo>.ver`; el resto no aparece (ni con candado). Si tiene permiso pero
  la pantalla no existe todavía, dice "Próximamente".
- `RequirePermission` protege cada ruta interna (por ejemplo
  `/seguridad/usuarios` exige `seguridad.ver`).
- Botones como "Nuevo usuario" o "Guardar cambios" solo aparecen con el
  permiso de gestión correspondiente.

El backend valida el permiso en cada petición; el frontend solo decide qué
mostrar.

**Sesión:** `src/api/client.js` renueva el access token con el refresh
cuando vence (15 min). Si el refresh también venció (30 min sin uso) o la
contraseña cambió, se cierra la sesión y vuelve al login.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/login`, `/register` | Acceso y solicitud de cuenta |
| `/recuperar-contrasena` | Pedir el enlace de recuperación (HU 1.3) |
| `/restablecer-contrasena?token=` | Definir la nueva contraseña o activar una cuenta invitada |
| `/dashboard` | Inicio |
| `/seguridad/usuarios` | Usuarios: aprobar solicitudes, roles, activar/desactivar, invitar |
| `/seguridad/roles` | Roles y matriz de permisos por módulo |
| `/inventario` | Movimientos: existencias, ingreso, salida por orden (cesta) e historial |
| `/inventario/catalogo` | Catálogo de telas e insumos por categoría, con imagen de referencia (sin existencias) |
| `/inventario/proveedores` | Directorio de proveedores (NIT único, clasificación, archivados) |

## Variables de entorno

| Variable       | Por defecto             | Descripción |
|----------------|--------------------------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | URL base del backend. |

Todo lo que empieza por `VITE_` queda visible en el navegador: nunca pongas
secretos aquí. El acceso a la base de datos lo hace **solo** el backend.

## Despliegue

Render como Static Site (pasos completos en `backend/docs/despliegue-render.md`):

- Build: `npm ci && npm run build`
- Publish directory: `dist`
- Variables: `VITE_API_URL` (URL pública del backend, se lee **al compilar**) y `NODE_VERSION=22`.
- En el panel del sitio, *Redirects/Rewrites*: `/*` → `/index.html` (Rewrite). Sin
  esa regla, recargar una ruta interna o abrir el enlace del correo de
  recuperación da 404.
- Agrega el dominio del frontend a `CORS_ALLOWED_ORIGINS` en el backend.
- El workflow `.github/workflows/deploy-render.yml` informa a Jira del resultado de cada despliegue
  (detalles en `backend/docs/despliegue-render.md`, sección "Despliegues en Jira"). Necesita el secreto `RENDER_API_KEY`.

Sirve también en cualquier hosting estático (Vercel, Netlify, Nginx, ...).
