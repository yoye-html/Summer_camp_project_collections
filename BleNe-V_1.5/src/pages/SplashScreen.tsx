import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Heart, Fingerprint, Mic } from 'lucide-react';
import { AccessibleButton } from '@/components/AccessibleButton';
import { SkipLink } from '@/components/SkipLink';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSpeechSynthesis } from '@/hooks/useSpeech';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { matchVoiceCommand } from '@/utils/voiceCommands';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HERO_IMAGES = [
  '/images/hero/hero-1.png',
  '/images/hero/hero-2.png',
  '/images/hero/hero-3.png',
  '/images/hero/hero-4.png',
  '/images/hero/hero-5.png',
  '/images/hero/hero-6.png',
];

function HeroSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000); // cycle every 5 seconds

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/70 z-10" />

      {HERO_IMAGES.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'
            }`}
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export default function SplashScreen() {
  const navigate = useNavigate();
  const { setRole, isAuthenticated, user, loginWithBiometrics } = useAuthContext();
  const { speak, isSupported: ttsSupported, isSpeaking } = useSpeechSynthesis();
  const { authenticate: biometricAuth, isSupported: biometricSupported, checkEnrollment } = useBiometricAuth();
  const { transcript, isListening, startListening, stopListening, resetTranscript, isSupported: sttSupported } = useSpeechRecognition();

  const [attemptingBiometric, setAttemptingBiometric] = useState(false);
  const [showVoiceFallback, setShowVoiceFallback] = useState(false);
  const isProcessingCommand = useRef(false);
  const hasAnnounced = useRef(false);

  // Auto-navigate if already fully authenticated
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(user.role === 'volunteer' ? '/volunteer-dashboard' : '/user');
    }
  }, [isAuthenticated, user, navigate]);

  // Try biometric quick access for returning visually impaired users
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const attemptQuickAuth = async () => {
      try {
        // Check if user is enrolled and was previously visually impaired (check localStorage)
        const storedRole = localStorage.getItem('user_role');
        const isVisuallyImpairedRef = storedRole === 'visually_impaired';
        const isEnrolled = await checkEnrollment();

        // If NOT authenticated but IS enrolled and IS visually impaired -> Attempt Quick Auth
        // (If they are already authenticated, the effect above handles redirect)
        if (!isAuthenticated && isVisuallyImpairedRef && biometricSupported && isEnrolled) {
          if (!isMounted) return;
          setAttemptingBiometric(true);

          if (ttsSupported) {
            speak('Authenticating with face recognition for quick access.');
          }

          const result = await biometricAuth();

          if (result.success && result.credentialId) {
            // Success! Log them in via mock biometric login
            try {
              const loginSuccess = await loginWithBiometrics(result.credentialId);

              if (loginSuccess) {
                setAttemptingBiometric(false);
                if (ttsSupported) {
                  speak('Authentication successful. Welcome back!');
                }
                navigate('/user');
              } else {
                console.warn('[BiometricAuth] Login failed after successful biometric auth');
                if (ttsSupported) {
                  speak('Login verification failed. Please try voice authentication.');
                }
                setAttemptingBiometric(false);
                setShowVoiceFallback(true);
              }
            } catch (loginError) {
              console.error('[BiometricAuth] Login error:', loginError);
              if (ttsSupported) {
                speak('Login failed. Please try again or use the login screen.');
              }
              setAttemptingBiometric(false);
              setShowVoiceFallback(true);
            }
          } else {
            // Biometric failed - offer voice fallback
            setAttemptingBiometric(false);

            if (ttsSupported) {
              speak('Biometric authentication failed. Please say "I am visually impaired" to login, or "Emergency access" for immediate help.');
            }
            setShowVoiceFallback(true);

            // Auto-start voice listening after a short delay
            timeoutId = setTimeout(() => {
              if (!isMounted) return;
              if (sttSupported) {
                startListening();
              }
            }, 2000);
          }
        }
      } catch (error) {
        console.error('[BiometricAuth] Quick auth failed:', error);
        if (isMounted) {
          setAttemptingBiometric(false);
        }
      }
    };

    // Only attempt once on mount
    if (!attemptingBiometric && !showVoiceFallback) {
      attemptQuickAuth();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // Ensure this effect only runs once on mount
  }, []);
  // Handle voice fallback commands
  useEffect(() => {
    const handleVoiceCommands = async () => {
      // Listen for commands if transcript is present, regardless of showVoiceFallback
      if (!transcript || isProcessingCommand.current) return;

      const normalizedTranscript = transcript.toLowerCase();

      // Robust matching for visually impaired role
      const impairedPhrases = [
        'visually impaired',
        'visually impaird',
        'blind',
        'blind user',
        'impaired user',
        'i am visually impaired',
        'i am blind'
      ];

      const isImpairedMatch = impairedPhrases.some(phrase => normalizedTranscript.includes(phrase)) ||
        matchVoiceCommand(transcript, 'dashboard', 0.6).matched;

      const isEmergencyMatch = normalizedTranscript.includes('emergency') ||
        normalizedTranscript.includes('immediate help') ||
        normalizedTranscript.includes('emergency access');

      if (isImpairedMatch) {
        console.log('[Voice] Visually impaired login triggered');
        isProcessingCommand.current = true;
        resetTranscript();

        if (ttsSupported) {
          speak('Voice command recognized. Attempting face recognition scan.');
        }
        stopListening();

        // Re-attempt biometric instead of just redirecting
        const result = await biometricAuth();
        if (result.success && result.credentialId) {
          const loginSuccess = await loginWithBiometrics(result.credentialId);
          if (loginSuccess) {
            if (ttsSupported) speak('Authentication successful. Welcome back!');
            navigate('/user');
            return;
          }
        }

        // If biometric fails or not enrolled, go to auth page
        if (ttsSupported) speak('Face recognition not available. Opening login screen.');
        handleRoleSelect('visually_impaired');
        // Command end - state will change via navigation, but for safety:
        isProcessingCommand.current = false;
      } else if (isEmergencyMatch) {
        console.log('[Voice] Emergency access triggered');
        isProcessingCommand.current = true;
        resetTranscript();

        if (ttsSupported) {
          speak('Emergency access initiated. Redirecting.');
        }
        stopListening();
        navigate('/auth?mode=emergency');
      }
    };

    handleVoiceCommands();
  }, [transcript, ttsSupported, speak, stopListening, navigate, resetTranscript, biometricAuth, loginWithBiometrics]);

  // Phase 1: Welcome Announcement
  useEffect(() => {
    if (ttsSupported && !attemptingBiometric && !hasAnnounced.current) {
      hasAnnounced.current = true;
      const timer = setTimeout(() => {
        speak('Welcome to BleNe. Disability is reality for me but possibility for you. Please select your role: I am Visually Impaired, or I am a Volunteer. You can also say I am visually impaired for shortcut access.');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ttsSupported, speak, attemptingBiometric]);

  // Phase 2: Start Listening when Speech ends
  useEffect(() => {
    if (sttSupported && hasAnnounced.current && !isSpeaking && !isListening && !attemptingBiometric && !isProcessingCommand.current) {
      const timer = setTimeout(() => {
        if (!isSpeaking && !isListening) {
          console.log('[Voice] Auto-starting listener after announcement');
          startListening();
        }
      }, 1000); // 1s buffer
      return () => clearTimeout(timer);
    }
  }, [sttSupported, isSpeaking, isListening, attemptingBiometric, startListening]);

  const handleRoleSelect = (role: 'visually_impaired' | 'volunteer') => {
    // Stop any active voice listening
    if (isListening) {
      stopListening();
    }
    setRole(role);
    navigate('/auth');
  };

  const handleVoiceFallbackCancel = () => {
    stopListening();
    resetTranscript();
    setShowVoiceFallback(false);
  };

  if (attemptingBiometric) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <HeroSlideshow />
        <div className="relative z-10 flex flex-col items-center">
          <Fingerprint className="w-24 h-24 text-primary-foreground animate-pulse mb-6" />
          <p className="text-accessible-xl text-primary-foreground mb-4">Authenticating...</p>
          <p className="text-accessible text-primary-foreground/70">Please verify your identity</p>
        </div>
      </div>
    );
  }

  if (showVoiceFallback) {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <HeroSlideshow />
        <div className="relative z-10 flex flex-col items-center w-full max-w-md">
          <Mic className={`w-24 h-24 text-primary-foreground mb-6 ${isListening ? 'animate-pulse' : ''}`} />
          <p className="text-accessible-xl text-primary-foreground mb-4">
            {isListening ? 'Listening...' : 'Voice Authentication'}
          </p>
          <p className="text-accessible text-primary-foreground/90 mb-8 text-center max-w-md">
            Say "I am visually impaired" or "open dashboard" to continue
          </p>

          {transcript && (
            <div className="bg-primary-foreground/10 p-4 rounded-xl mb-6 max-w-md">
              <p className="text-primary-foreground text-sm">
                You said: "{transcript}"
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <AccessibleButton
              variant="secondary"
              onClick={handleVoiceFallbackCancel}
            >
              Use Login Screen
            </AccessibleButton>

            {!isListening && (
              <AccessibleButton
                variant="primary"
                onClick={startListening}
              >
                Try Again
              </AccessibleButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col relative overflow-hidden">
      <HeroSlideshow />
      <div className="absolute top-4 right-4 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-2">
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">About</span>
            </Button >
          </DialogTrigger >
          <DialogContent className="bg-white/95 backdrop-blur-xl border-white/20 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-primary">About BleNe</DialogTitle>
              <DialogDescription className="text-base leading-relaxed pt-4 text-foreground/80 overflow-y-auto max-h-[60vh] text-left">
                <p className="mb-4">
                  This app is idealized and developed by <span className="font-semibold text-primary">Yenesew Zenebe</span>, student at AAU, inspired by an inclusiveness project to provide a solution for impaired persons. It came to life as a project idea from <span className="font-semibold">Team O</span> with the wholehearted purpose of serving society.
                </p>

                <p className="mb-4 font-medium text-primary/90 italic">
                  "Connecting kind helping hands with those in need."
                </p>
                <p className="mb-6">
                  BleNe(An amharic word ብሌኔ figuratively means "my eye") serves as a compassionate bridge, enabling visually impaired individuals to connect with volunteers for real-time assistance. It is built on the belief that we can light up each other's worlds through simple acts of kindness.
                </p>

                <div className="space-y-3 text-sm border-t border-gray-200 pt-4 bg-gray-50/50 -mx-6 px-6 -mb-6 pb-6 rounded-b-lg">
                  <p className="font-bold text-primary mb-2">Acknowledgments</p>
                  <li><span className="font-semibold text-foreground/90">Meki</span> for her relentless support and troubleshooting.</li>
                  <p>Special thanks to my dormmates:</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-foreground/70">
                    <li><span className="font-semibold text-foreground/90">Dave</span> for his supportive technical guidance.</li>
                    <li><span className="font-semibold text-foreground/90">Yeroson and Sami</span> for being dedicated volunteer testers.</li>
                    <li><span className="font-semibold text-foreground/90">Admas, Temesgen, and Tesfa</span> for their relentless moral support.</li>
                  </ul>
                  <p className="mt-3 text-xs text-foreground/60">
                    And to <span className="font-semibold">Team O</span> members for accepting the idea and participating in its realization.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog >
      </div >

      <SkipLink targetId="main-content" />

      <main
        id="main-content"
        className="flex-1 flex flex-col items-center justify-between p-6 text-center relative z-10"
        role="main"
        aria-labelledby="app-title"
      >
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Logo & Title Container */}
          <div className="flex flex-row items-center gap-6 mb-8 transform hover:scale-105 transition-transform duration-300">
            {/* App Logo */}
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-2xl">
              <img
                src="/icon_193.png"
                alt="BleNe Logo"
                className="w-20 h-20 object-contain drop-shadow-lg"
              />
            </div>

            {/* App Title */}
            <h1
              id="app-title"
              className="text-accessible-hero text-primary-foreground drop-shadow-lg text-left"
            >
              BleNe
              <span className="block text-2xl mt-1 font-normal opacity-90">(ብሌኔ)</span>
            </h1>
          </div>

          {/* Motto */}
          <blockquote
            className="text-accessible-xl text-primary-foreground/90 max-w-xl mx-auto leading-relaxed drop-shadow-md font-medium"
            aria-label="Our motto"
          >
            "Disability is reality for me but possibility for you"
          </blockquote>
        </div>

        <div className="w-full flex flex-col items-center gap-8 mb-4">
          {/* Emergency Access Button */}
          <div className="w-full max-w-4xl px-4">
            <AccessibleButton
              variant="primary"
              onClick={() => {
                setRole('visually_impaired');
                navigate('/auth?mode=emergency');
              }}
              className="w-full py-6 bg-red-600 hover:bg-red-700 text-white shadow-2xl border-2 border-white/20 transform transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
              ariaLabel="Emergency Access - Immediate help without full login"
            >
              <div className="bg-white/20 p-2 rounded-full">
                <div className="w-4 h-4 bg-white rounded-full animate-ping" />
              </div>
              <span className="text-xl font-bold tracking-wide">EMERGENCY ACCESS</span>
            </AccessibleButton>
          </div>

          {/* Role Selection Buttons */}
          <div className="w-full max-w-4xl flex flex-col sm:flex-row gap-6 px-4">
            <h2 className="sr-only">Select your role</h2>

            <AccessibleButton
              variant="secondary"
              onClick={() => handleRoleSelect('visually_impaired')}
              className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 py-6 sm:py-4 bg-white/10 hover:bg-white/20 text-primary-foreground border border-white/30 shadow-xl backdrop-blur-md transform transition-transform hover:scale-105"
              ariaLabel="I am Visually Impaired - Select this if you need assistance"
            >
              <Eye className="w-8 h-8" aria-hidden="true" />
              <span className="text-lg font-semibold">I'm Visually Impaired</span>
            </AccessibleButton>

            <AccessibleButton
              variant="secondary"
              onClick={() => handleRoleSelect('volunteer')}
              className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 py-6 sm:py-4 bg-white/10 hover:bg-white/20 text-primary-foreground border border-white/30 shadow-xl backdrop-blur-md transform transition-transform hover:scale-105"
              ariaLabel="I am a Volunteer - Select this if you want to help others"
            >
              <Heart className="w-8 h-8" aria-hidden="true" />
              <span className="text-lg font-semibold">I'm a Volunteer</span>
            </AccessibleButton>
          </div>

          {/* Association Credit */}
          <footer className="text-primary-foreground/80 text-sm sm:text-base font-medium drop-shadow-md">
            <p>Ethiopian National Association of the Blind</p>
            <p className="mt-1 text-xs sm:text-sm opacity-80">POWERED BY YEnESolutions</p>
          </footer>
        </div>
      </main>
    </div >
  );
}
