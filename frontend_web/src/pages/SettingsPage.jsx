import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

export default function SettingsPage() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-vault-bg">
            {/* Header */}
            <header className="border-b border-vault-border bg-vault-surface/80 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="text-vault-muted hover:text-vault-text transition">← Back</button>
                        <h1 className="text-xl font-semibold">Settings</h1>
                    </div>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {/* Account */}
                <section>
                    <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">Account</h2>
                    <div className="card divide-y divide-vault-border">
                        <div className="flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium">Email</p>
                                <p className="text-sm text-vault-muted">{user?.email}</p>
                            </div>
                            <span className="text-vault-muted">✉️</span>
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium">User ID</p>
                                <p className="text-sm text-vault-muted font-mono">{localStorage.getItem('sv_userId') || 'N/A'}</p>
                            </div>
                            <span className="text-vault-muted">🪪</span>
                        </div>
                    </div>
                </section>

                {/* Security */}
                <section>
                    <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">Security</h2>
                    <div className="card divide-y divide-vault-border">
                        <div className="flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium">Encryption</p>
                                <p className="text-sm text-vault-muted">AES-256-GCM with Argon2id key derivation</p>
                            </div>
                            <span className="bg-vault-green/10 text-vault-green text-xs font-semibold px-2.5 py-1 rounded-full">Active</span>
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium">Auto-lock Timer</p>
                                <p className="text-sm text-vault-muted">Lock vault after inactivity</p>
                            </div>
                            <select className="bg-vault-card border border-vault-border rounded-lg px-3 py-1.5 text-sm text-vault-text">
                                <option>5 minutes</option>
                                <option>15 minutes</option>
                                <option>1 hour</option>
                                <option>Never</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium">Biometric Unlock</p>
                                <p className="text-sm text-vault-muted">Use fingerprint or Face ID</p>
                            </div>
                            <span className="text-vault-muted text-sm">Mobile only</span>
                        </div>
                    </div>
                </section>

                {/* Sync */}
                <section>
                    <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">Sync & Devices</h2>
                    <div className="card divide-y divide-vault-border">
                        <div className="flex items-center justify-between p-4">
                            <div>
                                <p className="font-medium">Sync Status</p>
                                <p className="text-sm text-vault-muted">Automatic sync enabled</p>
                            </div>
                            <span className="bg-vault-green/10 text-vault-green text-xs font-semibold px-2.5 py-1 rounded-full">Connected</span>
                        </div>
                        <div className="p-4">
                            <p className="font-medium mb-2">API Endpoint</p>
                            <code className="text-sm text-vault-teal bg-vault-bg px-3 py-1.5 rounded-lg block">http://localhost:8080/api</code>
                        </div>
                    </div>
                </section>

                {/* About */}
                <section>
                    <h2 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">About</h2>
                    <div className="card divide-y divide-vault-border">
                        <div className="p-4">
                            <p className="font-medium">SecureVault v1.0.0</p>
                            <p className="text-sm text-vault-muted mt-1">
                                Zero-knowledge architecture — your vault is encrypted on your device.
                                The server stores only encrypted BYTEA blobs and can never access your data.
                            </p>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-vault-muted">
                                Stack: Spring Boot 3.4 · PostgreSQL · React · Flutter · Chrome Extension
                            </p>
                        </div>
                    </div>
                </section>

                {/* Logout */}
                <button
                    onClick={() => { logout(); navigate('/login') }}
                    className="btn-danger w-full"
                >
                    ↗️ Log Out
                </button>
            </div>
        </div>
    )
}
