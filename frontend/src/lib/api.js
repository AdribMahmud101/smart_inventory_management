import axios from 'axios'

// Axios instance shared by every view.
// Base URL '/api' is proxied to the FastAPI backend by the Vite dev
// server (see vite.config.js), so no CORS issues in development.
const api = axios.create({
  baseURL: '/api',
})

// Attach the bearer token to every outgoing request, if one is stored.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 (invalid/expired token), clear the session and go back to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api
