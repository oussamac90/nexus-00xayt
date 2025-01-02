import { environment } from '../../../environments/environment';
import CryptoJS from 'crypto-js'; // v4.1.1

// Storage configuration constants
const STORAGE_ENCRYPTION_KEY = 'NEXUS_STORAGE_KEY';
const STORAGE_PREFIX = 'nexus_';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
const STORAGE_QUOTA_THRESHOLD = 0.9; // 90% threshold for quota warning

/**
 * Interface for storage operation result
 */
interface StorageResult {
  success: boolean;
  error?: string;
}

/**
 * Encrypts data using AES encryption
 * @param data Data to encrypt
 * @returns Encrypted string
 */
const encryptData = (data: string): string => {
  try {
    return CryptoJS.AES.encrypt(data, STORAGE_ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts AES encrypted data
 * @param encryptedData Encrypted data string
 * @returns Decrypted string
 */
const decryptData = (encryptedData: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, STORAGE_ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Checks if storage quota is available
 * @param size Size of data to store in bytes
 * @returns Boolean indicating if quota is available
 */
const checkStorageQuota = (size: number): boolean => {
  try {
    const quota = navigator.storage?.estimate?.() || { usage: 0, quota: 0 };
    return (quota.usage + size) <= quota.quota;
  } catch {
    // Fallback for browsers not supporting Storage API
    return true;
  }
};

/**
 * Stores data in localStorage with optional encryption
 * @param key Storage key
 * @param value Data to store
 * @param encrypt Whether to encrypt the data
 * @returns void
 * @throws Error if storage fails
 */
export function setLocalStorage<T>(key: string, value: T, encrypt: boolean = false): void {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let dataToStore: string;

    // Convert value to string if object
    if (typeof value === 'object') {
      dataToStore = JSON.stringify(value);
    } else {
      dataToStore = String(value);
    }

    // Check size constraints
    const dataSize = new Blob([dataToStore]).size;
    if (dataSize > MAX_STORAGE_SIZE) {
      throw new Error(`Data size exceeds maximum allowed size of ${MAX_STORAGE_SIZE} bytes`);
    }

    // Check storage quota
    if (!checkStorageQuota(dataSize)) {
      throw new Error('Storage quota exceeded');
    }

    // Encrypt if required
    if (encrypt) {
      dataToStore = encryptData(dataToStore);
    }

    // Store data
    localStorage.setItem(prefixedKey, dataToStore);

    // Check storage usage and emit warning if needed
    if (!environment.production) {
      const quota = navigator.storage?.estimate?.();
      if (quota && (quota.usage / quota.quota) > STORAGE_QUOTA_THRESHOLD) {
        console.warn('Storage usage exceeds 90% of quota');
      }
    }
  } catch (error) {
    console.error('Storage error:', error);
    throw new Error(`Failed to store data for key: ${key}`);
  }
}

/**
 * Retrieves data from localStorage with optional decryption
 * @param key Storage key
 * @param encrypted Whether the data is encrypted
 * @returns Retrieved value or null if not found
 * @throws Error if retrieval fails
 */
export function getLocalStorage<T>(key: string, encrypted: boolean = false): T | null {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let storedData = localStorage.getItem(prefixedKey);

    if (!storedData) {
      return null;
    }

    // Decrypt if needed
    if (encrypted) {
      storedData = decryptData(storedData);
    }

    // Parse JSON if the data is an object
    try {
      return JSON.parse(storedData) as T;
    } catch {
      // If parsing fails, return as is
      return storedData as unknown as T;
    }
  } catch (error) {
    console.error('Retrieval error:', error);
    throw new Error(`Failed to retrieve data for key: ${key}`);
  }
}

/**
 * Removes an item from localStorage
 * @param key Storage key
 * @returns void
 * @throws Error if removal fails
 */
export function removeLocalStorage(key: string): void {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
  } catch (error) {
    console.error('Removal error:', error);
    throw new Error(`Failed to remove data for key: ${key}`);
  }
}

/**
 * Clears all Nexus-related items from storage
 * @returns void
 * @throws Error if clearing fails
 */
export function clearStorage(): void {
  try {
    // Get all storage keys
    const keys = Object.keys(localStorage);
    
    // Remove all items with Nexus prefix
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error(`Failed to remove item: ${key}`, error);
        }
      }
    });

    // Clear session storage as well
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          sessionStorage.removeItem(key);
        } catch (error) {
          console.error(`Failed to remove session item: ${key}`, error);
        }
      }
    });
  } catch (error) {
    console.error('Storage clearing error:', error);
    throw new Error('Failed to clear storage');
  }
}