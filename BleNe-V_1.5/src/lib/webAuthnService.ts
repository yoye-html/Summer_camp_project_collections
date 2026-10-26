/**
 * Mock WebAuthn Server Service
 * 
 * CRITICAL SECURITY WARNING:
 * This file acts as a MOCK for the server-side operations required by WebAuthn.
 * In a real production application, these operations MUST be performed on a secure backend server.
 * 
 * 1. Challenge Generation: Must be server-side to prevent replay attacks.
 * 2. Verification: Signature verification must happen server-side with the stored public key.
 * 3. Credential Storage: Public keys and counters must be stored securely in a database.
 * 
 * The implementations below are INSECURE purely for demonstration/MVP purposes to allow
 * the application to run without a dedicated backend API.
 */

// Mock database for credentials
// In a real app, this would be your database (e.g., Supabase, PostgreSQL)
const mockCredentialDb = new Map<string, { credentialId: string; publicKey: string }>();

/**
 * Simulates fetching a registration challenge from the server.
 * POST /api/auth/webauthn/register-challenge
 */
export async function getRegistrationChallenge(userId: string): Promise<Uint8Array> {
    // SIMULATE NETWORK DELAY
    await new Promise(resolve => setTimeout(resolve, 500));

    console.warn('[WebAuthnService] ⚠️ Generating UNSAFE client-side challenge for registration.');
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge;
}

/**
 * Simulates verifying the registration attestation on the server.
 * POST /api/auth/webauthn/register-verify
 */
export async function verifyRegistration(userId: string, credential: any): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 800));

    console.warn('[WebAuthnService] ⚠️ Mocking server-side registration verification.');

    // In a real app, we would:
    // 1. Verify the challenge matches what we sent
    // 2. Verify the origin matches
    // 3. Verify the signature structure
    // 4. Store the public key and credential ID

    // Mock storage
    mockCredentialDb.set(userId, {
        credentialId: credential.id,
        publicKey: credential.response.publicKey || 'mock-public-key'
    });

    return { success: true };
}
/**
 * Simulates fetching an authentication challenge from the server.
 * POST /api/auth/webauthn/login-challenge
 */
export async function getAuthenticationChallenge(): Promise<Uint8Array> {
    await new Promise(resolve => setTimeout(resolve, 500));

    console.warn('[WebAuthnService] ⚠️ Generating UNSAFE client-side challenge for authentication.');
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge;
}

/**
 * Simulates verifying the authentication assertion on the server.
 * POST /api/auth/webauthn/login-verify
 */
export async function verifyAuthentication(credential: any): Promise<{ success: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 800));

    // In a real app, we would:
    // 1. Find the user by the credential ID
    // 2. Verify the challenge
    // 3. Verify the signature using the stored public key
    // 4. Update the authenticator counter

    const credentialId = credential.id;

    if (!credentialId) {
        console.warn('[WebAuthnService] ❌ Authentication failed: No credential ID provided.');
        return { success: false, error: 'No credential ID' };
    }

    // Mimic lookup using the same reference as verifyRegistration
    let matchFound = false;

    for (const [userId, record] of mockCredentialDb.entries()) {
        if (record.credentialId === credentialId) {
            console.log(`[WebAuthnService] ✅ Server recognized credential for user: ${userId}`);
            matchFound = true;
            break;
        }
    }

    if (!matchFound) {
        console.warn(`[WebAuthnService] ❌ Authenticator not recognized on server. ID: ${credentialId}`);
        // In a real flow, this means the user is not enrolled or is using a wrong authenticator
        return { success: false, error: 'Authenticator not recognized. Please re-enroll.' };
    }

    return { success: true };
}

/**
 * MOCK HELPER: Look up a user ID by their credential ID.
 * This simulates the backend knowing which user owns a specific passkey.
 */
export async function getUserByCredentialId(credentialId: string): Promise<string | null> {
    for (const [userId, record] of mockCredentialDb.entries()) {
        if (record.credentialId === credentialId) {
            return userId;
        }
    }
    return null;
}
export async function createBiometricSession(userId: string): Promise<{ access_token: string; refresh_token: string; }> {
    // Simulate network latency for backend processing
    await new Promise(resolve => setTimeout(resolve, 300));
    // Return mock JWT-like tokens. In production this would be a real Supabase JWT.
    return {
        access_token: `mock-access-token-${userId}`,
        refresh_token: `mock-refresh-token-${userId}`,
    };
}
