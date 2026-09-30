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
