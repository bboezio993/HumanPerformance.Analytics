/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../../firebase";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

export interface MediaAsset {
  id: string;
  url: string;
  status: "uploaded" | "deleted";
  sourceType: "meal_photo" | "ocr_label" | "voice";
  deleteReason?: string;
  createdAt: any;
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
  // Soft delete representation for the retention controls
  await setDoc(docRef, {
    status: "deleted",
    deleteReason: reason,
    deletedAt: serverTimestamp()
  }, { merge: true });
}

// In a real implementation this would also delete the file from Firebase Storage
