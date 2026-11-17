/**
 * SecureStorage for HKM Church Management System
 * Provides an encrypted and tamper-proof storage for sensitive data
 * Optimized with key caching, batch operations, and IndexedDB fallback
 */

const ENCRYPTION_KEY_NAME = 'hkm_secure_storage_key';
const INDEXEDDB_NAME = 'hkm_secure_storage_db';
const INDEXEDDB_VERSION = 1;

// Global key cache to avoid repeated key generation/import
const keyCache = new Map<string, CryptoKey>();

// IndexedDB connection cache
let indexedDB: IDBDatabase | null = null;

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  // Check cache first
  const cachedKey = keyCache.get(ENCRYPTION_KEY_NAME);
  if (cachedKey) {
    return cachedKey;
  }

  const storedKey = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
  if (storedKey) {
    const keyData = JSON.parse(storedKey);
    const key = await crypto.subtle.importKey('jwk', keyData, { name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    keyCache.set(ENCRYPTION_KEY_NAME, key);
    return key;
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

  const exportedKey = await crypto.subtle.exportKey('jwk', key);
  sessionStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));

  keyCache.set(ENCRYPTION_KEY_NAME, key);
  return key;
}

// IndexedDB utility functions
async function getIndexedDB(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) {
    return null;
  }

  if (indexedDB) {
    return indexedDB;
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(INDEXEDDB_NAME, INDEXEDDB_VERSION);

    request.onerror = () => {
      console.warn('IndexedDB not available, falling back to localStorage');
      resolve(null);
    };

    request.onsuccess = (event) => {
      indexedDB = (event.target as IDBOpenDBRequest).result;
      resolve(indexedDB);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('secure_storage')) {
        db.createObjectStore('secure_storage', { keyPath: 'key' });
      }
    };
  });
}

async function indexedDBSetItem(key: string, value: string): Promise<void> {
  const db = await getIndexedDB();
  if (!db) {
    localStorage.setItem(key, value);
    return;
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(['secure_storage'], 'readwrite');
    const store = transaction.objectStore('secure_storage');

    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => {
      // Fallback to localStorage
      localStorage.setItem(key, value);
      resolve();
    };
  });
}

async function indexedDBGetItem(key: string): Promise<string | null> {
  const db = await getIndexedDB();
  if (!db) {
    return localStorage.getItem(key);
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(['secure_storage'], 'readonly');
    const store = transaction.objectStore('secure_storage');

    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };

    request.onerror = () => {
      // Fallback to localStorage
      resolve(localStorage.getItem(key));
    };
  });
}

async function indexedDBRemoveItem(key: string): Promise<void> {
  const db = await getIndexedDB();
  if (!db) {
    localStorage.removeItem(key);
    return;
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(['secure_storage'], 'readwrite');
    const store = transaction.objectStore('secure_storage');

    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      // Fallback to localStorage
      localStorage.removeItem(key);
      resolve();
    };
  });
}

export class SecureStorage {
  private key: CryptoKey | null = null;
  private writeBuffer: Map<string, string> = new Map();
  private flushTimeout: number | null = null;
  private static readonly FLUSH_DELAY_MS = 100;

  constructor(private storageKey: string) {}

  private async getKey(): Promise<CryptoKey> {
    if (!this.key) {
      this.key = await getOrCreateEncryptionKey();
    }
    return this.key;
  }

  // Batch encryption for multiple values
  private async encryptBatch(values: string[]): Promise<string[]> {
    const key = await this.getKey();
    const encoder = new TextEncoder();

    const encryptedResults: string[] = [];

    for (const value of values) {
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      encryptedResults.push(btoa(String.fromCharCode(...combined)));
    }

    return encryptedResults;
  }

