/**
 * SecureVault Browser Extension — Popup Script
 *
 * Handles: login, vault retrieval, search, autofill trigger, logout.
 * Communicates with backend API via fetch().
 */

console.log("SecureVault popup loaded");

const API_BASE = 'http://localhost:8080/api';

// ── DOM Elements ──────────────────────────────────────────
const loginView = document.getElementById('login-view');
const vaultView = document.getElementById('vault-view');
const loadingEl = document.getElementById('loading');
const loginError = document.getElementById('login-error');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('master-password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const syncBtn = document.getElementById('sync-btn');
const searchInput = document.getElementById('search-input');
const vaultList = document.getElementById('vault-list');
const itemCount = document.getElementById('item-count');

let allItems = [];

// ── Initialization ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const { sv_token } = await chrome.storage.local.get('sv_token');
    if (sv_token) {
        showVault();
        await fetchVault(sv_token);
    } else {
        showLogin();
    }
});

// ── Event Listeners ───────────────────────────────────────
loginBtn.addEventListener('click', handleLogin);
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});
logoutBtn.addEventListener('click', handleLogout);
syncBtn.addEventListener('click', handleSync);
searchInput.addEventListener('input', handleSearch);

// ── Login ─────────────────────────────────────────────────
async function handleLogin() {
    const email = emailInput.value.trim();
    const pass = passwordInput.value;

    if (!email || !pass) {
        showError('Please enter email and password');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    hideError();

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, masterPassword: pass }),
        });

        if (res.ok) {
            const data = await res.json();
            await chrome.storage.local.set({
                sv_token: data.token,
                sv_email: data.email,
                sv_userId: data.userId,
            });
            showVault();
            await fetchVault(data.token);
        } else {
            const errData = await res.json().catch(() => ({}));
            showError(errData.error || 'Invalid email or password');
        }
    } catch (err) {
        showError('Cannot connect to server. Is the backend running?');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
    }
}

// ── Fetch Vault ───────────────────────────────────────────
async function fetchVault(token) {
    showLoading(true);
    try {
        // Get current tab domain for prioritized matching
        let currentDomain = null;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                currentDomain = new URL(tab.url).hostname;
            }
        } catch (e) { }

        const res = await fetch(`${API_BASE}/vault`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
            const rawItems = await res.json();
            allItems = rawItems.map(item => {
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

            // Sort: domain-matched items first
            if (currentDomain) {
                allItems.sort((a, b) => {
                    const aMatch = matchesDomain(a, currentDomain);
                    const bMatch = matchesDomain(b, currentDomain);
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return 0;
                });
            }

            renderItems(allItems);
        } else if (res.status === 401 || res.status === 403) {
            await handleLogout();
        }
    } catch (err) {
        vaultList.innerHTML = '<div class="empty-state"><p>Failed to load vault</p></div>';
    } finally {
        showLoading(false);
    }
}

function matchesDomain(item, domain) {
    if (!item.website) return false;
    const itemDomain = item.website.toLowerCase()
        .replace('https://', '').replace('http://', '').replace('www.', '');
    return domain.toLowerCase().includes(itemDomain) || itemDomain.includes(domain.toLowerCase());
}

// ── Render Items ──────────────────────────────────────────
function renderItems(items) {
    if (items.length === 0) {
        vaultList.innerHTML = '<div class="empty-state"><p>No items found</p></div>';
        itemCount.textContent = '0 items';
        return;
    }

    vaultList.innerHTML = items.map(item => {
        const icon = getTypeIcon(item.type);
        const name = item.name || item.type || 'Unknown';
        const sub = item.username || item.website || item.type;
        const fav = item.favorite ? '<span class="star">⭐</span>' : '';

        return `
      <div class="vault-item" data-id="${item.id}" data-username="${item.username || ''}" data-password="${item.password || ''}">
        <div class="vault-item-icon">${icon}</div>
        <div class="vault-item-info">
          <div class="vault-item-name">${escapeHtml(name)}</div>
          <div class="vault-item-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="vault-item-actions">
          ${fav}
          <button class="btn-icon copy-btn" title="Copy password">📋</button>
          <button class="btn-icon fill-btn" title="Autofill">✏️</button>
        </div>
      </div>
    `;
    }).join('');

    itemCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    // Attach event listeners
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.vault-item');
            const pw = item.dataset.password;
            if (pw) {
                navigator.clipboard.writeText(pw);
                showToast('Password copied');
            }
        });
    });

    document.querySelectorAll('.fill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.vault-item');
            triggerAutofill(item.dataset.username, item.dataset.password);
        });
    });

    document.querySelectorAll('.vault-item').forEach(el => {
        el.addEventListener('click', () => {
            triggerAutofill(el.dataset.username, el.dataset.password);
        });
    });
}

