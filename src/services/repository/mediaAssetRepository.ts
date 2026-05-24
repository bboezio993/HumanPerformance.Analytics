/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../../firebase";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { CloudFunctionsGateway } from "../cloudFunctionsGateway";
import { StorageService } from "../storageService";

export interface MediaAsset {
  id: string;
  url: string;
  status: "uploaded" | "deleted";
  sourceType: "meal_photo" | "ocr_label" | "voice";
  storagePath?: string;
  deleteReason?: string;
  createdAt?: any;
}

export async function saveMediaAsset(uid: string, asset: Omit<MediaAsset, "createdAt">): Promise<void> {
  if (!uid) return;
  const docRef = doc(db, "users", uid, "mediaAssets", asset.id);
  await setDoc(docRef, {
    ...asset,
    createdAt: serverTimestamp()
  }, { merge: true });
}

export async function deleteMediaAsset(uid: string, assetId: string, reason: string): Promise<void> {
  if (!uid) return;
  const docRef = doc(db, "users", uid, "mediaAssets", assetId);
  
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as MediaAsset;
      if (data.storagePath) {
        await StorageService.deleteFile(data.storagePath);
      }
    }
  } catch (e) {
    console.error("Failed to delete physical storage file", e);
  }

  // Soft delete representation for the retention controls
  await setDoc(docRef, {
    status: "deleted",
    deleteReason: reason,
    deletedAt: serverTimestamp()
  }, { merge: true });
}
