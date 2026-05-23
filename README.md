# Aura Elite

Aura Elite est une plateforme personnelle de monitoring destinée aux athlètes de haut niveau (et passionnés exigeants) visant l'optimisation de la performance, l'équilibre de la charge d'entraînement, et le suivi des signaux de charge et récupération.

## Périmètre du Projet

Aura Elite se positionne comme un agrégateur et moteur d’analyse déterministe centré sur :
1. **Garmin** : comme source de données physiologique (HRV, sommeil, biometrie) et sportive (activités, TSS, charges). L'intégration se fait via l'import direct de fichiers ZIP, CSV, FIT ou JSON (pas d'API externe requise en V1).
2. **Saisie Utilisateur** : via des formulaires journaliers subjectifs (Index Hooper, RPE de séance, contexte de vie, hydratation, logs de douleur, menstruations).
3. **Données Dérivées (Engine)** : Notre moteur déterministe (Aura Analytics) calcule longitudinalement l'ACWR (Acute:Chronic Workload Ratio), les z-scores de récupération, les dettes de sommeil, et les bilans énergétiques (si la masse maigre est renseignée).

**Architecture et Philosophie :**
- **Déterministe & Transparent** : Aucun "score magique" généré par une IA. Tous les calculs sont mathématiques et affichent les "drivers" exacts qui les composent (Data Used, Data Missing, Limits).
- **Prudence & Non-Médical** : Aura Elite propose des *recommandations* et des *signaux de vigilance* (ex: disponibilité énergétique à interpréter prudemment) en conservant un wording très prudent ("signal de vigilance", "adaptation recommandée"). Aucun diagnostic n'est posé.
- **Explainability Layer** : Les rapports sous forme de textes destinés aux athlètes sont d'abord structurés par un moteur interne, puis reformulés de façon pédagogique en bout de chaîne (ex: Gemini) – uniquement à des fins de *rewrite* littéraire, sans liberté d'action sur les tendances ni sur les chiffres.

## Cadre Strictement Non Médical

Aura Elite est un outil logiciel conçu exclusivement pour l'optimisation de la performance sportive et le bien-être. Les analyses affichées dépendent entièrement de la qualité des données tierces (Garmin) et subjectives saisies par l'utilisateur. 
L'application ne pose aucun diagnostic, ne traite aucune pathologie et n'offre aucun avis médical. En cas de douleur aiguë ou de symptômes persistants, l'application suggère d'observer une prudence accrue et de recourir à une évaluation professionnelle.

## Moteur Modulaire (Analysis Engine)

La chaîne de calcul est séparée en sous-moteurs distincts :
- **Baseline Engine** : Suivi longitudinal robuste (7, 14, 28, 42, 90 jours) avec MAD/Median et indices de maturité des données.
- **Training Load Engine** : Gère l'ACWR et la dynamique des charges.
- **Sleep Engine** : Agrège durée, score, dette de sommeil et RHR nocturne.
- **Recovery Engine** : Fusionne HRV, RHR, et logs subjectifs (Hooper).
- **Nutrition/Context/Mental Engines** : Modélisent le bilan énergétique, le stress et les contraintes externes (voyages, alcool, examens).
- **Readiness Engine & Risk Boundary** : Calculent le score final de disponibilité et évaluent les situations nécessitant prudence ou évaluation professionnelle (ex: douleur extrême isolée).

## Qualité des données (Data Quality)

Chaque donnée ingérée passe par un évaluateur de qualité (couche `assessDataQuality`) mesurant son intégrité, sa fraîcheur temporelle et sa cohérence de source. Le score assigné à chaque métrique (0-100) va par la suite influencer les intervalles de calcul de la plateforme, plafonnant la certitude des moteurs en cas de contexte faible ou partiellement renseigné.

## Données rejetées / Quarantaine

Aucune information ne disparaît sans laisser de trace :
Les valeurs détectées comme aberrantes ou dont les attributs ne matchent pas le registre strict de l'application (finalConfidence < 50) sont orientées vers une quarantaine systémique (`rejectedMetrics`). Ces données exclues restent vérifiables en vue d'audit (diagnostic des sources, anomalies des parsers ou saisies hasardeuses de l'utilisateur).

## Architecture Cloud-First, Modèles IA de Saisie & Vie Privée

Aura Elite cible une architecture moderne **Cloud-First** couplée à des modèles d'assistance par IA (Gemini) strictes pour lever toute friction de saisie :
- **Source de Vérité Cloud** : Dès que l'athlète crée un compte ou s'authentifie, **Firebase Firestore** devient l'unique source de vérité de ses logs de santé et sportifs. `IndexedDB` n'intervient plus que comme cache asynchrone hors-ligne et file d'attente réseau (offline-queue).
- **Sécurité et Isolation (RGPD)** : Tous les documents de l'athlète sont sécurisés au sein de collections imbriquées de type `/users/{uid}/...` (notamment `/mealLogs`, `/metrics`, `/recipes`, `/pains`). L'isolation est étanche et régie par des Règles de Sécurité Firestore verrouillant les accès au seul propriétaire authentifié.
- **Droit à l'Oubli et Purge** : L'athlète dispose d'une gouvernance explicite avec contrôle de suppression locale, suppression cloud globale pour suppression de compte, rétention limitée des photos et exports standardisés au format JSON portable.

### Assistances IA de Saisie Obligatoires (Moteur de Brouillon)

Afin d'éviter toute saisie de données manuelles laborieuse, quatre flux d'IA sont intégrés de manière obligatoire. Chaque flux d'IA a un rôle strict d'accélérateur et génère un **Brouillon (Draft)** transitoire devant être audité et validé par l'athlète avant persistance définitive.

1.  **Saisie Photo Repas (Gemini Vision)** : Upload asynchrone de la photo vers un bucket Cloud Storage sécurisé sous l'URI de l'athlète. Analyse via la Cloud Function `analyzeMealPhoto` renvoyant le schéma `MealPhotoDraft` (aliments probables, portions, incertitudes, questions sémantiques).
2.  **OCR d'Étiquettes Nutritionnelles** : Capture photo ou téléversement d'un tableau de valeurs d'emballage vers Storage. Extraction asynchrone par `extractNutritionLabel` renvoyant un `NutritionLabelDraft` avec étalonnage par 100g, incertitudes de détection et aide à la vigilance sur les allergènes.
3.  **Saisie Vocale (Transcription & Extraction)** : Enregistrement de 15 à 45 secondes d'expression libre. Transcription via l'API Web Speech, puis segmentation structurée par la Cloud Function `parseVoiceForm` renvoyant un `VoiceDraft`/`FormDraft` pré-remplissant instantanément le formulaire journalier actif (Daily check-in, RPE, etc.).
4.  **Import de Recettes par Texte Libre** : Collage ou dictée d'une recette littéraire brute. Extraction structurée des ingrédients, portions théoriques et poids finaux par `parseRecipeText` renvoyant une `RecipeDraft`.

### Matrice de Stockage et Vie Privée (Cible Beta)

| Catégorie de Donnée | Stockage Local (Cache) | Cloud (Firestore) | Export (JSON) | Suppression locale | Suppression distante |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Profil physique** | oui | oui (source de vérité) | oui | oui | oui |
| **Métriques Garmin** | oui | oui (source de vérité) | oui | oui | oui |
| **Activités & Entrainements** | oui | oui (source de vérité) | oui | oui | oui |
| **Nutrition (Meal Logs & Recettes)**| oui | oui (source de vérité) | oui | oui | oui |
| **Douleurs & Bien-être** | oui | oui (source de vérité) | oui | oui | oui |
| **Enregistrements Vocaux & Photos**| oui (temporaire) | oui (Storage avec rétention) | oui | oui | oui |

---

## Intégrations Tiers & Garmin

*   **Open Food Facts & Code-Barres** : Module de numérisation de code-barres par caméra (ZXing) avec fallback de saisie manuelle. Utilisation de la Cloud Function de raccordement s'appuyant sur l'API officielle OFF pour mapper les aliments industriels dans la base.
*   **Garmin Import** : Support de l'import physique autonome par fichiers (ZIP, CSV, JSON, FIT) en local ou cloud. L'application prépare les interfaces de consentement du connecteur Garmin API direct sans simulation mensongère (carte informative "En préparation" désactivée par défaut).

---

## Nutrition : Moteurs et Règles Métier

Pour maintenir une fiabilité analytique, le modèle énergétique actuel exige une base de profils corporels complète (poids, taille, masse grasse). Sans ces informations, l'application neutralise le niveau de certitude quant au risque de déficit et bloque ses estimations.
Les calculs finaux de nutrition sont exclusivement exécutés par le code interne déterministe (`recipeEngine.ts`, `mealLogEngine.ts`), l'IA n'ayant aucune licence pour calculer les calories ou scores définitifs mais agissant comme un passeur de données fluide.

---

## Validation et Tests

Un script dédié (`npm run test`) couvre la prévention d'erreurs déterministes sur des snapshots fixes, validant :
*   Le blocage des calculs métaboliques sans composition corporelle.
*   Le rejet qualifié des métriques incorrectes ou physiologiquement impossibles (Quarantaine).
*   La non-régression sémantique avec blocage automatique des formulations et analogies médicales (`wordingPolicy.test.ts`).
*   Le respect absolu de la logique "Draft" de l'IA sans pré-sauvegarde automatique dans la base.

