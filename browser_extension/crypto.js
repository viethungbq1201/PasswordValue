/**
 * Crypto utility for Browser Extension
 * Uses AES-256-GCM and PBKDF2 (matching WebCrypto standard)
 */

export async function deriveMasterKey(password, email) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const saltBytes = encoder.encode(email.toLowerCase().trim());

    const baseKey = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    const masterKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true, // extractable
        ['encrypt', 'decrypt']
    );

    const rawKey = await crypto.subtle.exportKey('raw', masterKey);
    return bufToHex(rawKey);
}

export async function importMasterKey(hex) {
    const rawKey = hexToBuf(hex);
    return crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

function bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBuf(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

export async function encrypt(data, masterKey) {
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        masterKey,
        plaintext
    );

    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedData, masterKey) {
    let combined;
    if (typeof encryptedData === 'string') {
        combined = new Uint8Array(
            atob(encryptedData)
                .split('')
                .map(c => c.charCodeAt(0))
        );
    } else if (encryptedData instanceof Uint8Array) {
        combined = encryptedData;
    } else if (Array.isArray(encryptedData)) {
        combined = new Uint8Array(encryptedData);
    } else {
        throw new Error('Unsupported encrypted data format');
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedContent = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        masterKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedContent));
}
