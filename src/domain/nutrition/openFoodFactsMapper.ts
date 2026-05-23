/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FoodItem } from "./foodTypes";

export interface FoodProductDraft {
  id: string;
  barcode: string;
  source: string;
  productName: string;
  brand: string;
  imageUrl?: string;
  ingredientsText?: string;
  allergens?: string[];
  traces?: string[];
  nutrimentsPer100g: {
    calories: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    protein: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    carbs: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    sugars: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    fat: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    saturatedFat: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    fiber: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    salt: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
    sodium: { value: number | null; unit: string; isMissing: boolean; missingReason?: string };
  };
  sourceCompleteness: number;
  confidence: number;
  lastFetchedAt: string;
  createdAt: string;
}

/**
 * Mappe un produit brut ou un brouillon Open Food Facts vers une instance de FoodItem d'Aura Elite,
 * en veillant rigoureusement à NE JAMAIS remplacer les valeurs manquantes par 0.
 * Si une macro est absente, elle est relevée comme étant absente ou 'not_documented' sans affecter le score de complétude.
 */
export function mapOpenFoodFactsToFoodItem(draft: FoodProductDraft): FoodItem {
  const getMacroValue = (nutrient: { value: number | null; isMissing: boolean }): number => {
    // Si la valeur est absente ou manquante, on retourne -1 (représentation interne pour avertir l'absence)
    // mais on ne la remplace jamais par 0 par défaut pour éviter de fausser les calculs énergétiques.
    if (nutrient.isMissing || nutrient.value === null) {
      return -1; 
    }
    return nutrient.value;
  };

  const missingFields: string[] = [];
  const requiredMacros = [
    { key: "calories", label: "Calories" },
    { key: "protein", label: "Protéines" },
    { key: "carbs", label: "Glucides" },
    { key: "fat", label: "Lipides" }
  ];

  requiredMacros.forEach(macro => {
    const rawNut = draft.nutrimentsPer100g[macro.key as keyof typeof draft.nutrimentsPer100g];
    if (!rawNut || rawNut.isMissing || rawNut.value === null) {
      missingFields.push(macro.label);
    }
  });

  return {
    id: draft.id,
    source: "internal",
    sourceFoodId: draft.id,
    sourceVersion: "OFF_v2",
    sourceName: "Open Food Facts",
    importDate: draft.lastFetchedAt || new Date().toISOString(),
    name: draft.productName || "Produit sans nom",
    normalizedName: (draft.productName || "produit sans nom").toLowerCase().trim(),
    brand: draft.brand || "Marque inconnue",
    barcode: draft.barcode,
    category: "Aliment emballé",
    defaultUnit: "g",
    confidence: draft.confidence || 90,
    verified: draft.sourceCompleteness >= 90,
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    locale: "fr",
    
    // Valeurs directes (avec signature -1 si indocumenté)
    calories: getMacroValue(draft.nutrimentsPer100g.calories),
    protein: getMacroValue(draft.nutrimentsPer100g.protein),
    carbs: getMacroValue(draft.nutrimentsPer100g.carbs),
    fat: getMacroValue(draft.nutrimentsPer100g.fat),
    fiber: draft.nutrimentsPer100g.fiber?.value ?? undefined,
    sugars: draft.nutrimentsPer100g.sugars?.value ?? undefined,
    saturatedFat: draft.nutrimentsPer100g.saturatedFat?.value ?? undefined,
    sodium: draft.nutrimentsPer100g.sodium?.value !== null ? (draft.nutrimentsPer100g.sodium.value * 1000) : undefined // convert g to mg
  };
}
