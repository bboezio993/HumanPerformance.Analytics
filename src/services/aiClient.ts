/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile, AnalysisResult } from "../types";
import { runAnalysisEngine } from "./analysisEngine/engine";
import { useStore } from "../store/useStore";
import { runExplainabilityLayer } from "./analysisEngine/explainabilityLayer";

/**
 * Analyse et reformule pédagogiquement les indicateurs physiologiques de l'athlète.
 * Fait appel à notre proxy serveur sécurisé pour éviter l'exposition de clés ou de librairies IA côté client.
 *
 * @param {UserProfile} profile Profil de l'athlète connecté
 * @param {any[]} recentMetrics Métriques de performance récentes (compatibilité signature)
 * @returns {Promise<AnalysisResult>} Diagnostic reformulé et indexé de readiness
 */
export async function analyzeHealthData(
  profile: UserProfile,
  recentMetrics: any[]
): Promise<AnalysisResult> {
  const storeState = useStore.getState();
  const calculatedScores = runAnalysisEngine(storeState);
  const explainability = runExplainabilityLayer(storeState);

  try {
    const response = await fetch("/api/gemini/analyze-health-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile,
        calculatedScores,
        shortSummary: explainability.shortSummary,
        pedagogicalReformulation: explainability.pedagogicalReformulation,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status} lors de l'appel proxy.`);
    }

    const data = await response.json();

    // Mappage strict des statuts déterminé par le moteur déterministe
    let mappedStatus: "optimal" | "stable" | "strained" | "critical" = "stable";
    if (calculatedScores.performanceReadiness.status === "optimal") {
       mappedStatus = "optimal";
    } else if (calculatedScores.performanceReadiness.status === "caution") {
       mappedStatus = "critical";
    } else if (calculatedScores.performanceReadiness.status === "reduced" || calculatedScores.performanceReadiness.status === "low") {
       mappedStatus = "strained";
    }

    return {
      readinessScore: calculatedScores.performanceReadiness.score,
      status: mappedStatus,
      summary: data.summary || explainability.naturalLanguageExplanation,
      recommendations: [], // Les préconisations déterministes sont gérées par le tableau de bord
      trends: {
        hrv: calculatedScores.trends?.hrv || "stable",
        recovery: calculatedScores.trends?.recovery || "stable"
      }
    };
  } catch (error) {
    console.error("Gemini Analysis Error (Serverless Fallback):", error);
    
    // Fallback de sécurité robuste et déterministe d'Aura Elite si l'appel réseau ou d'IA échoue
    let mappedStatus: "optimal" | "stable" | "strained" | "critical" = "stable";
    if (calculatedScores.performanceReadiness.status === "optimal") mappedStatus = "optimal";
    else if (calculatedScores.performanceReadiness.status === "caution") mappedStatus = "critical";
    else if (calculatedScores.performanceReadiness.status === "reduced" || calculatedScores.performanceReadiness.status === "low") mappedStatus = "strained";

    return {
      readinessScore: calculatedScores.performanceReadiness.score,
      status: mappedStatus,
      summary: explainability.naturalLanguageExplanation,
      recommendations: [],
      trends: {
        hrv: calculatedScores.trends?.hrv || "stable",
        recovery: calculatedScores.trends?.recovery || "stable"
      }
    };
  }
}
