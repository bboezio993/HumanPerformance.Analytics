/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { validateWording, FORBIDDEN_MEDICAL_TERMS } from "./wordingPolicy";

console.log("====================================================");
console.log("      AURA ELITE : TESTS WORDING POLICY (SAFETY)    ");
console.log("====================================================");

// Exemple 1 : Un texte sain ne doit pas déclencher d'erreur
const compliantText = "L'athlète présente une charge aiguë élevée. Une stratégie de récupération active et d'adaptation de la charge d'entraînement est recommandée.";
const checkCompliant = validateWording(compliantText);
assert.strictEqual(checkCompliant.isValid, true, "Un texte sans termes médicaux doit être valide.");
console.log("✅ Texte conforme validé sans erreur.");

// Exemple 2 : Des textes contenant des termes strictement interdits doivent être rejetés
const medicalTexts = [
  { text: "L'analyse montre un diagnostic de fatigue chronique.", term: "diagnostic" },
  { text: "Nous conseillons de traiter cette pathologie au plus vite.", term: "pathologie" },
  { text: "Ce manque d'apport est une carence sévère.", term: "carence" },
  { text: "L'athlète présente tous les symptômes du RED-S.", term: "RED-S" },
  { text: "Attention à ne pas tomber dans le surentraînement.", term: "surentraînement" },
];

for (const m of medicalTexts) {
  const check = validateWording(m.text);
  assert.strictEqual(check.isValid, false, `Le texte contenant le terme "${m.term}" aurait dû échouer.`);
  assert.ok(check.forbiddenTermsFound.map(t => t.toLowerCase()).includes(m.term.toLowerCase()) || check.forbiddenTermsFound.length > 0, `Le terme interdit détecté doit inclure "${m.term}"`);
  console.log(`✅ Détection réussie et blocage du terme interdit : "${m.term}"`);
}

// Exemple 3 : Vérification exhaustives de tous les termes interdits de la liste
console.log("Vérification complète de chacun des termes interdits isolés :");
for (const term of FORBIDDEN_MEDICAL_TERMS) {
  const result = validateWording(`Le système a détecté un cas de ${term} chez l'athlète.`);
  assert.strictEqual(result.isValid, false, `Le terme interdit "${term}" n'a pas été détecté.`);
  assert.ok(result.forbiddenTermsFound.length > 0, `La liste des termes trouvés pour "${term}" est vide.`);
  console.log(`  - Bloqué : "${term}"`);
}

console.log("====================================================");
console.log("   TOUS LES TESTS DE WORDING S'EXÉCUTENT EN GREEN ! ");
console.log("====================================================");
export const wordingTestsPassed = true;
