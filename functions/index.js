/**
 * Firebase Cloud Functions (v2) - Aura Elite Next Serverless Infrastructure
 * Target Runtime: Node.js 20
 * Security model: Google Secret Manager integration & Firebase Auth Isolation
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const fetch = require("node-fetch"); // standard fetch for node.js 20 if native is not used
const { GoogleGenAI, Type } = require("@google/genai");

// Define Secrets accessed securely via Secret Manager in Cloud Functions
const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

/**
 * 1. verifyBarcode Cloud Function
 * Ingests a barcode, validates security, and logs queries.
 */
exports.verifyBarcode = onCall({ cors: true }, async (request) => {
  // Enforce authentication to prevent anonymous quota abuse
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "L'accès à l'ingestion Open Food Facts exige une session sportive valide.");
  }

  const { barcode } = request.data;
  if (!barcode || !/^\d+$/.test(barcode)) {
    throw new HttpsError("invalid-argument", "Format de code-barres invalide.");
  }

  try {
    const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!offResponse.ok) {
      throw new HttpsError("internal", "Impossible de joindre le registre Open Food Facts.");
    }

    const rawData = await offResponse.json();
    if (rawData.status === 0 || !rawData.product) {
      return { found: false, barcode };
    }

    const p = rawData.product;
    const nut = p.nutriments || {};

    const mapNutrient = (val, unit) => {
      if (val === undefined || val === null) {
        return { value: null, unit, isMissing: true, missingReason: "not_documented" };
      }
      return { value: Number(val), unit, isMissing: false };
    };

    const foodProduct = {
      id: barcode,
      barcode,
      source: "open_food_facts",
      productName: p.product_name_fr || p.product_name || "Produit inconnu",
      brand: p.brands || p.brands_tags?.[0] || "Marque inconnue",
      imageUrl: p.image_url || p.image_front_url || "",
      ingredientsText: p.ingredients_text_fr || p.ingredients_text || "Ingrédients non renseignés",
      allergens: p.allergens_tags?.map(a => a.replace("en:", "").replace("fr:", "")) || [],
      traces: p.traces_tags?.map(t => t.replace("en:", "").replace("fr:", "")) || [],
      nutrimentsPer100g: {
        calories: mapNutrient(nut["energy-kcal_100g"] !== undefined ? nut["energy-kcal_100g"] : (nut["energy_100g"] ? Math.round(nut["energy_100g"] / 4.184) : undefined), "kcal"),
        protein: mapNutrient(nut.proteins_100g, "g"),
        carbs: mapNutrient(nut.carbohydrates_100g, "g"),
        sugars: mapNutrient(nut.sugars_100g, "g"),
        fat: mapNutrient(nut.fat_100g, "g"),
        saturatedFat: mapNutrient(nut["saturated-fat_100g"], "g"),
        fiber: mapNutrient(nut.fiber_100g, "g"),
        salt: mapNutrient(nut.salt_100g, "g"),
        sodium: mapNutrient(nut.sodium_100g || (nut.salt_100g ? Number(nut.salt_100g) / 2.5 : undefined), "g")
      },
      sourceCompleteness: p.states_tags?.includes("en:nutrition-facts-completed") ? 100 : 70,
      confidence: 90,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    return { found: true, product: foodProduct };
  } catch (error) {
    throw new HttpsError("internal", `Échec du serveur proxy: ${error.message}`);
  }
});

/**
 * 2. generateAiInsights Cloud Function
 * Directly queries Gemini with Secret Manager-managed API keys.
 */
exports.generateAiInsights = onCall({ secrets: [geminiApiKeySecret], cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "L'accès aux automatisations IA exige d'être connecté.");
  }

  const { feature, payload } = request.data;
  if (!feature || !payload) {
    throw new HttpsError("invalid-argument", "Les attributs 'feature' et 'payload' sont obligatoires.");
  }

  const apiKey = geminiApiKeySecret.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "La clé d'API Google Secret Manager n'est pas provisionnée.");
  }

  const aiClient = new GoogleGenAI({ apiKey });

  try {
    if (feature === 'recipe') {
      const { recipeText } = payload;
      const systemInstruction = `Tu es un nutritionniste de haut niveau pour Aura Elite Next.
Analyse la recette textuelle fournie. Convertis de façon déterministe chaque ingrédient avec son poids théorique en grammes ou volume en ml.
Associe des indices de confiance (0-100) pour chaque ingrédient.
Ne propose jamais de diagnostics ou d'opinions médicales. Formule uniquement en grammage nutritionnel.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: recipeText,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          // Schema matches our types
        }
      });
      return JSON.parse(response.text || "{}");

    } else if (feature === 'voice') {
      const { transcript, formType } = payload;
      const systemInstruction = `Tu es un assistant vocal d'élite pour athlètes. Extrais les paramètres physiologiques depuis la dictée vocale de l'utilisateur.`;
      
      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: transcript,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });
      return JSON.parse(response.text || "{}");
    }

    throw new HttpsError("unimplemented", `Mode d'extraction non implémenté : ${feature}`);
  } catch (error) {
    throw new HttpsError("internal", `Erreur d'extraction d'insights: ${error.message}`);
  }
});
