import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);
const SESSION_MINUTES = 45;

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate              = useNavigate();
  const timerRef              = useRef(null);

  // ── Clear session timer ──────────────────────────────────────────────
  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // ── Force logout after 45 minutes ───────────────────────────────────
  const startSessionTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      logout(true);   // true = session expired (not manual logout)
    }, SESSION_MINUTES * 60 * 1000);
  }, []);

  // ── Restore session on page refresh ─────────────────────────────────
  useEffect(() => {
    const token      = localStorage.getItem('token');
    const userData   = localStorage.getItem('user');
    const loginTime  = localStorage.getItem('loginTime');

    if (token && userData && loginTime) {
      const elapsed = (Date.now() - Number(loginTime)) / 1000 / 60;

      if (elapsed >= SESSION_MINUTES) {
        // Session already expired while browser was closed
        _clearStorage();
        setLoading(false);
        return;
      }

      // Restore user + start timer for remaining time
      setUser(JSON.parse(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const remainingMs = (SESSION_MINUTES - elapsed) * 60 * 1000;
      timerRef.current = setTimeout(() => logout(true), remainingMs);
    }
    setLoading(false);

    return () => clearTimer();
  }, []);

  const _clearStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    delete api.defaults.headers.common['Authorization'];
  };

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });

    localStorage.setItem('token',     data.token);
    localStorage.setItem('user',      JSON.stringify(data.user));
    localStorage.setItem('loginTime', Date.now().toString());

    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
    startSessionTimer();

    return data.user;
  };

  // ── Register ───────────────────────────────────────────────────────
  const register = async (formData) => {
    const { data } = await api.post('/auth/register', formData);

    localStorage.setItem('token',     data.token);
    localStorage.setItem('user',      JSON.stringify(data.user));
    localStorage.setItem('loginTime', Date.now().toString());

    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user);
    startSessionTimer();

    return data.user;
  };

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = useCallback((expired = false) => {
    clearTimer();
    _clearStorage();
    setUser(null);

    if (expired) {
      toast.error('Session expired. Please log in again.', {
        duration: 5000,
        icon:     '⏱️',
      });
    } else {
      toast.success('Logged out successfully');
    }

    navigate('/');
  }, [navigate]);

  // ── Update user in context (e.g. after wallet connect) ────────────
  const updateUser = (updatedFields) => {
    const merged = { ...user, ...updatedFields };
    setUser(merged);
    localStorage.setItem('user', JSON.stringify(merged));
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, register, logout, updateUser,
      isLoggedIn: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);