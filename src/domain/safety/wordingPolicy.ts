/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Charte sémantique et politique de gel des termes interdits (Wording Policy).
 * Cette politique de sécurité et de conformité produit d'Aura EliteNext interdit l'utilisation
 * directe ou par affirmation de terminologies médicales, cliniques ou de diagnostics pathologiques
 * dans l'interface utilisateur, les prompts envoyés aux modèles d'IA, et les rapports générés.
 */

export const FORBIDDEN_MEDICAL_TERMS = [
  "diagnostic",
  "diagnostic médical",
  "diagnostiquer",
  "maladie",
  "pathologie",
  "soigner",
  "guérir",
  "prescrire",
  "prescription",
  "traitement",
  "thérapeutique",
  "clinique",
  "médical",
  "surentraînement", // Remplacer par "signal de surcharge", "charge aiguë élevée"
  "carence", // Remplacer par "apport potentiellement insuffisant", "disponibilité énergétique basse"
  "RED-S", // Relative Energy Deficiency in Sport -> Remplacer par "vigilance disponibilité énergétique" ou "signaux de fatigue cumulée"
  "triade", // Triade de l'athlète féminine -> Remplacer par "vigilance métabolique/énergétique"
  "pathologique",
  "anémie",
  "dépression",
  "anxiété clinique",
  "guérison"
];

export interface WordingCheckResult {
  isValid: boolean;
  forbiddenTermsFound: string[];
}

/**
 * Scanne un texte donné pour détecter la présence de termes médicaux interdits.
 * Permet un filtrage insensible à la casse et tolérant aux signes de ponctuation simples.
 * @param text Le texte (UI, recommandation, prompt) à valider.
 */
export function validateWording(text: string): WordingCheckResult {
  if (!text) {
    return { isValid: true, forbiddenTermsFound: [] };
  }

  const normalizedText = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Supprime les accents de manière robuste

  const found: string[] = [];

  for (const term of FORBIDDEN_MEDICAL_TERMS) {
    const normalizedTerm = term
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Recherche de correspondances exactes de mots ou sous-chaînes critiques
    // On utilise un regex simple ou inclus pour attraper les pluriels et variations
    const regex = new RegExp(`\\b${normalizedTerm}\\w*\\b`, "i");
    if (regex.test(normalizedText) || normalizedText.includes(normalizedTerm)) {
      found.push(term);
    }
  }

  return {
    isValid: found.length === 0,
    forbiddenTermsFound: found,
  };
}

/**
 * Fournit une alternative sémantique autorisée et prudente pour chaque terme médical interdit.
 * Permet d'aider les développeurs et de guider les prompts d'IA vers un wording conforme.
 */
export const WORDING_ALTERNATIVES: Record<string, string> = {
  "diagnostic": "évaluation de l'équilibre charge/récupération, signal, tendance",
  "diagnostiquer": "identifier des tendances de fatigue, mettre en évidence des signaux",
  "maladie": "état de méforme temporaire, fatigue accrue, interruption de l'effort physique",
  "pathologie": "surcharge tissulaire, fatigue physique marquée, inconfort",
  "soigner": "favoriser la récupération active, optimiser le repos",
  "guérir": "restaurer les capacités d'effort, achever la phase de récupération",
  "prescrire": "recommander, suggérer des pistes d'ajustement",
  "prescription": "protocole d'adaptation, suggestion d'ajustement de charge",
  "traitement": "stratégie de récupération, protocole de repos passif ou actif",
  "surentraînement": "surcharge aiguë élevée, fatigue cumulative, déséquilibre de charge prolongé",
  "carence": "apport nutritionnel possiblement bas, signal d'adéquation incomplète",
  "RED-S": "disponibilité énergétique possiblement basse, fatigue systémique cumulée",
  "triade": "signaux d'adaptation métabolique à surveiller, vigilance d'adéquation de disponibilité énergétique",
  "médical": "suivi de bien-être physique et de charge sportive",
};
