import React, { useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/useSpeech';

interface VoiceFeedbackProps {
  message: string;
  autoSpeak?: boolean;
  showVisual?: boolean;
}

export function VoiceFeedback({ 
  message, 
  autoSpeak = true, 
  showVisual = true 
}: VoiceFeedbackProps) {
  const { speak, isSpeaking, cancel, isSupported } = useSpeechSynthesis();

  useEffect(() => {
    if (autoSpeak && message && isSupported) {
      speak(message);
    }
    
    return () => {
      cancel();
    };
  }, [message, autoSpeak, isSupported, speak, cancel]);

  if (!showVisual) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex items-center justify-center gap-3 p-4 bg-secondary rounded-xl"
    >
      {isSpeaking ? (
        <Volume2 className="w-6 h-6 text-primary animate-pulse" aria-hidden="true" />
      ) : (
        <VolumeX className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="text-accessible text-foreground">{message}</span>
    </div>
  );
}
