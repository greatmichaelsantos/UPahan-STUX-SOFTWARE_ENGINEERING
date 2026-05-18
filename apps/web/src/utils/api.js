import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('upahan_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.method === 'get') {
      config.params = { ...config.params, _t: Date.now() };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on login 401 — let the login form show the error
    const isLoginAttempt = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('upahan_token');
      localStorage.removeItem('upahan_user');
      localStorage.removeItem('upahan_tenant');
      window.location.href = '/select-role';
    }
    return Promise.reject(error);
  }
);

export default api;
