/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { Type } = require("@google/genai");
const { z } = require("zod");

// ============================================
// COMPLIANCE SCHEMA DEFINITIONS (ZOD)
// ============================================

const RecipeIngredientSchema = z.object({
  rawText: z.string().default(""),
  foodName: z.string().default("Inconnu"),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  grams: z.number().nullable().optional(),
  confidence: z.number().min(0).max(100).optional().default(100),
  assumptions: z.string().nullable().optional().default("")
});

const RecipeDraftSchema = z.object({
  name: z.string().default("Recette sans titre"),
  ingredients: z.array(RecipeIngredientSchema).default([]),
  missingMatches: z.array(z.string()).default([]),
  questionsForUser: z.array(z.string()).default([]),
  requiresValidation: z.boolean().default(true)
});

const VoiceDailySchema = z.object({
  fatigue: z.number().min(1).max(7).nullable().optional(),
  stress: z.number().min(1).max(7).nullable().optional(),
  sleepQuality: z.number().min(1).max(7).nullable().optional(),
  soreness: z.number().min(1).max(7).nullable().optional(),
  mood: z.number().min(1).max(7).nullable().optional(),
  motivation: z.number().min(1).max(7).nullable().optional(),
  painLevel: z.number().min(0).max(10).nullable().optional(),
  digestion: z.number().min(1).max(5).nullable().optional(),
  appetite: z.number().min(1).max(5).nullable().optional(),
  notes: z.string().nullable().optional(),
  missingFields: z.array(z.string()).default([]),
  uncertainFields: z.array(z.string()).default([]),
  requiresValidation: z.boolean().default(true)
});

const VoiceRpeSchema = z.object({
  rpe: z.number().min(1).max(10).nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  feeling: z.number().min(1).max(5).nullable().optional(),
  comment: z.string().nullable().optional(),
  conformanceToPlan: z.boolean().nullable().optional(),
  missingFields: z.array(z.string()).default([]),
  uncertainFields: z.array(z.string()).default([]),
  requiresValidation: z.boolean().default(true)
});

const VoiceNutritionIngredientSchema = z.object({
  foodName: z.string().default("Inconnu"),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  rawCookedState: z.string().nullable().optional(),
  confidence: z.number().optional().default(100),
  assumptions: z.string().nullable().optional().default("")
});

const VoiceNutritionSchema = z.object({
  mealType: z.string().nullable().optional(),
  items: z.array(VoiceNutritionIngredientSchema).default([]),
  missingQuantities: z.array(z.string()).default([]),
  uncertainItems: z.array(z.string()).default([]),
  requiresValidation: z.boolean().default(true)
});

const VoicePainSchema = z.object({
  localisation: z.string().default("Non spécifié"),
  intensity: z.number().min(0).max(10).default(0),
  description: z.string().nullable().optional(),
  aggravatingFactors: z.string().nullable().optional(),
  missingFields: z.array(z.string()).default([]),
  uncertainFields: z.array(z.string()).default([]),
  requiresValidation: z.boolean().default(true)
});

const VoiceContextSchema = z.object({
  travel: z.boolean().nullable().optional(),
  jetlag: z.boolean().nullable().optional(),
  alcohol: z.boolean().nullable().optional(),
  lateMeal: z.boolean().nullable().optional(),
  heat: z.boolean().nullable().optional(),
  altitude: z.boolean().nullable().optional(),
  stressEx: z.boolean().nullable().optional(),
  exams: z.boolean().nullable().optional(),
  meds: z.boolean().nullable().optional(),
  cycle: z.boolean().nullable().optional(),
  competition: z.boolean().nullable().optional(),
  interruptedNight: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
  missingFields: z.array(z.string()).default([]),
  uncertainFields: z.array(z.string()).default([]),
  requiresValidation: z.boolean().default(true)
});

const NutrientValueSchema = z.object({
  nutrientId: z.string().default("calories"),
  value: z.number().nullable(),
  unit: z.string().default("g"),
  confidence: z.number().optional().default(100),
  rawText: z.string().nullable().optional().default(""),
  missingReason: z.string().nullable().optional()
});

