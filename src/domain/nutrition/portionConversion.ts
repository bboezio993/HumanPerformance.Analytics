/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServingUnit } from "./foodTypes";

export interface ConversionResult {
  grams: number;
  confidence: number;
  assumptions: string[];
}

/**
 * Convertit une portion quelconque en son équivalent en grammes de manière déterministe
 * et transparente pour l'athlète (Explainability Layer).
 *
 * Supporte : Banane (pelée / entière), Huile de table/olive, Lait de vache, et portions personnalisées.
 */
export function convertPortionToGrams(
  foodId: string,
  quantity: number,
  unit: string,
  customUnits: ServingUnit[] = []
): ConversionResult {
  if (unit === "g" || unit === "grammes") {
    return {
      grams: quantity,
      confidence: 100,
      assumptions: ["Saisie directe de la masse en grammes (sans incertitude)."]
    };
  }

  // 1. Recherche dans les portions spécifiques de l'aliment (y compris custom)
  const allUnits = [...customUnits];
  const matched = allUnits.find(
    (u) =>
      u.foodId === foodId &&
      (u.id === unit || u.label.toLowerCase().trim() === unit.toLowerCase().trim())
  );

  if (matched && matched.gramsEquivalent !== undefined) {
    return {
      grams: matched.gramsEquivalent * quantity,
      confidence: matched.confidence || 90,
      assumptions: [
        `Utilisation de l'équivalent portion de l'athlète : ${matched.label} (${matched.gramsEquivalent}g/unité).`
      ]
    };
  }

  // 2. Règles déterministes par défaut pour les aliments clés de la bêta (Banane, huile, lait, œuf...)
  const normalizedFoodId = foodId.toLowerCase().trim();
  const normalizedUnit = unit.toLowerCase().trim();

  // BANANE
  if (normalizedFoodId.includes("banane")) {
    if (normalizedUnit === "piece" || normalizedUnit === "entier" || normalizedUnit === "unité" || normalizedUnit === "unite") {
      return {
        grams: 118 * quantity,
        confidence: 85,
        assumptions: ["Approximation standard d'une banane pelée moyenne selon USDA FDC (118g)."]
      };
    }
    if (normalizedUnit === "petit" || normalizedUnit === "petite") {
      return {
        grams: 101 * quantity,
        confidence: 80,
        assumptions: ["Approximation d'une petite banane selon USDA FDC (101g)."]
      };
    }
    if (normalizedUnit === "grand" || normalizedUnit === "grande") {
      return {
        grams: 136 * quantity,
        confidence: 80,
        assumptions: ["Approximation d'une grande banane selon USDA FDC (136g)."]
      };
    }
  }

  // HUILE
  if (normalizedFoodId.includes("huile")) {
    if (normalizedUnit === "cs" || normalizedUnit === "c. à soupe" || normalizedUnit === "cuillère à soupe") {
      return {
        grams: 13.6 * quantity,
        confidence: 90,
        assumptions: ["1 cuillère à soupe d'huile équivaut à environ 15 ml avec une densité de 0.91 (13.6g)."]
      };
    }
    if (normalizedUnit === "cc" || normalizedUnit === "c. à café" || normalizedUnit === "cuillère à café") {
      return {
        grams: 4.5 * quantity,
        confidence: 90,
        assumptions: ["1 cuillère à café d'huile équivaut à environ 5 ml avec une densité de 0.91 (4.5g)."]
      };
    }
  }

  // LAIT
  if (normalizedFoodId.includes("lait") || normalizedFoodId.includes("milk")) {
    const density = 1.03; // Densité du lait entier/demi-écrémé de vache
    if (normalizedUnit === "ml" || normalizedUnit === "millilitre") {
      return {
        grams: Math.round(quantity * density * 10) / 10,
        confidence: 95,
        assumptions: [`Conversion de volume d'eau vers liquide dense (densité estimée à ${density} g/ml).`]
      };
    }
    if (normalizedUnit === "cl") {
      return {
        grams: Math.round(quantity * 10 * density * 10) / 10,
        confidence: 95,
        assumptions: [`Conversion de volume d'eau vers liquide dense (densité estimée à ${density} g/ml).`]
      };
    }
    if (normalizedUnit === "verre") {
      return {
        grams: Math.round(200 * quantity * density * 10) / 10,
        confidence: 75,
        assumptions: [`Approximation d'un verre standard (200 ml) de lait avec densité de ${density} g/ml.`]
      };
    }
    if (normalizedUnit === "bol") {
      return {
        grams: Math.round(350 * quantity * density * 10) / 10,
        confidence: 70,
        assumptions: [`Approximation d'un bol moyen (350 ml) de lait avec densité de ${density} g/ml.`]
      };
    }
  }

  // œuf
  if (normalizedFoodId.includes("oeuf") || normalizedFoodId.includes("œuf")) {
    if (normalizedUnit === "piece" || normalizedUnit === "unite" || normalizedUnit === "unité") {
      return {
        grams: 55 * quantity,
        confidence: 95,
        assumptions: ["Équivalent moyen constaté d'un œuf gros de poule de calibre L (55g de blanc et jaune)."]
      };
    }
  }

  // generic ml standard conversion (assuming density 1.0 for unspecified liquids)
  if (normalizedUnit === "ml") {
    return {
      grams: quantity,
      confidence: 90,
      assumptions: ["Conversion directe volume/masse basée sur la densité standard de l'eau (1.0 g/ml)."]
    };
  }

  if (normalizedUnit === "cl") {
    return {
      grams: quantity * 10,
      confidence: 90,
      assumptions: ["Conversion centilitres en grammes basée sur la densité de l'eau (10g par cl)."]
    };
  }

  // Non identifié
  return {
    grams: quantity,
    confidence: 50,
    assumptions: [
      `Unité '${unit}' inconnue pour l'élément '${foodId}'. Poids par défaut équivalent à la quantité en grammes (1:1).`
    ]
  };
}
