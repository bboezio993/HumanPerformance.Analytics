/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

export const OcrNutrientItemSchema = z.object({
  nutrientId: z.string().describe("Identifiant du nutriment (calories, protein, carbs...)"),
  value: z.number().describe("Valeur numérique pour 100g ou 100ml"),
  unit: z.string().describe("Unité d'expression (g, mg, kcal)"),
  confidence: z.number().min(0).max(100).describe("Confiance du modèle d'IA 0-100"),
  rawText: z.string().describe("Texte brut d'origine extrait sur l'étiquette"),
  missingReason: z.string().optional().describe("Raison de l'absence du nutriment")
});

export const OcrDraftSchema = z.object({
  productName: z.string().optional().default("Produit OCRisé"),
  servingSize: z.string().optional().describe("Portion suggérée de l'emballage (ex: '30g')"),
  valuesPer100g: z.array(OcrNutrientItemSchema),
  ingredientsText: z.string().optional().describe("Liste des ingrédients détectés"),
  allergensText: z.string().optional().describe("Optionnel: allergènes repérés"),
  uncertainFields: z.array(z.string()).describe("Champs illisibles ou incertains"),
  requiresUserValidation: z.boolean().default(true).describe("Validation manuelle requise")
});

export type OcrNutrientItem = z.infer<typeof OcrNutrientItemSchema>;
export type OcrDraft = z.infer<typeof OcrDraftSchema>;

/**
 * Valide et nettoie un brouillon de photo d'étiquette provenant de la passerelle IA.
 */
export function validateAndCleanOcrDraft(raw: any): OcrDraft {
  const result = OcrDraftSchema.safeParse(raw);
  if (!result.success) {
    console.warn("[OcrDraft validation fail]", result.error);
    return {
      productName: typeof raw?.productName === "string" ? raw.productName : "Produit OCRisé",
      servingSize: typeof raw?.servingSize === "string" ? raw.servingSize : undefined,
      valuesPer100g: Array.isArray(raw?.valuesPer100g)
        ? raw.valuesPer100g.map((n: any) => ({
            nutrientId: String(n?.nutrientId || "calories"),
            value: typeof n?.value === "number" ? n.value : 0,
            unit: String(n?.unit || "g"),
            confidence: typeof n?.confidence === "number" ? n.confidence : 50,
            rawText: String(n?.rawText || ""),
            missingReason: typeof n?.missingReason === "string" ? n.missingReason : undefined
          }))
        : [],
      ingredientsText: typeof raw?.ingredientsText === "string" ? raw.ingredientsText : undefined,
      allergensText: typeof raw?.allergensText === "string" ? raw.allergensText : undefined,
      uncertainFields: Array.isArray(raw?.uncertainFields) ? raw.uncertainFields.map(String) : [],
      requiresUserValidation: true
    };
  }
  return result.data;
}