const NutritionLabelDraftSchema = z.object({
  productName: z.string().nullable().optional().default(""),
  servingSize: z.string().nullable().optional().default(""),
  valuesPer100g: z.array(NutrientValueSchema).default([]),
  ingredientsText: z.string().nullable().optional().default(""),
  allergensText: z.string().nullable().optional().default(""),
  uncertainFields: z.array(z.string()).default([]),
  requiresUserValidation: z.boolean().default(true)
});

const VisualFoodItemSchema = z.object({
  label: z.string().default("Inconnu"),
  probableFoodIds: z.array(z.string()).default([]),
  visualConfidence: z.number().optional().default(100),
  estimatedQuantityLabel: z.string().nullable().optional().default(""),
  quantityConfidence: z.number().optional().default(100),
  rawCookedGuess: z.string().nullable().optional().default(""),
  needsUserConfirmation: z.boolean().default(true),
  uncertaintyNotes: z.array(z.string()).default([])
});

const MealPhotoDraftSchema = z.object({
  detectedFoods: z.array(VisualFoodItemSchema).default([]),
  globalUncertainties: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  modelVersion: z.string().nullable().optional().default("gemini-3.5-flash"),
  promptVersion: z.string().nullable().optional().default("1.0.0")
});

const HealthAnalysisSchema = z.object({
  summary: z.string().default("Données insuffisantes ou en attente d'évaluation professionnelle.")
});

// ============================================
// RESILIENT PARSING UTILITIES
// ============================================

function parseAndValidate(jsonStr, schema, defaultValue = {}) {
  let parsed = {};
  try {
    parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  } catch (err) {
    console.error("[JSON Parse Failure] fallback to standard default schema object:", err);
    return defaultValue;
  }
  
  const validation = schema.safeParse(parsed);
  if (validation.success) {
    return validation.data;
  } else {
    console.warn("[Zod Schema Compliance Violation] cleaning data matching defaults. Errors:", validation.error.format());
    try {
      return schema.parse(Object.assign({}, defaultValue, parsed));
    } catch (fallbackErr) {
      console.error("[Fallback Parse Failed] returning clean default value:", fallbackErr);
      return defaultValue;
    }
  }
}

// ============================================
// CORE AI ADAPTERS WITH INTEGRATED LLM SCHEMAS
// ============================================

/**
 * Analyse une recette littéraire brute d'athlète et extrait précisément les ingrédients, portions et macros.
 *
 * @param {GoogleGenAI} aiClient Client GenAI déjà configuré avec la clé secrète
 * @param {string} recipeText Texte libre de recette de cuisine
 * @returns {Promise<object>} Le brouillon RecipeDraft conforme
 */
async function parseRecipeText(aiClient, recipeText) {
  if (!recipeText) {
    throw new HttpsError("invalid-argument", "Le texte de la recette est requis.");
  }

  const prompt = `Analyse cette recette de cuisine collée ou dictée par l'athlète et extrait précisément les ingrédients, portions et macro-estimations.
Recette:
${recipeText}`;

  const systemInstruction = `Tu es un nutritionniste de haut niveau pour Aura Elite Next.
Analyse la recette textuelle fournie. Convertis de façon déterministe chaque ingrédient avec son poids théorique en grammes ou volume en ml.
Associe des indices de confiance (0-100) pour chaque ingrédient.
Ne propose jamais de diagnostics ou d'opinions médicales. Formule uniquement en grammage nutritionnel.`;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nom général de la recette" },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rawText: { type: Type.STRING, description: "Ingrédient brut textuel" },
                foodName: { type: Type.STRING, description: "Nom d'aliment standardisé en français" },
                quantity: { type: Type.NUMBER, description: "Quantité numérique extraite" },
                unit: { type: Type.STRING, description: "Unité (g, ml, pièce, portions...)" },
                grams: { type: Type.NUMBER, description: "Poids converti en grammes" },
                confidence: { type: Type.NUMBER, description: "Confiance de 0 à 100" },
                assumptions: { type: Type.STRING, description: "Densité ou portion supposée" }
              },
              required: ["rawText", "foodName", "quantity", "unit", "grams", "confidence", "assumptions"]
            }
          },
          missingMatches: { type: Type.ARRAY, items: { type: Type.STRING } },
          questionsForUser: { type: Type.ARRAY, items: { type: Type.STRING } },
          requiresValidation: { type: Type.BOOLEAN }
        },
        required: ["name", "ingredients", "missingMatches", "questionsForUser", "requiresValidation"]
      }
    }
  });

  return parseAndValidate(response.text || "{}", RecipeDraftSchema, {
    name: "Recette extraite",
    ingredients: [],
    missingMatches: [],
    questionsForUser: [],
    requiresValidation: true
  });
}

