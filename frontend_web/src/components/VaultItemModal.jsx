import { useState, useEffect } from 'react'
import { vaultApi } from '../services/api'
import zxcvbn from 'zxcvbn'

const TYPES = ['LOGIN', 'CARD', 'SECURE_NOTE', 'IDENTITY', 'OTP']

export default function VaultItemModal({ item, onClose, onSaved }) {
    const isEdit = !!item
    const [type, setType] = useState(item?.type || 'LOGIN')
    const [name, setName] = useState(item?.name || '')
    const [website, setWebsite] = useState(item?.website || '')
    const [matchType, setMatchType] = useState(item?.matchType || 'DOMAIN')
    const [username, setUsername] = useState(item?.username || '')
    const [password, setPassword] = useState(item?.password || '')
    const [notes, setNotes] = useState(item?.notes || '')
    const [cardNumber, setCardNumber] = useState(item?.cardNumber || '')
    const [cardHolder, setCardHolder] = useState(item?.cardHolder || '')
    const [cardExpiry, setCardExpiry] = useState(item?.cardExpiry || '')
    const [cardCvv, setCardCvv] = useState(item?.cardCvv || '')
    const [otpSecret, setOtpSecret] = useState(item?.otpSecret || '')
    const [favorite, setFavorite] = useState(item?.favorite || false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showPass, setShowPass] = useState(false)

    const handleSave = async () => {
        if (!name.trim()) return setError('Name is required')

        setSaving(true)
        setError('')
        try {
            const rawJson = JSON.stringify({
                name: name.trim(), // Apply trim here as name is no longer a top-level field
                website, username, password, notes,
                cardNumber, cardHolder, cardExpiry, cardCvv, otpSecret,
            });

            const payload = {
                type,
                favorite,
                encryptedData: btoa(unescape(encodeURIComponent(rawJson))),
                website: website || null,
                matchType: matchType,
            }

            if (isEdit) {
                await vaultApi.update(item.id, payload)
            } else {
                await vaultApi.create(payload)
            }
            onSaved()
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const generatePassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-='
        let pw = ''
        const arr = new Uint32Array(20)
        crypto.getRandomValues(arr)
        for (let i = 0; i < 20; i++) pw += chars[arr[i] % chars.length]
        setPassword(pw)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-vault-border">
                    <h2 className="text-lg font-semibold">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
                    <button onClick={onClose} className="text-vault-muted hover:text-vault-text text-xl">✕</button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {error && (
                        <div className="bg-vault-red/10 border border-vault-red/25 rounded-lg px-4 py-2.5 text-sm text-vault-red">{error}</div>
                    )}

                    {/* Type Selector */}
                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Type</label>
                        <div className="flex flex-wrap gap-2">
                            {TYPES.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setType(t)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${type === t ? 'bg-vault-blue text-white' : 'bg-vault-bg text-vault-muted hover:text-vault-text'}`}
                                >
                                    {t.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Name *</label>
                        <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GitHub, Gmail, Netflix" autoFocus />
                    </div>

                    {/* Favorite */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} className="w-4 h-4 rounded accent-vault-amber" />
                        <span className="text-sm">⭐ Mark as favorite</span>
                    </label>

                    {/* Type-specific fields */}
                    {type === 'LOGIN' && (
                        <>
                            <div>
                                <label className="block text-sm text-vault-muted mb-1.5">Website / Login URL</label>
                                <input className="input-field mb-3" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://github.com/login" />
                                
                                <label className="block text-sm text-vault-muted mb-1.5">Match Strategy</label>
                                <select className="input-field appearance-none bg-vault-bg" value={matchType} onChange={e => setMatchType(e.target.value)}>
                                    <option value="DOMAIN">Base Domain (e.g. any subdomains)</option>
                                    <option value="HOST">Host (e.g. exact subdomain)</option>
                                    <option value="STARTS_WITH">Starts With</option>
                                    <option value="EXACT">Exact Match</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-vault-muted mb-1.5">Username</label>
                                <input className="input-field" value={username} onChange={e => setUsername(e.target.value)} placeholder="your-username" />
                            </div>
                            <div>
                                <label className="block text-sm text-vault-muted mb-1.5">Password</label>
                                <div className="flex gap-2 mb-1.5">
                                    <div className="relative flex-1">
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            className="input-field pr-10 font-mono"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted hover:text-vault-text">
                                            {showPass ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    <button onClick={generatePassword} className="px-3 py-2 bg-vault-bg border border-vault-border rounded-xl text-sm hover:bg-white/5 transition whitespace-nowrap" title="Generate">
                                        🔐
                                    </button>
                                </div>
                                {password && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 flex gap-1 h-1.5">
                                            {[...Array(4)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-full transition-colors ${zxcvbn(password).score > i
                                                        ? (zxcvbn(password).score < 2 ? 'bg-vault-red' : zxcvbn(password).score < 3 ? 'bg-vault-amber' : 'bg-vault-green')
                                                        : 'bg-vault-border'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-vault-muted w-12 text-right">
                                            {['Weak', 'Fair', 'Good', 'Strong', 'Epic'][zxcvbn(password).score]}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {type === 'CARD' && (
                        <>
                            <div>
                                <label className="block text-sm text-vault-muted mb-1.5">Card Number</label>
                                <input className="input-field font-mono" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" />
                            </div>
                            <div>
                                <label className="block text-sm text-vault-muted mb-1.5">Cardholder Name</label>
                                <input className="input-field" value={cardHolder} onChange={e => setCardHolder(e.target.value)} placeholder="John Doe" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-vault-muted mb-1.5">Expiry</label>
                                    <input className="input-field" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} placeholder="MM/YY" />
                                </div>
                                <div>
                                    <label className="block text-sm text-vault-muted mb-1.5">CVV</label>
                                    <input type="password" className="input-field font-mono" value={cardCvv} onChange={e => setCardCvv(e.target.value)} placeholder="•••" />
                                </div>
                            </div>
                        </>
                    )}

                    {type === 'OTP' && (
                        <div>
                            <label className="block text-sm text-vault-muted mb-1.5">OTP Secret Key</label>
                            <input className="input-field font-mono" value={otpSecret} onChange={e => setOtpSecret(e.target.value)} placeholder="JBSWY3DPEHPK3PXP" />
                        </div>
                    )}

                    {/* Notes — all types */}
                    <div>
                        <label className="block text-sm text-vault-muted mb-1.5">Notes</label>
                        <textarea className="input-field min-h-[80px] resize-y" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-vault-border">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-vault-muted hover:text-vault-text hover:bg-white/5 transition">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="btn-primary text-sm !py-2.5 flex items-center gap-2">
                        {saving ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> : null}
                        {isEdit ? 'Save Changes' : 'Create Item'}
                    </button>
                </div>
            </div>
        </div>
    )
}
