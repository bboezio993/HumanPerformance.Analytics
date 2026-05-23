/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FoodItem } from "./foodTypes";
import { internalFoodDatabase } from "./foodDatabase";

export interface FoodCandidate {
  foodId: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  score: number; // match rating 0-100
}

/**
 * Nettoie une chaîne pour enlever les accents, ponctuations et mettre en minuscule.
 */
function normalizeMatchText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Enlève les accents
    .replace(/[^a-z0-9\s]/g, " ") // Remplace ponctuation par espace
    .replace(/\s+/g, " ") // Supprime multiples espaces
    .trim();
}

/**
 * Calcule un score de correspondance (0-100) basé sur l'intersection de jetons.
 */
export function calculateMatchScore(searchText: string, targetName: string): number {
  const query = normalizeMatchText(searchText);
  const target = normalizeMatchText(targetName);

  if (!query || !target) return 0;

  // 1. Match exact
  if (query === target) return 100;

  // 2. Substring direct
  if (target.includes(query)) return 90;
  if (query.includes(target)) return 80;

  // 3. Correspondance de mots clés
  const queryWords = query.split(" ").filter(w => w.length > 1);
  const targetWords = target.split(" ").filter(w => w.length > 1);

  if (queryWords.length === 0) return 0;

  let intersectionCount = 0;
  for (const qWord of queryWords) {
    if (targetWords.includes(qWord)) {
      intersectionCount++;
    } else {
      // Vérification partielle par début de mot (ex: pates -> pates_crues)
      const hasPartial = targetWords.some(tWord => tWord.startsWith(qWord) || qWord.startsWith(tWord));
      if (hasPartial) {
        intersectionCount += 0.5;
      }
    }
  }

  const ratio = intersectionCount / queryWords.length;
  return Math.round(ratio * 75); // Max 75 pour du mot à mot partiel
}

/**
 * Trouve les candidats les plus proches dans la base de données locale d'aliments
 * et les favoris de l'athlète.
 */
export function matchFoodCandidates(
  searchText: string,
  customUserFoods: FoodItem[] = [],
  favoriteFoods: any[] = []
): FoodCandidate[] {
  const query = searchText.trim();
  if (!query) return [];

  const candidatesMap = new Map<string, FoodCandidate>();

  // 1. Fusionner toutes les sources d'aliments
  const allFoods = [
    ...customUserFoods,
    ...internalFoodDatabase
  ];

  // 2. Traiter les favoris s'ils disposent de données nutritionnelles
  const favoriteCandidates = favoriteFoods.map(fav => ({
    id: fav.foodProductId || fav.id,
    name: fav.displayName || fav.name,
    brand: fav.brand,
    calories: fav.calories || 0,
    protein: fav.protein || 0,
    carbs: fav.carbs || 0,
    fat: fav.fat || 0,
    source: "favorite"
  }));

  // 3. Matcher les favoris d'abord (bonus de confiance car l'athlète l'utilise souvent)
  for (const fav of favoriteCandidates) {
    const score = calculateMatchScore(query, fav.name);
    if (score > 10) {
      candidatesMap.set(fav.id, {
        foodId: fav.id,
        name: fav.name,
        brand: fav.brand,
        calories: fav.calories,
        protein: fav.protein,
        carbs: fav.carbs,
        fat: fav.fat,
        source: "Équipement Favorisé ⭐",
        score: Math.min(100, score + 15) // bonus de 15% pour les aliments favoris
      });
    }
  }

  // 4. Matcher le catalogue interne
  for (const food of allFoods) {
    const score = calculateMatchScore(query, food.name);
    if (score > 10) {
      const existing = candidatesMap.get(food.id);
      if (!existing || existing.score < score) {
        candidatesMap.set(food.id, {
          foodId: food.id,
          name: food.name,
          brand: food.brand,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          source: food.source === "ciqual" ? "Registre National CIQUAL 🛒" : "Catalogue Personnel 📂",
          score
        });
      }
    }
  }

  // Trier par pertinence descendante
  return Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score);
}
