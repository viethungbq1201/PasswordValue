/**
 * SecureVault Browser Extension — Background Service Worker
 *
 * Tracks login form detections and manages badge state.
 */

// Track pages with login forms
const loginPages = new Map();
const API_BASE = 'http://localhost:8080/api';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOGIN_FORM_DETECTED' && sender.tab?.id) {
        loginPages.set(sender.tab.id, {
            domain: message.domain,
            url: message.url,
        });

        chrome.action.setBadgeText({ text: '●', tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#175DDC', tabId: sender.tab.id });
    }

    if (message.type === 'GET_MATCHING_CREDENTIALS') {
        handleGetCredentials(message.domain).then(sendResponse);
        return true;
    }

    if (message.type === 'SAVE_CREDENTIAL') {
        handleSaveCredential(message.payload).then(sendResponse);
        return true;
    }
});

async function handleGetCredentials(domain) {
    try {
        const { sv_token } = await chrome.storage.local.get('sv_token');
        if (!sv_token) return { error: 'Not logged in' };

        const res = await fetch(`${API_BASE}/vault`, {
            headers: { 'Authorization': `Bearer ${sv_token}` }
        });

        if (!res.ok) return { error: 'Failed to fetch' };

        const rawItems = await res.json();
        const items = rawItems.map(item => {
            try {
                if (item.encryptedData) {
                    const decodedStr = atob(item.encryptedData);
                    const decodedData = JSON.parse(decodeURIComponent(escape(decodedStr)));
                    return { ...item, ...decodedData };
                }
            } catch (e) { }
            return item;
        });

        const matches = items.filter(item =>
            item.type === 'LOGIN' &&
            item.website &&
            item.website.toLowerCase().includes(domain.toLowerCase())
        );

        return { matches };
    } catch (err) {
        return { error: err.message };
    }
}

async function handleSaveCredential(payload) {
    try {
        const { sv_token } = await chrome.storage.local.get('sv_token');
        if (!sv_token) return { error: 'Not logged in' };

        const rawJson = JSON.stringify({
            name: payload.website,
            website: payload.website,
            username: payload.username,
            password: payload.password
        });

        const apiPayload = {
            type: 'LOGIN',
            favorite: false,
            encryptedData: btoa(unescape(encodeURIComponent(rawJson))),
        };

        if (payload.id) {
            // Update
            await fetch(`${API_BASE}/vault/${payload.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${sv_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            });
        } else {
            // Create
            await fetch(`${API_BASE}/vault`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sv_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            });
        }
        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
}

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    loginPages.delete(tabId);
});

// Clean up on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        loginPages.delete(tabId);
        chrome.action.setBadgeText({ text: '', tabId });
    }
});
