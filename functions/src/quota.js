/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { getFirestore } = require("firebase-admin/firestore");

/**
 * Limites de quotas journalières strictes pour la phase Beta d'Aura Elite (Cahier des charges Page 6).
 */
const QUOTA_LIMITS = {
  meal_photo: 5,
  photo_repas: 5,
  label_ocr: 10,
  ocr_etiquette: 10,
  recipe_text: 20,
  recette_texte: 20,
  voice_form: 30,
  voix: 30,
  reformulation: 10
};

/**
 * Vérifie et incrémente de manière atomique le quota d'IA d'un athlète dans Firestore pour le jour actuel.
 *
 * @param {string} uid UID de l'utilisateur
 * @param {string} feature Clé de la fonctionnalité d'assistance IA
 * @returns {Promise<{allowed: boolean, remaining: number}>} Statut d'autorisation et quota résiduel.
 */
async function checkAndIncrementQuota(uid, feature) {
  const db = getFirestore();
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  const docRef = db.collection("users").doc(uid).collection("settings").doc("aiUsage");

  return db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(docRef);
    const limit = QUOTA_LIMITS[feature] || 10;
    
    let data = docSnap.exists ? docSnap.data() : {};
    
    // Initialise le jour s'il n'existe pas
    if (!data[today]) {
      data[today] = {};
    }
    
    const currentUsage = data[today][feature] || 0;
    
    if (currentUsage >= limit) {
      return { allowed: false, remaining: 0 };
    }
    
    // Incrémente le quota de manière sécurisée
    const newUsage = currentUsage + 1;
    data[today][feature] = newUsage;
    
    // Sauvegarde atomique
    transaction.set(docRef, data, { merge: true });
    
    return { allowed: true, remaining: limit - newUsage };
  });
}

module.exports = { checkAndIncrementQuota, QUOTA_LIMITS };
