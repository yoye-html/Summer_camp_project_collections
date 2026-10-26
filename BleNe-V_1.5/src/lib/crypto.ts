/**
 * BleNe Connect - Cryptography & Privacy Engine
 * 
 * Implements hardware-accelerated, zero-dependency client-side encryption
 * using the native W3C Web Cryptography API (SubtleCrypto).
 * 
 * Features:
 * - AES-256-GCM authenticated encryption for precise GPS coordinates
 * - Cryptographically secure 96-bit IV generation per operation
 * - PBKDF2 (SHA-256, 100,000 iterations) key derivation
 * - Differential privacy / coordinate fuzzing for coarse spatial discovery
 */

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  timestamp?: number;
}

export interface EncryptedLocationPayload {
  version: '1.0';
  algorithm: 'AES-256-GCM';
  ciphertext: string; // Base64
  iv: string;         // Base64 (12 bytes)
  tagLength: 128;
  timestamp: string;
}

// Default application pepper/salt for key derivation when using request-scoped secret
const APP_PEPPER = new TextEncoder().encode('blene-connect-location-security-salt-2026');

/**
 * Convert ArrayBuffer to Base64 string
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure 256-bit AES-GCM key
 */
export async function generateLocationKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export CryptoKey to Base64 raw string
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return bufferToBase64(exported);
}

/**
 * Import Base64 raw string back to CryptoKey
 */
export async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const rawBytes = base64ToBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive an AES-256-GCM key from a shared passphrase or request ID
 */
export async function deriveKeyFromSecret(secret: string, customSalt?: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretKeyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: customSalt || APP_PEPPER,
      iterations: 100000,
      hash: 'SHA-256',
    },
    secretKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt location coordinates using AES-256-GCM
 */
export async function encryptLocation(
  coords: LocationCoordinates,
  keyOrSecret?: CryptoKey | string
): Promise<EncryptedLocationPayload> {
  // If string provided, derive key; if none provided, derive from default session salt
  let cryptoKey: CryptoKey;
  if (!keyOrSecret) {
    cryptoKey = await deriveKeyFromSecret('blene-default-e2ee-location-key');
  } else if (typeof keyOrSecret === 'string') {
    cryptoKey = await deriveKeyFromSecret(keyOrSecret);
  } else {
    cryptoKey = keyOrSecret;
  }

  // 1. Generate 96-bit (12 bytes) IV (standard recommended for AES-GCM)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Prepare payload
  const plainText = JSON.stringify({
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy || null,
    altitude: coords.altitude || null,
    timestamp: coords.timestamp || Date.now(),
  });

  const encodedData = new TextEncoder().encode(plainText);

  // 3. Encrypt with AES-GCM (256-bit key)
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128,
    },
    cryptoKey,
    encodedData
  );

  return {
    version: '1.0',
    algorithm: 'AES-256-GCM',
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    tagLength: 128,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt location payload using AES-256-GCM
 */
export async function decryptLocation(
  payload: EncryptedLocationPayload | string,
  keyOrSecret?: CryptoKey | string
): Promise<LocationCoordinates | null> {
  try {
    const data: EncryptedLocationPayload =
      typeof payload === 'string' ? JSON.parse(payload) : payload;

    if (!data.ciphertext || !data.iv) {
      console.warn('[Crypto] Invalid encrypted location format');
      return null;
    }

    let cryptoKey: CryptoKey;
    if (!keyOrSecret) {
      cryptoKey = await deriveKeyFromSecret('blene-default-e2ee-location-key');
    } else if (typeof keyOrSecret === 'string') {
      cryptoKey = await deriveKeyFromSecret(keyOrSecret);
    } else {
      cryptoKey = keyOrSecret;
    }

    const iv = base64ToBuffer(data.iv);
    const ciphertext = base64ToBuffer(data.ciphertext);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      cryptoKey,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decoded) as LocationCoordinates;
  } catch (err) {
    console.error('[Crypto] Decryption failed or authentication tag mismatch:', err);
    return null;
  }
}

/**
 * Differential Privacy / Coordinate Fuzzing
 * 
 * Jitters coordinates randomly within a specified radius (default ~350m).
 * Used to populate coarse PostGIS queries for discovery without revealing
 * the user's exact address or apartment location until accepted.
 */
export function fuzzCoordinates(
  lat: number,
  lng: number,
  jitterMeters: number = 350
): { latitude: number; longitude: number } {
  // Earth radius in meters
  const earthRadius = 6378137;

  // Cryptographically secure random angle and distance
  const randomArray = new Uint32Array(2);
  window.crypto.getRandomValues(randomArray);

  const angle = (randomArray[0] / 0xffffffff) * 2 * Math.PI;
  const distance = Math.sqrt(randomArray[1] / 0xffffffff) * jitterMeters;

  const dLat = (distance * Math.cos(angle)) / earthRadius;
  const dLng = (distance * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));

  return {
    latitude: lat + (dLat * 180) / Math.PI,
    longitude: lng + (dLng * 180) / Math.PI,
  };
}

/**
 * Compute SHA-256 hash of a text or token
 */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
