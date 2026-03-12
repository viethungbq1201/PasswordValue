import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import { vaultApi, folderApi } from '../services/api'
import VaultItemModal from '../components/VaultItemModal'
import PasswordGenerator from '../components/PasswordGenerator'

const TYPE_ICONS = {
    LOGIN: '🌐', CARD: '💳', SECURE_NOTE: '📝', IDENTITY: '👤', OTP: '🔑',
}
const NAV_ITEMS = [
    { key: 'all', label: 'All Items', icon: '📦' },
    { key: 'favorites', label: 'Favorites', icon: '⭐' },
    { key: 'LOGIN', label: 'Logins', icon: '🌐' },
    { key: 'CARD', label: 'Cards', icon: '💳' },
    { key: 'SECURE_NOTE', label: 'Secure Notes', icon: '📝' },
    { key: 'IDENTITY', label: 'Identities', icon: '👤' },
    { key: 'trash', label: 'Trash', icon: '🗑️' },
]

export default function DashboardPage() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [items, setItems] = useState([])
    const [folders, setFolders] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedItem, setSelectedItem] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [showGenerator, setShowGenerator] = useState(false)
    const [toast, setToast] = useState('')
    const [sidebarOpen, setSidebarOpen] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            let res
            switch (filter) {
                case 'favorites': res = await vaultApi.getFavorites(); break
                case 'trash': res = await vaultApi.getTrash(); break
                case 'all': res = await vaultApi.getAll(); break
                default: res = await vaultApi.getByType(filter); break
            }
            const parsedItems = res.data.map(item => {
                try {
                    if (item.encryptedData) {
                        const decodedStr = atob(item.encryptedData);
                        const decodedData = JSON.parse(decodeURIComponent(escape(decodedStr)));
                        return { ...item, ...decodedData };
                    }
                } catch (e) {
                    console.error('Failed to parse item data', e);
                }
                return item;
            });
            setItems(parsedItems);
            const folderRes = await folderApi.getAll();
            setFolders(folderRes.data)
        } catch (err) {
            console.error('Failed to fetch vault:', err)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => { fetchData() }, [fetchData])

    const showToast = (msg) => {
        setToast(msg)
        setTimeout(() => setToast(''), 2500)
    }

    const handleDelete = async (id) => {
        if (!confirm('Move this item to trash?')) return
        try {
            await vaultApi.delete(id)
            setItems(prev => prev.filter(i => i.id !== id))
            showToast('Moved to trash')
        } catch { showToast('Failed to delete') }
    }

    const handleRestore = async (id) => {
        try {
            await vaultApi.restore(id)
            setItems(prev => prev.filter(i => i.id !== id))
            showToast('Item restored')
        } catch { showToast('Failed to restore') }
    }

    const handleCopy = (text, label) => {
        navigator.clipboard.writeText(text)
        showToast(`${label} copied`)
    }

    const openEdit = (item) => {
        setSelectedItem(item)
        setShowModal(true)
    }

    const openAdd = () => {
        setSelectedItem(null)
        setShowModal(true)
    }

    const handleSaved = () => {
        setShowModal(false)
        fetchData()
        showToast(selectedItem ? 'Item updated' : 'Item created')
    }

    const filteredItems = items.filter(i => {
        if (!search) return true
        const q = search.toLowerCase()
        return (i.name || '').toLowerCase().includes(q) ||
            (i.username || '').toLowerCase().includes(q) ||
            (i.website || '').toLowerCase().includes(q)
    })

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-vault-surface border-r border-vault-border flex-shrink-0 transition-all duration-200 overflow-hidden`}>
                <div className="p-4 h-full flex flex-col">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 bg-vault-blue rounded-lg flex items-center justify-center text-white font-bold text-sm">SV</div>
                        <span className="font-bold text-lg">SecureVault</span>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 space-y-1">
                        {NAV_ITEMS.map(n => (
                            <button
                                key={n.key}
                                onClick={() => setFilter(n.key)}
                                className={`sidebar-link w-full text-left ${filter === n.key ? 'active' : ''}`}
                            >
                                <span>{n.icon}</span>
                                <span>{n.label}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Folders */}
                    {folders.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-vault-border">
                            <p className="text-xs text-vault-muted font-semibold uppercase tracking-wider mb-2 px-2">Folders</p>
                            {folders.map(f => (
                                <button key={f.id} className="sidebar-link w-full text-left text-sm" onClick={() => { }}>
                                    <span>📁</span>
                                    <span>{f.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* User */}
                    <div className="mt-auto pt-4 border-t border-vault-border">
                        <p className="text-xs text-vault-muted truncate px-2 mb-2">{user?.email}</p>
                        <div className="flex gap-2">
                            <button onClick={() => navigate('/settings')} className="sidebar-link flex-1 text-sm justify-center" title="Settings">⚙️</button>
                            <button onClick={logout} className="sidebar-link flex-1 text-sm justify-center text-vault-red" title="Logout">↗️</button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <header className="flex items-center gap-3 px-6 py-4 border-b border-vault-border bg-vault-bg/80 backdrop-blur-sm">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-vault-muted hover:text-vault-text p-1">
                        ☰
                    </button>
                    <div className="relative flex-1 max-w-lg">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-muted">🔍</span>
                        <input
                            type="text"
                            className="input-field pl-10"
                            placeholder="Search vault..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={() => setShowGenerator(!showGenerator)} className="px-3 py-2 rounded-lg bg-vault-card border border-vault-border text-sm hover:bg-white/5 transition" title="Password Generator">
                        🔐 Generator
                    </button>
                    <button onClick={openAdd} className="btn-primary text-sm !py-2.5">
                        + Add Item
                    </button>
                </header>

                {/* Generator Panel */}
                {showGenerator && (
                    <div className="border-b border-vault-border bg-vault-surface/50">
                        <PasswordGenerator onCopy={(pw) => handleCopy(pw, 'Password')} />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin w-8 h-8 border-2 border-vault-blue border-t-transparent rounded-full"></div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-vault-muted">
                            <span className="text-5xl mb-4">🛡️</span>
                            <p className="text-lg font-medium">No items found</p>
                            <p className="text-sm mt-1">Click "+ Add Item" to create your first vault entry</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    className="card flex items-center gap-4 p-4 hover:bg-white/[0.02] transition cursor-pointer group"
                                    onClick={() => openEdit(item)}
                                >
                                    <div className="w-10 h-10 bg-vault-blue/15 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                                        {TYPE_ICONS[item.type] || '🔒'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium truncate">{item.name || 'Unnamed'}</p>
                                            {item.favorite && <span className="text-vault-amber text-xs">⭐</span>}
                                        </div>
                                        <p className="text-sm text-vault-muted truncate">{item.username || item.website || item.type}</p>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {item.username && (
                                            <button onClick={(e) => { e.stopPropagation(); handleCopy(item.username, 'Username') }} className="p-2 rounded-lg hover:bg-white/10 text-sm" title="Copy username">👤</button>
                                        )}
                                        {item.password && (
                                            <button onClick={(e) => { e.stopPropagation(); handleCopy(item.password, 'Password') }} className="p-2 rounded-lg hover:bg-white/10 text-sm" title="Copy password">🔑</button>
                                        )}
                                        {filter === 'trash' ? (
                                            <button onClick={(e) => { e.stopPropagation(); handleRestore(item.id) }} className="p-2 rounded-lg hover:bg-vault-green/20 text-sm" title="Restore">♻️</button>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }} className="p-2 rounded-lg hover:bg-vault-red/20 text-sm" title="Delete">🗑️</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Item count footer */}
                <footer className="px-6 py-2 border-t border-vault-border text-xs text-vault-muted text-center">
                    {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                </footer>
            </main>

            {/* Modal */}
            {showModal && (
                <VaultItemModal
                    item={selectedItem}
                    onClose={() => setShowModal(false)}
                    onSaved={handleSaved}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-vault-green text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg animate-bounce z-50">
                    {toast}
                </div>
            )}
        </div>
    )
}
