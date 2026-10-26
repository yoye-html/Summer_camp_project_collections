import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, User, UserRole } from '@/hooks/useAuth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  infoMessage: string | null;
  selectedRole: UserRole;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, phone: string, role: UserRole, faceId?: string) => Promise<boolean>;
  loginWithBiometrics: (credentialId: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setRole: (role: UserRole) => void;
  verifyVolunteer: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
