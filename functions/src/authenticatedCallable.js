/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");

/**
 * Sécurise et encapsule une fonction callable.
 * Enforce l'authentification de l'athlète, normalize le traitement des erreurs,
 * et journalise les événements sans divulguer de données anatomiques, médicales ou subjectives sensibles.
 *
 * @param {object|function} options Options Firestore ou fonction handler directe.
 * @param {function} [handler] Fonction de traitement physique sous-jacente.
 */
function authenticatedCallable(options, handler) {
  let finalOptions = { cors: true };
  let finalHandler = handler;

  if (typeof options === "function") {
    finalHandler = options;
  } else if (typeof options === "object") {
    finalOptions = { ...finalOptions, ...options };
  }

  return onCall(finalOptions, async (request) => {
    // 1. Isolation & Sécurité : Enforce la session active
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "L'accès aux routines analytiques Aura Elite exige une authentification athlète valide."
      );
    }

    const uid = request.auth.uid;

    try {
      // 2. Exécution du traitement de la fonction callable
      return await finalHandler(request, uid);
    } catch (error) {
      // 3. Normalisation de sortie et journalisation étanche sans données personnelles
      console.error(`[Aura Engine Cloud Error] Exception détectée pour l'utilisateur UID: ${uid.substring(0, 6)}...`, {
        code: error.code || "internal_execution_failed",
        message: error.message
      });

      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Une anomalie est survenue lors du traitement cloud Aura Elite."
      );
    }
  });
}

module.exports = { authenticatedCallable };
