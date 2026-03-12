import { useState, useCallback } from 'react'

export default function PasswordGenerator({ onCopy }) {
    const [length, setLength] = useState(20)
    const [upper, setUpper] = useState(true)
    const [lower, setLower] = useState(true)
    const [numbers, setNumbers] = useState(true)
    const [symbols, setSymbols] = useState(true)
    const [password, setPassword] = useState(() => generate(20, true, true, true, true))

    function generate(len, up, low, num, sym) {
        let chars = ''
        if (up) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        if (low) chars += 'abcdefghijklmnopqrstuvwxyz'
        if (num) chars += '0123456789'
        if (sym) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
        if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

        const arr = new Uint32Array(len)
        crypto.getRandomValues(arr)
        return Array.from(arr, v => chars[v % chars.length]).join('')
    }

    const regen = useCallback(() => {
        const pw = generate(length, upper, lower, numbers, symbols)
        setPassword(pw)
    }, [length, upper, lower, numbers, symbols])

    const handleCopy = () => {
        navigator.clipboard.writeText(password)
        onCopy?.(password)
    }

    const strength = length < 10 ? 'Weak' : length < 16 ? 'Fair' : length < 24 ? 'Strong' : 'Very Strong'
    const strengthColor = length < 10 ? 'bg-vault-red' : length < 16 ? 'bg-vault-amber' : 'bg-vault-green'
    const strengthPct = Math.min(100, (length / 40) * 100)

    return (
        <div className="p-5">
            <h3 className="text-sm font-semibold text-vault-muted uppercase tracking-wider mb-3">Password Generator</h3>

            {/* Generated password */}
            <div className="flex items-center gap-2 bg-vault-bg border border-vault-border rounded-xl p-3 mb-3">
                <code className="flex-1 text-sm font-mono break-all text-vault-text select-all">{password}</code>
                <button onClick={handleCopy} className="p-2 hover:bg-white/10 rounded-lg transition text-sm flex-shrink-0" title="Copy">📋</button>
                <button onClick={regen} className="p-2 hover:bg-white/10 rounded-lg transition text-sm flex-shrink-0" title="Regenerate">🔄</button>
            </div>

            {/* Strength bar */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-1.5 bg-vault-border rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} rounded-full transition-all`} style={{ width: `${strengthPct}%` }}></div>
                </div>
                <span className={`text-xs font-semibold ${strengthColor.replace('bg-', 'text-')}`}>{strength}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <label className="text-sm text-vault-muted whitespace-nowrap">Length:</label>
                    <input
                        type="range" min="4" max="40" value={length}
                        onChange={e => { setLength(+e.target.value); setTimeout(regen, 0) }}
                        className="flex-1 accent-vault-blue"
                    />
                    <span className="text-sm font-semibold w-6 text-center">{length}</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {[
                        ['A-Z', upper, () => { setUpper(!upper); setTimeout(regen, 0) }],
                        ['a-z', lower, () => { setLower(!lower); setTimeout(regen, 0) }],
                        ['0-9', numbers, () => { setNumbers(!numbers); setTimeout(regen, 0) }],
                        ['!@#', symbols, () => { setSymbols(!symbols); setTimeout(regen, 0) }],
                    ].map(([label, active, toggle]) => (
                        <button
                            key={label}
                            onClick={toggle}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${active ? 'bg-vault-blue/20 text-vault-blue' : 'bg-vault-bg text-vault-muted'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
