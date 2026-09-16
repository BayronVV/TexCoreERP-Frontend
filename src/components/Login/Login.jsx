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
      setError('Invalid credentials. Please try again.');
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
            Hello<br />TexCoreERP! 👋
          </h1>
          <p className={styles.bannerText}>
            Skip repetitive and manual sales-marketing tasks. Get highly productive through automation and save tons of time!
          </p>
          <div className={styles.footerText}>
            © 2026 TexCoreERP. All rights reserved.
          </div>
        </div>
      </div>
      
      <div className={styles.rightForm}>
        <div className={styles.formContent}>
          <div className={styles.header}>
            <h2 className={styles.brandName}>TexCoreERP</h2>
          </div>
          
          <div className={styles.formWrapper}>
            <h3 className={styles.welcomeTitle}>Welcome Back!</h3>
            <p className={styles.subtitle}>
              Don't have an account? <a href="#" className={styles.link}>Create a new account now</a>, it's FREE! Takes less than a minute.
            </p>
            
            <form onSubmit={handleSubmit} className={styles.form}>
              {error && <div className={styles.errorMessage}>{error}</div>}
              
              <div className={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Username / Email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
              
              <div className={styles.inputGroup}>
                <input 
                  type="password" 
                  placeholder="Password" 
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
                {loading ? 'Logging in...' : 'Login Now'}
              </button>
              
              <button type="button" className={styles.googleBtn}>
                <span className={styles.googleIcon}>G</span> Login with Google
              </button>
              
              <div className={styles.forgotPassword}>
                Forget password <a href="#" className={styles.link}>Click here</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
