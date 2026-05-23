# FEUILLE DE ROUTE TECHNIQUE (ROADMAP BETA)
## Consolidation de l'Architecture Cloud-First & Sécurisée de Aura Elite Next

Ce document fait foi de spécification interne pour guider les vagues de transition et d'intégration de la suite logicielle sportive Aura Elite Next, en pleine adéquation avec le cahier des charges de la version Beta.

---

### I. Modèle d'Isolation Rigoureux des Données (RGPD & Données Physio/Santé)

#### Choix d'isolation : Document Infiltré sous `/users/{uid}/`
*   **Décision d'architecture (Garantie de Sécurité Maximale)** : Pour s'assurer qu'aucun athlète ne puisse accéder aux données physiologiques, repas ou programmes d'un autre, toutes les collections de données sont imbriquées sous le document de profil de premier niveau de l'utilisateur.
*   **Structure des Collections Firestore Cibles** :
    *   `/users/{uid}/profile/main` : Informations anthropométriques de l'athlète (poids, taille, objectif corporel).
    *   `/users/{uid}/settings/privacy` : Consentements RGPD explicites, opt-in/opt-out de rétention média (photos/voix).
    *   `/users/{uid}/settings/aiUsage` : Suivi quotidien des volumes de requêtes d'IA.
    *   `/users/{uid}/metrics/{metricId}` : Métriques issues de Garmin ou saisies manuelles (HRV, RHR, sommeil, poids).
    *   `/users/{uid}/activities/{activityId}` : Séances sportives et historiques d'entraînement.
    *   `/users/{uid}/garminImports/{importId}` : Historique traçable d'imports manuels ou automatisés.
    *   `/users/{uid}/mealLogs/{mealLogId}` : Journal nutritionnel détaillé.
    *   `/users/{uid}/recipes/{recipeId}` : Recettes consolidées étalonnées par portions et masse finale.
    *   `/users/{uid}/nutritionDrafts/{draftId}` : Brouillons transitoires de repas par IA (attente validation).
    *   `/users/{uid}/voiceDrafts/{draftId}` : Brouillons transitoires de synthèses vocales (attente validation).
    *   `/users/{uid}/mediaAssets/{assetId}` : Métadonnées et chemins Storage des photos ou audios d'assistance.
*   **Validation des Règles de Sécurité Firestore** : Le déploiement des règles s'assure que seul le propriétaire authentifié dont l'UID correspond au chemin d'URI est autorisé à lire ou écrire dans ces branches :
    ```javascript
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    ```

---

### II. Gestion de la Synchronisation Réactive (Session, Cache & Retries)

*   **Zustand comme Cache UI Réactif** : Zustand sert d'intermédiaire synchrone instantané dans l'application pour une réactivité optimale de l'interface graphique face aux interactions de l'athlète.
*   **Registre des Statuts d'Écritures** : Chaque transaction de synchronisation avec Firestore met à jour un registre temporaire réactif (`syncStatuses`) dans le store pour informer visuellement l'athlète :
    *   `pending` : L'écriture asynchrone est en cours de transmission au Cloud (clignotement orange).
    *   `synced` : La donnée est enregistrée de manière pérenne et sécurisée (indicateur vert).
    *   `failed` : Échec de synchronisation dû à une perte réseau ou un blocage de validation (indicateur rouge).
*   **Résilience Hors-Connexion** : Les requêtes d'écriture s'appuient sur l'IndexedDB et la file d'attente d'écriture du SDK Firestore client pour acheminer automatiquement les modifications dès le retour de la connectivité.

---

### III. Migration vers les Cloud Functions (Remplacement de server.ts)

Afin d'éliminer tout serveur long-running en production de manière hautement sécurisée, toute la logique métier sensible d'IA et de proxies tiers sera migrée du serveur de développement Express (`server.ts`) vers des **Google Cloud Functions serverless** sécurisées :

```
                           +-------------------------------+
                           |     AURA ELITE CLIENT APP     |
                           +---------------+---------------+
                                           |
                 +-------------------------+-------------------------+
                 | (Writes/Reads via SDK)                            | (Secure HTTPS Callables with Auth Check)
                 v                                                   v
     +--------------------------+                       +-----------------------------+
     |   Firestore Database     |                       |  Google Cloud Functions     |
     |                          |                       |  (Node.js 20 Serverless)    |
     |   - Nested user Paths    |                       +--------------+--------------+
     |   - Secured via auth.uid |                                      |
     +--------------------------+                      +---------------+---------------+
                                                       |                               |
                                                       v                               v
                                          +-------------------------+     +---------------------+
                                          |   Open Food Facts API   |     | Gemini Flash / Pro  |
                                          |   (With User-Agent)     |     | (Secret API Keys)   |
                                          +-------------------------+     +---------------------+
```

#### Plan de Transition des Fonctions Backend Obligatoires (Sprint 2 & 3) :
1.  **lookupOpenFoodFacts** : Validation de code-barres, proxy avec User-Agent identifié et mise en cache produit.
2.  **parseRecipeText** : Réception de texte libre de recette, traitement structuré JSON par Gemini et retour exclusif de `RecipeDraft`.
3.  **parseVoiceForm** : Extraction de données structurées physiologiques ou subjectives basées sur la transcription vocale de 45 secondes, sans sauvegarde finale directe.
4.  **extractNutritionLabel** : Analyse par vision par ordinateur des emballage-produits et retour d'un tableau nutritionnel étalonné par 100g.
5.  **analyzeMealPhoto** : Détection d'aliments probables par IA visuelle et retour de proportions conjecturées avec un score de confiance.
6.  **checkAiQuota & logAiUsage** : Vérification stricte des limites quotidiennes par athlète (ex: 5 analyses photo/jour) et mise à jour de logs d'usage anonymisés pour audit des coûts de requêtes.
