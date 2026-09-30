import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../../api/client'
import AuthShell from '../Auth/AuthShell'
import { PASSWORD_RULES, passwordIsValid } from '../Auth/passwordRules'
import styles from '../Auth/Auth.module.css'

const AREAS = [
  { value: 'PRODUCCION', label: 'Producción' },
  { value: 'ALMACENISTA', label: 'Bodega' },
  { value: 'VENDEDOR', label: 'Ventas' },
  { value: 'GERENTE', label: 'Gerencia' },
  { value: 'SECRETARIA', label: 'Secretaria' },
  { value: 'TERMINACION', label: 'Terminación' },
]

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  password_confirm: '',
  requested_area: '',
  document_id: '',
}

// Íconos de línea, del mismo trazo que los del login.
const Icon = ({ d }) => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)
const ICONS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0',
  mail: 'M3 6.5 12 13l9-6.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  lock: 'M7 10.5V8a5 5 0 0 1 10 0v2.5M6 10.5h12a1 1 0 0 1 1 1V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7.5a1 1 0 0 1 1-1Z',
  area: 'M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  id: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8.5 12a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM5.8 16a2.8 2.8 0 0 1 5.4 0M14 10h4M14 14h3',
}

const Register = () => {
  const [form, setForm] = useState(EMPTY)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const redirect = useRef(null)

  useEffect(() => () => clearTimeout(redirect.current), [])

  const set = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const mismatch = form.password_confirm.length > 0 && form.password !== form.password_confirm
  const canSubmit = passwordIsValid(form.password) && form.password === form.password_confirm && !loading

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiRequest('/api/register/', {
        method: 'POST',
        auth: false,
        body: { ...form, requested_area: form.requested_area || null },
      })
      setSuccess(true)
      redirect.current = setTimeout(
        () => navigate('/login', { state: { notice: 'Solicitud enviada. Un administrador te asignará un rol.' } }),
        3000,
      )
    } catch (err) {
      setError(err.message || 'No se pudo registrar. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell wide>
      <h1 className={styles.welcomeTitle}>
        Crea tu cuenta en <span className={styles.welcomeAccent}>TexCoreERP</span>
      </h1>
      <p className={styles.subtitle}>
        Tu cuenta quedará pendiente hasta que un administrador te asigne un rol.
      </p>

      {success ? (
        <div className={styles.successMessage} role="status">
          Registro exitoso. Te llevamos al inicio de sesión...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <Icon d={ICONS.user} />
              <input
                type="text" name="first_name" placeholder="Nombre(s)" value={form.first_name}
                onChange={set} className={styles.input} autoComplete="given-name" required
              />
            </div>
            <div className={styles.inputGroup}>
              <Icon d={ICONS.user} />
              <input
                type="text" name="last_name" placeholder="Apellidos" value={form.last_name}
                onChange={set} className={styles.input} autoComplete="family-name" required
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <Icon d={ICONS.mail} />
            <input
              type="email" name="email" placeholder="Correo electrónico corporativo" value={form.email}
              onChange={set} className={styles.input} autoComplete="email" autoCapitalize="none" required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <Icon d={ICONS.area} />
              <select
                name="requested_area" value={form.requested_area} onChange={set}
                className={`${styles.input} ${styles.select} ${form.requested_area ? '' : styles.selectEmpty}`}
                aria-label="Cargo o área solicitada"
              >
                <option value="">Cargo o área</option>
                {AREAS.map((area) => (
                  <option key={area.value} value={area.value}>{area.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <Icon d={ICONS.id} />
              <input
                type="text" name="document_id" placeholder="Cédula (opcional)" value={form.document_id}
                onChange={set} className={styles.input} inputMode="numeric"
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <Icon d={ICONS.lock} />
            <input
              type={showPassword ? 'text' : 'password'} name="password" placeholder="Contraseña"
              value={form.password} onChange={set} className={styles.input} autoComplete="new-password" required
            />
            <button
              type="button" className={styles.revealBtn} onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          <ul className={styles.checklist} aria-label="Requisitos de la contraseña">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(form.password)
              return (
                <li key={rule.label} className={ok ? styles.ruleOk : undefined}>
                  <span aria-hidden="true">{ok ? '✓' : '•'}</span> {rule.label}
                </li>
              )
            })}
          </ul>

          <div className={styles.inputGroup}>
            <Icon d={ICONS.lock} />
            <input
              type={showPassword ? 'text' : 'password'} name="password_confirm" placeholder="Repite la contraseña"
              value={form.password_confirm} onChange={set} aria-invalid={mismatch}
              className={`${styles.input} ${mismatch ? styles.inputError : ''}`} autoComplete="new-password" required
            />
          </div>
          {mismatch && <p className={styles.fieldHint}>Las contraseñas no coinciden.</p>}

          <button type="submit" className={styles.loginBtn} disabled={!canSubmit}>
            {loading ? 'Registrando...' : 'Registrarse'}
            <span className={styles.btnArrow} aria-hidden="true">→</span>
          </button>

          <div className={styles.registerRow}>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className={styles.registerLink}>Inicia sesión</Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}

export default Register
