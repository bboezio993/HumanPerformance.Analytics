# Audit Technique et Cartographie du Dépôt - Aura Elite Next

Cet audit dresse l'état des lieux approfondi du dépôt initial avant d'entamer les sprints de développement de la version Beta. Il analyse l'architecture, la conformité aux exigences produit, et identifie les zones de risque technique, de sécurité et réglementaire (RGPD/Médical).

---

## 1. Cartographie des Fichiers et Organisation du Projet

L'architecture actuelle suit un découpage modulaire entre la couche de présentation (React), les moteurs physiologiques déterministes (Domain), et la persistance des données (Services/Repositories).

```
/
├── components/ui/            # Composants graphiques atomiques d'interface (Shadcn/UI)
├── src/
│   ├── components/           # Assistants de capture spécifiques (Photos, Voix, OCR, etc.)
│   ├── domain/               # Logique métier et moteurs physiologiques déterministes
│   │   ├── dataQuality/      # Évaluation de la fraîcheur et complétude des données
│   │   ├── metrics/          # Enregistrement et modélisation des métriques athlètes
│   │   ├── nutrition/        # Moteur de conversion de portions, recettes & aliments
│   │   ├── recommendations/  # Système de conseils basé sur les scores sportifs
│   │   ├── science/          # Registre de preuves scientifiques adossant les assertions
│   │   └── units/            # Moteur de conversion métrique / impérial
│   ├── layouts/              # Gabarit global de mise en page (MainLayout)
│   ├── pages/                # Écrans fonctionnels de l'application (Dashboard, Nutrition, Sleep, etc.)
│   ├── services/             # Couche d'infrastructure et d'accès aux données
│   │   ├── analysisEngine/   # Moteur d'analyse déterministe complet (Readiness, Fatigue, ACWR, etc.)
│   │   ├── garmin/           # Pipelines d'import et parsers de fichiers (FIT, CSV, ZIP)
│   │   ├── CloudDataRepository.ts   # Persistance Firestore Cloud
│   │   ├── LocalDataRepository.ts   # Persistance IndexedDB locale
│   │   ├── RepositoryProvider.ts    # Sélection dynamique du dépôt actif (Local vs Cloud)
│   │   └── gemini.ts         # Service de reformulation pédagogique contrôlée par IA
│   └── store/                # Gestion d'état global réactif client via Zustand
├── functions/                # Fonctions serverless prêtes pour la migration vers le Cloud (Firebase Functions)
├── firestore.rules           # Règles de sécurité Firestore initiales
└── metadata.json             # Paramètres de l'applet et permissions d'environnement
```

---

## 2. Analyse des Dépendances et Scripts (package.json)

### Dépendances majeures et rôles :
*   `@google/genai` (v1.29.0) : SDK officiel et moderne de Google pour l'interaction avec l'API Gemini.
*   `firebase` (v12.12.0) : SDK Firebase client pour la synchronisation, l'authentification et l'écriture dans Firestore et Storage.
*   `zustand` (v5.0.12) : Gestionnaire d'état robuste et extrêmement performant avec support optionnel pour les snapshot-listeners de synchronisation.
*   `idb-keyval` (v6.2.2) : Cache d'écriture local asynchrone pour assurer l'accès hors-ligne.
*   `framer-motion` & `motion` : Moteurs d'animation fluides pour les transitions d'écrans et l'engagement de l'athlète.
*   `recharts` (v3.8.1) : Bibliothèque de visualisation graphique pour le suivi longitudinal des scores (HRV, sommeil, charge).
*   `fit-file-parser` & `papaparse` : Outils d'ingestions de bas niveau pour extraire les metrics brutes Garmin.

### Scripts disponibles :
*   `npm run dev` : Démarre le serveur local de dev via `tsx server.ts` sur le port 3000.
*   `npm run build` : Gère la compilation de l'application SPA React.
*   `npm run lint` : Vérification du typage système via `tsc --noEmit`.
*   `npm run test` : Lance le script d'exécution des tests physiologiques déterministes sur snapshots (`tsx test-engine.ts`).

---

## 3. Cartographie des Routes de Navigation (src/App.tsx)

L'application déclare un ensemble de routes d'accès hiérarchisés sous un layout unifié (`MainLayout.tsx`) préservant l'unité ergonomique globale :

