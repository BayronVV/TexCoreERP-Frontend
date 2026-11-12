# TexCore — Frontend

Interfaz web del ERP TexCore (gestión y trazabilidad de la producción de jeans).

**Stack:** Node 20.19+ · React 19 · Vite 8 · React Router 7 · Axios (solo en el acceso) / `fetch` en el cliente de la API

Documentación completa (manuales, arquitectura, API y modelo de datos): <https://bayronvv.github.io/TexCoreERP-Backend/>.
El manual de usuario explica cada pantalla; este archivo es la guía para quien desarrolla el frontend.

> **El frontend no publica GitHub Pages.** La documentación del sistema vive únicamente en el sitio del repositorio del backend
> (enlace de arriba). Aquí solo está esta guía y los comentarios JSDoc de los componentes.

**Estado:** Sprint 3 (lavandería, calidad, producto terminado, ventas, envíos, cartera y reportes). La aplicación en producción
está en <https://texcore-web.onrender.com> y su API en <https://texcore-api.onrender.com>.

## Estructura

```
frontend/
├── public/            # Archivos estáticos servidos tal cual
├── src/
│   ├── api/           # client.js: toda llamada al backend pasa por aquí (renueva el token, ApiError)
│   ├── auth/          # AuthProvider (carga /api/auth/me/) y useAuth() con can('<módulo>.<acción>')
│   ├── config/        # modules.js: módulos del menú (etiquetas, rutas y módulos ocultos)
│   ├── components/
│   │   ├── Auth/        # Login, recuperar y restablecer contraseña (HU 1.3)
│   │   ├── Register/    # Solicitud de cuenta
│   │   ├── Layout/      # Encabezado + menú lateral de las pantallas internas
│   │   ├── Sidebar/     # Menú lateral según los permisos
│   │   ├── Dashboard/   # Inicio: solicitudes pendientes y alertas de stock
│   │   ├── Security/    # Usuarios y Roles y permisos (HU 1.4)
│   │   ├── Inventory/   # Movimientos, catálogo de productos y proveedores (HU 2.1 a 2.4)
│   │   ├── Purchasing/  # Órdenes de compra y recepción de mercancía
│   │   ├── References/  # Catálogo de jeans (HU 3.1) y ficha técnica de consumo (HU 3.2)
│   │   ├── Production/  # Órdenes y lotes, monitor, recursos y liquidación (HU 4.1 a 4.6)
│   │   ├── Laundry/     # Procesos externos: remisión a lavado y recepción de lavandería (TE-57, TE-58)
│   │   ├── Quality/     # Control de calidad: inspecciones de lotes y catálogo de defectos (HU 6.1)
│   │   ├── Finished/    # Producto terminado: ingreso, existencias, ajuste manual y movimientos (HU 6.2, TE-60 y TE-61)
│   │   ├── Sales/       # Ventas: panel, nueva venta, cartera, facturas, clientes y precios (TE-62, TE-64)
│   │   ├── Shipping/    # Envíos: panel, guías, por despachar y relaciones de despacho (TE-63)
│   │   ├── Reports/     # Reportes: tablero gerencial con exportación a Excel/CSV (TE-65)
│   │   └── ui/          # Modal, avisos (toasts), RequirePermission
│   ├── App.jsx        # Enrutamiento principal
│   ├── main.jsx       # Punto de entrada
│   └── index.css      # Estilos base
├── index.html
├── vite.config.js
├── .oxlintrc.json     # Reglas de oxlint
├── .env.example       # Plantilla de variables de entorno
└── backend_inventory_example.py  # Ejemplo de modelos heredado de los primeros días; no lo usa la aplicación
```

Cada carpeta de `components/` agrupa por módulo de negocio sus pantallas (`*Page.jsx`), formularios (`*Form.jsx`), estilos
(`*.module.css`) y la **lógica pura** (`*.js` sin React) con su prueba (`*.test.js`).

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
| `npm run lint`    | Revisa `src/` con oxlint. Hoy deja 9 avisos (`react/set-state-in-effect`, anteriores al Sprint 3) y ningún error. |
| `npm test`        | Pruebas de la lógica pura con el ejecutor de Node (`node --test`): 221 pruebas, sin navegador ni backend. |

