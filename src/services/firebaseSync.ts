/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NormalizedMetric, GarminActivity, GarminImportLog, UserProfile } from '../types';
import { RepositoryProvider } from './RepositoryProvider';
import { auth } from '../firebase';

/**
 * ARCHITECTURE DE DONNÉES / DATA PRIVACY
 * ====================================
 * Aura Elite Next est une application pleinement cloud-first.
 * Toutes les données utilisateur, y compris les mesures biométriques passives, les activités
 * Garmin, ainsi que les journaux subjectifs de nutrition, douleurs, cycles menstruels
 * et questionnaires Hooper, sont synchronisées en temps réel de manière sécurisée et isolée par UID
 * dans Firestore comme source de vérité. No IndexedDB acts only as a local offline cache.
 * 
 * Toutes les écritures de synchronisation transitent obligatoirement par le DataRepository unifié
 * pour préserver le respect des contrats de sécurité et d'isolation.
 */

export const syncMetricsToFirestore = async (metrics: NormalizedMetric[]) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveMetrics(metrics);
};

export const syncActivitiesToFirestore = async (activities: GarminActivity[]) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveActivities(activities);
};

export const syncLogToFirestore = async (log: GarminImportLog) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveGarminImportLog(log);
};

export const syncProfileToFirestore = async (profile: UserProfile) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveUserProfile(profile);
};

// --- Cloud-First Active Synchronizers ---

export const syncMealLogToFirestore = async (mealLog: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveMealLog(mealLog);
};

export const deleteMealLogFromFirestore = async (id: string) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().deleteMealLog(id);
};

export const syncRecipeToFirestore = async (recipe: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveRecipe(recipe);
};

export const deleteRecipeFromFirestore = async (id: string) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().deleteRecipe(id);
};

export const syncHooperLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveHooperLog(log);
};

export const syncSessionRpeToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveSessionRpe(log);
};

export const syncPainLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().savePainLog(log);
};

export const syncMenstrualLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveMenstrualLog(log);
};

export const syncContextLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveContextLog(log);
};

export const syncWeeklyScreeningLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveWeeklyScreeningLog(log);
};

export const syncAllergenBypassLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveAllergenBypassLog(log);
};

export const syncFoodProductToFirestore = async (foodProduct: any) => {
  if (!auth.currentUser) return;
  await RepositoryProvider.getRepository().saveFoodProduct(foodProduct);
};
