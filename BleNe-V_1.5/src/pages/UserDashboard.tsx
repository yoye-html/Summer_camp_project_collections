
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, MapPin, LogOut, Loader2, Send, Eye, ShieldCheck, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AccessibleButton } from '@/components/AccessibleButton';
import { VoiceFeedback } from '@/components/VoiceFeedback';
import { SkipLink } from '@/components/SkipLink';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSpeechSynthesis } from '@/hooks/useSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useGeolocation } from '@/hooks/useGeolocation';
import { detectHelpIntent, matchVoiceCommand } from '@/utils/voiceCommands';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { analytics } from '@/services/analyticsService';
import { encryptLocation, fuzzCoordinates } from '@/lib/crypto';

type RequestState = 'idle' | 'locating' | 'listening' | 'processing' | 'sent' | 'connected' | 'rating';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthContext();
  const { speak, isSupported: ttsSupported, isSpeaking } = useSpeechSynthesis();
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: sttSupported,
  } = useSpeechRecognition();
  const { requestLocation, latitude, longitude, error: locationError, isLoading: locationLoading } = useGeolocation();
  const { startRecording, stopRecording } = useAudioRecorder();

  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [helpDescription, setHelpDescription] = useState('');
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [isVoiceAssistantActive, setIsVoiceAssistantActive] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const commentSubRef = useRef<any>(null);
  const hasAnnounced = useRef(false);

  // Redirect if not authenticated (Bypass for emergency)
  useEffect(() => {
    const isEmergency = new URLSearchParams(window.location.search).get('emergency') === 'true';
    if (!isAuthenticated && !isEmergency) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Phase 1: Welcome Announcement
  useEffect(() => {
    const isEmergency = new URLSearchParams(window.location.search).get('emergency') === 'true';
    if (ttsSupported && (user || isEmergency) && !hasAnnounced.current) {
      hasAnnounced.current = true;
      const timer = setTimeout(() => {
        const welcomeName = user?.name || "Guest";
        speak(`Welcome ${welcomeName}. ${isEmergency ? 'Emergency access activated.' : ''} Tap the large button or say "Request Help" to get assistance.`);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ttsSupported, user, speak]);

  // Phase 2: Start Listening when Speech ends (Auto-listen)
  useEffect(() => {
    if (sttSupported && hasAnnounced.current && !isSpeaking && !isListening && requestState === 'idle') {
      const timer = setTimeout(() => {
        if (!isSpeaking && !isListening) {
          console.log('[Voice] Auto-starting listener after dashboard welcome');
          startListening();
        }
      }, 1000); // 1s buffer
      return () => clearTimeout(timer);
    }
  }, [sttSupported, isSpeaking, isListening, requestState, startListening]);

  // Handle voice commands with intelligent matching
  useEffect(() => {
    if (!transcript || requestState !== 'idle') return;

    // Check for help request intent
    const helpIntent = detectHelpIntent(transcript);
    if (helpIntent.isHelpRequest && helpIntent.confidence > 0.5) {
      console.log('[Voice] Help request detected:', helpIntent);
      analytics.trackVoiceMatched({
        transcript,
        matchedCategory: helpIntent.category,
        confidence: helpIntent.confidence,
      });
      resetTranscript(); // Clear immediately
      handleRequestHelp();
      return;
    }

    // Check for emergency
    const normalized = transcript.toLowerCase();
    if (normalized.includes('emergency') || normalized.includes('immediate help')) {
      console.log('[Voice] Emergency triggered via dashboard');
      analytics.track({
        event_name: 'hazard_reported',
        category: 'emergency',
        user_id: user?.id,
        role: 'visually_impaired',
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        metadata: { trigger: 'voice_emergency', transcript }
      });
      resetTranscript();
      speak('Emergency mode activated.');
      navigate('/user?emergency=true'); // Re-trigger with emergency flag
      return;
    }

    // Check for logout
    if (normalized.includes('log out') || normalized.includes('logout') || normalized.includes('sign out')) {
      console.log('[Voice] Logout triggered');
      resetTranscript();
      speak('Logging you out.');
      logout();
      return;
    }
  }, [transcript, requestState, resetTranscript, navigate, speak]);

  // Cleanup subscription
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
      if (commentSubRef.current) supabase.removeChannel(commentSubRef.current);
    };
  }, []);

  // Handle "finished" keyword and 2-minute inactivity timeout during help request description
  useEffect(() => {
    if (requestState !== 'listening') return;

    // 1. Keyword detection "finish" or "finished"
    const normalized = transcript.toLowerCase();
    if (normalized.includes('finished') || normalized.includes('finish')) {
      console.log('[Voice] "Finish" detected, submitting request');
      // Strip keywords from the description
      const cleanDescription = transcript.replace(/finished|finish/gi, '').trim() || "Help requested";
      handleStopListening(cleanDescription);
      return;
    }

    // 2. Inactivity timeout (2 minutes)
    // We use a timer that resets whenever transcript changes
    const inactivityTimer = setTimeout(() => {
      console.log('[Voice] Inactivity timeout (2m), auto-submitting request');
      handleStopListening();
    }, 120000); // 120,000ms = 2 minutes

    return () => clearTimeout(inactivityTimer);
  }, [transcript, requestState]);

  // Voice Assistant: Continuous Listening when connected
  useEffect(() => {
    if (requestState === 'connected' && isVoiceAssistantActive && transcript) {
      const lastTranscript = transcript.trim();
      if (lastTranscript.length > 10) { // Simple threshold for sending
        sendVoiceComment(lastTranscript);
        resetTranscript();
      }
    }
  }, [transcript, requestState, isVoiceAssistantActive, resetTranscript]);

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.warn('Audio play failed:', e));
  };

  const announceAndSetFeedback = useCallback((message: string) => {
    setFeedbackMessage(message);
    if (ttsSupported) {
      speak(message);
    }
  }, [ttsSupported, speak]);

  const handleRequestHelp = async () => {
    // Step 1: Request location
    setRequestState('locating');
    announceAndSetFeedback('Please allow location access. I need your location to find a nearby volunteer.');

    const position = await requestLocation();

    if (!position) {
      // Strict requirement: Fail if no location
      setRequestState('idle');
      announceAndSetFeedback('Location access is required to find a nearby volunteer. Please enable location permissions.');
      return;
    }

    announceAndSetFeedback('Location acquired. Now, please describe your problem.');


    // Step 2: Listen for description
    setRequestState('listening');
    announceAndSetFeedback('Listening... Please describe what help you need.');
    resetTranscript();
    setTimeout(() => {
      startListening();
      startRecording();
    }, 1500);
  };

  const sendVoiceComment = async (content: string) => {
    if (!currentRequestId || !user) return;
    await supabase.from('comments').insert({
      request_id: currentRequestId,
      sender_id: user.id,
      content: content,
      is_voice: true
    });
  };

  const handleStopListening = async (finalTranscript?: string) => {
    stopListening();
    const audioBlob = await stopRecording();
    const description = finalTranscript || transcript || "Voice Help requested";
    setHelpDescription(description);

    if (description.trim() || audioBlob) {
      setRequestState('processing');
      announceAndSetFeedback('Processing your request...');

      if (!user) return;

      // Convert audio blob to base64 for submission
      let audioBase64 = null;
      if (audioBlob) {
        audioBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(audioBlob);
        });
      }

      console.log('[Request] Encrypting location & sending voice request...');

      // End-to-End Cryptography for GPS Location Data
      let encryptedPayload = null;
      let coarseLocation = null;

      if (latitude && longitude) {
        try {
          // 1. Encrypt exact GPS coordinates using AES-256-GCM
          encryptedPayload = await encryptLocation({
            latitude,
            longitude,
            timestamp: Date.now()
          });

          // 2. Compute coarse/fuzzed coordinates for discovery via PostGIS
          const fuzzed = fuzzCoordinates(latitude, longitude, 300);
          coarseLocation = `POINT(${fuzzed.longitude} ${fuzzed.latitude})`;
        } catch (cryptErr) {
          console.warn('[Crypto] Location encryption error, falling back:', cryptErr);
        }
      }

      const { data, error } = await supabase
        .from('requests')
        .insert([
          {
            user_id: user.id,
            description: description,
            audio_url: audioBase64,
            location: coarseLocation || (latitude && longitude ? `POINT(${longitude} ${latitude})` : null),
            encrypted_location: encryptedPayload ? JSON.stringify(encryptedPayload) : null,
            location_iv: encryptedPayload ? encryptedPayload.iv : null,
            is_location_encrypted: !!encryptedPayload,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating request:', error);
        setRequestState('idle');
        announceAndSetFeedback('Failed to send request. Please try again.');
        return;
      }

      if (data) {
        setCurrentRequestId(data.id);
        setRequestState('sent');
        announceAndSetFeedback('Request submitted! A volunteer will connect with you shortly.');

        // Track telemetry
        analytics.trackRequestCreated({
          userId: user.id,
          latitude: latitude || undefined,
          longitude: longitude || undefined,
          descriptionLength: description.length,
          hasAudio: !!audioBlob,
        });

        // Subscribe to updates for this request
        const sub = supabase
          .channel(`request:${data.id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'requests',
            filter: `id=eq.${data.id}`
          }, async (payload) => {
            const newStatus = payload.new.status;
            const volId = payload.new.volunteer_id;

            if (newStatus === 'accepted' && volId) {
              setRequestState('connected');
              playNotificationSound();

              const { data: volData } = await supabase.from('users').select('name').eq('id', volId).single();
              const volName = volData?.name || 'A volunteer';

              announceAndSetFeedback(`Volunteer ${volName} has responded to your request and is on the way! I am now listening to your voice to send messages to them.`);
              setIsVoiceAssistantActive(true);
              startListening();

              // Subscribe to comments
              const cSub = supabase
                .channel(`comments:${data.id}`)
                .on('postgres_changes', {
                  event: 'INSERT',
                  schema: 'public',
                  table: 'comments',
                  filter: `request_id=eq.${data.id}`
                }, (p) => {
                  setComments(prev => [...prev, p.new]);
                  if (p.new.sender_id !== user.id && ttsSupported) {
                    speak(`Volunteer says: ${p.new.content}`);
                  }
                })
                .subscribe();
              commentSubRef.current = cSub;
            }
          })
          .subscribe();

        subscriptionRef.current = sub;
      }

    } else {
      announceAndSetFeedback('No description captured. Please try again.');
      setRequestState('idle');
    }
  };

  const handleNewRequest = () => {
    setRequestState('idle');
    setHelpDescription('');
    resetTranscript();
    setFeedbackMessage('');
    setCurrentRequestId(null);
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  };

  const handleRateVolunteer = () => {
    navigate('/rate', { state: { requestId: currentRequestId } });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background/80 backdrop-blur-sm">

      <div className="relative z-10 flex flex-col h-full flex-1">
        <SkipLink targetId="main-action" />

        {/* Header */}
        <header className="p-4 border-b border-border flex items-center justify-between bg-transparent">
          <div>
            <h1 className="text-accessible-lg font-bold text-foreground flex items-center gap-2">
              <Eye className="w-8 h-8 text-primary" aria-hidden="true" />
              Hi, {user?.name || 'User'}
            </h1>
            <div className="flex items-center gap-2 ml-10 mt-0.5">
              <p className="text-muted-foreground text-sm">BleNe Assistance</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
                <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                AES-256 E2EE GPS
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-3 rounded-xl hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring"
            aria-label="Sign out"
          >
            <LogOut className="w-6 h-6" aria-hidden="true" />
          </button>
        </header>

        {/* Main Content */}
        <main
          id="main-action"
          className="flex-1 flex flex-col items-center justify-center p-6"
          role="main"
        >
          {/* Feedback Area */}
          {feedbackMessage && (
            <div className="w-full max-w-md mb-8 animate-fade-in">
              <VoiceFeedback message={feedbackMessage} autoSpeak={false} />
            </div>
          )}

          {/* Main Action Button */}
          {requestState === 'idle' && (
            <div className="flex flex-col items-center gap-6">
              <AccessibleButton
                variant="mega"
                onClick={handleRequestHelp}
                ariaLabel="Tap or say 'Request Help' to get assistance"
              >
                <Mic className="w-16 h-16" aria-hidden="true" />
                <span className="text-center leading-tight">
                  Tap or Say
                  <br />
                  "Request Help"
                </span>
              </AccessibleButton>

              {!sttSupported && (
                <p className="text-muted-foreground text-base text-center">
                  Voice recognition not supported. Tap button to describe your need.
                </p>
              )}
            </div>
          )}

          {/* Locating State */}
          {requestState === 'locating' && (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <div className="p-8 bg-secondary rounded-full">
                <MapPin className="w-16 h-16 text-primary animate-pulse" />
              </div>
              <p className="text-accessible-lg text-center">Getting your location...</p>
            </div>
          )}

          {/* Listening State */}
          {requestState === 'listening' && (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <AccessibleButton
                variant="mega"
                onClick={() => handleStopListening()}
                isListening={true}
                ariaLabel="Tap to stop listening and send request"
              >
                <MicOff className="w-16 h-16" aria-hidden="true" />
                <span className="text-center leading-tight">
                  Tap to Send
                  <br />
                  Request
                </span>
              </AccessibleButton>

              {transcript && (
                <div className="w-full max-w-md p-4 bg-secondary rounded-xl">
                  <p className="text-muted-foreground text-sm mb-1">Your request:</p>
                  <p className="text-accessible text-foreground">{transcript}</p>
                </div>
              )}
            </div>
          )}

          {/* Processing State */}
          {requestState === 'processing' && (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <div className="p-8 bg-secondary rounded-full">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              </div>
              <p className="text-accessible-lg text-center">Sending your request...</p>
            </div>
          )}

          {/* Request Sent State */}
          {requestState === 'sent' && (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <div className="p-8 bg-success/20 rounded-full">
                <Send className="w-16 h-16 text-success" />
              </div>
              <p className="text-accessible-lg text-center text-success font-bold">
                Request Sent!
              </p>
              <p className="text-accessible text-center text-muted-foreground">
                Waiting for a volunteer to accept...
              </p>
            </div>
          )}

          {/* Connected State */}
          {requestState === 'connected' && (
            <div className="flex flex-col items-center gap-6 w-full max-w-md animate-fade-in">
              <div className="card-accessible w-full text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-success/20 rounded-full flex items-center justify-center relative">
                  <span className="text-3xl animate-bounce">🤝</span>
                  {isVoiceAssistantActive && (
                    <div className="absolute -top-2 -right-2 bg-primary p-2 rounded-full animate-pulse shadow-lg">
                      <Mic className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h2 className="text-accessible-xl font-bold text-foreground mb-2">
                  Connected!
                </h2>
                <p className="text-accessible text-muted-foreground mb-6">
                  {isVoiceAssistantActive ? 'Voice Assistant Active: Just speak to message the volunteer.' : 'A volunteer is on their way.'}
                </p>

                {/* Live Comments for accessibility/debugger */}
                <div className="space-y-3 mb-6 max-h-40 overflow-auto px-2">
                  {comments.slice(-3).map((c, i) => (
                    <div key={i} className={`p-3 rounded-xl text-sm ${c.sender_id === user?.id ? 'bg-primary/10 border border-primary/20 text-right' : 'bg-secondary text-left'}`}>
                      <p className="font-bold text-[10px] uppercase opacity-50 mb-1">{c.sender_id === user?.id ? 'You' : 'Volunteer'}</p>
                      <p className="text-base">{c.content}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <AccessibleButton
                    variant={isVoiceAssistantActive ? "secondary" : "primary"}
                    onClick={() => {
                      setIsVoiceAssistantActive(!isVoiceAssistantActive);
                      if (!isVoiceAssistantActive) startListening();
                      else stopListening();
                    }}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {isVoiceAssistantActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    {isVoiceAssistantActive ? 'Pause Voice Assistant' : 'Resume Voice Assistant'}
                  </AccessibleButton>

                  <AccessibleButton
                    variant="success"
                    onClick={handleRateVolunteer}
                    className="w-full"
                  >
                    Rate Volunteer
                  </AccessibleButton>

                  <AccessibleButton
                    variant="secondary"
                    onClick={handleNewRequest}
                    className="w-full"
                  >
                    New Request
                  </AccessibleButton>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Location Error */}
        {locationError && (
          <div
            role="alert"
            className="fixed bottom-4 left-4 right-4 p-4 bg-destructive text-destructive-foreground rounded-xl animate-slide-up"
          >
            <p className="font-bold">Location Error</p>
            <p className="text-sm">{locationError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
