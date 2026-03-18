/**
 * SecureVault Browser Extension — Background Service Worker
 *
 * Tracks login form detections, manages badge state, credential cache,
 * and communicates with the backend autofill API.
 */

const loginPages = new Map();
const API_BASE = 'https://passwordvalue-production.up.railway.app/api';

// ── Credential Cache (60-second TTL) ──────────────────────
const credentialCache = new Map();
const CACHE_TTL_MS = 60000;

console.log("[SecureVault] Background service worker started.");

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

    if (message.type === 'GET_MASTER_KEY') {
        chrome.storage.local.get('sv_master_key').then(sendResponse).catch(err => {
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

        // Cache the raw API response (encrypted data)
        setCachedCredentials(domain, items);

        console.log(`[SecureVault] Found ${items.length} matching credentials from API.`);
        return { matches: items };
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

        const rawJson = JSON.stringify({
            name: payload.name || payload.website,
            website: payload.website,
            username: payload.username,
            password: payload.password
        });

        const apiPayload = {
            type: 'LOGIN',
            favorite: false,
            encryptedData: btoa(unescape(encodeURIComponent(rawJson))),
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
