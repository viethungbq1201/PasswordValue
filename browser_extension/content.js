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

// ── Display Autofill Dropdown ────────────────────────────
let activeDropdown = null;

function showAutofillDropdown(inputElement, matches) {
    if (activeDropdown) activeDropdown.remove();
    if (!matches || matches.length === 0) return;

    activeDropdown = document.createElement('div');
    activeDropdown.className = 'securevault-dropdown';
    activeDropdown.style.cssText = `
        position: absolute;
        z-index: 2147483647;
        background: #1E2A47;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        width: 250px;
        max-height: 200px;
        overflow-y: auto;
        font-family: -apple-system, sans-serif;
        color: #E8EAED;
    `;

    const rect = inputElement.getBoundingClientRect();
    activeDropdown.style.top = `${window.scrollY + rect.bottom + 4}px`;
    activeDropdown.style.left = `${window.scrollX + rect.left}px`;

    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-size: 11px; font-weight: bold; color: #9AA0A6; border-bottom: 1px solid rgba(255,255,255,0.05); text-transform: uppercase;';
    header.textContent = 'SecureVault';
    activeDropdown.appendChild(header);

    matches.forEach(cred => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: background 0.15s;';
        item.onmouseover = () => item.style.background = '#243154';
        item.onmouseout = () => item.style.background = 'transparent';

        const username = document.createElement('div');
        username.style.cssText = 'font-size: 13px; font-weight: 500;';
        username.textContent = cred.username || 'No username';

        const passInfo = document.createElement('div');
        passInfo.style.cssText = 'font-size: 11px; color: #9AA0A6;';
        passInfo.textContent = '••••••••';

        item.appendChild(username);
        item.appendChild(passInfo);

        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            fillCredentials(cred.username, cred.password);
            activeDropdown.remove();
            activeDropdown = null;
        });

        activeDropdown.appendChild(item);
    });

    document.body.appendChild(activeDropdown);

    const closeDropdown = (e) => {
        if (activeDropdown && e.target !== inputElement && !activeDropdown.contains(e.target)) {
            activeDropdown.remove();
            activeDropdown = null;
            document.removeEventListener('mousedown', closeDropdown);
        }
    };
    document.addEventListener('mousedown', closeDropdown);
}

// ── Notify background and prepare autofill ───────────────
let cachedMatches = null;

function setupAutofillTriggers() {
    const userField = findUsernameField();
    const passField = findPasswordField();

    const attachTrigger = (field) => {
        if (!field || field.dataset.svAttached) return;
        field.dataset.svAttached = 'true';
        field.addEventListener('focus', () => {
            if (cachedMatches) {
                showAutofillDropdown(field, cachedMatches);
            } else {
                chrome.runtime.sendMessage({ type: 'GET_MATCHING_CREDENTIALS', domain: window.location.hostname }, (res) => {
                    if (res && res.matches && res.matches.length > 0) {
                        cachedMatches = res.matches;
                        // ensure field is still focused
                        if (document.activeElement === field) {
                            showAutofillDropdown(field, cachedMatches);
                        }
                    }
                });
            }
        });
    };

    if (userField) attachTrigger(userField);
    if (passField) attachTrigger(passField);
}

function notifyBackground() {
    const forms = detectLoginForms();
    if (forms.length > 0) {
        chrome.runtime.sendMessage({
            type: 'LOGIN_FORM_DETECTED',
            url: window.location.href,
            domain: window.location.hostname,
            formCount: forms.length,
        }).catch(() => { });

        setupAutofillTriggers();
    }
}

// ── Capture form submissions for Auto-Save ────────────────
document.addEventListener('submit', (e) => {
    const passField = findPasswordField();
    if (!passField) return; // Not a login/password form

    const form = passField.closest('form');
    if (e.target !== form) return;

    const userField = findUsernameField();
    const username = userField ? userField.value : '';
    const password = passField.value;

    if (!password) return;

    // Check if we already have this credential identical
    let existing = null;
    if (cachedMatches) {
        existing = cachedMatches.find(c => c.username === username);
    }

    if (existing && existing.password === password) {
        return; // No change
    }

    // Capture and ask to save
    const isUpdate = !!existing;
    const msg = isUpdate ? 'Update password in SecureVault?' : 'Save new password to SecureVault?';

    // Injecting a simple floating confirmation dialog
    const promptDiv = document.createElement('div');
    promptDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 2147483647;
        background: #16213E; color: #E8EAED; padding: 16px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid #175DDC;
        font-family: -apple-system, sans-serif;
    `;
    promptDiv.innerHTML = `
        <div style="font-weight:bold; margin-bottom: 8px; font-size: 14px;">🛡️ SecureVault</div>
        <div style="font-size: 13px; margin-bottom: 12px;">${msg}<br/><span style="color:#9AA0A6">${username}</span></div>
        <div style="display:flex; gap: 8px; justify-content: flex-end;">
            <button id="sv-deny" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#FFF; padding:6px 12px; border-radius:4px; cursor:pointer;">Not Now</button>
            <button id="sv-allow" style="background:#175DDC; border:none; color:#FFF; padding:6px 12px; border-radius:4px; cursor:pointer;">Save</button>
        </div>
    `;

    document.body.appendChild(promptDiv);

    document.getElementById('sv-deny').onclick = (ev) => {
        ev.preventDefault();
        promptDiv.remove();
    };
    document.getElementById('sv-allow').onclick = (ev) => {
        ev.preventDefault();
        promptDiv.remove();
        chrome.runtime.sendMessage({
            type: 'SAVE_CREDENTIAL',
            payload: {
                id: existing ? existing.id : null,
                website: window.location.hostname,
                username: username,
                password: password
            }
        });
    };
});

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyBackground);
} else {
    notifyBackground();
}

// Observe DOM for dynamically added forms
const observer = new MutationObserver(() => notifyBackground());
observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
});