  // Batch decryption for multiple values
  private async decryptBatch(encryptedValues: string[]): Promise<(string | null)[]> {
    const key = await this.getKey();
    const results: (string | null)[] = [];

    for (const encryptedValue of encryptedValues) {
      try {
        const combined = new Uint8Array(
          atob(encryptedValue)
            .split('')
            .map((c) => c.charCodeAt(0)),
        );

        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

        results.push(new TextDecoder().decode(decrypted));
      } catch {
        results.push(null);
      }
    }

    return results;
  }

  async setItem(value: string): Promise<void> {
    // Add to write buffer for batching
    this.writeBuffer.set(this.storageKey, value);

    // Schedule flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = window.setTimeout(() => {
        this.flushBuffer();
      }, SecureStorage.FLUSH_DELAY_MS);
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.writeBuffer.size === 0) {
      this.flushTimeout = null;
      return;
    }

    const keys = Array.from(this.writeBuffer.keys());
    const values = Array.from(this.writeBuffer.values());

    try {
      const encryptedValues = await this.encryptBatch(values);

      // Store all encrypted values using IndexedDB with fallback
      for (let i = 0; i < keys.length; i++) {
        await indexedDBSetItem(keys[i], encryptedValues[i]);
      }

      this.writeBuffer.clear();
    } catch (error) {
      console.error('Batch encryption failed:', error);
      // Fallback to individual encryption
      for (const [key, value] of this.writeBuffer) {
        try {
          const encrypted = await this.encryptBatch([value]);
          await indexedDBSetItem(key, encrypted[0]);
        } catch (err) {
          console.error('Individual encryption failed for key:', key, err);
        }
      }
      this.writeBuffer.clear();
    }

    this.flushTimeout = null;
  }

  async getItem(): Promise<string | null> {
    // Check if value is in write buffer (not yet persisted)
    if (this.writeBuffer.has(this.storageKey)) {
      return this.writeBuffer.get(this.storageKey) || null;
    }

    const storedValue = await indexedDBGetItem(this.storageKey);
    if (!storedValue) return null;

    try {
      const [decrypted] = await this.decryptBatch([storedValue]);
      return decrypted;
    } catch {
      return null;
    }
  }

  // Batch get multiple items
  async getItems(keys: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const valuesToDecrypt: string[] = [];
    const keysToDecrypt: string[] = [];

    // Check write buffer first
    for (const key of keys) {
      if (this.writeBuffer.has(key)) {
        results.set(key, this.writeBuffer.get(key) || null);
      } else {
        const storedValue = await indexedDBGetItem(key);
        if (storedValue) {
          valuesToDecrypt.push(storedValue);
          keysToDecrypt.push(key);
        } else {
          results.set(key, null);
        }
      }
    }

    if (valuesToDecrypt.length > 0) {
      try {
        const decryptedValues = await this.decryptBatch(valuesToDecrypt);
        keysToDecrypt.forEach((key, index) => {
          results.set(key, decryptedValues[index]);
        });
      } catch (error) {
        console.error('Batch decryption failed:', error);
        keysToDecrypt.forEach((key) => {
          results.set(key, null);
        });
      }
    }

    return results;
  }

  async removeItem(): Promise<void> {
    // Remove from write buffer if present
    this.writeBuffer.delete(this.storageKey);
    await indexedDBRemoveItem(this.storageKey);
  }

  // Force immediate flush of buffer
  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await this.flushBuffer();
  }

  // Clear the entire buffer without flushing
  clearBuffer(): void {
    this.writeBuffer.clear();
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  // Static method to clear all secure storage
  static async clearAll(): Promise<void> {
    if (indexedDB) {
      try {
        indexedDB.close();
        indexedDB = null;
        await new Promise((resolve) => {
          const request = window.indexedDB.deleteDatabase(INDEXEDDB_NAME);
          request.onsuccess = () => resolve(void 0);
          request.onerror = () => resolve(void 0);
        });
      } catch (error) {
        console.warn('Failed to clear IndexedDB:', error);
      }
    }

    // Clear localStorage as well
    localStorage.clear();
    sessionStorage.removeItem(ENCRYPTION_KEY_NAME);

    // Clear caches
    keyCache.clear();
  }
}