1.  **Dashboard (`/`)** : Le cockpit de l'athlète affichant ses scores d'optimalité de charge, les priorités d'action du jour et la confiance des calculs.
2.  **Biometrics (`/biometrics`)** : Suivi des constantes anthropométriques et analyse corporelle (poids, taille, etc.).
3.  **Sleep (`/sleep`)** : Monitoring chronobiologique, détection des dettes de repos et analyse de la fréquence cardiaque au repos (RHR).
4.  **Recovery (`/recovery`)** : Synthèse de la récupération physiologique avec suivi de la variabilité cardiaque (HRV) et de l'état quotidien subjectif.
5.  **Menstrual Cycle (`/cycle`)** : Évaluation d'impact du cycle sur la performance et alertes d'ajustements de charge.
6.  **Training (`/training`)** : Calculateur de ratio de charge ACWR, sensation d'entraînement et surcharge progressive.
7.  **Nutrition (`/nutrition`)** : Saisie des repas manuelle ou assistée par IA, calcul d'adéquation énergétique et suivi d'hydratation.
8.  **Mental (`/mental`)** : Analyse de charge externe et santé psychologique (Screenings PHQ-9, GAD-7, PSS).
9.  **Connections (`/connections`)** : Activation des connecteurs d'importance (Garmin, etc.).
10. **Garmin Import Hub (`/connections/garmin`)** : Zone sécurisée d'importation manuelle de fichiers physiologiques et audits de parsers.
11. **Settings (`/settings`)** : Profil utilisateur, préférences et configuration d'alertes.
12. **Confidentiality (`/confidentiality`)** : Gestion RGPD, retrait d'autorisation, droit d'accès et suppression physique des médias locaux/cloud.

---

## 4. Architecture de Gestion d’État Global (Zustand)

Le store global, localisé dans `/src/store/useStore.ts`, pilote l'état réactif répercuté à l'écran.
*   Il sert de cache synchrone local et d'intermédiaire vers les écritures physiques dans la base.
*   Il conserve les données physiologiques brutes (`metrics`), l'historique d'entraînement, le contexte de vie, les questionnaires subjectifs d'index de Hooper, ainsi que l'état d'authentification utilisateur (`user`).
*   Il intègre un système d'initialisation des écoutes en temps réel (Listeners Firestore ou cache hors-ligne) pour mettre à jour instantanément la vue à la moindre actualisation distante.

---

## 5. Intégration de l’Intelligence Artificielle (src/services/gemini.ts)

L'intégration de l'IA (Gemini) respecte scrupuleusement la règle produit d'**architectural honesty & no-hallucination** :
1.  **Un Moteur Déterministe d'Abord** : Les calculs phares (Readiness, ACWR, Sommeil, Récupération) sont entièrement exécutés par des algorithmes mathématiques déterministes écrits en TypeScript (`/src/services/analysisEngine/`).
2.  **Un Rôle Strict de Reformulation Pédagogique** : L'appel au modèle `gemini-3.5-flash` n'est déclenché qu'à la fin de la chaîne pour vulgariser de manière humaine, bienveillante et compréhensible les données et explications issues du moteur mathématique interne (`runExplainabilityLayer`).
3.  **Encadrement Systémique Strict** : Les instructions système (`systemInstruction`) de l'API bloquent de façon radicale la déviation médicale, l'invention de valeurs aberrantes, ou l'altération des scores d'origine.
4.  **Dispositif anti-panne (Fallback)** : En cas de coupure réseau ou d'épuisement de quotas d'API, le système bascule automatiquement sur les explications formelles textuelles générées en interne par les algorithmes, sans perturbation pour l'utilisateur.

---

## 6. Architecture des Dépôts de Données (Repositories)

