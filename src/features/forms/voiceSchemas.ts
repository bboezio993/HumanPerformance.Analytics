/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

const FormFieldSchema = z.object({
  value: z.union([z.number(), z.string(), z.boolean(), z.null()]).optional(),
  confidence: z.number().min(0).max(100).describe("Confiance du parseur IA, de 0 à 100"),
  uncertaintyReason: z.string().optional().describe("Raison si l'IA doute de la valeur")
});

export const DailyVoiceDraftSchema = z.object({
  fatigue: FormFieldSchema.optional(),
  stress: FormFieldSchema.optional(),
  sleepQuality: FormFieldSchema.optional(),
  soreness: FormFieldSchema.optional(),
  mood: FormFieldSchema.optional(),
  motivation: FormFieldSchema.optional(),
  painLevel: FormFieldSchema.optional(),
  digestion: FormFieldSchema.optional(),
  appetite: FormFieldSchema.optional(),
  recovery: FormFieldSchema.optional(),
  isIll: FormFieldSchema.optional(),
  notes: FormFieldSchema.optional(),
  missingFields: z.array(z.string()).describe("Champs recommandés absents de la dictée"),
  uncertainFields: z.array(z.string()).describe("Ambiguïtés détectées dans la phrase"),
  requiresValidation: z.boolean().default(true)
});

export const RpeVoiceDraftSchema = z.object({
  rpe: FormFieldSchema.optional(),
  durationMinutes: FormFieldSchema.optional(),
  feeling: FormFieldSchema.optional(),
  comment: FormFieldSchema.optional(),
  missingFields: z.array(z.string()),
  uncertainFields: z.array(z.string()),
  requiresValidation: z.boolean().default(true)
});

// A unified base interface
export type VoiceDraftField = z.infer<typeof FormFieldSchema>;
export type DailyVoiceDraft = z.infer<typeof DailyVoiceDraftSchema>;
export type RpeVoiceDraft = z.infer<typeof RpeVoiceDraftSchema>;
