/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CookingYieldFactor } from "./foodTypes";

export const CookingYieldFactors: CookingYieldFactor[] = [
  {
    foodId: "pates_crues",
    category: "Pâtes",
    fromState: "raw",
    toState: "cooked",
    factor: 2.7,
    confidence: 95,
    note: "Facteur de gonflement standard des pâtes (2.7x) par absorption d'eau."
  },
  {
    foodId: "riz_cru",
    category: "Riz",
    fromState: "raw",
    toState: "cooked",
    factor: 2.8,
    confidence: 95,
    note: "Facteur de gonflement standard du riz blanc de gisement moyen (2.8x)."
  },
  {
    foodId: "poulet_cru",
    category: "Viandes",
    fromState: "raw",
    toState: "cooked",
    factor: 0.75,
    confidence: 90,
    note: "Réduction moyenne de masse des viandes blanches après évaporation de l'eau (0.75x)."
  },
  {
    foodId: "steak_hache_cru",
    category: "Viandes",
    fromState: "raw",
    toState: "cooked",
    factor: 0.82,
    confidence: 90,
    note: "Réduction moyenne de masse des steaks hachés boeuf 15% (0.82x)."
  }
];

/**
 * Convertit une quantité d'aliment selon l'état de cuisson choisi.
 * Permet à l'athlète d'entrer du Riz Cru, mais de logguer en cuit (ou inversement), avec traçabilité complète.
 */
export function convertCookingState(
  quantityGrams: number,
  foodId: string,
  targetState: "raw" | "cooked"
): {
  finalGrams: number;
  appliedFactor: number;
  confidence: number;
  note: string;
} {
  const normId = foodId.toLowerCase();
  
  // Chercher un facteur spécifique
  const factorMatch = CookingYieldFactors.find(
    f => (f.foodId && normId.includes(f.foodId)) || (f.category && normId.includes(f.category.toLowerCase()))
  );

  if (!factorMatch) {
    return {
      finalGrams: quantityGrams,
      appliedFactor: 1.0,
      confidence: 100,
      note: "Aucun facteur d'équivalence cru/cuit requis ou trouvé pour cet aliment."
    };
  }

  // Si on veut du cuit à partir de cru
  if (targetState === "cooked" && factorMatch.toState === "cooked") {
    return {
      finalGrams: Math.round(quantityGrams * factorMatch.factor * 10) / 10,
      appliedFactor: factorMatch.factor,
      confidence: factorMatch.confidence,
      note: factorMatch.note
    };
  }

  // Si on veut du cru à partir de cuit (on divise par le facteur de gonflement)
  if (targetState === "raw" && factorMatch.toState === "cooked") {
    return {
      finalGrams: Math.round((quantityGrams / factorMatch.factor) * 10) / 10,
      appliedFactor: 1 / factorMatch.factor,
      confidence: factorMatch.confidence - 5, // Un peu moins sûr dans ce sens
      note: `Conversion inverse : réduction du gonflement cuit vers cru (division par ${factorMatch.factor}).`
    };
  }

  return {
    finalGrams: quantityGrams,
    appliedFactor: 1.0,
    confidence: 100,
    note: "États de cuisson identiques ou compatibles, aucune conversion requise."
  };
}
