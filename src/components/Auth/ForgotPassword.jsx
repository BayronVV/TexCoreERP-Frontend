import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../../api/client'
import AuthShell from './AuthShell'
import styles from './Auth.module.css'

const MailIcon = () => (
  <svg className={styles.inputIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 6.5 12 13l9-6.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
    />
  </svg>
)

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      const response = await apiRequest('/api/auth/password-reset/', { method: 'POST', body: { email }, auth: false })
      setSent({ email: email.trim(), minutes: response.expires_minutes })
    } catch (err) {
      setError(
        err.status === 429
          ? 'Hiciste demasiadas solicitudes seguidas. Espera unos minutos y vuelve a intentarlo.'
          : err.message,
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthShell>
      <h1 className={styles.welcomeTitle}>¿Olvidaste tu contraseña?</h1>

      {sent ? (
        <>
          <div className={styles.successMessage}>
            Si <strong>{sent.email}</strong> pertenece a una cuenta activa, te llegará un correo con un enlace para
            crear una contraseña nueva. El enlace vence en {sent.minutes} minutos y sirve una sola vez.
          </div>
          <p className={styles.subtitle}>¿No lo ves? Revisa la carpeta de spam o pide otro enlace.</p>
          <div className={styles.form}>
            <Link to="/login" className={styles.loginBtn}>
              Volver a iniciar sesión
            </Link>
            <button type="button" className={styles.secondaryBtn} onClick={() => setSent(null)}>
              Enviar otro enlace
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.subtitle}>
            Escribe el correo con el que te registraste y te enviaremos un enlace para restablecerla.
          </p>
          <form onSubmit={submit} className={styles.form}>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <div className={styles.inputGroup}>
              <MailIcon />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={styles.input}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <button type="submit" className={styles.loginBtn} disabled={sending}>
              {sending ? 'Enviando...' : 'Enviar enlace'}
              <span className={styles.btnArrow} aria-hidden="true">
                →
              </span>
            </button>
            <div className={styles.registerRow}>
              ¿La recordaste?{' '}
              <Link to="/login" className={styles.registerLink}>
                Inicia sesión
              </Link>
            </div>
          </form>
        </>
      )}
    </AuthShell>
  )
}
