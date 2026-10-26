import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderHook {
    isRecording: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
    audioBlob: Blob | null;
    audioUrl: string | null;
    resetRecording: () => void;
}

export function useAudioRecorder(): AudioRecorderHook {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                // Stop all tracks to release the microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            console.log('[AudioRecorder] Started recording');
        } catch (error) {
            console.error('[AudioRecorder] Error starting recording:', error);
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    setAudioBlob(blob);
                    const url = URL.createObjectURL(blob);
                    setAudioUrl(url);

                    // Stop tracks
                    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

                    setIsRecording(false);
                    console.log('[AudioRecorder] Stopped recording');
                    resolve(blob);
                };
                mediaRecorderRef.current.stop();
            } else {
                resolve(null);
            }
        });
    }, [isRecording]);

    const resetRecording = useCallback(() => {
        setAudioBlob(null);
        setAudioUrl(null);
        audioChunksRef.current = [];
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        audioBlob,
        audioUrl,
        resetRecording,
    };
}
