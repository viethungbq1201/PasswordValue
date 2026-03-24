import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL?.endsWith('/')
        ? import.meta.env.VITE_API_URL
        : `${import.meta.env.VITE_API_URL}/`,
    headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sv_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Handle 401 responses — auto logout
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('sv_token')
            localStorage.removeItem('sv_email')
            window.location.href = '/login'
        }
        return Promise.reject(err)
    }
)

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
    register: (email, masterPassword) =>
        api.post('auth/register', { email, masterPassword }),
    login: (email, masterPassword) =>
        api.post('auth/login', { email, masterPassword }),
}

// ── Vault ─────────────────────────────────────────────────
export const vaultApi = {
    getAll: () => api.get('vault'),
    getByType: (type) => api.get(`vault?type=${type}`),
    getFavorites: () => api.get('vault/favorites'),
    getTrash: () => api.get('vault/trash'),
    getByFolder: (id) => api.get(`vault/folder/${id}`),
    create: (data) => api.post('vault', data),
    update: (id, data) => api.put(`vault/${id}`, data),
    delete: (id) => api.delete(`vault/${id}`),
    restore: (id) => api.post(`vault/${id}/restore`),
    deletePermanent: (id) => api.delete(`vault/${id}/permanent`),
}

// ── Folders ───────────────────────────────────────────────
export const folderApi = {
    getAll: () => api.get('folders'),
    create: (name) => api.post('folders', { name }),
    update: (id, name) => api.put(`folders/${id}`, { name }),
    delete: (id) => api.delete(`folders/${id}`),
}

// ── Sync ──────────────────────────────────────────────────
export const syncApi = {
    upload: (data) => api.post('sync/upload', data),
    downloadDelta: (ts) => api.get(`sync/download?since=${ts}`),
    downloadFull: () => api.post('sync/full'),
}

// ── Autofill ──────────────────────────────────────────────
export const autofillApi = {
    match: (domain) => api.get(`autofill?domain=${encodeURIComponent(domain)}`),
}

export default api
