/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { HttpsError } = require("firebase-functions/v2/https");
const fetch = require("node-fetch");

/**
 * Recherche et mappe un aliment fini depuis le registre public Open Food Facts (OFF).
 *
 * @param {string} barcode Le code-barres numérique du produit
 * @returns {Promise<object>} L'état "found" et le produit standardisé
 */
async function lookupBarcode(barcode) {
  if (!barcode || !/^\d+$/.test(barcode)) {
    throw new HttpsError("invalid-argument", "Le format de code-barres fourni est incorrect.");
  }

  // Utilisation d'un agent utilisateur propre comme requis par la charte d'usage OFF
  const options = {
    headers: {
      "User-Agent": "AuraEliteNext-Beta/1.0 (aubindescamps38@gmail.com) Node/20"
    }
  };

  try {
    const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, options);
    if (!offResponse.ok) {
      throw new HttpsError("internal", "Impossible de contacter l'index public Open Food Facts.");
    }

    const rawData = await offResponse.json();
    if (rawData.status === 0 || !rawData.product) {
      return { found: false, barcode };
    }

    const p = rawData.product;
    const nut = p.nutriments || {};

    const mapNutrient = (name, val, unit) => {
      if (val === undefined || val === null) {
        return { value: null, unit, isMissing: true, missingReason: "not_documented" };
      }
      return { value: Number(val), unit, isMissing: false };
    };

    const foodProduct = {
      id: barcode,
      barcode,
      source: "open_food_facts",
      productName: p.product_name_fr || p.product_name || "Produit sans nom",
      brand: p.brands || p.brands_tags?.[0] || "Marque inconnue",
      imageUrl: p.image_url || p.image_front_url || "",
      ingredientsText: p.ingredients_text_fr || p.ingredients_text || "Ingrédients non documentés",
      allergens: p.allergens_tags?.map(a => a.replace("en:", "").replace("fr:", "")) || [],
      traces: p.traces_tags?.map(t => t.replace("en:", "").replace("fr:", "")) || [],
      nutrimentsPer100g: {
        calories: mapNutrient("calories", nut["energy-kcal_100g"] !== undefined ? nut["energy-kcal_100g"] : (nut["energy_100g"] ? Math.round(nut["energy_100g"] / 4.184) : undefined), "kcal"),
        protein: mapNutrient("protein", nut.proteins_100g, "g"),
        carbs: mapNutrient("carbs", nut.carbohydrates_100g, "g"),
        sugars: mapNutrient("sugars", nut.sugars_100g, "g"),
        fat: mapNutrient("fat", nut.fat_100g, "g"),
        saturatedFat: mapNutrient("saturatedFat", nut["saturated-fat_100g"], "g"),
        fiber: mapNutrient("fiber", nut.fiber_100g, "g"),
        salt: mapNutrient("salt", nut.salt_100g, "g"),
        sodium: mapNutrient("sodium", nut.sodium_100g || (nut.salt_100g ? Number(nut.salt_100g) / 2.5 : undefined), "g")
      },
      sourceCompleteness: p.states_tags?.includes("en:nutrition-facts-completed") ? 100 : 70,
      confidence: 90,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    return { found: true, product: foodProduct };
  } catch (err) {
    throw new HttpsError("internal", `Erreur d'appel du registre OFF: ${err.message}`);
  }
}

module.exports = { lookupBarcode };
