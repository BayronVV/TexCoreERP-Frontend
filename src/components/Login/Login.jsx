import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:8000/api/token/', {
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
    <div className={styles.loginContainer}>
      <div className={styles.leftBanner}>
        <div className={styles.bannerContent}>
          <div className={styles.logoIcon}>✳</div>
          <h1 className={styles.bannerTitle}>
            ¡Hola<br />TexCoreERP! 👋
          </h1>
          <p className={styles.bannerText}>
            Omite las tareas repetitivas y manuales. ¡Vuélvete altamente productivo mediante la automatización y ahorra muchísimo tiempo!
          </p>
          <div className={styles.footerText}>
            © 2026 TexCoreERP. Todos los derechos reservados.
          </div>
        </div>
      </div>
      
      <div className={styles.rightForm}>
        <div className={styles.formContent}>
          <div className={styles.header}>
            <h2 className={styles.brandName}>TexCoreERP</h2>
          </div>
          
          <div className={styles.formWrapper}>
            <h3 className={styles.welcomeTitle}>¡Bienvenido de nuevo!</h3>
            <p className={styles.subtitle}>
              ¿No tienes una cuenta? <a href="#" className={styles.link}>Crea una cuenta nueva ahora</a>, ¡es GRATIS! Toma menos de un minuto.
            </p>
            
            <form onSubmit={handleSubmit} className={styles.form}>
              {error && <div className={styles.errorMessage}>{error}</div>}
              
              <div className={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Usuario / Correo electrónico" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
              
              <div className={styles.inputGroup}>
                <input 
                  type="password" 
                  placeholder="Contraseña" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className={styles.loginBtn}
                disabled={loading}
              >
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión ahora'}
              </button>
              
              <button type="button" className={styles.googleBtn}>
                <span className={styles.googleIcon}>G</span> Iniciar sesión con Google
              </button>
              
              <div className={styles.forgotPassword}>
                ¿Olvidaste tu contraseña? <a href="#" className={styles.link}>Haz clic aquí</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
