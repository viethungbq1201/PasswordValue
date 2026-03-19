import { decrypt, encrypt, importMasterKey } from './crypto.js';

const loginPages = new Map();
const API_BASE = 'https://passwordvalue-production.up.railway.app/api';

// ── Credential Cache (60-second TTL) ──────────────────────
const credentialCache = new Map();
const CACHE_TTL_MS = 60000;

console.log("[SecureVault] Background service worker started.");

let syncSocket = null;

async function getMasterKey() {
    const { sv_master_key_hex } = await chrome.storage.local.get('sv_master_key_hex');
    if (!sv_master_key_hex) return null;
    return importMasterKey(sv_master_key_hex);
}

function connectSyncSocket() {
    chrome.storage.local.get(['sv_token', 'sv_userId']).then(({ sv_token, sv_userId }) => {
        if (!sv_token) {
            console.log("[SecureVault] No token found, skipping sync connection.");
            return;
        }
        
        if (!sv_userId) {
            console.warn("[SecureVault] No sv_userId found, cannot sync yet.");
            return;
        }

        if (syncSocket && syncSocket.readyState <= 1) return; // Already connecting or connected

        const wsUrl = API_BASE.replace('https', 'wss').replace('http', 'ws').replace('/api', '') + '/ws-sync-notification';
        console.log(`[SecureVault] Connecting to sync WebSocket: ${wsUrl}`);
        
        syncSocket = new WebSocket(wsUrl);

        syncSocket.onopen = () => {
            console.log("[SecureVault] Sync WebSocket connected. Authenticating...");
            syncSocket.send("AUTH:" + sv_userId);
        };

        syncSocket.onmessage = (event) => {
            if (event.data === 'SYNC_REQUIRED') {
                console.log("[SecureVault] Real-time sync notification received. Clearing cache.");
                credentialCache.clear();
            } else if (event.data === 'AUTH_OK') {
                console.log("[SecureVault] Sync WebSocket authenticated successfully.");
            }
        };

        syncSocket.onclose = () => {
            console.log("[SecureVault] Sync WebSocket closed. Reconnecting in 10s...");
            setTimeout(connectSyncSocket, 10000);
        };

        syncSocket.onerror = (err) => {
            console.error("[SecureVault] Sync WebSocket error:", err);
        };
    });
}

// Start connection attempt
connectSyncSocket();

// ── Auto-lock Monitoring ──────────────────────────────────
async function initAutoLock() {
    const { sv_auto_lock_timer } = await chrome.storage.local.get('sv_auto_lock_timer');
    updateIdleDetection(sv_auto_lock_timer);
}

function updateIdleDetection(timerMinutes) {
    const minutes = parseInt(timerMinutes) || 0;
    if (minutes > 0) {
        chrome.idle.setDetectionInterval(minutes * 60);
        console.log(`[SecureVault] Idle detection interval set to ${minutes} minutes.`);
    } else {
        console.log("[SecureVault] Auto-lock disabled (timer is 0 or 'Never').");
    }
}

// Listen for system idle state changes
chrome.idle.onStateChanged.addListener(async (state) => {
    const { sv_token, sv_auto_lock_timer } = await chrome.storage.local.get(['sv_token', 'sv_auto_lock_timer']);
    if (!sv_token) return;

    if (state === 'locked') {
        console.log("[SecureVault] System locked. Auto-locking vault.");
        await lockVault();
    } else if (state === 'idle') {
        const minutes = parseInt(sv_auto_lock_timer) || 0;
        if (minutes > 0) {
            console.log(`[SecureVault] Idle detected for ${minutes}m. Auto-locking vault.`);
            await lockVault();
        }
    }
});

// Periodic fallback check (optional)
chrome.alarms.create('lockCheck', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'lockCheck') {
        const { sv_token, sv_last_active, sv_auto_lock_timer } = await chrome.storage.local.get([
            'sv_token', 'sv_last_active', 'sv_auto_lock_timer'
        ]);

        if (!sv_token || !sv_auto_lock_timer || sv_auto_lock_timer === '0') return;

        const timerMs = parseInt(sv_auto_lock_timer) * 60000;
        const now = Date.now();

        if (now - sv_last_active > timerMs) {
            console.log("[SecureVault] Inactivity fallback triggered auto-lock.");
            await lockVault();
        }
    }
});

// Watch for setting changes to update detector immediately
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sv_auto_lock_timer) {
        updateIdleDetection(changes.sv_auto_lock_timer.newValue);
    }
});

async function lockVault() {
    console.log("[SecureVault] Internal lock triggered. Clearing session storage.");
    await chrome.storage.local.remove([
        'sv_token', 
        'sv_master_key_hex', 
        'sv_last_active',
        'sv_email',
        'sv_userId'
    ]);
    credentialCache.clear();
    // Reset badge
    chrome.action.setBadgeText({ text: '' });
}

// Initialize on startup
initAutoLock();

function getCachedCredentials(domain) {
    const entry = credentialCache.get(domain);
    if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
        console.log(`[SecureVault] Cache hit for domain: ${domain}`);
        return entry.data;
    }
    credentialCache.delete(domain);
    return null;
}

function setCachedCredentials(domain, data) {
    console.log(`[SecureVault] Caching ${data.length} credentials for domain: ${domain}`);
    credentialCache.set(domain, { data, timestamp: Date.now() });
}

