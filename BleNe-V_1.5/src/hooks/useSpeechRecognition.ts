import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognitionHookResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
}

interface UseSpeechRecognitionOptions {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
    onResult?: (result: SpeechRecognitionHookResult) => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
    transcript: string;
    isListening: boolean;
    isSupported: boolean;
    confidence: number;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    isFinal: boolean;
}

// Extend Window interface for SpeechRecognition
declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
    }
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
    const {
        continuous = true,
        interimResults = true,
        lang = 'en-US',
        onResult,
        onEnd,
        onError,
    } = options;

    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [confidence, setConfidence] = useState(0);
    const [isFinal, setIsFinal] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Check if browser supports Speech Recognition
    const SpeechRecognitionAPI = typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    const isSupported = !!SpeechRecognitionAPI;
    // Initialize speech recognition
    useEffect(() => {
        if (!isSupported) {
            console.warn('Speech Recognition is not supported in this browser');
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let fullTranscript = '';
            let maxConfidence = 0;
            let isFinalResult = false;

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                fullTranscript += result[0].transcript;
                if (result.isFinal) {
                    isFinalResult = true;
                    maxConfidence = Math.max(maxConfidence, result[0].confidence);
                }
            }

            const currentTranscript = fullTranscript.trim();
            setTranscript(currentTranscript);
            setConfidence(maxConfidence);
            setIsFinal(isFinalResult);

            if (onResult) {
                onResult({
                    transcript: currentTranscript,
                    confidence: maxConfidence,
                    isFinal: isFinalResult,
                });
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);

            // Auto-restart on common temporary errors
            if (event.error === 'no-speech' || event.error === 'aborted') {
                console.log('[STT] Attempting to recover from error:', event.error);
                // We don't set isListening to false here to allow recovery
                return;
            }

            setIsListening(false);
            if (onError) {
                onError(event.error);
            }
        };

        recognition.onend = () => {
            console.log('[STT] recognition ended');
            // If it ended but we didn't explicitly call stop, and it's continuous, restart
            if (recognitionRef.current && continuous && !isFinal) {
                try {
                    console.log('[STT] Auto-restarting on end');
                    recognitionRef.current.start();
                } catch (e) {
                    console.warn('[STT] Could not auto-restart:', e);
                    setIsListening(false);
                }
            } else {
                setIsListening(false);
            }

            if (onEnd) {
                onEnd();
            }
        };

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [isSupported, continuous, interimResults, lang, onResult, onEnd, onError]);

    const startListening = useCallback(() => {
        if (!isSupported) {
            console.warn('Speech Recognition is not supported');
            return;
        }

        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
                console.log('[STT] Started listening');
            } catch (error) {
                console.error('[STT] Error starting recognition:', error);
            }
        }
    }, [isSupported, isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            console.log('[STT] Stopped listening');
        }
    }, [isListening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setConfidence(0);
        setIsFinal(false);
    }, []);

    return {
        transcript,
        isListening,
        isSupported,
        confidence,
        startListening,
        stopListening,
        resetTranscript,
        isFinal,
    };
}
