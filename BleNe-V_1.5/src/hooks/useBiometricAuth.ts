import { useState, useCallback } from 'react';
import {
    getRegistrationChallenge,
    verifyRegistration,
    getAuthenticationChallenge,
    verifyAuthentication
} from '@/lib/webAuthnService';

interface BiometricAuthResult {
    success: boolean;
    error?: string;
    credentialId?: string;
}

interface UseBiometricAuthReturn {
    isSupported: boolean;
    isEnrolled: boolean;
    authenticate: () => Promise<BiometricAuthResult>;
    enroll: (userId: string) => Promise<BiometricAuthResult>;
    checkEnrollment: () => Promise<boolean>;
}

/**
 * Hook for biometric authentication using Web Authentication API (WebAuthn)
 * Provides face/fingerprint authentication for PWAs
 */
export function useBiometricAuth(): UseBiometricAuthReturn {
    const [isEnrolled, setIsEnrolled] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('biometric_enrolled') === 'true';
    });

    // Check if WebAuthn is supported (for biometric authentication)
    const isSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

    /**
     * Enroll a biometric credential for a user
     */
    const enroll = useCallback(
        async (userId: string): Promise<BiometricAuthResult> => {
            if (!isSupported) {
                return { success: false, error: 'Biometric authentication is not supported in this browser' };
            }

            try {
                // 1. Get challenge from server (mocked service)
                const challenge = await getRegistrationChallenge(userId);

                const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
                    challenge: challenge as unknown as BufferSource,
                    rp: { name: 'BleNe Connect', id: window.location.hostname },
                    user: {
                        id: new TextEncoder().encode(userId) as unknown as BufferSource,
                        name: userId,
                        displayName: 'User',
                    },
                    pubKeyCredParams: [
                        { type: 'public-key', alg: -7 },
                        { type: 'public-key', alg: -257 },
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        requireResidentKey: true,
                        userVerification: 'required',
                    },
                    timeout: 60000,
                    attestation: 'none',
                };

                const credential = await navigator.credentials.create({
                    publicKey: publicKeyCredentialCreationOptions,
                });

                if (credential) {
                    // 2. Send attestation to server for verification
                    const verifyResult = await verifyRegistration(userId, credential);

                    if (verifyResult.success) {
                        // Store credential ID for authentication (locally for now as optimization/cache)
                        // In a real app the server would store this, but we need it locally for the 'get' call allowCredentials
                        const pkCred = credential as PublicKeyCredential;
                        localStorage.setItem(
                            'biometric_credential_id',
                            JSON.stringify(Array.from(new Uint8Array(pkCred.rawId)))
                        );

                        // Only set local state AFTER server confirms success
                        localStorage.setItem('biometric_enrolled', 'true');
                        setIsEnrolled(true);
                        console.log('[Biometric] Enrollment successful');
                        return { success: true };
                    }
                }

                return { success: false, error: 'Credential creation failed' };
            } catch (error: any) {
                console.error('[Biometric] Enrollment error:', error);
                return { success: false, error: error.message || 'Biometric enrollment failed' };
            }
        },
        [isSupported]
    );

    const authenticate = useCallback(
        async (): Promise<BiometricAuthResult> => {
            if (!isSupported) return { success: false, error: 'Biometric authentication is not supported' };

            try {
                // 1. Get auth challenge from server (mocked service)
                const challenge = await getAuthenticationChallenge();

                // Ideally we don't look up credential ID locally if we want to allow "resident key" (passwordless),
                // but if we are doing 2FA we might pass allowedCredentials.
                // For logic safety in MVP:
                const credentialIdStr = localStorage.getItem('biometric_credential_id');
                const allowedCredentials: PublicKeyCredentialDescriptor[] = [];

                if (credentialIdStr) {
                    allowedCredentials.push({
                        type: 'public-key',
                        id: new Uint8Array(JSON.parse(credentialIdStr)) as unknown as BufferSource,
                        transports: ['internal'],
                    });
                }

                const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
                    challenge: challenge as unknown as BufferSource,
                    allowCredentials: allowedCredentials.length > 0 ? allowedCredentials : undefined,
                    timeout: 60000,
                    userVerification: 'required',
                };

                const credential = await navigator.credentials.get({
                    publicKey: publicKeyCredentialRequestOptions,
                });

                if (credential) {
                    // 2. Send assertion to server
                    const verifyResult = await verifyAuthentication(credential);

                    if (verifyResult.success) {
                        console.log('[Biometric] Authentication successful');
                        return { success: true, credentialId: credential.id };
                    }
                }

                return { success: false, error: 'Authentication failed' };
            } catch (error: any) {
                console.error('[Biometric] Authentication error:', error);
                if (error.name === 'NotAllowedError') return { success: false, error: 'Authentication was cancelled or denied' };
                return { success: false, error: error.message || 'Biometric authentication failed' };
            }
        },
        [isSupported]
    );

    /**
     * Check if biometric is already enrolled
     */
    const checkEnrollment = useCallback(async (): Promise<boolean> => {
        const enrolled = localStorage.getItem('biometric_enrolled') === 'true';
        setIsEnrolled(enrolled);
        return enrolled;
    }, []);

    return {
        isSupported,
        isEnrolled,
        authenticate,
        enroll,
        checkEnrollment,
    };
}
