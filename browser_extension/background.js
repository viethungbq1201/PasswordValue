/**
 * SecureVault Browser Extension — Background Service Worker
 *
 * Tracks login form detections and manages badge state.
 */

// Track pages with login forms
const loginPages = new Map();

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'LOGIN_FORM_DETECTED' && sender.tab?.id) {
        loginPages.set(sender.tab.id, {
            domain: message.domain,
            url: message.url,
        });

        // Show blue dot badge when login form detected
        chrome.action.setBadgeText({ text: '●', tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#175DDC', tabId: sender.tab.id });
    }
});

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