/**
 * Extrait les paramètres physiologiques ou logistiques d'un athlète depuis une dictée vocale.
 *
 * @param {GoogleGenAI} aiClient Client GenAI déjà configuré avec la clé secrète
 * @param {string} transcript Texte libre transcrit de la voix
 * @param {"daily"|"rpe"|"nutrition"|"pain"|"context"} formType Sous-moule de formulaire cible
 * @returns {Promise<object>} Le brouillon FormDraft correspondant au moule
 */
async function parseVoiceForm(aiClient, transcript, formType) {
  if (!transcript || !formType) {
    throw new HttpsError("invalid-argument", "Le transcript et le formType sont obligatoires pour la transcription.");
  }

  const systemInstruction = `Tu es un assistant vocal d'élite pour athlètes Aura Elite.
Extrais les paramètres physiologiques depuis la dictée vocale de l'utilisateur.
Utilise rigoureusement le schéma JSON imposé selon le formulaire ${formType}.
Règles :
- daily : fatigue (1-7), stress (1-7), sleepQuality (1-7), soreness (1-7), mood (1-7), motivation (1-7), painLevel (0-10), digestion (1-5), appetite (1-5). NE transpose jamais de diagnostic médical ou d'allusions cliniques.
- rpe : rpe (1-10 échelle de Borg), durationMinutes (durée), feeling (1-5), comment, conformanceToPlan.
- nutrition : mealType (breakfast, lunch, dinner, snack, pre_workout, intra_workout, post_workout), items d'aliments avec quantité numérique et unité d'ingrédient.
- pain : localisation de douleur, intensité (0-10), description, facteurs déclencheurs.
- context : booléens pour voyage, décalage horaire, alcool, chaleur, repas tardif, altitude, stress, examens, etc.
Livre les incertitudes dans 'uncertainFields' et éléments omis dans 'missingFields'.`;

  const schemas = {
    daily: {
      type: Type.OBJECT,
      properties: {
        fatigue: { type: Type.INTEGER, description: "Fatigue (1 à 7)" },
        stress: { type: Type.INTEGER, description: "Stress (1 à 7)" },
        sleepQuality: { type: Type.INTEGER, description: "Qualité sommeil (1 à 7)" },
        soreness: { type: Type.INTEGER, description: "Courbatures (1 à 7)" },
        mood: { type: Type.INTEGER, description: "Humeur (1 à 7)" },
        motivation: { type: Type.INTEGER, description: "Motivation (1 à 7)" },
        painLevel: { type: Type.INTEGER, description: "Douleur (0 à 10)" },
        digestion: { type: Type.INTEGER, description: "Digestion (1 à 5)" },
        appetite: { type: Type.INTEGER, description: "Appétit (1 à 5)" },
        notes: { type: Type.STRING },
        missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        requiresValidation: { type: Type.BOOLEAN }
      },
      required: ["missingFields", "uncertainFields", "requiresValidation"]
    },
    rpe: {
      type: Type.OBJECT,
      properties: {
        rpe: { type: Type.INTEGER, description: "RPE d'effort (1 à 10)" },
        durationMinutes: { type: Type.INTEGER },
        feeling: { type: Type.INTEGER, description: "Feeling subjectif (1 à 5)" },
        comment: { type: Type.STRING },
        conformanceToPlan: { type: Type.BOOLEAN },
        missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        requiresValidation: { type: Type.BOOLEAN }
      },
      required: ["missingFields", "uncertainFields", "requiresValidation"]
    },
    nutrition: {
      type: Type.OBJECT,
      properties: {
        mealType: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              foodName: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              rawCookedState: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              assumptions: { type: Type.STRING }
            },
            required: ["foodName", "quantity", "unit", "confidence", "assumptions"]
          }
        },
        missingQuantities: { type: Type.ARRAY, items: { type: Type.STRING } },
        uncertainItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        requiresValidation: { type: Type.BOOLEAN }
      },
      required: ["items", "missingQuantities", "uncertainItems", "requiresValidation"]
    },
    pain: {
      type: Type.OBJECT,
      properties: {
        localisation: { type: Type.STRING },
        intensity: { type: Type.INTEGER, description: "Douleur (0 à 10)" },
        description: { type: Type.STRING },
        aggravatingFactors: { type: Type.STRING },
        missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        requiresValidation: { type: Type.BOOLEAN }
      },
      required: ["localisation", "intensity", "missingFields", "uncertainFields", "requiresValidation"]
    },
    context: {
      type: Type.OBJECT,
      properties: {
        travel: { type: Type.BOOLEAN, description: "Voyage récent" },
        jetlag: { type: Type.BOOLEAN, description: "Décalage horaire" },
        alcohol: { type: Type.BOOLEAN, description: "Consommation alcool" },
        lateMeal: { type: Type.BOOLEAN, description: "Repas tardif" },
        heat: { type: Type.BOOLEAN, description: "Chaleur excessive" },
        altitude: { type: Type.BOOLEAN, description: "Altitude ressentie" },
        stressEx: { type: Type.BOOLEAN, description: "Stress exceptionnel" },
        exams: { type: Type.BOOLEAN, description: "Surcharge pro/exams" },
        meds: { type: Type.BOOLEAN, description: "Médicaments" },
        cycle: { type: Type.BOOLEAN, description: "Cycle menstruel sensible" },
        competition: { type: Type.BOOLEAN, description: "Compétition" },
        interruptedNight: { type: Type.BOOLEAN, description: "Nuit coupée" },
        notes: { type: Type.STRING },
        missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        requiresValidation: { type: Type.BOOLEAN }
      },
      required: ["missingFields", "uncertainFields", "requiresValidation"]
    }
  };

  const selectedSchema = schemas[formType] || schemas.daily;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash",
    contents: transcript,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: selectedSchema
    }
  });

  // Align validation schemas
  let zodFormSchema = VoiceDailySchema;
  let formDefault = { missingFields: [], uncertainFields: [], requiresValidation: true };

  switch (formType) {
    case 'daily':
      zodFormSchema = VoiceDailySchema;
      break;
    case 'rpe':
      zodFormSchema = VoiceRpeSchema;
      break;
    case 'nutrition':
      zodFormSchema = VoiceNutritionSchema;
      formDefault = { items: [], missingQuantities: [], uncertainItems: [], requiresValidation: true };
      break;
    case 'pain':
      zodFormSchema = VoicePainSchema;
      formDefault = { localisation: "Inconnue", intensity: 0, missingFields: [], uncertainFields: [], requiresValidation: true };
      break;
    case 'context':
      zodFormSchema = VoiceContextSchema;
      break;
  }

  return parseAndValidate(response.text || "{}", zodFormSchema, formDefault);
}

