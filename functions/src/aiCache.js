/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { getFirestore } = require("firebase-admin/firestore");

/**
 * Checks if a cached AI response exists for a given athlete and input payload hash.
 * 
 * @param {string} uid Athlete's unique identifier
 * @param {string} inputHash MD5 hash of the raw input payload
 * @returns {Promise<any|null>} The cached draft or null if not found
 */
async function getAiCache(uid, inputHash) {
  if (!inputHash) return null;
  try {
    const db = getFirestore();
    const cacheRef = db.collection("users").doc(uid).collection("aiCache").doc(inputHash);
    const snap = await cacheRef.get();
    if (snap.exists) {
      const data = snap.data();
      // Cache remains valid for 7 days
      const cacheDate = new Date(data.createdAt);
      const isExpired = Date.now() - cacheDate.getTime() > 7 * 24 * 60 * 60 * 1000;
      if (!isExpired) {
        return data.draft;
      }
    }
  } catch (err) {
    console.error(`[AI Cache Error] Failed to read cache: ${err.message}`);
  }
  return null;
}

/**
 * Saves an AI generated draft in the athlete's personal cache.
 * 
 * @param {string} uid Athlete's unique identifier
 * @param {string} inputHash MD5 hash of the raw input payload
 * @param {any} draft Generated structured AI feedback
 * @returns {Promise<void>}
 */
async function setAiCache(uid, inputHash, draft) {
  if (!inputHash || !draft) return;
  try {
    const db = getFirestore();
    const cacheRef = db.collection("users").doc(uid).collection("aiCache").doc(inputHash);
    await cacheRef.set({
      draft,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[AI Cache Error] Failed to write cache: ${err.message}`);
  }
}

module.exports = { getAiCache, setAiCache };