L'accès aux données respecte le principe d'abstraction via une interface contractuelle commune (`DataRepository`) :
*   `LocalDataRepository.ts` : S'appuie sur `idb-keyval` pour le stockage direct et performant des logs subjectifs et sportifs dans IndexedDB à l'échelle du navigateur.
*   `CloudDataRepository.ts` : Mobilise le SDK client Firebase Firestore pour persister de manière asynchrone les données de santé de l'athlète de façon isolée et conforme.
*   `RepositoryProvider.ts` : Arbitre dynamiquement les résolutions de requêtes entre la persistance Cloud (si l'utilisateur est connecté et identifié via Firebase Auth) et le mode Local (hors connexion).
*   **Contrainte Forte** : Les composants React n'appellent jamais directement l'API Firestore. Ils requièrent systématiquement le singleton provider de repository pour isoler la vue des contraintes de stockage.

---

## 7. Identification des Zones de Risque Majeures avant la Beta

À ce stade d’initialisation, quatre faiblesses architecturales et fonctionnelles critiques sont répertoriées :

### 🚨 Risque 1 : Exposition de Securité de la Clé API Gemini (Client-Side bundle)
*   **Problématique** : Bien que le service `src/services/gemini.ts` lise la clé via `process.env.GEMINI_API_KEY`, le fichier de configuration de build `vite.config.ts` inclut une injection de bundle au compile-time (`JSON.stringify(env.GEMINI_API_KEY)`).
*   **Sévérité** : **CRITIQUE**. Cela expose la clé secrète dans le bundle JS accessible en clair dans le navigateur de l'athlète, permettant des vols de quotas et des contournements d'App Check.
*   **Mesure d'atténuation (Sprint 2)** : Suppression de l'injection d'environnement au compile-time et transition complète vers des appels Cloud Functions asynchrones agissant comme mandataires authentifiés ultra-sécurisés.

### ⚠️ Risque 2 : Sémantique Médicale & Limites Diagnostiques (Wording Policy)
*   **Problématique** : Plusieurs écrans ou fragments de texte explicatif du moteur interne pourraient employer un wording trop péremptoire ou médicalisé ("diagnostic", "maladie", "RED-S", "carence", "surentraîinement"), augmentant l'exposition juridique de la plateforme.
*   **Sévérité** : **HAUTE**. L'application n'est pas un dispositif médical de diagnostic de santé.
*   **Mesure d'atténuation (Sprint 0.2)** : Création d'un gel sémantique rigoureux (`wordingPolicy.ts`) couplé à des tests automatisés de non-régression sémantique scannant le code source au build pour interdire systématiquement ces termes à risque.

### ⚠️ Risque 3 : Source of Truth et Logique de Synchronisation Floue
*   **Problématique** : Le modèle d'isolation décrit dans l'historique de la Roadmap v1 fait référence à des collections Firestore en Top-Level segmentées par un attribut `uid` interne au document. Cette structure autoriserait accidentellement des failles de fuite de données d'un athlète à l'autre en cas d'insuffisance ou de faille dans l'écriture des règles Firestore.
*   **Sévérité** : **MOYENNE**. RGPD / Sécurisation des données de performance et de santé.
*   **Mesure d'atténuation (Sprint 1)** : Restructurer et renforcer impérativement les accès vers des schémas d'isolation stricts de premier niveau sous la forme d'imbrication d'URI de type `/users/{uid}/...` (comme stipulé dans le plan beta page 4 et 5), et forcer la double-destruction locale/cloud à la demande pour l'athlète.

### ⚙️ Risque 4 : Dépendances et Absence d'Intégration CI Automatisée
*   **Problématique** : L'absence de vérification automatique au push des règles Firestore et du moteur de l'Analysis Engine expose le dépôt à des régressions lors de modifications incrémentales de types ou de seuils d'optimalité.
*   **Sévérité** : **FAIBLE**. Confort de livraison.
*   **Mesure d'atténuation (Sprint 12)** : Paramétrer d'ici la livraison finale des Workflows GitHub Actions stricts rejetant toute modification dont le lint de non-émission, les builds de bundle ou les scans de sécurité défaillent.

### 🔒 Recommandation relative aux risques techniques mineurs (Administration & Déploiement)
*   **Problématique** : Nécessité critique de rappeler aux administrateurs de provisionner l'API d'authentification (Firebase Auth) et de stocker en toute sécurité la clé secrète `GEMINI_API_KEY` dans Google Secret Manager avant tout déploiement de Cloud Functions, afin de garantir l'étanchéité des requêtes et l'intégrité de l'environnement serverless.
*   **Sévérité** : **FAIBLE / MINEURE**. Intégrité de la sécurité et du déploiement.
*   **Mesure d'atténuation (Sprint E)** : Intégrer des alertes d'environnement explicites et répertorier des consignes de déploiement officielles dans la documentation technique du dépôt et au sein du workflow de setup administratif.

