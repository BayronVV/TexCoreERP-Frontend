import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { API_URL } from '../../api/client';
import AuthShell from './AuthShell';
import styles from './Auth.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const notice = useLocation().state?.notice;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/token/`, {
        username: email,
        password: password,
      });

      const { access, refresh } = response.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Parse JWT token to get role
      const payloadBase64 = access.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      localStorage.setItem('user_role', payload.role);

      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Credenciales inválidas. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className={styles.welcomeTitle}>
        ¡Bienvenido a <span className={styles.welcomeAccent}>TexCoreERP</span>!
      </h1>
      <p className={styles.subtitle}>
        Inicia sesión y continúa la trazabilidad de tu producción.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        {notice && !error && <div className={styles.successMessage}>{notice}</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.inputGroup}>
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
          <input
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            placeholder="Usuario / Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.inputGroup}>
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
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.forgotRow}>
          <Link to="/recuperar-contrasena" className={styles.link}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button type="submit" className={styles.loginBtn} disabled={loading}>
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          <span className={styles.btnArrow} aria-hidden="true">
            →
          </span>
        </button>

        <div className={styles.divider}>
          <span />
          <em>o</em>
          <span />
        </div>

        <button type="button" className={styles.googleBtn}>
          <svg className={styles.googleIcon} viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
            />
          </svg>
          Continuar con Google
        </button>

        <div className={styles.registerRow}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className={styles.registerLink}>
            Regístrate
          </Link>
        </div>
      </form>
    </AuthShell>
  );
};

export default Login;
