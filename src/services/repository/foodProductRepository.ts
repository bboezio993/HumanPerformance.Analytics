/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from "../../firebase";
import { doc, setDoc, getDoc, collection, serverTimestamp } from "firebase/firestore";

export interface UserFoodProduct {
  id: string; // can be barcode or generated
  name: string;
  servingSize?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  ingredientsText?: string;
  allergensText?: string;
  sourceType: "label_ocr" | "open_food_facts" | "manual";
  createdAt: any;
}

/**
 * Creates or updates a food product scoped to the user.
 * This makes the food reusable in future MealLogs.
 */
export async function saveUserFoodProduct(uid: string, food: Omit<UserFoodProduct, "createdAt">): Promise<void> {
  if (!uid) throw new Error("UID required to save user food product");
  
  const docRef = doc(db, "users", uid, "foodProducts", food.id);
  await setDoc(docRef, {
    ...food,
    createdAt: serverTimestamp()
  }, { merge: true });
}

export async function getUserFoodProduct(uid: string, foodId: string): Promise<UserFoodProduct | null> {
  const docRef = doc(db, "users", uid, "foodProducts", foodId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as UserFoodProduct;
}
