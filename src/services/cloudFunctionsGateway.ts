import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, app } from '../firebase';
import { useStore } from '../store/useStore';

// Singleton instance wrapper for Serverless Cloud Functions Gateway
export class CloudFunctionsGateway {
  /**
   * Helper to fetch or emulate Serverless endpoints based on environment and local simulation settings.
   * Leverages exponential backoff retries and latency measuring to prove resilience.
   */
  private static async executeWithResilience<T>(
    endpointName: string,
    payload: any
  ): Promise<T> {
    const store = useStore.getState();
    const simulateOffline = store.simulateOffline;
    const simulateLatencyMs = store.simulateLatencyMs || 0;
    const simulateTokenCollision = store.simulateTokenCollision;

    if (simulateOffline) {
      console.warn(`[Gateway Sandbox] Simulating Client-Server Connection Loss for: ${endpointName}`);
      throw new Error(`Coupure réseau simulée par l'athlète (ERR_INTERNET_DISCONNECTED)`);
    }

    if (simulateLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
    }

    if (simulateTokenCollision) {
      console.error("[Security Audit] Simulating Firebase Auth Session Collision / Unauthorized state!");
      throw new Error(`Firebase Auth Conflict Exception: JWT validation failed. Access denied (401 Unauthorized)`);
    }

    const startTime = performance.now();
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const functions = getFunctions(app, 'us-central1'); // use default v2 region
        const callableFunction = httpsCallable(functions, endpointName);
        
        const result = await callableFunction(payload);
        
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        useStore.setState({ lastNetworkLatencyMs: latency });

        return result.data as T;
      } catch (err: any) {
        attempt++;
        lastError = err;
        console.warn(`[Gateway Retry] Attempt ${attempt}/${maxRetries} failed for ${endpointName}: ${err.message}`);
        
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 150));
        }
      }
    }

    throw lastError || new Error(`Network failure calling ${endpointName} after ${maxRetries} retries`);
  }

  public static async verifyBarcode(barcode: string): Promise<any> {
    return this.executeWithResilience<any>(
      'lookupOpenFoodFacts',
      { barcode }
    );
  }

  public static async generateAiInsights(
    feature: 'recipe' | 'voice' | 'label_ocr' | 'meal_photo' | 'health_report',
    payload: any
  ): Promise<any> {
    let functionName = '';
    
    switch (feature) {
      case 'recipe':
        functionName = 'parseRecipeText';
        break;
      case 'voice':
        functionName = 'parseVoiceForm';
        break;
      case 'label_ocr':
        functionName = 'extractNutritionLabel';
        break;
      case 'meal_photo':
        functionName = 'analyzeMealPhoto';
        break;
      default:
        throw new Error(`Fonctionnalité d'intelligence artificielle non reconnue : ${feature}`);
    }

    return this.executeWithResilience<any>(
      functionName,
      payload
    );
  }
}
