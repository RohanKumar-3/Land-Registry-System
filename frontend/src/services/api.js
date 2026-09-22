import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────────────
api.interceptors.response.use(
  response => response,   // 2xx — pass through
  error => {
    const status = error.response?.status;

    // If 401 and it's NOT the login endpoint → session expired
    // (login endpoint 401 = wrong password, handle in component)
    if (status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('loginTime');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/';   // hard redirect to home
    }

    // ALWAYS rethrow so catch blocks in components receive the error
    return Promise.reject(error);
  }
);

export default api;