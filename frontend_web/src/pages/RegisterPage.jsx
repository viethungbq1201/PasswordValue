import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

export default function RegisterPage() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email || !password || !confirm) return setError('Please fill in all fields')
        if (password.length < 12) return setError('Master password must be at least 12 characters')
        if (password !== confirm) return setError('Passwords do not match')

        setLoading(true)
        setError('')
        try {
            await register(email.trim(), password)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Create Account</h1>
                    <p className="text-vault-muted mt-2">
                        Your master password encrypts your vault locally.
                        <br />
                        <span className="text-vault-teal text-sm font-medium">It is never sent to the server.</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="card p-6 space-y-5">
                    {error && (
                        <div className="bg-vault-red/10 border border-vault-red/25 rounded-lg px-4 py-3 text-sm text-vault-red">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Email</label>
                        <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
                    </div>

                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Master Password <span className="text-vault-muted">(min 12 characters)</span></label>
                        <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a strong master password" />
                        {password.length > 0 && password.length < 12 && (
                            <p className="text-vault-amber text-xs mt-1">⚠️ {12 - password.length} more character{12 - password.length !== 1 ? 's' : ''} needed</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Confirm Master Password</label>
                        <input type="password" className="input-field" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter your master password" />
                    </div>

                    <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                        {loading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : 'Create Account'}
                    </button>

                    <p className="text-center text-sm text-vault-muted">
                        Already have an account?{' '}
                        <Link to="/login" className="text-vault-teal hover:underline font-medium">Log in</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
