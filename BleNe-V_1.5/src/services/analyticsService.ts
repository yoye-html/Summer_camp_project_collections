import { supabase } from '@/lib/supabase';

export interface AnalyticsEvent {
  event_name: 
    | 'request_created' 
    | 'request_accepted' 
    | 'request_completed' 
    | 'request_cancelled' 
    | 'voice_matched' 
    | 'voice_fallback' 
    | 'biometric_attempt' 
    | 'response_latency' 
    | 'hazard_reported';
  category?: 'roadCrossing' | 'reading' | 'navigation' | 'identification' | 'emergency' | 'general';
  user_id?: string;
  role?: 'visually_impaired' | 'volunteer' | 'admin' | 'system' | 'anonymous';
  district?: string;
  latitude?: number;
  longitude?: number;
  duration_seconds?: number;
  metadata?: Record<string, any>;
}

// Map coordinates to approximate Addis Ababa districts if nearby
export function inferDistrictFromCoords(lat?: number, lng?: number): string {
  if (!lat || !lng) return 'General / Unknown';

  // Addis Ababa sub-city bounding boxes (approximations for telemetry)
  if (lat >= 9.02 && lat <= 9.05 && lng >= 38.74 && lng <= 38.77) return 'Piazza / Arada';
  if (lat >= 8.98 && lat <= 9.02 && lng >= 38.77 && lng <= 38.81) return 'Bole';
  if (lat >= 9.00 && lat <= 9.03 && lng >= 38.73 && lng <= 38.76) return 'Kirkos / Mexico';
  if (lat >= 9.00 && lat <= 9.03 && lng >= 38.70 && lng <= 38.73) return 'Lideta';
  if (lat >= 9.03 && lat <= 9.06 && lng >= 38.78 && lng <= 38.83) return 'Yeka';
  if (lat >= 9.02 && lat <= 9.05 && lng >= 38.71 && lng <= 38.74) return 'Addis Ketema';
  
  return 'Greater Addis Ababa';
}

class AnalyticsService {
  private eventQueue: AnalyticsEvent[] = [];
  private isProcessing = false;

  public async track(event: AnalyticsEvent): Promise<void> {
    try {
      // Auto-infer district if coords available
      const district = event.district || inferDistrictFromCoords(event.latitude, event.longitude);

      const payload = {
        ...event,
        district,
        created_at: new Date().toISOString(),
      };

      // Attempt sending to Supabase
      const { error } = await supabase.from('analytics_events').insert([payload]);

      if (error) {
        // If table doesn't exist yet or network issue, buffer or log quietly
        console.warn('[Analytics] Telemetry event queued/failed to persist:', error.message);
      }
    } catch (err) {
      console.warn('[Analytics] Failed to track event:', err);
    }
  }

  // Pre-configured telemetry helpers
  public trackRequestCreated(params: {
    userId: string;
    category?: 'roadCrossing' | 'reading' | 'navigation' | 'identification' | 'emergency' | 'general';
    latitude?: number;
    longitude?: number;
    descriptionLength?: number;
    hasAudio?: boolean;
  }) {
    return this.track({
      event_name: 'request_created',
      user_id: params.userId,
      role: 'visually_impaired',
      category: params.category || 'general',
      latitude: params.latitude,
      longitude: params.longitude,
      metadata: {
        descriptionLength: params.descriptionLength,
        hasAudio: params.hasAudio,
      },
    });
  }

  public trackRequestAccepted(params: {
    requestId: string;
    volunteerId: string;
    waitTimeSeconds: number;
    latitude?: number;
    longitude?: number;
  }) {
    return this.track({
      event_name: 'request_accepted',
      user_id: params.volunteerId,
      role: 'volunteer',
      duration_seconds: params.waitTimeSeconds,
      latitude: params.latitude,
      longitude: params.longitude,
      metadata: { requestId: params.requestId },
    });
  }

  public trackRequestCompleted(params: {
    requestId: string;
    volunteerId: string;
    serviceDurationSeconds: number;
  }) {
    return this.track({
      event_name: 'request_completed',
      user_id: params.volunteerId,
      role: 'volunteer',
      duration_seconds: params.serviceDurationSeconds,
      metadata: { requestId: params.requestId },
    });
  }

  public trackVoiceMatched(params: {
    transcript: string;
    matchedCategory?: string;
    confidence: number;
  }) {
    return this.track({
      event_name: 'voice_matched',
      role: 'visually_impaired',
      category: (params.matchedCategory as any) || 'general',
      metadata: {
        transcript: params.transcript,
        confidence: params.confidence,
      },
    });
  }

  public trackBiometric(params: {
    userId?: string;
    success: boolean;
    method: 'face' | 'fingerprint' | 'webauthn';
  }) {
    return this.track({
      event_name: 'biometric_attempt',
      user_id: params.userId,
      role: 'visually_impaired',
      metadata: {
        success: params.success,
        method: params.method,
      },
    });
  }
}

export const analytics = new AnalyticsService();

