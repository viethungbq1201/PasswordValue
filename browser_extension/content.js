/**
 * SecureVault Browser Extension — Content Script
 *
 * Injected into all pages. Detects login forms, handles autofill with
 * WebCrypto AES-256-GCM decryption, login success detection for save prompts.
 */

(function () {
    console.log("[SecureVault] Content script loaded inside IIFE module.");

    let cachedDecrypted = null;
    let pendingCredentials = null;
    let lastUrl = window.location.href;
    let activeDropdownWrapper = null;

    // ── WebCrypto Decryption Utilities ────────────────────────
    async function deriveKeyFromMaster(masterKeyBase64) {
        const rawKey = Uint8Array.from(atob(masterKeyBase64), c => c.charCodeAt(0));
        return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
    }

    async function decryptVaultData(encryptedBase64, cryptoKey) {
        try {
            const raw = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
            // First 12 bytes = IV/nonce, rest = ciphertext + auth tag
            const iv = raw.slice(0, 12);
            const ciphertext = raw.slice(12);
            const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
            const text = new TextDecoder().decode(dec);
            return JSON.parse(text);
        } catch (e) {
            // Fallback: try plain base64 JSON (for legacy unencrypted data)
            try {
                const decoded = atob(encryptedBase64);
                return JSON.parse(decodeURIComponent(escape(decoded)));
            } catch (e2) {
                return null;
            }
        }
    }

    // ── Detect login forms on the page ────────────────────────
    function detectLoginForms() {
        const forms = [];
        document.querySelectorAll('form').forEach(form => {
            if (form.querySelector('input[type="password"]')) {
                forms.push(form);
            }
        });
        // Also detect standalone password fields (no form wrapper)
        if (forms.length === 0 && document.querySelector('input[type="password"]')) {
            forms.push(document.body);
        }
        return forms;
    }

    // ── Advanced Form Field Detection ─────────────────────────
    function findUsernameField() {
        // Expanded heuristics for robust username field detection
        const selectors = [
            'input[autocomplete="username"]',
            'input[autocomplete="email"]',
            'input[name="username"]',
            'input[name="email"]',
            'input[name="user"]',
            'input[name="login"]',
            'input[name="identifier"]',
            'input[name="user_login"]',
            'input[name="userid"]',
            'input[name="loginid"]',
            'input[name="account"]',
            'input[name="session[username_or_email]"]',
            'input[id="username"]',
            'input[id="email"]',
            'input[id="login"]',
            'input[id="login_field"]',
            'input[id="user"]',
            'input[id="identifierId"]', // Google
            'input[type="email"]',
        ];

        for (const sel of selectors) {
            const field = document.querySelector(sel);
            if (field && isVisible(field)) return field;
        }
        
        // Extended Check: Placeholder and aria-label
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
        for (const field of textInputs) {
            if (!isVisible(field)) continue;
            const ph = (field.placeholder || '').toLowerCase();
            const aria = (field.getAttribute('aria-label') || '').toLowerCase();
            if (ph.includes('email') || ph.includes('username') || aria.includes('email') || aria.includes('username')) {
                return field;
            }
        }

        // Fallback: first visible text input before password field
        const passField = document.querySelector('input[type="password"]');
        if (passField) {
            const allInputs = Array.from(document.querySelectorAll('input'));
            const passIdx = allInputs.indexOf(passField);
            for (let i = passIdx - 1; i >= 0; i--) {
                const inp = allInputs[i];
                if ((inp.type === 'text' || inp.type === 'email' || !inp.type) && isVisible(inp)) {
                    return inp;
                }
            }
        }

        return null;
    }

    function findPasswordField() {
        const fields = document.querySelectorAll('input[type="password"]');
        for (const f of fields) {
            if (isVisible(f)) return f;
        }
        return null;
    }

    function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            el.offsetWidth > 0 &&
            el.offsetHeight > 0;
    }

    // ── Fill credentials into form fields ─────────────────────
    function fillCredentials(username, password) {
        console.log("[SecureVault] Filling credentials into form...");
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

    function setFieldValue(input, value) {
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
        
        // React 16+ specific hack
        let tracker = input._valueTracker;
        if (tracker) {
            tracker.setValue(value);
        }
    }

    // ── Autofill Dropdown UI (Shadow DOM) ─────────────────────

    function showAutofillDropdown(inputElement, credentials) {
        if (activeDropdownWrapper) {
            activeDropdownWrapper.remove();
            activeDropdownWrapper = null;
        }
        if (!credentials || credentials.length === 0) return;
        
        console.log(`[SecureVault] Showing dropdown UI with ${credentials.length} items.`);

        // Create isolated wrapper container
        activeDropdownWrapper = document.createElement('div');
        activeDropdownWrapper.className = 'securevault-dropdown-wrapper active';
        
        const rect = inputElement.getBoundingClientRect();
        activeDropdownWrapper.style.top = `${window.scrollY + rect.bottom + 4}px`;
        activeDropdownWrapper.style.left = `${window.scrollX + rect.left}px`;
        
        // Attach Shadow DOM to prevent host page CSS interference
        const shadow = activeDropdownWrapper.attachShadow({ mode: 'closed' });
        
        // Inject styles into shadow root
        const style = document.createElement('style');
        style.textContent = `
            .sv-dropdown {
                background: #1E2A47;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05);
                width: 280px;
                max-height: 250px;
                overflow-y: auto;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #E8EAED;
                pointer-events: auto; /* Re-enable pointer events inside the dropdown */
            }
            .sv-dropdown-header {
                padding: 8px 12px;
                font-size: 11px;
                font-weight: bold;
                color: #9AA0A6;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                text-transform: uppercase;
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(0, 0, 0, 0.1);
            }
            .sv-credential-item {
                padding: 10px 12px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                gap: 3px;
                transition: background 0.1s ease;
            }
            .sv-credential-item:hover,
            .sv-credential-item:focus {
                background: #243154;
                outline: none;
            }
            .sv-item-username {
                font-size: 13px;
                font-weight: 500;
                color: #FFFFFF;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .sv-item-password {
                font-size: 11px;
                color: #9AA0A6;
                display: flex;
                align-items: center;
                gap: 4px;
            }
        `;
        shadow.appendChild(style);
        
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'sv-dropdown';

        const header = document.createElement('div');
        header.className = 'sv-dropdown-header';
        header.textContent = '🛡️ SecureVault';
        dropdownContainer.appendChild(header);

        credentials.forEach(cred => {
            const item = document.createElement('div');
            item.className = 'sv-credential-item';
            // Allow keyboard navigation
            item.tabIndex = 0; 

            const username = document.createElement('div');
            username.className = 'sv-item-username';
            username.textContent = cred.username || 'No username';

            const passInfo = document.createElement('div');
            passInfo.className = 'sv-item-password';
            passInfo.textContent = '••••••••';

            item.appendChild(username);
            item.appendChild(passInfo);

            const triggerFill = (e) => {
                e.preventDefault();
                e.stopPropagation();
                fillCredentials(cred.username, cred.password);
                if (activeDropdownWrapper) {
                    activeDropdownWrapper.remove();
                    activeDropdownWrapper = null;
                }
            };

            item.addEventListener('mousedown', triggerFill);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') triggerFill(e);
            });

            dropdownContainer.appendChild(item);
        });

        shadow.appendChild(dropdownContainer);
        document.body.appendChild(activeDropdownWrapper);

        const closeDropdown = (e) => {
            if (activeDropdownWrapper && e.target !== inputElement && e.target !== activeDropdownWrapper) {
                activeDropdownWrapper.remove();
                activeDropdownWrapper = null;
                document.removeEventListener('mousedown', closeDropdown);
            }
        };
        // Use a slight delay to prevent immediate dismissal if triggering from another mousedown
        setTimeout(() => document.addEventListener('mousedown', closeDropdown), 10);
    }

    // ── Autofill Trigger Setup ────────────────────────────────

    function setupAutofillTriggers() {
        const userField = findUsernameField();
        const passField = findPasswordField();

        const attachTrigger = (field) => {
            if (!field || field.dataset.svAttached) return;
            field.dataset.svAttached = 'true';
            
            field.addEventListener('focus', () => {
                if (cachedDecrypted) {
                    showAutofillDropdown(field, cachedDecrypted);
                } else {
                    console.log("[SecureVault] Field focused. Fetching matching credentials...");
                    const domain = window.location.hostname;
                    const fullUrl = window.location.href;
                    
                    chrome.runtime.sendMessage({
                        type: 'GET_MATCHING_CREDENTIALS',
                        domain: domain,
                        fullUrl: fullUrl
                    }, async (res) => {
                        if (res && res.matches && res.matches.length > 0) {
                            console.log(`[SecureVault] Received ${res.matches.length} encrypted matches from background.`);
                            // Decrypt each matched item client-side
                            const decrypted = await decryptMatchedItems(res.matches);
                            cachedDecrypted = decrypted;
                            if (document.activeElement === field && decrypted.length > 0) {
                                showAutofillDropdown(field, cachedDecrypted);
                            }
                        } else if (res && res.error) {
                            console.warn(`[SecureVault] Error fetching credentials: ${res.error}`);
                        } else {
                            console.log(`[SecureVault] No matches found for ${domain}`);
                            cachedDecrypted = []; // Cache empty to avoid repeated calls
                        }
                    });
                }
            });
        };

        if (userField) attachTrigger(userField);
        if (passField) attachTrigger(passField);
    }

    async function decryptMatchedItems(matches) {
        const results = [];
        // Try to get master key for WebCrypto decryption
        let cryptoKey = null;
        try {
            const res = await chrome.runtime.sendMessage({ type: 'GET_MASTER_KEY' });
            if (res && res.sv_master_key) {
                cryptoKey = await deriveKeyFromMaster(res.sv_master_key);
                console.log("[SecureVault] Master key successfully derived.");
            } else {
                console.warn("[SecureVault] No master key available in local storage.");
            }
        } catch (e) { 
            console.error("[SecureVault] Failed to retrieve master key:", e);
            return []; // Cannot decrypt without key
        }

        let decryptedCount = 0;
        for (const item of matches) {
            let data = null;
            const encData = item.encryptedData;
            if (!encData) continue;

            // Convert byte array to base64 if needed
            let base64Data;
            if (typeof encData === 'string') {
                base64Data = encData;
            } else if (Array.isArray(encData)) {
                base64Data = btoa(String.fromCharCode(...new Uint8Array(encData)));
            } else {
                continue;
            }

            if (cryptoKey) {
                try {
                    data = await decryptVaultData(base64Data, cryptoKey);
                } catch (err) {
                    console.error("[SecureVault] Decryption failed for item", item.id, err);
                    continue;
                }
            }

            // Fallback: try plain base64
            if (!data) {
                try {
                    const decoded = atob(base64Data);
                    data = JSON.parse(decodeURIComponent(escape(decoded)));
                } catch (e) { continue; }
            }

            if (data && (data.type === 'login' || data.type === 'LOGIN' || item.type === 'LOGIN')) {
                results.push({
                    id: item.id,
                    username: data.username || '',
                    password: data.password || '',
                    name: data.name || '',
                    website: data.website || ''
                });
                decryptedCount++;
            }
        }
        
        console.log(`[SecureVault] Successfully decrypted ${decryptedCount} items client-side.`);
        return results;
    }

    // ── SPA Support & Navigation Sync ──────────────────────────

    function handleRouteOrDOMChange() {
        const forms = detectLoginForms();
        if (forms.length > 0) {
            chrome.runtime.sendMessage({
                type: 'LOGIN_FORM_DETECTED',
                url: window.location.href,
                domain: window.location.hostname,
                formCount: forms.length,
            }).catch(() => { });

            setupAutofillTriggers();
            checkLoginSuccess(); // Check if this new DOM/URL implies successful login bounds
        }
    }

    // Debounced observer for React/Vue/Angular dynamic routing/rendering
    let domTimeout;
    const domObserver = new MutationObserver(() => {
        clearTimeout(domTimeout);
        domTimeout = setTimeout(() => {
            handleRouteOrDOMChange();
        }, 300);
    });

    // Monkeypatch history API to detect SPA navigation without page reload
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
    window.addEventListener('locationchange', () => {
        console.log("[SecureVault] SPA Location changed: ", window.location.href);
        cachedDecrypted = null; // Clear cache on navigation
        handleRouteOrDOMChange();
    });

    // ── Listen for autofill messages from popup ───────────────
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === 'SECUREVAULT_AUTOFILL') {
            const success = fillCredentials(message.username, message.password);
            sendResponse({ success });
        }
        return true;
    });

    // ── Login Success Detection for Save Prompts ──────────────
    document.addEventListener('submit', (e) => {
        const passField = findPasswordField();
        if (!passField) return;

        const form = passField.closest('form');
        if (form && e.target !== form) return;

        const userField = findUsernameField();
        const username = userField ? userField.value : '';
        const password = passField.value;

        if (!password) return;

        // Store pending credentials — don't prompt yet
        console.log("[SecureVault] Login form submitted. Saving pending credentials locally.");
        pendingCredentials = {
            username,
            password,
            website: window.location.hostname
        };

        // Check if already saved
        if (cachedDecrypted) {
            const existing = cachedDecrypted.find(c => c.username === username);
            if (existing && existing.password === password) {
                console.log("[SecureVault] Credential already saved. No prompt needed.");
                pendingCredentials = null; // No change needed
                return;
            }
            pendingCredentials.existingId = existing ? existing.id : null;
        }
    });

    function checkLoginSuccess() {
        if (!pendingCredentials) return;
        
        const currentUrl = window.location.href;
        const passField = findPasswordField();
        
        let loginSucceeded = false;
        
        // Success heuristic 1: URL changed
        if (currentUrl !== lastUrl) {
            console.log("[SecureVault] URL changed after form submit. Triggering save prompt.");
            loginSucceeded = true;
        } 
        // Success heuristic 2: Password field is gone from DOM
        else if (!passField) {
            console.log("[SecureVault] Password field disappeared after submit. Triggering save prompt.");
            loginSucceeded = true;
        }

        if (loginSucceeded) {
            showSavePrompt(pendingCredentials);
            pendingCredentials = null;
        }
        lastUrl = currentUrl;
    }

    function showSavePrompt(creds) {
        const isUpdate = !!creds.existingId;
        const msg = isUpdate ? 'Update password in SecureVault?' : 'Save new password to SecureVault?';

        // Use Shadow DOM for prompt to isolate styles
        const promptContainer = document.createElement('div');
        promptContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 2147483647;';
        
        const shadow = promptContainer.attachShadow({ mode: 'closed' });
        
        const style = document.createElement('style');
        style.textContent = `
            .sv-prompt {
                background: #16213E;
                color: #E8EAED;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                border: 1px solid #175DDC;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                max-width: 320px;
                animation: svSlideIn 0.3s ease;
            }
            @keyframes svSlideIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .sv-btn {
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: opacity 0.2s;
            }
            .sv-btn:hover { opacity: 0.9; }
            .sv-btn-secondary {
                background: transparent;
                border: 1px solid rgba(255,255,255,0.2);
                color: #FFF;
            }
            .sv-btn-primary {
                background: #175DDC;
                border: none;
                color: #FFF;
            }
        `;
        
        const promptDiv = document.createElement('div');
        promptDiv.className = 'sv-prompt';
        promptDiv.innerHTML = `
            <div style="font-weight:bold; margin-bottom: 8px; font-size: 14px;">🛡️ SecureVault</div>
            <div style="font-size: 13px; margin-bottom: 12px;">${msg}<br/><span style="color:#9AA0A6">${creds.username}</span></div>
            <div style="display:flex; gap: 8px; justify-content: flex-end;">
                <button id="sv-deny" class="sv-btn sv-btn-secondary">Not Now</button>
                <button id="sv-allow" class="sv-btn sv-btn-primary">Save</button>
            </div>
        `;
        
        shadow.appendChild(style);
        shadow.appendChild(promptDiv);
        document.body.appendChild(promptContainer);

        shadow.getElementById('sv-deny').onclick = (ev) => {
            ev.preventDefault();
            promptContainer.remove();
        };
        shadow.getElementById('sv-allow').onclick = (ev) => {
            ev.preventDefault();
            promptContainer.remove();
            console.log(`[SecureVault] User approved save. Sending SAVE_CREDENTIAL to background.`);
            chrome.runtime.sendMessage({
                type: 'SAVE_CREDENTIAL',
                payload: {
                    id: creds.existingId || null,
                    website: creds.website,
                    username: creds.username,
                    password: creds.password
                }
            });
        };

        // Auto-dismiss after 15 seconds
        setTimeout(() => { if (promptContainer.parentNode) promptContainer.remove(); }, 15000);
    }

    // ── Initialize ────────────────────────────────────────────
    function initSecureVault() {
        console.log("[SecureVault] Initializing on:", window.location.hostname);
        handleRouteOrDOMChange();

        // Start observing DOM 
        if (document.body) {
            domObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initSecureVault);
    } else {
        initSecureVault();
    }

})();