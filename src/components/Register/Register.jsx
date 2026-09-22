import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Register.module.css';

const Register = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirm: '',
    requested_area: '',
    document_id: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axios.post('http://localhost:8000/api/register/', formData);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
        // Display first error message
        const firstErrorKey = Object.keys(err.response.data)[0];
        const errorMessage = err.response.data[firstErrorKey];
        setError(`${firstErrorKey}: ${Array.isArray(errorMessage) ? errorMessage[0] : errorMessage}`);
      } else {
        setError('Error al registrar. Por favor intenta de nuevo.');
      }
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
            ¡Únete a<br />TexCoreERP! 👋
          </h1>
          <p className={styles.bannerText}>
            Regístrate ahora para acceder al ERP. Tu cuenta quedará en estado pendiente hasta que un administrador te asigne tu rol.
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
            <h3 className={styles.welcomeTitle}>Crear una cuenta</h3>
            <p className={styles.subtitle}>
              ¿Ya tienes una cuenta? <Link to="/login" className={styles.link}>Inicia sesión aquí</Link>.
            </p>
            
            {success ? (
              <div className={styles.successMessage} style={{color: 'green', padding: '1rem', background: '#e6ffe6', borderRadius: '4px', marginBottom: '1rem'}}>
                Registro exitoso. Serás redirigido al login...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                {error && <div className={styles.errorMessage}>{error}</div>}
                
                <div style={{display: 'flex', gap: '10px'}}>
                  <div className={styles.inputGroup} style={{flex: 1}}>
                    <input 
                      type="text" 
                      name="first_name"
                      placeholder="Nombre(s)*" 
                      value={formData.first_name}
                      onChange={handleChange}
                      className={styles.input}
                      required
                    />
                  </div>
                  
                  <div className={styles.inputGroup} style={{flex: 1}}>
                    <input 
                      type="text" 
                      name="last_name"
                      placeholder="Apellidos*" 
                      value={formData.last_name}
                      onChange={handleChange}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <input 
                    type="email" 
                    name="email"
                    placeholder="Correo Electrónico Corporativo*" 
                    value={formData.email}
                    onChange={handleChange}
                    className={styles.input}
                    required
                  />
                </div>

                <div style={{display: 'flex', gap: '10px'}}>
                  <div className={styles.inputGroup} style={{flex: 1}}>
                    <input 
                      type="password" 
                      name="password"
                      placeholder="Contraseña*" 
                      value={formData.password}
                      onChange={handleChange}
                      className={styles.input}
                      required
                    />
                  </div>
                  
                  <div className={styles.inputGroup} style={{flex: 1}}>
                    <input 
                      type="password" 
                      name="password_confirm"
                      placeholder="Confirmar Contraseña*" 
                      value={formData.password_confirm}
                      onChange={handleChange}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div style={{display: 'flex', gap: '10px'}}>
                  <div className={styles.inputGroup} style={{flex: 1}}>
                    <select 
                      name="requested_area"
                      value={formData.requested_area}
                      onChange={handleChange}
                      className={styles.input}
                      style={{appearance: 'none', backgroundColor: 'white'}}
                    >
                      <option value="" disabled>Cargo o Área solicitada</option>
                      <option value="PRODUCCION">Producción</option>
                      <option value="ALMACENISTA">Bodega</option>
                      <option value="VENDEDOR">Ventas</option>
                      <option value="GERENTE">Gerencia</option>
                      <option value="SECRETARIA">Secretaria</option>
                      <option value="TERMINACION">Terminación</option>
                    </select>
                  </div>

                  <div className={styles.inputGroup} style={{flex: 1}}>
                    <input 
                      type="text" 
                      name="document_id"
                      placeholder="Cédula (Opcional)" 
                      value={formData.document_id}
                      onChange={handleChange}
                      className={styles.input}
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  className={styles.loginBtn}
                  disabled={loading}
                  style={{marginTop: '10px'}}
                >
                  {loading ? 'Registrando...' : 'Registrarse'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
