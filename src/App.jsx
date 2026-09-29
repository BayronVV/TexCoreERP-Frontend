import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Auth/Login'
import ForgotPassword from './components/Auth/ForgotPassword'
import ResetPassword from './components/Auth/ResetPassword'
import Register from './components/Register/Register'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './components/Dashboard/Dashboard'
import InventoryMovements from './components/Inventory/InventoryMovements'
import UsersPage from './components/Security/UsersPage'
import RolesPage from './components/Security/RolesPage'
import RequirePermission from './components/ui/RequirePermission'

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
                <InventoryMovements />
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
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  )
}

export default App
