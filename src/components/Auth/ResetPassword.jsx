import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../api/client'
import AuthShell from './AuthShell'
import { PASSWORD_RULES, passwordIsValid } from './passwordRules'
import styles from './Auth.module.css'

const LockIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 10.5V8a5 5 0 0 1 10 0v2.5M6 10.5h12a1 1 0 0 1 1 1V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7.5a1 1 0 0 1 1-1Z"
    />
  </svg>
)

// También la usa quien recibe la invitación de una cuenta creada por un admin.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // El token queda solo en memoria: se quita de la URL para que no quede en el historial.
  const [token] = useState(() => params.get('token') || '')
  const [check, setCheck] = useState(() =>
    token
      ? { state: 'checking' }
      : { state: 'invalid', detail: 'El enlace está incompleto. Ábrelo de nuevo desde el correo.' },
  )
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const validate = useCallback(() => {
    apiRequest('/api/auth/password-reset/validate/', { method: 'POST', body: { token }, auth: false })
      .then((data) => setCheck({ state: 'valid', ...data }))
      // Solo un 400 significa que el enlace no sirve; lo demás (sin conexión, 429) se puede reintentar.
      .catch((err) => setCheck({ state: err.status === 400 ? 'invalid' : 'error', detail: err.message }))
  }, [token])

  useEffect(() => {
    setParams({}, { replace: true })
    if (token) validate()
  }, [token, validate, setParams])

  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = passwordIsValid(password) && password === confirm && !saving

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await apiRequest('/api/auth/password-reset/confirm/', {
        method: 'POST',
        auth: false,
        body: { token, password, password_confirm: confirm },
      })
      navigate('/login', {
        replace: true,
        state: { notice: 'Tu contraseña quedó guardada. Ya puedes iniciar sesión.' },
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (check.state === 'checking') {
    return (
      <AuthShell>
        <p className={styles.subtitle}>Verificando el enlace...</p>
      </AuthShell>
    )
  }

  if (check.state === 'error') {
    return (
      <AuthShell>
        <h1 className={styles.welcomeTitle}>No pudimos revisar el enlace</h1>
        <div className={styles.errorMessage}>{check.detail}</div>
        <div className={styles.form}>
          <button
            type="button"
            className={styles.loginBtn}
            onClick={() => {
              setCheck({ state: 'checking' })
              validate()
            }}
          >
            Intentar de nuevo
          </button>
        </div>
      </AuthShell>
    )
  }

  if (check.state === 'invalid') {
    return (
      <AuthShell>
        <h1 className={styles.welcomeTitle}>Este enlace ya no sirve</h1>
        <div className={styles.errorMessage}>{check.detail}</div>
        <div className={styles.form}>
          <Link to="/recuperar-contrasena" className={styles.loginBtn}>
            Pedir un enlace nuevo
          </Link>
          <Link to="/login" className={styles.secondaryBtn}>
            Volver a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    )
  }

  const invite = check.purpose === 'invite'

  return (
    <AuthShell>
      <h1 className={styles.welcomeTitle}>{invite ? 'Activa tu cuenta' : 'Crea una contraseña nueva'}</h1>
      <p className={styles.subtitle}>
        Cuenta: <strong>{check.email}</strong>
      </p>

      <form onSubmit={submit} className={styles.form}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.inputGroup}>
          <LockIcon />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña nueva"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
            autoComplete="new-password"
            required
            autoFocus
          />
          <button
            type="button"
            className={styles.revealBtn}
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <ul className={styles.checklist} aria-label="Requisitos de la contraseña">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(password)
            return (
              <li key={rule.label} className={ok ? styles.ruleOk : undefined}>
                <span aria-hidden="true">{ok ? '✓' : '•'}</span> {rule.label}
              </li>
            )
          })}
        </ul>

        <div className={styles.inputGroup}>
          <LockIcon />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={`${styles.input} ${mismatch ? styles.inputError : ''}`}
            autoComplete="new-password"
            aria-invalid={mismatch}
            required
          />
        </div>
        {mismatch && <p className={styles.fieldHint}>Las contraseñas no coinciden.</p>}

        <button type="submit" className={styles.loginBtn} disabled={!canSubmit}>
          {saving ? 'Guardando...' : invite ? 'Activar cuenta' : 'Guardar contraseña'}
          <span className={styles.btnArrow} aria-hidden="true">
            →
          </span>
        </button>
      </form>
    </AuthShell>
  )
}