/**
 * Extrait les valeurs macro-nutritionnelles d'une étiquette par 100g via vision par ordinateur.
 *
 * @param {GoogleGenAI} aiClient Client GenAI déjà configuré avec la clé secrète
 * @param {string} imageBase64 Représentation image complète au format Base64 brut
 * @returns {Promise<object>} Le brouillon NutritionLabelDraft converti d'après l'OCR
 */
async function extractNutritionLabel(aiClient, imageBase64) {
  if (!imageBase64) {
    throw new HttpsError("invalid-argument", "L'image base64 de l'étiquette nutritionnelle est requise.");
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: cleanBase64
    }
  };

  const textPart = {
    text: "Analyse cette photo de tableau nutritionnel d'aliment et extrais les nutriments POUR 100 G."
  };

  const systemInstruction = `Tu es un OCR intelligent spécialisé en métabolisme et étiquetage CIQUAL.
Analyse la photo de l'étiquette et extrais les nutriments standardisés uniquement pour 100 G.
Donne des indices de confiance (0-100) pour chaque nutriment.
Ne remplace jamais une valeur illisible par 0, utilise l'argument 'missingReason'.`;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash",
    contents: { parts: [imagePart, textPart] },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING },
          servingSize: { type: Type.STRING },
          valuesPer100g: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nutrientId: { type: Type.STRING, description: "calories, protein, carbs, sugars, fat, saturatedFat, fiber, salt, sodium" },
                value: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                rawText: { type: Type.STRING },
                missingReason: { type: Type.STRING }
              },
              required: ["nutrientId", "value", "unit", "confidence", "rawText"]
            }
          },
          ingredientsText: { type: Type.STRING },
          allergensText: { type: Type.STRING },
          uncertainFields: { type: Type.ARRAY, items: { type: Type.STRING } },
          requiresUserValidation: { type: Type.BOOLEAN }
        },
        required: ["valuesPer100g", "uncertainFields", "requiresUserValidation"]
      }
    }
  });

  return parseAndValidate(response.text || "{}", NutritionLabelDraftSchema, {
    productName: "Aliment extrait",
    servingSize: "100g",
    valuesPer100g: [],
    ingredientsText: "",
    allergensText: "",
    uncertainFields: [],
    requiresUserValidation: true
  });
}

