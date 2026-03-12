import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

export default function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPass, setShowPass] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email || !password) return setError('Please fill in all fields')

        setLoading(true)
        setError('')
        try {
            await login(email.trim(), password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid email or password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-vault-blue/20 rounded-2xl mb-4">
                        <svg className="w-8 h-8 text-vault-blue" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">SecureVault</h1>
                    <p className="text-vault-muted mt-2">Your zero-knowledge password manager</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="card p-6 space-y-5">
                    <h2 className="text-xl font-semibold">Log in</h2>

                    {error && (
                        <div className="bg-vault-red/10 border border-vault-red/25 rounded-lg px-4 py-3 text-sm text-vault-red">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Email</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Master Password</label>
                        <div className="relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="input-field pr-12"
                                placeholder="Enter your master password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text transition-colors"
                            >
                                {showPass ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                        ) : 'Log In'}
                    </button>

                    <p className="text-center text-sm text-vault-muted">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-vault-teal hover:underline font-medium">Create account</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
