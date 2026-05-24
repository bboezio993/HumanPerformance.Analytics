/**
 * Firebase Cloud Functions (v2) - Aura Elite Next Serverless Infrastructure
 * Target Runtime: Node.js 20
 * Security model: Google Secret Manager integration & Firebase Auth Isolation
 *
 * This entry point has been modularized to meet the requirements of Sprint 2.
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// SECRETS accessed securely via Secret Manager in Cloud Functions
const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

// Module Imports for Modular Cloud Architecture
const { authenticatedCallable } = require("./src/authenticatedCallable");
const { checkAndIncrementQuota } = require("./src/quota");
const { recordAiUsage } = require("./src/aiUsage");
const { lookupBarcode } = require("./src/openFoodFacts");
const { deleteMediaFileAndLog } = require("./src/media");
const {
  parseRecipeText,
  parseVoiceForm,
  extractNutritionLabel,
  analyzeMealPhoto,
  analyzeHealthData
} = require("./src/ai");

/**
 * Helper to safely initialize and retrieve the server-side Gemini client.
 */
function getAiClient() {
  const apiKey = geminiApiKeySecret.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "La clé d'API Google Secret Manager n'est pas provisionnée.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}

/**
 * 1. lookupOpenFoodFacts
 * Proxy query to OFF for finished products.
 */
exports.lookupOpenFoodFacts = authenticatedCallable(async (request, uid) => {
  const { barcode } = request.data;
  return await lookupBarcode(barcode);
});

// Retro-compatibility name bindings
exports.verifyBarcode = exports.lookupOpenFoodFacts;

/**
 * 2. parseRecipeText
 * Extracts ingredients, portions and options from recipe layout text.
 */
exports.parseRecipeText = authenticatedCallable({ secrets: [geminiApiKeySecret] }, async (request, uid) => {
  const { recipeText } = request.data;
  const quota = await checkAndIncrementQuota(uid, "recipe_text");
  if (!quota.allowed) {
    throw new HttpsError("resource-exhausted", "Le quota d'analyse de recette d'aujourd'hui est épuisé.");
  }

  const aiClient = getAiClient();
  const draft = await parseRecipeText(aiClient, recipeText);

  const crypto = require("crypto");
  const inputHash = crypto.createHash("md5").update(recipeText || "").digest("hex");

  const log = await recordAiUsage(uid, {
    feature: "recipe_text",
    model: "gemini-3.5-flash",
    inputHash,
    cached: false,
    status: "confirmed"
  });

  return { draft, log };
});

/**
 * 3. parseVoiceForm
 * Processes transcribed dictation inputs into a structured form log.
 */
exports.parseVoiceForm = authenticatedCallable({ secrets: [geminiApiKeySecret] }, async (request, uid) => {
  const { transcript, formType } = request.data;
  const quota = await checkAndIncrementQuota(uid, "voice_form");
  if (!quota.allowed) {
    throw new HttpsError("resource-exhausted", "Le quota journalier de dictée vocale est dépassé.");
  }

  const aiClient = getAiClient();
  const draft = await parseVoiceForm(aiClient, transcript, formType);

  const crypto = require("crypto");
  const inputHash = crypto.createHash("md5").update(`${formType}_${transcript}`).digest("hex");

  const log = await recordAiUsage(uid, {
    feature: "voice_form",
    model: "gemini-3.5-flash",
    inputHash,
    cached: false,
    status: "confirmed"
  });

  return { draft, log };
});

/**
 * 4. extractNutritionLabel
 * OCR extract macro per 100g on standard labels.
 */
exports.extractNutritionLabel = authenticatedCallable({ secrets: [geminiApiKeySecret] }, async (request, uid) => {
  const { imageBase64 } = request.data;
  const quota = await checkAndIncrementQuota(uid, "label_ocr");
  if (!quota.allowed) {
    throw new HttpsError("resource-exhausted", "Quota journalier d'analyse OCR d'étiquettes épuisé.");
  }

  const aiClient = getAiClient();
  const draft = await extractNutritionLabel(aiClient, imageBase64);

  const crypto = require("crypto");
  const inputHash = crypto.createHash("md5").update(imageBase64?.substring(0, 1000) || "").digest("hex");

  const log = await recordAiUsage(uid, {
    feature: "label_ocr",
    model: "gemini-3.5-flash",
    inputHash,
    cached: false,
    status: "confirmed"
  });

  return { draft, log };
});

/**
 * 5. analyzeMealPhoto
 * Identifies probable foods from visual meal upload.
 */
exports.analyzeMealPhoto = authenticatedCallable({ secrets: [geminiApiKeySecret] }, async (request, uid) => {
  const { imageBase64 } = request.data;
  const quota = await checkAndIncrementQuota(uid, "meal_photo");
  if (!quota.allowed) {
    throw new HttpsError("resource-exhausted", "Quota d'analyse visuelle de photo repas atteint pour aujourd'hui.");
  }

  const aiClient = getAiClient();
  const draft = await analyzeMealPhoto(aiClient, imageBase64);

  const crypto = require("crypto");
  const inputHash = crypto.createHash("md5").update(imageBase64?.substring(0, 1000) || "").digest("hex");

  const log = await recordAiUsage(uid, {
    feature: "meal_photo",
    model: "gemini-3.5-flash",
    inputHash,
    cached: false,
    status: "confirmed"
  });

  return { draft, log };
});

/**
 * 6. analyzeHealthData
 * Generates pedagogical reformulation of health data.
 */
exports.analyzeHealthData = authenticatedCallable({ secrets: [geminiApiKeySecret] }, async (request, uid) => {
  const { profile, calculatedScores, shortSummary, pedagogicalReformulation } = request.data;
  const quota = await checkAndIncrementQuota(uid, "reformulation");
  if (!quota.allowed) {
    throw new HttpsError("resource-exhausted", "Quota d'analyse de santé atteint pour aujourd'hui.");
  }

  const aiClient = getAiClient();
  const result = await analyzeHealthData(aiClient, profile, calculatedScores, shortSummary, pedagogicalReformulation);

  const log = await recordAiUsage(uid, {
    feature: "reformulation",
    model: "gemini-3.5-flash",
    inputHash: uid + "_" + Date.now(),
    cached: false,
    status: "confirmed"
  });

  return { summary: result.summary, log };
});

/**
 * 6. deleteMediaAsset
 * Safely purge a private media asset file.
 */
exports.deleteMediaAsset = authenticatedCallable(async (request, uid) => {
  const { storagePath, reason } = request.data;
  return await deleteMediaFileAndLog(uid, storagePath, reason);
});

/**
 * 7. checkAiQuota
 * Verify current dynamic query quota for a feature on daily interval.
 */
exports.checkAiQuota = authenticatedCallable(async (request, uid) => {
  const { feature } = request.data;
  const today = new Date().toISOString().split("T")[0];
  const db = admin.firestore();
  const docRef = db.collection("users").doc(uid).collection("settings").doc("aiUsage");
  const docSnap = await docRef.get();

  const { QUOTA_LIMITS } = require("./src/quota");
  const limit = QUOTA_LIMITS[feature] || 10;

  let currentUsage = 0;
  if (docSnap.exists) {
    const data = docSnap.data();
    if (data[today] && data[today][feature]) {
      currentUsage = data[today][feature];
    }
  }

  return {
    allowed: currentUsage < limit,
    remaining: Math.max(0, limit - currentUsage),
    usage: currentUsage,
    limit
  };
});

/**
 * 8. logAiUsage
 * Custom endpoint to manually push logs into active tracking indexes.
 */
exports.logAiUsage = authenticatedCallable(async (request, uid) => {
  const { feature, model, inputHash, cached, status, tokens, cost } = request.data;
  return await recordAiUsage(uid, { feature, model, inputHash, cached, status, tokens, cost });
});

/**
 * 9. confirmDraft
 * Database transactional routine to confirm and save atomic objects.
 */
exports.confirmDraft = authenticatedCallable(async (request, uid) => {
  const { draftId, collectionName, correctionData } = request.data;
  const db = admin.firestore();
  const draftRef = db.collection("users").doc(uid).collection(collectionName).doc(draftId);

  return await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(draftRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Le brouillon ciblé est introuvable.");
    }

    const currentData = snap.data();
    const finalData = {
      ...currentData,
      ...correctionData,
      status: "confirmed",
      userConfirmed: true,
      confirmedAt: new Date().toISOString()
    };

    transaction.set(draftRef, finalData);
    return { success: true, draftId, status: "confirmed" };
  });
});

