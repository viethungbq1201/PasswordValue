/**
 * SecureVault Browser Extension — Content Script
 *
 * Injected into all pages. Detects login forms and handles autofill messages.
 */

// ── Listen for autofill messages from popup ──────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SECUREVAULT_AUTOFILL') {
        const success = fillCredentials(message.username, message.password);
        sendResponse({ success });
    }
    return true;
});

// ── Detect login forms on the page ───────────────────────
function detectLoginForms() {
    const forms = [];
    document.querySelectorAll('form').forEach(form => {
        if (form.querySelector('input[type="password"]')) {
            forms.push(form);
        }
    });
    return forms;
}

// ── Find username / email input ──────────────────────────
function findUsernameField() {
    const selectors = [
        'input[autocomplete="username"]',
        'input[autocomplete="email"]',
        'input[name="username"]',
        'input[name="email"]',
        'input[name="user"]',
        'input[name="login"]',
        'input[name="identifier"]',
        'input[id="username"]',
        'input[id="email"]',
        'input[id="login"]',
        'input[type="email"]',
        'input[type="text"]',
    ];

    for (const sel of selectors) {
        const field = document.querySelector(sel);
        if (field && isVisible(field)) return field;
    }
    return null;
}

// ── Find password input ──────────────────────────────────
function findPasswordField() {
    const field = document.querySelector('input[type="password"]');
    return field && isVisible(field) ? field : null;
}

// ── Check element visibility ─────────────────────────────
function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        el.offsetWidth > 0 &&
        el.offsetHeight > 0;
}

// ── Fill credentials into form fields ────────────────────
function fillCredentials(username, password) {
    const userField = findUsernameField();
    const passField = findPasswordField();
    let filled = false;

    if (userField && username) {
        setFieldValue(userField, username);
        filled = true;
    }

    if (passField && password) {
        setFieldValue(passField, password);
        filled = true;
    }

    return filled;
}

// ── Set value with framework compatibility ───────────────
function setFieldValue(input, value) {
    // Use native setter to work with React / Vue / Angular
    const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
        nativeSetter.call(input, value);
    } else {
        input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

// ── Notify background about detected login forms ─────────
function notifyBackground() {
    const forms = detectLoginForms();
    if (forms.length > 0) {
        chrome.runtime.sendMessage({
            type: 'LOGIN_FORM_DETECTED',
            url: window.location.href,
            domain: window.location.hostname,
            formCount: forms.length,
        }).catch(() => { }); // Ignore if background not ready
    }
}

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyBackground);
} else {
    notifyBackground();
}

// Observe DOM for dynamically added forms (SPAs)
const observer = new MutationObserver(() => notifyBackground());
observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
});
