/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

export const RecipeDraftIngredientSchema = z.object({
  rawText: z.string().describe("Texte brut d'origine de l'ingrédient"),
  foodName: z.string().describe("Nom de l'aliment normalisé"),
  quantity: z.number().describe("Quantité extraite"),
  unit: z.string().describe("Unité d'origine"),
  grams: z.number().describe("Masse ou volume équivalent estimé en grammes/ml"),
  confidence: z.number().min(0).max(100).describe("Confiance du modèle d'IA 0-100"),
  assumptions: z.string().describe("Détails ou hypothèses du modèle d'IA (densité, etc.)"),
  // Allow manual override candidate matching post-IA
  matchedFoodId: z.string().optional().describe("ID de l'aliment de notre base s'il est associé"),
  matchedFoodName: z.string().optional().describe("Nom de l'aliment de notre base s'il est associé")
});

export const RecipeDraftSchema = z.object({
  name: z.string().min(1, "Le nom de la recette est requis"),
  ingredients: z.array(RecipeDraftIngredientSchema),
  missingMatches: z.array(z.string()).describe("Ingrédients impossibles à identifier de façon fiable"),
  questionsForUser: z.array(z.string()).describe("Questions ou points de doute formulés par l'IA"),
  requiresValidation: z.boolean().default(true).describe("Validation manuelle obligatoire")
});

export type RecipeDraftIngredient = z.infer<typeof RecipeDraftIngredientSchema>;
export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;

/**
 * Valide et nettoie un brouillon de recette provenant de la passerelle IA.
 */
export function validateAndCleanRecipeDraft(raw: any): RecipeDraft {
  const result = RecipeDraftSchema.safeParse(raw);
  if (!result.success) {
    console.warn("[RecipeDraft validation fail]", result.error);
    // Return a safe fallback skeleton if parsing fails completely
    return {
      name: typeof raw?.name === "string" ? raw.name : "Recette Importée",
      ingredients: Array.isArray(raw?.ingredients) 
        ? raw.ingredients.map((ing: any) => ({
            rawText: String(ing?.rawText || ""),
            foodName: String(ing?.foodName || "Ingrédient inconnu"),
            quantity: typeof ing?.quantity === "number" ? ing.quantity : 0,
            unit: String(ing?.unit || "g"),
            grams: typeof ing?.grams === "number" ? ing.grams : 0,
            confidence: typeof ing?.confidence === "number" ? ing.confidence : 50,
            assumptions: String(ing?.assumptions || "Extraction brute")
          }))
        : [],
      missingMatches: Array.isArray(raw?.missingMatches) ? raw.missingMatches.map(String) : [],
      questionsForUser: Array.isArray(raw?.questionsForUser) ? raw.questionsForUser.map(String) : [],
      requiresValidation: true
    };
  }
  return result.data;
}