/**
 * 10. exportUserData
 * Complete JSON backup of the athlete's dataset.
 */
exports.exportUserData = authenticatedCallable(async (request, uid) => {
  const db = admin.firestore();
  const collections = [
    "profile", "settings", "metrics", "activities", "garminImports",
    "mealLogs", "recipes", "favoriteFoods", "nutritionDrafts",
    "voiceDrafts", "aiUsageLogs", "consents", "mediaAssets"
  ];
  const exportPayload = { uid, exportedAt: new Date().toISOString() };

  for (const col of collections) {
    const snap = await db.collection("users").doc(uid).collection(col).get();
    exportPayload[col] = snap.docs.map(doc => doc.data());
  }

  return exportPayload;
});

// Retro-compatible generateAiInsights endpoint
exports.generateAiInsights = authenticatedCallable({ secrets: [geminiApiKeySecret] }, async (request, uid) => {
  const { feature, payload } = request.data;
  if (!feature || !payload) {
    throw new HttpsError("invalid-argument", "Les attributs 'feature' et 'payload' sont obligatoires.");
  }

  const aiClient = getAiClient();
  if (feature === 'recipe') {
    return await parseRecipeText(aiClient, payload.recipeText);
  } else if (feature === 'voice') {
    return await parseVoiceForm(aiClient, payload.transcript, payload.formType);
  }

  throw new HttpsError("unimplemented", `Mode d'extraction non implémenté : ${feature}`);
});