/**
 * Analyse une photo de repas de l'assiette d'un athlète et conjecture des proportions et types d'ingrédients.
 *
 * @param {GoogleGenAI} aiClient Client GenAI déjà configuré avec la clé secrète
 * @param {string} imageBase64 Représentation d'image intégrale au format Base64 brut
 * @returns {Promise<object>} Le brouillon MealPhotoDraft issu du scan visuel
 */
async function analyzeMealPhoto(aiClient, imageBase64) {
  if (!imageBase64) {
    throw new HttpsError("invalid-argument", "L'image de l'assiette repas est impérative.");
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: cleanBase64
    }
  };

  const textPart = {
    text: "Identifie les aliments probables présents dans cette assiette de manière visuelle, estime leurs poids, portions ou volumes."
  };

  const systemInstruction = `Tu es un expert en estimation nutritionnelle visuelle pour Aura Elite Next.
Règles cruciales :
- Ne prétends jamais livrer des calories ou valeurs exactes indiscutables. Indique clairement qu'il s'agit d'un brouillon ('MealPhotoDraft') soumis à validation requise obligatoire de l'utilisateur.
- Propose des alternatives intelligentes d'aliments de notre base de données.
- Liste les incertitudes visuelles : sauce dissimulée, mélange non dissociable, etc.`;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash",
    contents: { parts: [imagePart, textPart] },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedFoods: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Nom informel français de l'ingrédient" },
                probableFoodIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs ou correspondances possibles d'aliments" },
                visualConfidence: { type: Type.NUMBER, description: "Niveau de certitude de détection" },
                estimatedQuantityLabel: { type: Type.STRING },
                quantityConfidence: { type: Type.NUMBER },
                rawCookedGuess: { type: Type.STRING },
                needsUserConfirmation: { type: Type.BOOLEAN },
                uncertaintyNotes: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["label", "probableFoodIds", "visualConfidence", "estimatedQuantityLabel", "quantityConfidence", "rawCookedGuess", "needsUserConfirmation", "uncertaintyNotes"]
            }
          },
          globalUncertainties: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          modelVersion: { type: Type.STRING },
          promptVersion: { type: Type.STRING }
        },
        required: ["detectedFoods", "globalUncertainties", "suggestedQuestions", "modelVersion", "promptVersion"]
      }
    }
  });

  return parseAndValidate(response.text || "{}", MealPhotoDraftSchema, {
    detectedFoods: [],
    globalUncertainties: ["Impossible de vérifier à cause de la qualité de la photo."],
    suggestedQuestions: [],
    modelVersion: "gemini-3.5-flash",
    promptVersion: "1.0.0"
  });
}

