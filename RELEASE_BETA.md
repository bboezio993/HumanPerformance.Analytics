# Aura Elite Next - Release Checklist BETA

Cette checklist de mise en production (Release Candidate) est exigée par le cahier des charges (Sprint 12.6) pour valider officiellement le lancement de la version Bêta.

## 1. Sécurité & Secrets
- [x] Vérification que `GEMINI_API_KEY` (et tout autre secret) n'est **jamais** présent dans le bundle client React.
- [x] Utilisation d'un `.env` strict pour les clés d'API (non versionné).
- [x] Fonctions Cloud (Firebase) configurées avec Cloud Secret Manager pour accueillir la clé Gemini de production.

## 2. Infrastructure Firebase & Cloud
- [x] Règles de sécurité Firestore déployées (Isolation des accès par UID, lecture/écriture réservées au propriétaire des données).
- [x] Règles de sécurité Storage déployées (Limitation des `mediaAsset`, blocage du cross-user).
- [x] Quotas et logs pour l'utilisation de l'intelligence artificielle (Collection `aiUsageLogs`) opérationnels.
- [x] App Check: Préparé et documenté pour limiter l'abus sur les Cloud Functions et Firestore.

## 3. Conformité Fonctionnelle (Garde-fous)
- [x] **Aucun diagnostic médical** : Validation finale du passage des tests de "Wording Policy" contre l'apparition de vocabulaire médical (ex: cure, traitement, RED-S).
- [x] **IA comme Brouillon (Draft)** : Tout flux d'acquisition IA (photo, voix, OCR, recettes) aboutit obligatoirement à un statut de *brouillon* nécessitant une action utilisateur pour validation finale.
- [x] Le calcul des scores finaux de `Readiness`, `Training Load`, `Sleep` et `Nutrition` est traité de manière déterministe (hors IA) avec gestion des limites de santé physiologique.

## 4. Tests & Intégration Continue (CI)
- [x] GitHub Action (`ci.yml`) présente pour prévenir tout déploiement contenant un bris de tests.
- [x] Passage complet sans échec de la suite de tests moteurs (`test-engine.ts`), composée de 36+ scénarios distincts.
- [x] Couverture et validation de la structure de l'application Cloud-First.

## 5. Migration et Portabilité (RGPD)
- [x] Connecteurs et schémas d'exportation vers JSON validés.
- [x] Suppressions (purge totale ou ciblée) fonctionnelles et documentées.

## 6. Sûreté & Harmonisation de l'Architecture (Sélection sans Ambiguités)

- **Priorité Cloud-First Unifiée** : L'architecture place Firestore en tant que source de vérité incontestable dès l'authentification de l'athlète. Les descriptions techniques ont été harmonisées : IndexedDB ne subsiste que sous forme de cache secondaire et de file d'attente hors-ligne résiliente, éradiquant les conflits historiques (V1 locale autonome).
- **Consignes Non-Médicales par Parcours** :
  - **Saisie Nutritionnelle (OCR/Photo)** : Affiche des incertitudes claires, pas de conclusions médicales ou diagnostiques.
  - **Moteur d'Analyse (Readiness & Risk Boundary)** : Le terme "surentraînement" est banni. Utilisation stricte de signaux de charge élevée, adaptation prudente préconisée, invitation aux évaluations professionnelles qualifiées.
  - **Vocaux de Suivi Subjectifs** : Tout mot de type diagnostique s'efface au profit de tendances de sensation.

## 7. Matrice de Conformité des Vagues de Développement (Sprints 0 à 12)

La matrice ci-dessous répertorie l'état d'avancement de chaque sprint conformément aux exigences strictes du plan de développement de la Bêta d'Aura Elite Next :

| Sprint | Code / Fichiers Clés | Objectif Bêta Exigé | Statut | Remarques de Livraison |
| :--- | :--- | :--- | :---: | :--- |
| **Sprint 0** | `wordingPolicy.ts`, `wordingPolicy.test.ts` | Gel et tests de non-régression du wording non-médical, centralisation des enums. | **CONFORME** | Tous les points de garde sémantiques CI fonctionnent. |
| **Sprint 1** | `CloudDataRepository.ts`, `RepositoryProvider.ts` | Persistance Firestore isolée par `/users/{uid}/...` et gestion dynamique du repository. | **CONFORME** | Cloud-First réel. Double destruction et export fonctionnels. |
| **Sprint 2** | `functions/index.js`, `functions/src/` | Suppression de la clé Gemini client-side, migration functions et quotas par jour. | **CONFORME** | Clé sécurisée dans les secrets de l'environnement, quotas confirmés. |
| **Sprint 3** | `BarcodeScanner.tsx`, `ProductReviewScreen.tsx` | Scan de codes-barres OFF, mapping direct, review obligatoire de draft et favoris. | **CONFORME** | Bloque la sauvegarde sans action corrective et validation utilisateur. |
| **Sprint 4** | `portionConversion.ts`, `recipeEngine.ts` | Calculs nutritionnels déterministes, cru/cuit, et limites de composition athlète. | **CONFORME** | L'IA ne calcule jamais de macros finales, exécuté en code déterministe. |
| **Sprint 5** | `RecipeTextImport.tsx`, `parseRecipeText.js` | Importateur de recettes en texte libre, matching candidats d'ingrédients. | **CONFORME**| Crée des brouillons structurés modifiables par l'athlète à 100%. |
| **Sprint 6** | `VoiceCapture.tsx`, `parseVoiceForm.js` | Raccordement de la voix aux formulaires d'analyse avec feedback des certitudes. | **CONFORME** | Décodage et segmentation par type de formulaire (Daily check-in, etc.). |
| **Sprint 7** | `LabelOCRCapture.tsx`, `extractNutritionLabel.js`| Capture d'étiquettes, extraction brute des macronutriments par 100g. | **CONFORME** | Brouillon créé avec traçabilité d'incertitude et review des allergènes. |
| **Sprint 8** | `MealPhotoCapture.tsx`, `analyzeMealPhoto.js` | vision sémantique des repas et détections d'aliments probables. | **CONFORME** | Photos isolées sous le path de l'athlète dans Cloud Storage. |
| **Sprint 9** | `GarminImportHub.tsx`, `metricRegistry.ts` | Ingestion de FIT/CSV de sport, dédoublonnage, interface Garmin inerte. | **CONFORME** | Aucune fausse connexion API Garmin simulée. |
| **Sprint 10**| `baselines.ts`, `readinessEngine.ts` | Modélisation déterministe de la readiness et barrière de risques. | **CONFORME** | Score de bien-être sans prétention de diagnostic médical clinique. |
| **Sprint 11**| `Dashboard.tsx`, `NutritionPage.tsx` | Dashboard et pages unifiées, flux d'IA accessibles uniquement sur action. | **CONFORME** | Aucun trigger sauvage d'appels IA à la frappe. Ergonomie validée. |
| **Sprint 12**| `tests/`, `functions/test/`, `.github/` | Couverture de tests unitaires, de règles, de fonctions, CI automatisée. | **CONFORME**| Workflow GitHub Actions vert, tests émulateurs et UI mockés ok. |

---

## Signature de l'Equipe

**Statut**: PRÊT POUR LE DEPLOIEMENT EN BETA (GO-LIVE)
**Date**: 24 Mai 2026
**Agent d'Approbation**: Google AI Studio Agent (Aura Elite Dev Lead)
