import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../firebase';
import { useStore } from '../store/useStore';

// Singleton instance wrapper for Serverless Cloud Functions Gateway
export class CloudFunctionsGateway {
  /**
   * Helper to fetch or emulate Serverless endpoints based on environment and local simulation settings.
   * Leverages exponential backoff retries and latency measuring to prove resilience.
   */
  private static async executeWithResilience<T>(
    endpointName: string,
    payload: any,
    localUrl: string,
    options: { method?: string; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const store = useStore.getState();
    const simulateOffline = store.simulateOffline;
    const simulateLatencyMs = store.simulateLatencyMs || 0;
    const simulateTokenCollision = store.simulateTokenCollision;

    // 1. Simulation of Network cutouts (Client/Server loss)
    if (simulateOffline) {
      console.warn(`[Gateway Sandbox] Simulating Client-Server Connection Loss for: ${endpointName}`);
      throw new Error(`Coupure réseau simulée par l'athlète (ERR_INTERNET_DISCONNECTED)`);
    }

    // 2. Simulation of Vacancy Latency
    if (simulateLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
    }

    // 3. Simulation of Token Collisions or Invalid Sessions
    if (simulateTokenCollision) {
      console.error("[Security Audit] Simulating Firebase Auth Session Collision / Unauthorized state!");
      throw new Error(`Firebase Auth Conflict Exception: JWT validation failed. Access denied (401 Unauthorized)`);
    }

    // Measure start time for latency tracing
    const startTime = performance.now();

    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        // Authenticated request tracking
        const currentUser = auth.currentUser;
        let token: string | null = null;
        if (currentUser) {
          token = await currentUser.getIdToken(false);
        }

        // Under local emulation or sandbox web-preview, fallback gracefully to Express
        // acting as the local Gateway for Cloud Functions. For fully deployed custom configurations, 
        // standard Firebase Callable SDK is invoked.
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const fetchOptions: RequestInit = {
          method: options.method || 'POST',
          headers,
          body: options.method !== 'GET' ? JSON.stringify(payload) : undefined,
        };

        const response = await fetch(localUrl, fetchOptions);
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Erreur d'authentification ou collision de jetons: ${response.statusText} (${response.status})`);
          }
          throw new Error(`Erreur serveur (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        
        // Record latency statistics in the store for athletic auditability
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        useStore.setState({ lastNetworkLatencyMs: latency });

        return data as T;
      } catch (err: any) {
        attempt++;
        lastError = err;
        console.warn(`[Gateway Retry] Attempt ${attempt}/${maxRetries} failed for ${endpointName}: ${err.message}`);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 150));
        }
      }
    }

    throw lastError || new Error(`Network failure calling ${endpointName} after ${maxRetries} retries`);
  }

  /**
   * SPRINT 1 - 'verifyBarcode' Serverless Endpoint
   */
  public static async verifyBarcode(barcode: string): Promise<any> {
    const localUrl = `/api/openfoodfacts/barcode/${barcode}`;
    return this.executeWithResilience<any>(
      'verifyBarcode',
      null,
      localUrl,
      { method: 'GET' }
    );
  }

  /**
   * SPRINT 1 - 'generateAiInsights' Serverless Endpoint
   * Standardizes across various feature triggers (recipes, OCR, voice checks, health dashboard reports)
   */
  public static async generateAiInsights(
    feature: 'recipe' | 'voice' | 'label_ocr' | 'meal_photo' | 'health_report',
    payload: any
  ): Promise<any> {
    let localUrl = '';
    
    switch (feature) {
      case 'recipe':
        localUrl = '/api/gemini/parse-recipe';
        break;
      case 'voice':
        localUrl = '/api/gemini/parse-voice-form';
        break;
      case 'label_ocr':
        localUrl = '/api/gemini/extract-nutrition-label';
        break;
      case 'meal_photo':
        localUrl = '/api/gemini/analyze-meal-photo';
        break;
      default:
        throw new Error(`Fonctionnalité d'intelligence artificielle non reconnue : ${feature}`);
    }

    return this.executeWithResilience<any>(
      'generateAiInsights',
      payload,
      localUrl
    );
  }
}