// ── Autofill ──────────────────────────────────────────────
async function triggerAutofill(username, password) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'SECUREVAULT_AUTOFILL',
                username: username || '',
                password: password || '',
            });
            showToast('Credentials filled');
            setTimeout(() => window.close(), 600);
        }
    } catch (err) {
        showToast('Cannot autofill on this page');
    }
}

// ── Search ────────────────────────────────────────────────
function handleSearch() {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
        renderItems(allItems);
        return;
    }
    const filtered = allItems.filter(item =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.username || '').toLowerCase().includes(q) ||
        (item.website || '').toLowerCase().includes(q) ||
        (item.type || '').toLowerCase().includes(q)
    );
    renderItems(filtered);
}

// ── Sync ──────────────────────────────────────────────────
async function handleSync() {
    const { sv_token } = await chrome.storage.local.get('sv_token');
    if (sv_token) {
        syncBtn.textContent = '⏳';
        await fetchVault(sv_token);
        syncBtn.textContent = '🔄';
        showToast('Vault synced');
    }
}

// ── Logout ────────────────────────────────────────────────
async function handleLogout() {
    allItems = [];
    await chrome.storage.local.remove(['sv_token', 'sv_email', 'sv_userId']);
    showLogin();
}

// ── View Helpers ──────────────────────────────────────────
function showLogin() {
    loginView.style.display = 'block';
    vaultView.style.display = 'none';
    emailInput.value = '';
    passwordInput.value = '';
    hideError();
}

function showVault() {
    loginView.style.display = 'none';
    vaultView.style.display = 'block';
}

function showLoading(show) {
    loadingEl.style.display = show ? 'flex' : 'none';
}

function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}

function hideError() {
    loginError.style.display = 'none';
}

function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// ── Utilities ─────────────────────────────────────────────
function getTypeIcon(type) {
    switch ((type || '').toUpperCase()) {
        case 'LOGIN': return '🌐';
        case 'CARD': return '💳';
        case 'SECURE_NOTE': return '📝';
        case 'IDENTITY': return '👤';
        case 'OTP': return '🔑';
        default: return '🔒';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ── Generator ─────────────────────────────────────────────
const generatorView = document.getElementById('generator-view');
const showGenBtn = document.getElementById('show-gen-btn');
const hideGenBtn = document.getElementById('hide-gen-btn');
const genPasswordInput = document.getElementById('gen-password-input');
const genLength = document.getElementById('gen-length');
const genLengthVal = document.getElementById('gen-length-val');
const genUpper = document.getElementById('gen-upper');
const genLower = document.getElementById('gen-lower');
const genNum = document.getElementById('gen-num');
const genSym = document.getElementById('gen-sym');
const genRegenBtn = document.getElementById('gen-regen-btn');
const genCopyBtn = document.getElementById('gen-copy-btn');
const strText = document.getElementById('gen-strength-text');

showGenBtn.addEventListener('click', () => {
    vaultView.style.display = 'none';
    generatorView.style.display = 'block';
    regeneratePassword();
});

hideGenBtn.addEventListener('click', () => {
    generatorView.style.display = 'none';
    vaultView.style.display = 'block';
});

[genLength, genUpper, genLower, genNum, genSym].forEach(el => {
    el.addEventListener('input', () => {
        if (el === genLength) genLengthVal.textContent = el.value;
        regeneratePassword();
    });
});

genRegenBtn.addEventListener('click', regeneratePassword);
genCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(genPasswordInput.value);
    showToast('Password copied');
    hideGenBtn.click();
});

function regeneratePassword() {
    const len = parseInt(genLength.value, 10);
    const up = genUpper.checked;
    const low = genLower.checked;
    const num = genNum.checked;
    const sym = genSym.checked;

    let chars = '';
    if (up) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (low) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (num) chars += '0123456789';
    if (sym) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    const pw = Array.from(arr, v => chars[v % chars.length]).join('');

    genPasswordInput.value = pw;

    // Calc strength via zxcvbn
    let score = 0;
    if (typeof zxcvbn !== 'undefined') {
        const result = zxcvbn(pw);
        score = result.score; // 0 to 4
    }

    const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Epic'];
    strText.textContent = labels[score];
    const color = score < 2 ? '#FF1744' : score < 3 ? '#FFB300' : '#00C853';
    strText.style.color = color;

    for (let i = 0; i < 4; i++) {
        const bar = document.getElementById(`str-${i}`);
        if (score > i) {
            bar.style.background = color;
        } else {
            bar.style.background = 'var(--border)';
        }
    }
}