## Permisos en el frontend (HU 1.4)

Al entrar a cualquier pantalla interna, `AuthProvider` pide
`/api/auth/me/` y guarda los permisos del usuario. Con ellos:

- `Sidebar` muestra solo los módulos para los que el usuario tiene
  `<módulo>.ver`; el resto no aparece (ni con candado). Si tiene permiso pero
  la pantalla no existe todavía, dice "Próximamente".
- Un módulo con `hidden: true` en `config/modules.js` **no aparece en el menú** aunque el usuario tenga su permiso. Hoy es
  *Fichas Técnicas* (`fichas_tecnicas`): la ficha se abre con el botón «Ficha técnica» de cada tarjeta del Catálogo de jeans.
  El módulo se conserva en la lista porque la pantalla de roles agrupa sus permisos por él.
- `RequirePermission` protege cada ruta interna (por ejemplo
  `/seguridad/usuarios` exige `seguridad.ver`).
- Botones como "Nuevo usuario", "Crear orden" o "Aprobar" solo aparecen con el
  permiso de gestión correspondiente (`can('produccion.gestionar')`, `can('compras.aprobar')`...).

El backend valida el permiso en cada petición; el frontend solo decide qué
mostrar. La matriz de permisos por rol está en la documentación (*Roles y permisos*).

**Sesión:** `src/api/client.js` renueva el access token con el refresh
cuando vence (15 min). Si el refresh también venció (30 min sin uso) o la
contraseña cambió, se cierra la sesión y vuelve al login.

## Rutas

