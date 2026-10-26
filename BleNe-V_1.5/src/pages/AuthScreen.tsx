import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ShieldCheck, Mail, Siren, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/useSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuthContext } from '@/contexts/AuthContext';
import { AccessibleInput } from '@/components/AccessibleInput';
import { AccessibleButton } from '@/components/AccessibleButton';
import { SkipLink } from '@/components/SkipLink';

type AuthMode = 'login' | 'register' | 'emergency';

export default function AuthScreen() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const initialMode = (searchParams.get('mode') as AuthMode) || 'login';

  const { login, register, selectedRole, isLoading, isInitializing, error, infoMessage, clearError, isAuthenticated, user } = useAuthContext();
  const { speak, isSupported: ttsSupported, isSpeaking } = useSpeechSynthesis();
  const { transcript, isListening, startListening, stopListening } = useSpeechRecognition();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const [faceId, setFaceId] = useState<string | undefined>(undefined);

  const [showPassword, setShowPassword] = useState(false);

  const isVolunteer = selectedRole === 'volunteer';
  const roleLabel = isVolunteer ? 'Volunteer' : 'Visually Impaired User';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'volunteer') {
        navigate(user.status === 'pending' ? '/pending' : '/volunteer-dashboard');
      } else {
        navigate('/user');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Redirect if no role selected
  useEffect(() => {
    if (!selectedRole) {
      navigate('/');
    }
  }, [selectedRole, navigate]);

  // Announce mode changes
  useEffect(() => {
    if (ttsSupported) {
      const modeLabel = mode === 'login' ? 'Login' : mode === 'register' ? 'Registration' : 'Emergency Access';
      speak(`${modeLabel} form for ${roleLabel}`);
    }
  }, [mode, roleLabel, ttsSupported, speak]);

  // Handle voice commands on auth screen
  useEffect(() => {
    if (!transcript) return;
    const normalized = transcript.toLowerCase();
    if (normalized.includes('emergency') || normalized.includes('immediate help')) {
      if (!isVolunteer) setMode('emergency');
    }
  }, [transcript, isVolunteer]);

  // Auto-listen for visually impaired users on mount
  useEffect(() => {
    if (!isVolunteer && ttsSupported && !isListening) {
      const timer = setTimeout(() => {
        if (!isListening && !isSpeaking) {
          startListening();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVolunteer, ttsSupported, isListening, startListening, isSpeaking]);

  // Announce errors and info messages
  useEffect(() => {
    if (error && ttsSupported) {
      speak(`Error: ${error}`);
    }
    if (infoMessage && ttsSupported) {
      speak(infoMessage);
    }
  }, [error, infoMessage, ttsSupported, speak]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    let success = false;
    if (mode === 'login') {
      success = await login(email, password);
    } else {
      success = await register(email, password, name, phone, selectedRole, faceId);
    }

    if (success) {
      if (ttsSupported) {
        if (isVolunteer && mode === 'register') {
          speak("Please wait for admin's approval and log in with these credentials later");
        } else {
          speak(mode === 'login'
            ? 'Login successful. Redirecting to your dashboard.'
            : 'Registration successful. Redirecting to your dashboard.');
        }
      }
    }
  };

  const { enroll } = useBiometricAuth();

  const handleRegisterFace = async () => {
    setIsRegisteringFace(true);
    if (ttsSupported) speak("Position your face in front of the camera for registration.");

    try {
      const result = await enroll(email || "unknown_user");
      if (result.success && result.credentialId) {
        setFaceRegistered(true);
        setFaceId(result.credentialId);
        if (ttsSupported) speak("Face registered successfully.");
      } else {
        if (ttsSupported) speak("Registration failed. Please try again.");
      }
    } catch (err) {
      console.error("Face registration error:", err);
      if (ttsSupported) speak("An error occurred during registration.");
    } finally {
      setIsRegisteringFace(false);
    }
  };

  const handleEmergencyAccess = async () => {
    if (ttsSupported) speak("Initiating emergency access. Granting service access.");
    // In a real app, this would create an anonymous session or use a quick biometric
    // For now, we simulate success and redirect to VI dashboard
    navigate('/user?emergency=true');
  };

  const toggleMode = () => {
    clearError();
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: "url('/wallpaper.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-0" />

      <div className="relative z-10 flex flex-col flex-1">
        <SkipLink targetId="auth-form" />

        {/* Header */}
        <header className="p-4 border-b border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-3 rounded-xl hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring"
              aria-label="Go back to role selection"
            >
              <ArrowLeft className="w-6 h-6" aria-hidden="true" />
            </button>
            <h1 className="text-accessible-lg font-bold text-foreground">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h1>
          </div>
          <p className="mt-2 ml-14 text-muted-foreground text-base">
            {roleLabel}
          </p>
        </header>

        {/* Main Form Area with Tabs */}
        <main id="auth-form" className="flex-1 p-6 max-w-lg mx-auto w-full" role="main">
          <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 mb-8 bg-background/50 backdrop-blur-md">
              <TabsTrigger value="login" className="text-base py-3">Login</TabsTrigger>
              <TabsTrigger value="register" className="text-base py-3">Signup</TabsTrigger>
              {!isVolunteer && (
                <TabsTrigger value="emergency" className="text-base py-3 text-red-500 font-bold gap-2">
                  <Siren className="w-4 h-4" />
                  Emergency
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="emergency" className="space-y-6">
              <div className="bg-red-500/10 border-2 border-red-500/20 p-6 rounded-2xl text-center">
                <Siren className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
                <h2 className="text-2xl font-bold text-red-500 mb-2">Emergency Access</h2>
                <p className="text-foreground/80 mb-6">
                  Quick access for immediate assistance. This will bypass regular login to get you help faster.
                </p>
                <AccessibleButton
                  variant="primary"
                  onClick={handleEmergencyAccess}
                  className="w-full py-6 bg-red-600 hover:bg-red-700 h-auto"
                >
                  <span className="text-xl font-bold">ACTIVATE EMERGENCY HELP</span>
                </AccessibleButton>
              </div>
            </TabsContent>

            <TabsContent value="login" className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <AccessibleInput
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
                <AccessibleInput
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />

                {infoMessage === "Please confirm your email by checking the mail we sent and tapping the link provided" && (
                  <div className="p-4 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl text-blue-600 flex items-start gap-3">
                    <Mail className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="font-medium">{infoMessage}</p>
                  </div>
                )}

                <AccessibleButton type="submit" variant="primary" disabled={isLoading} className="w-full py-4">
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Sign In"}
                </AccessibleButton>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <AccessibleInput
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
                <AccessibleInput
                  label="Phone Number"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone"
                  required
                />
                <AccessibleInput
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
                <AccessibleInput
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 chars"
                  required
                />

                {!isVolunteer && (
                  <div className="space-y-4 pt-2">
                    <div className={`p-4 rounded-xl border-2 flex flex-col gap-3 ${faceRegistered ? 'bg-green-500/10 border-green-500' : 'bg-primary/5 border-primary/20'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${faceRegistered ? 'bg-green-500 text-white' : 'bg-primary/20 text-primary'}`}>
                          {faceRegistered ? <ShieldCheck className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">Face Recognition Registration</p>
                          <p className="text-sm text-muted-foreground">{faceRegistered ? 'Face ID secured' : 'Required for quick voice access'}</p>
                        </div>
                      </div>

                      {!faceRegistered && (
                        <AccessibleButton
                          type="button"
                          variant="secondary"
                          onClick={handleRegisterFace}
                          disabled={isRegisteringFace}
                          className="w-full bg-white/50"
                        >
                          {isRegisteringFace ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Start Face Scan"}
                        </AccessibleButton>
                      )}
                    </div>
                  </div>
                )}

                {isVolunteer && (
                  <div className="p-4 bg-indigo-500/10 border-2 border-indigo-500/30 rounded-xl text-indigo-700 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">Please wait for admin's approval and log in with these credentials later after signing up.</p>
                  </div>
                )}

                <AccessibleButton
                  type="submit"
                  variant="primary"
                  disabled={isLoading || (!isVolunteer && !faceRegistered)}
                  className="w-full py-4"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Create Account"}
                </AccessibleButton>
              </form>
            </TabsContent>
          </Tabs>

          {(error || (isAuthenticated && user?.status === 'pending')) && (
            <div className={`mt-6 p-4 rounded-xl border-2 flex items-start gap-3 ${user?.status === 'pending' ? 'bg-amber-500/10 border-amber-500 text-amber-600' : 'bg-destructive/10 border-destructive text-destructive'
              }`}>
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="font-medium">
                {user?.status === 'pending' ? "Account pending approval. Please wait for admin's confirmation." : error}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
