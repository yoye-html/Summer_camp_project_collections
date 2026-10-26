import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { getUserByCredentialId, createBiometricSession } from '@/lib/webAuthnService';

export type UserRole = 'visually_impaired' | 'volunteer' | 'admin' | null;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status?: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  isVerifiedVolunteer?: boolean;
  stars?: number;
  phone?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  infoMessage: string | null;
}

interface UseAuthResult extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, phone: string, role: UserRole) => Promise<boolean>;
  loginWithBiometrics: (credentialId: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setRole: (role: UserRole) => void;
  selectedRole: UserRole;
  verifyVolunteer: (code: string) => Promise<boolean>;
}

export function useAuth(): UseAuthResult {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: true,
    error: null,
    infoMessage: null,
  });
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);

  // Helper to safely update state
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Fetch user profile from 'users' table
  const fetchUserProfile = async (userId: string, email: string) => {
    console.log('[Auth] Fetching profile for:', userId);
    try {
      const fetchPromise = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.error('[Auth] Profile fetch error:', error);
        throw error;
      }

      if (data) {
        console.log('[Auth] Profile loaded:', data.role, data.status);
        const user: User = {
          id: data.id,
          email: email,
          name: data.name,
          role: data.role as UserRole,
          status: data.status,
          admin_notes: data.admin_notes,
          isVerifiedVolunteer: data.membership_verified,
          stars: data.stars,
          phone: data.phone || data.user_metadata?.phone,
        };

        // Persist role for splash screen detection
        if (user.role) {
          localStorage.setItem('user_role', user.role);
        }

        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false,
          error: null,
          infoMessage: null,
        });
        setSelectedRole(user.role);
      } else {
        console.warn('[Auth] No profile found');
        updateState({ isLoading: false, isInitializing: false });
      }
    } catch (err: any) {
      console.error('[Auth] Profile error:', err);
      updateState({ isLoading: false, isInitializing: false, error: err.message || 'Error loading profile' });
    }
  };

  // Initialize auth listener
  useEffect(() => {
    console.log('[Auth] Initializing listener');

    const initialTimeout = setTimeout(() => {
      setState(prev => {
        if (prev.isInitializing) {
          console.warn('[Auth] Initial check timed out');
          return { ...prev, isInitializing: false };
        }
        return prev;
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      clearTimeout(initialTimeout);
      console.log('[Auth] Event:', event, session?.user?.id);

      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email ?? '');
      } else {
        setState(prev => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isInitializing: false,
          error: null,
          infoMessage: null
        }));
      }
    });

    return () => {
      clearTimeout(initialTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    console.log('[Auth] Login attempt:', email);
    updateState({ isLoading: true, error: null, infoMessage: null });

    const timeoutId = setTimeout(() => {
      updateState({ isLoading: false, error: 'Login took too long. Please try again.' });
    }, 15000);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        updateState({ isLoading: false, error: error.message });
        return false;
      }

      if (data.session) {
        await fetchUserProfile(data.session.user.id, data.session.user.email!);
      } else {
        updateState({ isLoading: false });
      }
      return true;
    } catch (err: any) {
      updateState({ isLoading: false, error: err.message || 'Network error during login' });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [updateState]);

  const loginWithBiometrics = useCallback(async (credentialId: string): Promise<boolean> => {
    console.log('[Auth] Attempting Biometric Login with Credential ID:', credentialId);

    try {
      // 1. SECURE LOOKUP: Ask the backend "Who owns this credential?"
      const userId = await getUserByCredentialId(credentialId);

      if (!userId) {
        console.warn('[Auth] No user found for this biometric credential.');
        return false;
      }

      console.log('[Auth] Credential matched to User ID:', userId);

      // 2. Create session for the MATCHED user (not just any user)
      // In a real app, the backend would return a JWT here.
      // For this mock, we reconstruct the user object based on the ID we found.

      // We'll simulate fetching their full profile
      try {
        await fetchUserProfile(userId, `${userId}@example.com`); // Mock email reconstruction
        return true;
      } catch (e) {
        console.error('[Auth] Failed to load profile for biometric user:', e);
        return false;
      }
    } catch (error) {
      console.error('[Auth] Unexpected error during biometric login:', error);
      return false;
    }
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    phone: string,
    role: UserRole,
    faceId?: string
  ): Promise<boolean> => {
    console.log('[Auth] Register attempt:', email, role);
    updateState({ isLoading: true, error: null, infoMessage: null });

    const timeoutId = setTimeout(() => {
      updateState({ isLoading: false, error: 'Registration took too long. Please try again.' });
    }, 15000);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, phone, role, face_id_template: faceId } },
      });

      if (authError) {
        updateState({ isLoading: false, error: authError.message });
        return false;
      }

      if (role) {
        localStorage.setItem('user_role', role);
      }

      if (authData.session) {
        await fetchUserProfile(authData.session.user.id, authData.session.user.email!);
      } else if (authData.user) {
        updateState({
          isLoading: false,
          infoMessage: 'Account created! Please check your email to confirm before logging in.',
          error: null
        });
      } else {
        updateState({ isLoading: false, error: 'Registration failed mysteriously' });
      }
      return true;
    } catch (err: any) {
      updateState({ isLoading: false, error: err.message || 'Network error during registration' });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [updateState]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // Do NOT clear biometric enrollment, but maybe clear persistent role? 
    // Usually we keep basic user prefs.
    setState({ user: null, isAuthenticated: false, isLoading: false, isInitializing: false, error: null, infoMessage: null });
    setSelectedRole(null);
  }, []);

  const clearError = useCallback(() => updateState({ error: null }), [updateState]);
  const setRole = useCallback((role: UserRole) => setSelectedRole(role), []);

  const verifyVolunteer = useCallback(async (code: string): Promise<boolean> => {
    console.log('[Auth] Verifying volunteer code:', code);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return code === '123456';
  }, []);

  return { ...state, login, register, loginWithBiometrics, logout, clearError, setRole, selectedRole, verifyVolunteer };
}