| Ruta | Permiso | Pantalla |
|------|---------|----------|
| `/login`, `/register` | público | Acceso y solicitud de cuenta |
| `/recuperar-contrasena` | público | Pedir el enlace de recuperación (HU 1.3) |
| `/restablecer-contrasena?token=` | público | Definir la nueva contraseña o activar una cuenta invitada |
| `/dashboard` | sesión | Inicio: solicitudes pendientes, nuevo stock de producto terminado (`producto_terminado.ver`) y alertas de stock |
| `/seguridad/usuarios` | `seguridad.ver` | Usuarios: aprobar solicitudes, roles, activar/desactivar, invitar |
| `/seguridad/roles` | `seguridad.ver` | Roles y matriz de permisos por módulo |
| `/inventario` | `inventario.ver` | Movimientos: existencias (con costo promedio), ingreso, salida a lavandería e historial |
| `/inventario/catalogo` | `inventario.ver` | Catálogo de telas e insumos por categoría, con imagen de referencia (sin existencias) |
| `/inventario/proveedores` | `inventario.ver` | Directorio de proveedores (NIT único, clasificación, archivados) |
| `/compras/ordenes` | `compras.ver` | Órdenes de compra: crear, editar el borrador, aprobar, cancelar y cerrar |
| `/compras/recepcion` | `compras.ver` | Recepción de mercancía contra una orden aprobada o sin orden (guardar exige `inventario.gestionar`) |
| `/referencias` | `referencias.ver` | Catálogo de jeans: referencias, estados, fotos y, desde cada tarjeta, la ficha técnica (`fichas_tecnicas.ver`) |
| `/produccion/ordenes` | `produccion.ver` | Órdenes de producción: disponibilidad de material, lotes y tallas, seguimiento de tiempos y asignación de recursos |
| `/produccion/monitor` | `produccion.ver` | Monitor de estado: tablero Kanban de lotes con arrastrar y soltar |
| `/produccion/recursos` | `produccion.ver` | Catálogo de operarios y máquinas |
| `/produccion/liquidacion` | `produccion.ver` | Liquidación de órdenes y tarifas de mano de obra por minuto |
| `/calidad/inspecciones` | `calidad.ver` | Inspecciones: lotes por inspeccionar, formulario de aptas y marras por defecto con suma en vivo, historial y detalle (registrar exige `calidad.gestionar`) |
| `/calidad/defectos` | `calidad.ver` | Catálogo de defectos corregibles e incorregibles (crear, editar y desactivar exige `calidad.gestionar`) |
| `/producto-terminado/ingreso` | `producto_terminado.ver` | Ingreso: inspecciones por ingresar, formulario con matriz talla × color, suma en vivo y confirmación, historial y detalle (ingresar exige `producto_terminado.gestionar`) |
| `/producto-terminado/existencias` | `producto_terminado.ver` | Existencias: matriz referencia × color × talla, con las celdas en cero resaltadas |
| `/producto-terminado/ajuste` | `producto_terminado.ver` | Ajuste manual: conteo físico contra el sistema con motivo (ajustar exige `producto_terminado.ajustar`) e historial |
| `/producto-terminado/movimientos` | `producto_terminado.ver` | Movimientos: libro de solo lectura con saldo antes y después |
| `/lavanderia/remisiones` | `lavanderia.ver` | Remisión a lavado: lotes, proveedor y receta, guía de remisión e historial |
| `/lavanderia/recepcion` | `lavanderia.ver` | Recepción de lavandería: cotejo de lo enviado y lo recibido, mermas, daños y pérdidas |
| `/ventas/panel` | `ventas.ver` | Resumen del día y últimas facturas |
| `/ventas/nueva` | `ventas.gestionar` | Nueva venta (punto de venta): cliente, matriz talla × color, descuentos y totales |
| `/ventas/cartera` | `ventas.ver` | Gestión de cartera: por cobrar, pagadas y devueltas (confirmar recaudo o devolución exige `ventas.gestionar`) |
| `/ventas/facturas` | `ventas.ver` | Facturas POS internas: filtros, detalle, PDF y anulación (`ventas.anular`) |
| `/ventas/clientes` | `ventas.ver` | Clientes (crear y modificar exige `ventas.gestionar`) |
| `/ventas/precios` | `ventas.ver` | Costo de fábrica y precios por referencia (modificar exige `ventas.precios`) |
| `/envios/panel` | `envios.ver` | Semáforo de guías, facturas sin guía, novedades y devoluciones |
| `/envios/guias` | `envios.ver` | Guías con filtros y detalle (estado, flete y rastreo exigen `envios.gestionar`) |
| `/envios/pendientes` | `envios.ver` | Facturas por despachar sin guía (anotar la guía exige `envios.anotar`) |
| `/envios/relaciones` | `envios.ver` | Relaciones de despacho con PDF (crear exige `envios.gestionar`) |
| `/reportes` | `reportes.ver` | Tablero gerencial con filtros avanzados y exportación a Excel/CSV |
| `/produccion/planificar` | — | Redirige a `/produccion/ordenes` (la planificación se unió a esa pantalla) |
| cualquier otra | — | Redirige a `/dashboard` |

## Lógica pura probada

La lógica que no necesita React vive en módulos `.js` con pruebas, para probarla sin navegador:

