/**
 * CryptoService — Client-side encryption for SecureVault
 * Standardized across Web, Extension, and Mobile.
 * Uses AES-256-GCM for data and PBKDF2-HMAC-SHA256 for key derivation.
 */

class CryptoService {
  constructor() {
    this.masterKey = null; // Stored in memory after login
  }

  /**
   * Derives a 256-bit master key from password and email (as salt).
   */
  async deriveMasterKey(password, email) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const saltBytes = encoder.encode(email.toLowerCase().trim());

    // Import the password as a raw key
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive the master key
    this.masterKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true, // Must be true to extract/export if needed, but false is safer if only used internally
      ['encrypt', 'decrypt']
    );

    return this.masterKey;
  }

  /**
   * Encrypts a JSON object.
   * Returns: Base64(iv(12) + ciphertext + tag(16))
   */
  async encrypt(data) {
    if (!this.masterKey) throw new Error('Vault is locked (no master key)');

    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      plaintext
    );

    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypts a Base64-encoded combined block.
   */
  async decrypt(encryptedBase64) {
    if (!this.masterKey) throw new Error('Vault is locked (no master key)');

    const combined = new Uint8Array(
      atob(encryptedBase64)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedContent));
  }

  setMasterKey(key) {
    this.masterKey = key;
  }

  clearKey() {
    this.masterKey = null;
  }
}

export default new CryptoService();
