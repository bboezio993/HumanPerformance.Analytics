/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

export const DetectedFoodItemSchema = z.object({
  label: z.string().describe("Nom de l'ingrédient identifié"),
  probableFoodIds: z.array(z.string()).describe("IDs d'aliments correspondants possibles"),
  visualConfidence: z.number().min(0).max(100).describe("Score de confiance visuelle de 0 à 100"),
  estimatedQuantityLabel: z.string().describe("Étiquette de portion estimée (ex: '150g')"),
  quantityConfidence: z.number().min(0).max(100).describe("Score de confiance pour la quantité"),
  rawCookedGuess: z.string().describe("État estimé: cru, cuit, ou inconnu"),
  needsUserConfirmation: z.boolean().default(true).describe("L'athlète doit valider"),
  uncertaintyNotes: z.array(z.string()).describe("Incertitudes par aliment"),
  // Allow manual override candidate matching post-IA
  matchedFoodId: z.string().optional().describe("ID de l'aliment de notre base s'il est associé"),
  matchedFoodName: z.string().optional().describe("Nom de l'aliment de notre base s'il est associé")
});

export const MealPhotoDraftSchema = z.object({
  detectedFoods: z.array(DetectedFoodItemSchema),
  globalUncertainties: z.array(z.string()).describe("Incertitudes globales détectées par le modèle visuel"),
  suggestedQuestions: z.array(z.string()).describe("Questions adressées à l'athlète"),
  modelVersion: z.string().describe("Version du modèle de vision utilisé"),
  promptVersion: z.string().describe("Version de l'instruction sémantique")
});

export type DetectedFoodItem = z.infer<typeof DetectedFoodItemSchema>;
export type MealPhotoDraft = z.infer<typeof MealPhotoDraftSchema>;

/**
 * Valide et nettoie un brouillon de photo de repas provenant de la passerelle IA.
 */
export function validateAndCleanMealPhotoDraft(raw: any): MealPhotoDraft {
  const result = MealPhotoDraftSchema.safeParse(raw);
  if (!result.success) {
    console.warn("[MealPhotoDraft validation fail]", result.error);
    return {
      detectedFoods: Array.isArray(raw?.detectedFoods)
        ? raw.detectedFoods.map((f: any) => ({
            label: String(f?.label || "Aliment non identifié"),
            probableFoodIds: Array.isArray(f?.probableFoodIds) ? f.probableFoodIds.map(String) : [],
            visualConfidence: typeof f?.visualConfidence === "number" ? f.visualConfidence : 50,
            estimatedQuantityLabel: String(f?.estimatedQuantityLabel || "100g"),
            quantityConfidence: typeof f?.quantityConfidence === "number" ? f.quantityConfidence : 50,
            rawCookedGuess: String(f?.rawCookedGuess || "inconnu"),
            needsUserConfirmation: true,
            uncertaintyNotes: Array.isArray(f?.uncertaintyNotes) ? f.uncertaintyNotes.map(String) : []
          }))
        : [],
      globalUncertainties: Array.isArray(raw?.globalUncertainties) ? raw.globalUncertainties.map(String) : [],
      suggestedQuestions: Array.isArray(raw?.suggestedQuestions) ? raw.suggestedQuestions.map(String) : [],
      modelVersion: typeof raw?.modelVersion === "string" ? raw.modelVersion : "gemini-3.5-flash",
      promptVersion: typeof raw?.promptVersion === "string" ? raw.promptVersion : "1.0"
    };
  }
  return result.data;
}