| Módulo | Qué resuelve |
|--------|--------------|
| `Inventory/orderLines.js`, `money.js`, `labels.js` | Líneas de una orden, formato de dinero y cantidades, mensajes de error por campo |
| `Production/lotSplit.js`, `lotSizes.js` | Reparto de las prendas en lotes y de las tallas por lote; cuerpo de la simulación y de la orden |
| `Production/lotTracking.js` | Duraciones y reemplazo de un lote tras una acción de tiempos |
| `Production/monitorBoard.js` | Tablero del monitor: qué movimientos son válidos, alertas, refresco y consulta |
| `Production/resources.js` | Validación y cuerpo de operarios y máquinas, etiquetas y avisos de ocupación |
| `Production/costSettlement.js` | Lectura del resultado de `/costos/` y estado de la liquidación (completa o parcial) |
| `Quality/quality.js` | Desglose de marras, suma de aptas + marras contra lo recibido, validaciones y cuerpos de la inspección y del defecto |
| `Finished/finished.js` | Matriz de variantes por talla y color, suma del reparto contra las aptas, validaciones, cuerpo y confirmación del ingreso y del ajuste manual, diferencia contra lo planificado e ingresos recientes del inicio |
| `Laundry/laundryReception.js` | Cotejo de cantidades por lote (conforme, merma, dañado), valoración de pérdidas y totales de la recepción |
| `Sales/sales.js` | Montos de línea con IVA y descuento (igual que el servidor), carrito, validaciones, cuerpo de la venta, resumen de cartera y filtros |
| `Shipping/shipping.js` | Semáforo y urgencia de guías, validación de notas y estados, cuerpo de la guía y de la relación de despacho, cuota de rastreo |
| `Reports/reports.js` | Filtros del tablero, filas por pestaña y matriz de exportación a CSV y Excel |
| `Purchasing/purchasing.js` | Estados y acciones de la orden de compra, filas de la recepción y sus validaciones |
| `References/variants.js`, `fichaRows.js` | Combinaciones de talla y color; filas de la ficha técnica |

## Variables de entorno

| Variable       | Por defecto             | Descripción |
|----------------|--------------------------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | URL base del backend. Es la única variable `VITE_*` que lee el código (`src/api/client.js`). |

- **Contra el backend local:** deja `VITE_API_URL=http://localhost:8000` (el valor de `.env.example`) y levanta el backend en ese puerto.
- **Contra producción:** `VITE_API_URL=https://texcore-api.onrender.com` en `.env.local` prueba tu interfaz con la API desplegada
  (son datos reales del entorno: úsalo con cuidado). El frontend publicado, <https://texcore-web.onrender.com>, se compila con la URL de esa API.

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

## Convenciones

- Ramas: el trabajo sale de `pruebas` y vuelve por pull request; `main` solo recibe lo aprobado y se despliega solo. El flujo es
  rama → `pruebas` → `main`.
- Commits y pull requests de una historia de usuario llevan la clave del Jira (`TE-xxx`) de lo que implementan, para que Jira los vincule;
  el pull request a `main` lleva título y descripción.
- Los textos de la interfaz van en español. Los errores de la API llegan como `{campo: [mensaje]}` y se muestran junto al campo.
- Un componente nuevo lleva sobre su declaración un comentario JSDoc o `//` que diga para qué sirve y qué props recibe; la lógica
  que se pueda separar de React va a un `.js` con su `.test.js`.

## Módulos del Sprint 3

| Módulo (menú) | Carpeta | Historias de Jira |
|---------------|---------|-------------------|
| Procesos Externos (Lavandería) | `src/components/Laundry/` | TE-57 (remisión a lavado), TE-58 (recepción de lavandería) |
| Control de Calidad | `src/components/Quality/` | TE-59 |
| Producto Terminado | `src/components/Finished/` | TE-60 (ingreso, existencias y movimientos), TE-61 (ajuste manual) |
| Ventas y Despachos | `src/components/Sales/` | TE-62 (facturación), TE-64 (gestión de cartera) |
| Envíos | `src/components/Shipping/` | TE-63 (guías de envío) |
| Reportes | `src/components/Reports/` | TE-65 (tablero gerencial) |

Los módulos de sprints anteriores (Seguridad, Inventario, Compras, Referencias y Producción) conservan sus carpetas descritas arriba.

### Límites conocidos (se tratan en el Sprint 4)

- **Lavandería:** las pantallas de remisión y recepción caen a datos de demostración (`mockLaundryData.js`) si la API no responde, y proponen valores por defecto (número de factura externa, costo por prenda). Está registrado como HU 5.4 (TE-172); mientras tanto, confirma que la API esté despierta antes de usarlas.
- **Cartera:** la lista, las pestañas y los contadores salen de las últimas 200 facturas que carga la pantalla; el saldo financiero viene de `/api/ventas/cartera/resumen/`.
- **Reportes:** los filtros se envían al servidor (`/api/reportes/gerencial/`) y la exportación a Excel y CSV se arma en el navegador con lo que devolvió.
