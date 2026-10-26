/**
 * DHRS-ET Client-Side Cryptographic Service (Web Crypto API)
 * Enforces zero-plaintext Protected Health Information (PHI) on public channels or on-chain.
 * All clinical encounter data is encrypted with AES-256-GCM before pinning to IPFS.
 */

export interface EncryptedPayload {
  ipfsPayloadBase64: string;
  onChainHash: string; // 0x-prefixed 32-byte SHA-256 digest
  ivHex: string;
  authTagHex: string;
}

// Convert byte array to hex
export function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert hex to byte array
export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const match = cleanHex.match(/.{1,2}/g);
  if (!match) return new Uint8Array(0);
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

/**
 * Derives or generates a random 256-bit symmetric encryption key for a patient or session.
 */
export async function generatePatientKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts arbitrary clinical JSON with AES-256-GCM.
 * Output includes standard 12-byte IV, 16-byte GCM authentication tag, and ciphertext.
 */
export async function encryptHealthRecordBrowser(
  plaintextJson: string,
  key?: CryptoKey
): Promise<EncryptedPayload> {
  const activeKey = key || (await generatePatientKey());
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintextJson);

  // Encrypt with 128-bit tag length
  const ciphertextWithTag = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    activeKey,
    encodedText
  );

  const ciphertextArray = new Uint8Array(ciphertextWithTag);

  // Split ciphertext and 16-byte auth tag (last 16 bytes in Web Crypto AES-GCM output)
  const tagLength = 16;
  const ciphertextOnly = ciphertextArray.slice(0, ciphertextArray.length - tagLength);
  const authTag = ciphertextArray.slice(ciphertextArray.length - tagLength);

  // Combine [IV (12)][Tag (16)][Ciphertext] into single binary envelope for IPFS
  const combined = new Uint8Array(iv.length + authTag.length + ciphertextOnly.length);
  combined.set(iv, 0);
  combined.set(authTag, iv.length);
  combined.set(ciphertextOnly, iv.length + authTag.length);

  // Base64 envelope for IPFS
  let binaryString = "";
  for (let i = 0; i < combined.length; i++) {
    binaryString += String.fromCharCode(combined[i]);
  }
  const ipfsPayloadBase64 = btoa(binaryString);

  // SHA-256 Digest for on-chain anchoring
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", combined);
  const onChainHash = "0x" + bufferToHex(new Uint8Array(hashBuffer));

  return {
    ipfsPayloadBase64,
    onChainHash,
    ivHex: bufferToHex(iv),
    authTagHex: bufferToHex(authTag),
  };
}

/**
 * Decrypts an encrypted payload using the patient's AES-256 key.
 */
export async function decryptHealthRecordBrowser(
  ipfsPayloadBase64: string,
  key: CryptoKey
): Promise<string> {
  const binaryString = atob(ipfsPayloadBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }

  const iv = combined.slice(0, 12);
  const authTag = combined.slice(12, 28);
  const ciphertext = combined.slice(28);

  // Re-assemble in Web Crypto expected format: [Ciphertext][Tag]
  const toDecrypt = new Uint8Array(ciphertext.length + authTag.length);
  toDecrypt.set(ciphertext, 0);
  toDecrypt.set(authTag, ciphertext.length);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    toDecrypt
  );

  return new TextDecoder().decode(decryptedBuffer);
}

