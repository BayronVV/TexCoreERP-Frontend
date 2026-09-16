import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styles from './Dashboard.module.css';

const ROLE_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'VENDEDOR', label: 'Vendedor' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'PRODUCCION', label: 'Jefe de Producción' },
  { value: 'ALMACENISTA', label: 'Almacenista' },
  { value: 'TERMINACION', label: 'Personal de Terminacion' },
  { value: 'SECRETARIA', label: 'Secretaria' },
];

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get('http://localhost:8000/api/users/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.put(`http://localhost:8000/api/users/${userId}/role/`, 
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      alert('Rol actualizado correctamente');
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Failed to update role', err);
      alert('Error al actualizar rol');
    }
  };

  if (loading) return <div>Cargando usuarios...</div>;

  return (
    <div className={styles.adminPanel}>
      <h3>Panel de Administración - Gestión de Usuarios</h3>
      <table className={styles.userTable}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Rol Actual</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td>
                <span className={`${styles.roleBadge} ${user.role === 'PENDING' ? styles.pending : ''}`}>
                  {user.role}
                </span>
              </td>
              <td>
                <select 
                  defaultValue={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className={styles.roleSelect}
                >
                  {ROLE_OPTIONS.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPanel;
