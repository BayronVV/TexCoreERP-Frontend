import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPanel from './AdminPanel';
import Sidebar from '../Sidebar/Sidebar';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const [role, setRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      navigate('/login');
      return;
    }
    setRole(userRole);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  if (!role) return <div>Loading...</div>;

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <h2>TexCoreERP Dashboard</h2>
        <div className={styles.userInfo}>
          <span className={styles.roleBadge}>{role}</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
        </div>
      </header>
      
      <div className={styles.body}>
        {role !== 'PENDING' && <Sidebar role={role} />}

        <main className={styles.mainContent}>
          {role === 'ADMIN' && <AdminPanel />}

          {role === 'PENDING' && (
            <div className={styles.messageCard}>
              <h3>Account Pending</h3>
              <p>Your account is currently pending approval. Please wait until an Administrator assigns you a role.</p>
            </div>
          )}

          {role !== 'ADMIN' && role !== 'PENDING' && (
            <div className={styles.messageCard}>
              <h3>Bienvenido, {role}</h3>
              <p>Este es tu panel personalizado según tu rol asignado en el sistema.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