/**
 * Analyse et reformule pédagogiquement les indicateurs physiologiques de l'athlète.
 * Fait appel au llm pour écrire un texte en français clair, en évitant le jargon médical.
 *
 * @param {GoogleGenAI} aiClient Client GenAI déjà configuré avec la clé secrète
 * @param {object} profile Profil de l'athlète
 * @param {object} calculatedScores Scores pré-calculés par le moteur
 * @param {string} shortSummary Résumé court de base
 * @param {string} pedagogicalReformulation Reformulation technique
 * @returns {Promise<object>} L'analyse formatée
 */
async function analyzeHealthData(aiClient, profile, calculatedScores, shortSummary, pedagogicalReformulation) {
  if (!profile || !calculatedScores) {
    throw new HttpsError("invalid-argument", "Profil d'athlète et scores requis.");
  }

  const systemInstruction = `
        Vous êtes un rédacteur et vulgarisateur sportif de haut niveau pour Aura Elite.
        Votre unique mission est de reformuler de manière pédagogique, fluide et extrêmement bienveillante les résultats déterminés par notre moteur mathématique interne de physiologie sportive.
        
        RÈGLES CRUCIALES :
        1. Vous ne devez JAMAIS effectuer de calculs mathématiques personnels ni modifier les scores et statuts fournis.
        2. Respectez scrupuleusement les scores calculés par notre moteur :
           - Score Readiness : ${calculatedScores.performanceReadiness?.score}
           - Statut Readiness : ${calculatedScores.performanceReadiness?.status}
           - Score Récupération : ${calculatedScores.recoveryStatus?.score}
           - Statut Récupération : ${calculatedScores.recoveryStatus?.status}
           - Statut Sommeil : ${calculatedScores.sleepHealth?.status}
        3. Utilisez obligatoirement des formulations prudentes, préventives et non médicales pour décrire les limites et contraintes :
           - Ne posez jamais de diagnostic.
           - Parlez de "signaux de surcharge à surveiller", "charge aiguë élevée par rapport à l'historique récent", "adaptation recommandée".
         4. Intégrez l'explication contextuelle suivante fournie par l'Explainability Layer :
           - "${shortSummary}"
           - "${pedagogicalReformulation}"
        
        Rédigez une synthèse claire d'environ 3 à 4 phrases en français dans la propriété "summary".
  `;

  const prompt = `
        Profil de l'athlète : ${JSON.stringify(profile)}
        Résultats physiologiques internes : ${JSON.stringify(calculatedScores)}
        
        Produisez l'analyse reformulée au format JSON respectant strictement le schéma.
  `;

  const response = await aiClient.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Synthèse de l'état actuel de récupération." }
        },
        required: ["summary"]
      }
    }
  });

  const validated = parseAndValidate(response.text || "{}", HealthAnalysisSchema, {
    summary: "Signaux physiologiques stables. Poursuivez vos entraînements en restant à l'écoute de vos sensations."
  });

  return {
    summary: validated.summary,
    usageLog: {
      feature: "reformulation",
      model: "gemini-3.5-flash",
      status: "confirmed",
      createdAt: new Date().toISOString()
    }
  };
}

module.exports = {
  parseRecipeText,
  parseVoiceForm,
  extractNutritionLabel,
  analyzeMealPhoto,
  analyzeHealthData
};
