/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

/**
 * Supprime physiquement un fichier media de Cloud Storage et y appose un marqueur "deleted" dans Firestore.
 *
 * @param {string} uid UID de l'athlète propriétaire
 * @param {string} storagePath Chemin de stockage complet du fichier
 * @param {string} reason Raison de la suppression (RGPD ou correction utilisateur)
 */
async function deleteMediaFileAndLog(uid, storagePath, reason) {
  const db = getFirestore();
  const storage = getStorage();

  // 1. Suppression physique de Cloud Storage
  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`[Media Cloud Delete] Fichier archivé avec succès de Storage: ${storagePath}`);
    }
  } catch (err) {
    console.warn(`[Media Cloud Delete Warning] Échec de la purge de Storage: ${err.message}`);
  }

  // 2. Marqueur auditables de soft delete dans Firestore (Cahier des charges Page 4)
  const mediaRef = db.collection("users").doc(uid).collection("mediaAssets");
  const querySnap = await mediaRef.where("storagePath", "==", storagePath).get();

  if (!querySnap.empty) {
    for (const doc of querySnap.docs) {
      await doc.ref.update({
        status: "deleted",
        reasonForDeletion: reason || "Purge initiée par l'athlète",
        deletedAt: new Date().toISOString()
      });
    }
  } else {
    // Si l'élément n'a pas été trouvé à l'index de départ, on crée une entrée d'archivage
    const newDoc = mediaRef.doc();
    await newDoc.set({
      id: newDoc.id,
      uid,
      storagePath,
      contentType: "unknown",
      size: 0,
      status: "deleted",
      reasonForDeletion: reason || "Purge manuelle orpheline",
      deletedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  }

  return { success: true, storagePath };
}

module.exports = { deleteMediaFileAndLog };