// ── Message Handler ───────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Update last active on any meaningful message
    if (['LOGIN_FORM_DETECTED', 'GET_MATCHING_CREDENTIALS', 'SAVE_CREDENTIAL', 'VAULT_FETCHED', 'ACTIVITY_DETECTED'].includes(message.type)) {
        chrome.storage.local.set({ sv_last_active: Date.now() });
    }

    if (message.type === 'LOGIN_FORM_DETECTED' && sender.tab?.id) {
        console.log(`[SecureVault] Login form detected on ${message.domain} (count: ${message.formCount})`);
        loginPages.set(sender.tab.id, {
            domain: message.domain,
            url: message.url,
        });

        chrome.action.setBadgeText({ text: '●', tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#175DDC', tabId: sender.tab.id });
    }

    if (message.type === 'GET_MATCHING_CREDENTIALS') {
        handleGetCredentials(message.domain, message.fullUrl).then(sendResponse);
        return true; // Keep message channel open for async response
    }

    if (message.type === 'SAVE_CREDENTIAL') {
        handleSaveCredential(message.payload).then(sendResponse);
        return true;
    }

    if (message.type === 'GET_MASTER_KEY_HEX') {
        chrome.storage.local.get('sv_master_key_hex').then(sendResponse).catch(err => {
            console.error(`[SecureVault] Error accessing storage for master key:`, err);
            sendResponse({ error: err.message });
        });
        return true;
    }

    if (message.type === 'INVALIDATE_CACHE') {
        console.log(`[SecureVault] Invalidating cache for domain: ${message.domain}`);
        credentialCache.delete(message.domain);
        sendResponse({ success: true });
        return true;
    }
});

// ── Fetch Credentials via /api/vault/match ────────────────
async function handleGetCredentials(domain, fullUrl) {
    try {
        console.log(`[SecureVault] Fetching credentials for domain: ${domain} (url: ${fullUrl})`);
        const { sv_token } = await chrome.storage.local.get('sv_token');
        if (!sv_token) {
            console.warn(`[SecureVault] Not logged in (missing token). Cannot fetch matches.`);
            return { error: 'Not logged in' };
        }

        const masterKey = await getMasterKey();
        if (!masterKey) {
            console.error("[SecureVault] Vault locked. Master key missing from storage.");
            return { error: 'Vault locked' };
        }

        // Check cache first
        const cached = getCachedCredentials(domain);
        if (cached) return { matches: cached };

        let url = `${API_BASE}/autofill?domain=${encodeURIComponent(domain)}`;
        if (fullUrl) {
            url += `&fullUrl=${encodeURIComponent(fullUrl)}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${sv_token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                console.warn(`[SecureVault] Unauthorized to fetch credentials (maybe token expired)`);
                return { error: 'Unauthorized' };
            }
            console.error(`[SecureVault] API returned error: ${res.status} ${res.statusText}`);
            return { error: `Failed to fetch: ${res.status}` };
        }

        const items = await res.json();
        
        // Decrypt matches
        const decryptedMatches = await Promise.all(items.map(async (item) => {
            if (!item.encryptedData) return item;
            try {
                // Try AES-GCM
                const decryptedData = await decrypt(item.encryptedData, masterKey);
                return { ...item, ...decryptedData };
            } catch (e) {
                // Legacy Base64 fallback
                try {
                    const decodedStr = atob(item.encryptedData);
                    const decodedData = JSON.parse(decodeURIComponent(escape(decodedStr)));
                    return { ...item, ...decodedData, _isLegacy: true };
                } catch (err) {
                    console.error("[SecureVault] Failed to decrypt matching item", item.id, e);
                    return { ...item, name: 'Decryption Error' };
                }
            }
        }));

        // Cache the decrypted response
        setCachedCredentials(domain, decryptedMatches);

        console.log(`[SecureVault] Found ${decryptedMatches.length} matching credentials from API.`);
        return { matches: decryptedMatches };
    } catch (err) {
        console.error(`[SecureVault] Network/Fetch error:`, err);
        return { error: err.message };
    }
}

// ── Save / Update Credential ──────────────────────────────
async function handleSaveCredential(payload) {
    try {
        console.log(`[SecureVault] Handling save credential prompt for ${payload.username}`);
        const { sv_token } = await chrome.storage.local.get('sv_token');
        if (!sv_token) return { error: 'Not logged in' };

        const masterKey = await getMasterKey();
        if (!masterKey) {
            return { error: 'Vault locked' };
        }

        const rawData = {
            name: payload.name || payload.website,
            website: payload.website,
            username: payload.username,
            password: payload.password
        };

        const encryptedData = await encrypt(rawData, masterKey);

        const apiPayload = {
            type: 'LOGIN',
            favorite: false,
            encryptedData: encryptedData,
            website: payload.website,
        };

        if (payload.id) {
            console.log(`[SecureVault] Updating existing item ${payload.id}`);
            apiPayload.id = payload.id;
        } else {
            console.log(`[SecureVault] Creating new vault item`);
        }

        const method = payload.id ? 'PUT' : 'POST';
        const endpoint = payload.id ? `${API_BASE}/vault/${payload.id}` : `${API_BASE}/vault`;

        const res = await fetch(endpoint, {
            method: method,
            headers: {
                'Authorization': `Bearer ${sv_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(apiPayload)
        });

        if (!res.ok) {
            console.error(`[SecureVault] Save failed: ${res.status}`);
            return { error: 'Failed to save' };
        }

        console.log(`[SecureVault] Credential saved successfully. Tracking cache invalidation.`);
        // Invalidate cache for this domain so new fetch gets updated data
        credentialCache.delete(payload.website);

        return { success: true };
    } catch (err) {
        console.error(`[SecureVault] Save exception:`, err);
        return { error: err.message };
    }
}
