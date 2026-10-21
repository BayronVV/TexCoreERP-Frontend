import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Auth/Login'
import ForgotPassword from './components/Auth/ForgotPassword'
import ResetPassword from './components/Auth/ResetPassword'
import Register from './components/Register/Register'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './components/Dashboard/Dashboard'
import InventoryPage from './components/Inventory/InventoryPage'
import CatalogPage from './components/Inventory/CatalogPage'
import SuppliersPage from './components/Inventory/SuppliersPage'
import ReferencesPage from './components/References/ReferencesPage'
import LotsMasterPage from './components/Production/LotsMasterPage'
import MonitorPage from './components/Production/MonitorPage'
import OrderSettlementPage from './components/Production/OrderSettlementPage'
import OrdersPage from './components/Purchasing/OrdersPage'
import ReceptionPage from './components/Purchasing/ReceptionPage'
import ResourcesPage from './components/Production/ResourcesPage'
import UsersPage from './components/Security/UsersPage'
import RolesPage from './components/Security/RolesPage'
import RequirePermission from './components/ui/RequirePermission'

/**
 * Enrutamiento principal. Las rutas públicas (acceso, registro y recuperación de contraseña) van sueltas; las internas
 * cuelgan de `AppLayout` y cada una se protege con `RequirePermission` según el permiso `<módulo>.ver` que exige.
 * `/produccion/planificar` redirige a `/produccion/ordenes`, donde hoy vive la planificación.
 */
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
        <Route path="/restablecer-contrasena" element={<ResetPassword />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/inventario"
            element={
              <RequirePermission code="inventario.ver">
                <InventoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="/inventario/catalogo"
            element={
              <RequirePermission code="inventario.ver">
                <CatalogPage />
              </RequirePermission>
            }
          />
          <Route
            path="/inventario/proveedores"
            element={
              <RequirePermission code="inventario.ver">
                <SuppliersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/referencias"
            element={
              <RequirePermission code="referencias.ver">
                <ReferencesPage />
              </RequirePermission>
            }
          />
          <Route path="/produccion/planificar" element={<Navigate to="/produccion/ordenes" replace />} />
          <Route
            path="/produccion/monitor"
            element={
              <RequirePermission code="produccion.ver">
                <MonitorPage />
              </RequirePermission>
            }
          />
          <Route
            path="/seguridad/usuarios"
            element={
              <RequirePermission code="seguridad.ver">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/seguridad/roles"
            element={
              <RequirePermission code="seguridad.ver">
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/produccion/ordenes"
            element={
              <RequirePermission code="produccion.ver">
                <LotsMasterPage />
              </RequirePermission>
            }
          />
          <Route
            path="/produccion/recursos"
            element={
              <RequirePermission code="produccion.ver">
                <ResourcesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/compras/ordenes"
            element={
              <RequirePermission code="compras.ver">
                <OrdersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/compras/recepcion"
            element={
              <RequirePermission code="compras.ver">
                <ReceptionPage />
              </RequirePermission>
            }
          />
          <Route
            path="/produccion/liquidacion"
            element={
              <RequirePermission code="produccion.ver">
                <OrderSettlementPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App
