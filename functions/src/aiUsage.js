/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { getFirestore } = require("firebase-admin/firestore");

/**
 * Journalise une transaction ou appel d'IA (Gemini) dans les logs d'usage de l'athlète.
 *
 * @param {string} uid UID de l'athlète
 * @param {object} logPayload Métadonnées de l'appel d'IA
 */
async function recordAiUsage(uid, { feature, model, inputHash, cached, status, tokens, cost }) {
  const db = getFirestore();
  const docRef = db.collection("users").doc(uid).collection("aiUsageLogs").doc();

  const logData = {
    id: docRef.id,
    uid,
    feature,
    model: model || "gemini-3.5-flash",
    inputHash: inputHash || "",
    cached: !!cached,
    status: status || "confirmed",
    tokens: tokens || null,
    cost: cost || null,
    createdAt: new Date().toISOString()
  };

  await docRef.set(logData);
  return logData;
}

module.exports = { recordAiUsage };
