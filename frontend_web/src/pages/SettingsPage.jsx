import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import { vaultApi } from '../services/api'
import { EncryptionUtils } from '../services/EncryptionUtils'

export default function SettingsPage() {
    const { user, logout, login } = useAuth()
    const navigate = useNavigate()
    const [exporting, setExporting] = useState(false)
    const [showExportModal, setShowExportModal] = useState(false)
    const [exportPassword, setExportPassword] = useState('')
    const [exportError, setExportError] = useState('')

    const handleExport = async (e) => {
        e.preventDefault()
        setExporting(true)
        setExportError('')

        try {
            // 1. Verify password by attempting to 'login' (doesn't change state, just checks)
            await login(user.email, exportPassword)

            // 2. Fetch all vault items
            const res = await vaultApi.getAll()
            const rawItems = res.data.map(item => {
                try {
                    if (item.encryptedData) {
                        const decodedStr = atob(item.encryptedData);
                        return JSON.parse(decodeURIComponent(escape(decodedStr)));
                    }
                } catch (e) { }
                return item
            })

            // 3. Encrypt data
            const encryptedPayload = await EncryptionUtils.encryptVault(rawItems, exportPassword)

            // 4. Download file
            const blob = new Blob([JSON.stringify(encryptedPayload, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `securevault-export-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setShowExportModal(false)
            setExportPassword('')
            alert('Vault exported successfully!')
        } catch (err) {
            setExportError('Invalid password or export failed')
        } finally {
            setExporting(false)
        }
    }

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
                        <div className="p-4 flex items-center justify-between">
                            <div>
                                <p className="font-medium">Export Vault</p>
                                <p className="text-sm text-vault-muted">Download an encrypted backup of your data</p>
                            </div>
                            <button 
                                onClick={() => setShowExportModal(true)}
                                className="px-4 py-2 bg-vault-card border border-vault-border rounded-lg text-sm font-medium hover:bg-white/5 transition"
                            >
                                📥 Export
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-vault-muted">
                                Stack: Spring Boot 3.4 · PostgreSQL · React · Flutter · Chrome Extension
                            </p>
                        </div>
                    </div>
                </section>

                {/* Export Modal */}
                {showExportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="card w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in duration-200">
                            <h3 className="text-xl font-semibold">Export Vault</h3>
                            <p className="text-sm text-vault-muted">
                                Enter your master password to encrypt your vault file. 
                                <strong> Keep this file safe!</strong>
                            </p>

                            {exportError && (
                                <div className="text-xs text-vault-red bg-vault-red/10 p-2 rounded border border-vault-red/20">
                                    {exportError}
                                </div>
                            )}

                            <form onSubmit={handleExport} className="space-y-4">
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder="Master Password"
                                    value={exportPassword}
                                    onChange={(e) => setExportPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <div className="flex gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setShowExportModal(false)}
                                        className="btn-secondary flex-1"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={exporting}
                                        className="btn-primary flex-1"
                                    >
                                        {exporting ? 'Encrypting...' : 'Export'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

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
