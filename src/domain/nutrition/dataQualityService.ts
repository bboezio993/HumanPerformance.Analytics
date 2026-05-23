/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DataQualityCategory = 
  | "non_valide" 
  | "valide_sans_quantite" 
  | "portions" 
  | "pese";

export function getConfidenceCategory(confidence: number): DataQualityCategory {
  if (confidence <= 0) return "non_valide";
  if (confidence < 55) return "valide_sans_quantite"; // 35-50 roughly, but we span up to 54
  if (confidence < 75) return "portions"; // 55-70
  return "pese"; // 75-90+
}

export function getConfidenceLabel(confidence: number): string {
  const category = getConfidenceCategory(confidence);
  switch (category) {
    case "non_valide": return "Non Valide";
    case "valide_sans_quantite": return "Estimé sans QTE";
    case "portions": return "Mode Portions (X/Y)";
    case "pese": return "Pesé Précis";
  }
}
