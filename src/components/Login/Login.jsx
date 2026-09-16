import React, { useState } from 'react';
import axios from 'axios';
import styles from './Login.module.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Adjusted the payload to use username since Django CustomUser uses username by default for login
      // If we configured it to use email, we would send email. But let's assume it's username for now.
      // Wait, let's use the input as username for the Django default setup.
      const response = await axios.post('http://localhost:8000/api/token/', {
        username: email, // Sending email input as username
        password: password,
      });
      console.log('Login successful:', response.data);
      // Store token (e.g., in localStorage)
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      alert('Login successful!');
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
