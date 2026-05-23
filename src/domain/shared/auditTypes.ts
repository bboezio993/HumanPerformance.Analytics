/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Enums de traçabilité et de statut standardisés pour Aura EliteNext (Sprint 0.3).
 * Ces enums sont obligatoires pour toutes les données automatiques ou manuelles,
 * garantissant l'auditabilité et la conformité sémantique de l'application.
 */

/**
 * Origine technique de la donnée ingérée.
 * Permet de tracer précisément d'où vient chaque enregistrement physique ou physiologique.
 */
export enum SourceType {
  Manual = "manual",
  GarminFile = "garmin_file",
  GarminApiFuture = "garmin_api_future",
  OpenFoodFacts = "open_food_facts",
  Barcode = "barcode",
  MealPhotoAi = "meal_photo_ai",
  LabelOcr = "label_ocr",
  RecipeTextAi = "recipe_text_ai",
  VoiceAi = "voice_ai",
  Derived = "derived"
}

/**
 * cycle de vie d'un enregistrement, notamment pour les brouillons (Drafts)
 * générés par les IA et les médias associés hébergés sur Storage.
 */
export enum AuditStatus {
  Draft = "draft",
  ReadyForReview = "ready_for_review",
  Confirmed = "confirmed",
  Rejected = "rejected",
  Expired = "expired",
  Deleted = "deleted",
  Failed = "failed"
}

/**
 * Représente le score de confiance (0 à 100) attribué à un traitement automatique ou semi-automatique.
 * 0 si non validable ; augmente avec la correction et les revues utilisateur.
 */
export type ConfidenceScore = number; // Plage de 0 à 100

/**
 * Interface de base de métadonnées d'audit communes.
 * Obligatoire pour tout flux automatisé d'IA d'après les principes non négociables (Page 4 et 5).
 */
export interface AuditTrailMetadata {
  sourceType: SourceType;
  status?: AuditStatus;
  confidence: ConfidenceScore;
  assumptions: string[];         // Hypothèses explicites (ex: portions, cru/cuit), jamais masquées.
  missingFields: string[];       // Valeurs absentes ou non documentées explicitement spécifiées.
  modelVersion?: string;          // Version précise du modèle d'IA (Gemini / OCR).
  promptVersion?: string;         // Version exacte du prompt système / schéma de sortie.
  inputHash?: string;            // Hash SHA/MD5 du média ou texte source pour la gestion du cache et quotas.
  userConfirmed: boolean;        // true seulement après une action physique explicite de l'utilisateur.
}
