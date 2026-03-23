import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from './api'
import cryptoService from './CryptoService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('sv_token')
            const email = localStorage.getItem('sv_email')
            const userId = localStorage.getItem('sv_userId')
            
            if (token && email) {
                const keyRestored = await cryptoService.restoreFromSession();
                if (keyRestored) {
                    setUser({ token, email, userId })
                } else {
                    // Session key lost (e.g., opened in a new tab) -> require re-login
                    localStorage.removeItem('sv_token')
                    localStorage.removeItem('sv_email')
                    localStorage.removeItem('sv_userId')
                    cryptoService.clearKey()
                    setUser(null)
                }
            }
            setLoading(false)
        };
        
        initAuth();
    }, [])

    const login = async (email, masterPassword) => {
        // Derive master key before sending anything to backend (or after, but we need it for decryption)
        await cryptoService.deriveMasterKey(masterPassword, email)
        
        const res = await authApi.login(email, masterPassword)
        const { token, email: userEmail, userId } = res.data
        localStorage.setItem('sv_token', token)
        localStorage.setItem('sv_email', userEmail)
        localStorage.setItem('sv_userId', userId)
        setUser({ token, email: userEmail, userId })
        return res.data
    }

    const register = async (email, masterPassword) => {
        await cryptoService.deriveMasterKey(masterPassword, email)
        
        const res = await authApi.register(email, masterPassword)
        const { token, email: userEmail, userId } = res.data
        localStorage.setItem('sv_token', token)
        localStorage.setItem('sv_email', userEmail)
        localStorage.setItem('sv_userId', userId)
        setUser({ token, email: userEmail, userId })
        return res.data
    }

    const logout = () => {
        localStorage.removeItem('sv_token')
        localStorage.removeItem('sv_email')
        localStorage.removeItem('sv_userId')
        cryptoService.clearKey()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
