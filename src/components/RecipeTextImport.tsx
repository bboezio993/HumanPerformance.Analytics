/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useAuth } from "../components/FirebaseProvider";
import { RepositoryProvider } from "../services/RepositoryProvider";
import { CloudFunctionsGateway } from "../services/cloudFunctionsGateway";
import { validateAndCleanRecipeDraft } from "../domain/nutrition/recipeDraftSchema";
import { matchFoodCandidates, FoodCandidate } from "../domain/nutrition/matchFoodCandidates";
import { internalFoodDatabase } from "../domain/nutrition/foodDatabase";
import { convertCookingState } from "../domain/nutrition/cookingYield";
import { 
  FileText, 
  HelpCircle, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  Loader2, 
  Plus, 
  Search,
  Scale,
  Utensils,
  BookOpen,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RecipeTextImport({ onAddMealItem }: { onAddMealItem: (item: any) => void }) {
  const store = useStore();
  const { user } = useAuth();
  
  const [recipeText, setRecipeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editedIngredients, setEditedIngredients] = useState<any[]>([]);
  const [missingMatches, setMissingMatches] = useState<string[]>([]);
  const [questionsForUser, setQuestionsForUser] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(undefined);

  // Recipe confirmations metrics
  const [numberOfPortions, setNumberOfPortions] = useState<number>(1);
  const [finalWeightGrams, setFinalWeightGrams] = useState<number>(0);
  const [cookingYieldWarning, setCookingYieldWarning] = useState<string | null>(null);

  // Store lists for dynamic candidate lookup
  const favoriteFoods = store.favoriteFoods || [];

  const handleParse = async () => {
    if (!recipeText.trim()) return;
    setLoading(true);
    setError(null);
    setEditedIngredients([]);
    setDraftName("");

    try {
      const parsedData = await CloudFunctionsGateway.generateAiInsights("recipe", { recipeText });
      
      // Pass through Zod layer for compliance (P5.1/P5.2)
      const cleanDraft = validateAndCleanRecipeDraft(parsedData);
      
      let draftId;
      if (user) {
        draftId = `draft_recipe_${Date.now()}`;
        try {
          await RepositoryProvider.getRepository().saveNutritionDraft({
            id: draftId,
            uid: user.uid,
            sourceType: "recipe_text_ai",
            sourceRef: "text_import",
            extractedJson: cleanDraft,
            confidence: 85,
            status: "draft",
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn("Recipe Draft persistence failed", e);
        }
      }

      setDraftName(cleanDraft.name);
      setMissingMatches(cleanDraft.missingMatches);
      setQuestionsForUser(cleanDraft.questionsForUser);
      // NOTE: Using a state variable or attaching draftId to state to finalize it later
      setDraftId(draftId);

      // Pre-match candidates immediately on load (P5.4)
      const enrichIngredients = cleanDraft.ingredients.map((ing) => {
        const candidates = matchFoodCandidates(ing.foodName, [], favoriteFoods);
        const topCandidate = candidates.length > 0 ? candidates[0] : null;

        // Auto-match if candidate confidence is excellent (score >= 80)
        let resolvedItem = null;
        if (topCandidate && topCandidate.score >= 80) {
          resolvedItem = internalFoodDatabase.find(f => f.id === topCandidate.foodId);
        }

        return {
          ...ing,
          matchedFoodId: resolvedItem?.id || undefined,
          matchedFoodName: resolvedItem?.name || undefined,
          calories: resolvedItem ? Math.round((resolvedItem.calories * ing.grams) / 100) : Math.round(ing.grams * 1.5),
          protein: resolvedItem ? Number(((resolvedItem.protein * ing.grams) / 100).toFixed(1)) : Number((ing.grams * 0.08).toFixed(1)),
          carbs: resolvedItem ? Number(((resolvedItem.carbs * ing.grams) / 100).toFixed(1)) : Number((ing.grams * 0.18).toFixed(1)),
          fat: resolvedItem ? Number(((resolvedItem.fat * ing.grams) / 100).toFixed(1)) : Number((ing.grams * 0.04).toFixed(1)),
          // Cache lists of candidates
          candidates: candidates
        };
      });

      setEditedIngredients(enrichIngredients);

      // Calculate initial sum of ingredient grams for default final weight
      const sumGrams = enrichIngredients.reduce((acc, ing) => acc + (ing.grams || 0), 0);
      setFinalWeightGrams(sumGrams);

      // Detect potential cooking yield discrepancy (dry raw grains like rice or pasta)
      const hasRawGrains = enrichIngredients.some(
        ing => ing.matchedFoodId === "pates_crues" || ing.matchedFoodId === "riz_cru"
      );
      if (hasRawGrains) {
        setCookingYieldWarning(
          "Alerte Cuisson : Cette recette utilise des féculents crus (riz/pâtes). Le poids final cuit réabsorbera l'eau d'environ 2.7x à 2.8x. Pensez à ajuster le poids de votre recette finalisée."
        );
      } else {
        setCookingYieldWarning(null);
      }

      // If uid available, write aiUsageLogs in Firestore to document cost
      if (user && parsedData.usageLog) {
        try {
          await RepositoryProvider.getRepository().saveAiUsageLog({ ...parsedData.usageLog, uid: user.uid });
        } catch (fsErr) {
          console.warn("[Firestore] AI Usage logs write skipped:", fsErr);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Délai d'attente dépassé ou anomalie d'analyse IA. Assurez-vous d'avoir saisi du texte lisible.");
    } finally {
      setLoading(false);
    }
  };

  // Triggered when an ingredient raw values or weights change
  const handleUpdateIngredientGram = (idx: number, gr: number) => {
    const updated = [...editedIngredients];
    const ing = updated[idx];
    const targetGrams = Math.max(0, gr);

    // Update weights and recalculate macros
    let resolvedItem = null;
    if (ing.matchedFoodId) {
      resolvedItem = internalFoodDatabase.find(f => f.id === ing.matchedFoodId);
    }

    updated[idx] = {
      ...ing,
      grams: targetGrams,
      calories: resolvedItem ? Math.round((resolvedItem.calories * targetGrams) / 100) : Math.round(targetGrams * 1.5),
      protein: resolvedItem ? Number(((resolvedItem.protein * targetGrams) / 100).toFixed(1)) : Number((targetGrams * 0.08).toFixed(1)),
      carbs: resolvedItem ? Number(((resolvedItem.carbs * targetGrams) / 100).toFixed(1)) : Number((targetGrams * 0.18).toFixed(1)),
      fat: resolvedItem ? Number(((resolvedItem.fat * targetGrams) / 100).toFixed(1)) : Number((targetGrams * 0.04).toFixed(1))
    };

    setEditedIngredients(updated);
  };

  // Bind individual extracted ingredient to an official catalog item
  const handleBindFoodItem = (idx: number, candidate: FoodCandidate | null) => {
    const updated = [...editedIngredients];
    const ing = updated[idx];

    if (!candidate) {
      // Unbind and restore generic backup
      updated[idx] = {
        ...ing,
        matchedFoodId: undefined,
        matchedFoodName: undefined,
        calories: Math.round(ing.grams * 1.5),
        protein: Number((ing.grams * 0.08).toFixed(1)),
        carbs: Number((ing.grams * 0.18).toFixed(1)),
        fat: Number((ing.grams * 0.04).toFixed(1))
      };
    } else {
      const resolvedItem = internalFoodDatabase.find(f => f.id === candidate.foodId);
      if (resolvedItem) {
        updated[idx] = {
          ...ing,
          matchedFoodId: resolvedItem.id,
          matchedFoodName: resolvedItem.name,
          calories: Math.round((resolvedItem.calories * ing.grams) / 100),
          protein: Number(((resolvedItem.protein * ing.grams) / 100).toFixed(1)),
          carbs: Number(((resolvedItem.carbs * ing.grams) / 100).toFixed(1)),
          fat: Number(((resolvedItem.fat * ing.grams) / 100).toFixed(1))
        };
      }
    }

    setEditedIngredients(updated);
  };

  // Computes grand total macros summed up for overall ingredients (P5.5)
  const totalCaloriesSum = editedIngredients.reduce((sum, ing) => sum + (ing.calories || 0), 0);
  const totalProteinSum = editedIngredients.reduce((sum, ing) => sum + (ing.protein || 0), 0);
  const totalCarbsSum = editedIngredients.reduce((sum, ing) => sum + (ing.carbs || 0), 0);
  const totalFatSum = editedIngredients.reduce((sum, ing) => sum + (ing.fat || 0), 0);

  // Recalculates portion division values safely
  const portionsCount = Math.max(1, numberOfPortions);
  const portionCalories = Math.round(totalCaloriesSum / portionsCount);
  const portionProtein = Number((totalProteinSum / portionsCount).toFixed(1));
  const portionCarbs = Number((totalCarbsSum / portionsCount).toFixed(1));
  const portionFat = Number((totalFatSum / portionsCount).toFixed(1));

  // Auto-fill final weight using wet recalculations if user desires
  const applyCookingAdjustment = () => {
    setLoading(true);
    let finalWetSum = 0;
    editedIngredients.forEach(ing => {
      if (ing.matchedFoodId === "pates_crues" || ing.matchedFoodId === "riz_cru") {
        const yieldObj = convertCookingState(ing.grams, ing.matchedFoodId, "cooked");
        finalWetSum += yieldObj.finalGrams;
      } else {
        finalWetSum += ing.grams;
      }
    });
    setFinalWeightGrams(Math.round(finalWetSum));
    setCookingYieldWarning(null);
    setLoading(false);
  };

  // Save official Recipe and push to MealLogger composed items
  const handleConfirmRecipeDraft = async () => {
    if (editedIngredients.length === 0 || !draftName.trim()) return;

    const finalRecipeId = `recipe_draft_${Date.now()}`;
    
    // 1. Prepare standard Recipe schema saving to the state Repository
    const officialRecipe = {
      id: finalRecipeId,
      name: draftName.trim(),
      items: editedIngredients.map((ing) => ({
        foodId: ing.matchedFoodId || "generique_plat",
        foodName: ing.matchedFoodName || ing.foodName,
        quantity: ing.quantity || ing.grams,
        unit: ing.unit || "g",
        gramsSelected: ing.grams,
        calories: ing.calories
      })),
      finalWeightGrams: finalWeightGrams || editedIngredients.reduce((sum, ing) => sum + ing.grams, 0),
      numberOfPortions: portionsCount,
      totalNutrition: {
        calories: totalCaloriesSum,
        protein: totalProteinSum,
        carbs: totalCarbsSum,
        fat: totalFatSum
      },
      nutritionPerPortion: {
        calories: portionCalories,
        protein: portionProtein,
        carbs: portionCarbs,
        fat: portionFat
      },
      createdAt: new Date().toISOString()
    };

    // Commit changes to local state storage
    store.addRecipe(officialRecipe);

    if (user && draftId) {
      try {
        await RepositoryProvider.getRepository().saveNutritionDraft({
            id: draftId,
            uid: user.uid,
            sourceType: "recipe_text_ai",
            sourceRef: "text_import",
            extractedJson: { recipe: officialRecipe },
            confidence: 95,
            status: "confirmed",
            userCorrections: editedIngredients,
            createdAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Failed to mark recipe draft as confirmed", e);
      }
    }

    // 2. Resolve exactly one portion of the new recipe as a Meal item inside the current composed logger meal logs
    onAddMealItem({
      foodId: finalRecipeId,
      foodName: `${draftName} (1 Portion)`,
      quantity: 1,
      unit: "serving",
      gramsSelected: Math.round((finalWeightGrams || editedIngredients.reduce((sum, ing) => sum + ing.grams, 0)) / portionsCount),
      conversionConfidence: 95,
      conversionAssumptions: `Recette confirmée de ${portionsCount} portions. Total: ${totalCaloriesSum} kcal, Par portion: ${portionCalories} kcal`,
      sourceType: "recipe",
      recipeId: finalRecipeId,
      recipeServingCount: portionsCount,
      calories: portionCalories,
      protein: portionProtein,
      carbs: portionCarbs,
      fat: portionFat
    });

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setEditedIngredients([]);
      setDraftName("");
      setRecipeText("");
    }, 2000);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Recipe Paste section */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5" id="label-textarea-recipe">
          <FileText size={14} className="text-emerald-500" />
          Coller le texte brut de votre recette (liste d'ingrédients, blog ou dictée) :
        </label>
        <textarea
          rows={5}
          value={recipeText}
          onChange={(e) => setRecipeText(e.target.value)}
          placeholder={`Exemple: Shaker Sport de l'Athlète
- 1 cuillère d'Isolat de Whey
- 1 grosse Banane fraîche
- 20g de flocons d'avoine brute
Ou encore une recette de pâtes au four issue d'un blog de cuisine.`}
          className="w-full text-xs rounded-xl border border-border bg-background p-3.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder:text-muted-foreground/45 leading-relaxed"
          id="textarea-recipe-text"
        />
      </div>

      {/* Button analyze trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <span className="text-[10px] text-muted-foreground font-medium leading-tight max-w-sm">
          Filtres de souveraineté Aura Engine : l'IA structure, extrait et convertit mais la validation des portions et les calculs restent 100% locaux.
        </span>
        <Button
          onClick={handleParse}
          disabled={loading || !recipeText.trim()}
          className="text-xs font-bold shrink-0 self-end"
          id="btn-analyze-recipe"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Analyse par Gemini-3.5-flash...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500 animate-pulse" />
              Lancer l'Analyse Assistée 🧪
            </>
          )}
        </Button>
      </div>

      {/* Error block */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs flex gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Confirmation Success message */}
      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs flex gap-2 items-center font-semibold">
          <Check size={16} className="shrink-0 text-emerald-500" />
          <span>La recette de l'athlète a été enregistrée et une portion a été ajoutée à votre repas actuel !</span>
        </div>
      )}

      {/* Interactive Ingredients matching editor */}
      {editedIngredients.length > 0 && (
        <div className="p-5 border rounded-2xl bg-secondary/5 border-border space-y-6 animate-fade-in text-xs">
          
          {/* Header block with Name override */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-border/60 pb-3">
            <div className="space-y-1">
              <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider block">Titre de la recette</span>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="text-base font-bold bg-background border border-border px-2.5 py-1 rounded-lg w-full max-w-md focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                placeholder="Nom de la recette"
                id="input-recipe-title"
              />
            </div>
            <Badge variant="outline" className="h-6 gap-1 bg-amber-500/5 text-amber-500 border-amber-500/20 font-mono self-start sm:self-center">
              <Sparkles size={11} /> Extraction validable
            </Badge>
          </div>

          {/* Ingredient lines with mapping options */}
          <div className="space-y-4">
            <h5 className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider">
              Analyse unitaire et appariement des Ingrédients :
            </h5>

            <div className="divide-y divide-border/60 max-h-96 overflow-y-auto pr-1 space-y-4">
              {editedIngredients.map((ing, idx) => {
                return (
                  <div key={idx} className="pt-4 first:pt-0 space-y-3">
                    {/* Header info */}
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground line-through italic block">
                          &laquo; {ing.rawText} &raquo;
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground text-xs">{ing.foodName}</span>
                          <span className="text-[10.5px] text-muted-foreground font-medium font-mono">
                            {ing.quantity} {ing.unit} (~{ing.grams}g)
                          </span>
                        </div>
                      </div>

                      {/* gram override and confidence badge */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-lg bg-background px-2 py-1 gap-1">
                          <input
                            type="number"
                            value={ing.grams}
                            onChange={(e) => handleUpdateIngredientGram(idx, Number(e.target.value))}
                            className="w-12 bg-transparent text-center font-bold text-foreground focus:outline-none font-mono"
                          />
                          <span className="text-[10px] text-muted-foreground">g</span>
                        </div>
                        <Badge className={`font-mono text-[9px] py-0.5 px-1.5 ${ing.confidence >= 80 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-500"}`}>
                          Fiabilité {ing.confidence}%
                        </Badge>
                      </div>
                    </div>

                    {/* Matched food link indicator or Candidate Selector selection */}
                    <div className="bg-secondary/10 p-2.5 rounded-xl border border-border/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9.5px] uppercase font-bold text-muted-foreground">Appariement au Catalogue local</span>
                        {ing.matchedFoodId ? (
                          <Badge className="bg-emerald-500 text-white font-semibold text-[9.5px] py-px px-2 flex gap-1 items-center">
                            ✅ Lié : {ing.matchedFoodName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-500 text-[9.5px] py-px px-2">
                            ⚠️ Valeur approchée (non lié)
                          </Badge>
                        )}
                      </div>

                      {/* Display Top suggestions if not linked or option to modify */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-muted-foreground mr-1">Suggestions :</span>
                        {ing.candidates && ing.candidates.slice(0, 3).map((cand: FoodCandidate) => {
                          const isCurrentlySelected = ing.matchedFoodId === cand.foodId;
                          return (
                            <button
                              key={cand.foodId}
                              type="button"
                              onClick={() => handleBindFoodItem(idx, isCurrentlySelected ? null : cand)}
                              className={`py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 ${isCurrentlySelected ? 'bg-emerald-500 text-white shadow-sm' : 'bg-background hover:bg-secondary border text-muted-foreground hover:text-foreground'}`}
                            >
                              {cand.name}
                              <span className="text-[8px] font-mono opacity-80">({cand.score}%)</span>
                            </button>
                          );
                        })}
                        {(!ing.candidates || ing.candidates.length === 0) && (
                          <span className="text-[10px] text-muted-foreground italic">Aucune suggestion trouvée.</span>
                        )}
                      </div>

                      {/* Local macro summary for this item */}
                      <div className="pt-1.5 flex gap-4 text-[9.5px] font-mono text-muted-foreground">
                        <span>Énergie : <strong className="text-foreground">{ing.calories} kcal</strong></span>
                        <span>Pro : <strong className="text-foreground">{ing.protein}g</strong></span>
                        <span>Glu : <strong className="text-foreground">{ing.carbs}g</strong></span>
                        <span>Lip : <strong className="text-foreground">{ing.fat}g</strong></span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Missing Matches or Questions Blocks */}
          {(missingMatches.length > 0 || questionsForUser.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
              {missingMatches.length > 0 && (
                <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl space-y-1">
                  <span className="font-bold text-red-400 text-[10.5px] flex items-center gap-1">
                    <AlertTriangle size={13} className="shrink-0" /> Ingrédients non résolus :
                  </span>
                  <ul className="list-disc list-inside text-muted-foreground text-[10px] space-y-0.5">
                    {missingMatches.map((item, idx) => (
                      <li key={idx} className="truncate">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {questionsForUser.length > 0 && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl space-y-1">
                  <span className="font-bold text-blue-400 text-[10.5px] flex items-center gap-1">
                    <HelpCircle size={13} className="shrink-0" /> Questions de l'Assistant :
                  </span>
                  <ul className="list-disc list-inside text-muted-foreground text-[10px] space-y-0.5">
                    {questionsForUser.map((item, idx) => (
                      <li key={idx} className="leading-snug">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Cooking Alert Warnings banner */}
          {cookingYieldWarning && (
            <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2 text-[11px] leading-relaxed text-amber-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{cookingYieldWarning}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={applyCookingAdjustment}
                className="hover:bg-amber-500/10 hover:text-amber-500 border-amber-500/25 shrink-0 text-[10px] font-bold h-7 flex gap-1 items-center"
              >
                <RefreshCw size={11} /> Ajuster au poids cuit
              </Button>
            </div>
          )}

          {/* Recipe Configuration details (portions, final weights) */}
          <div className="pt-4 border-t border-border/60 space-y-4">
            <h5 className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider">
              Paramètres Globaux de Portionnement :
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Utensils size={12} /> Portionnement de la Recette (Portions)
                </label>
                <input
                  type="number"
                  min="1"
                  value={numberOfPortions}
                  onChange={(e) => setNumberOfPortions(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-background border border-border px-3 py-1.5 rounded-lg font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  id="input-recipe-portions"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Scale size={12} /> Masse de la Recette Finalisée (Grammes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={finalWeightGrams}
                  onChange={(e) => setFinalWeightGrams(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-background border border-border px-3 py-1.5 rounded-lg font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  id="input-recipe-weight"
                />
              </div>
            </div>
          </div>

          {/* Macro Summary Split layout comparisons (Total vs. Portion) */}
          <div className="p-4 rounded-2xl bg-secondary/15 border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center text-xs">
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Nutrition calculée par portion individuelle :</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-emerald-500 font-mono">{portionCalories} <span className="text-xs font-normal text-muted-foreground">kcal</span></span>
                <span className="text-[10px] text-muted-foreground">/ portion de ~{Math.round((finalWeightGrams || editedIngredients.reduce((sum, ing) => sum + ing.grams, 0)) / portionsCount)}g</span>
              </div>
              <div className="flex gap-2.5 font-mono text-[10px] text-muted-foreground pt-1">
                <span>Pro : <strong className="text-foreground">{portionProtein}g</strong></span>
                <span>Glu : <strong className="text-foreground">{portionCarbs}g</strong></span>
                <span>Lip : <strong className="text-foreground">{portionFat}g</strong></span>
              </div>
            </div>

            <div className="space-y-1 text-left md:text-right border-t md:border-t-0 md:border-l border-border/60 pt-2.5 md:pt-0 md:pl-4">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Nutrition totale du plat :</span>
              <span className="text-sm font-bold text-foreground font-mono block">{totalCaloriesSum} kcal</span>
              <div className="flex gap-2.5 font-mono text-[9px] text-muted-foreground md:justify-end">
                <span>Pro : {totalProteinSum.toFixed(1)}g</span>
                <span>Glu : {totalCarbsSum.toFixed(1)}g</span>
                <span>Lip : {totalFatSum.toFixed(1)}g</span>
              </div>
            </div>
          </div>

          {/* Final confirm action */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-[10px] text-muted-foreground">
              En confirmant : la Recette complète sera stockée dans vos modèles de plats et **1 portion** sera injectée dans le repas en cours.
            </span>
            <Button
              onClick={handleConfirmRecipeDraft}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shrink-0 h-9 flex gap-1.5 items-center"
              id="btn-confirm-recipe"
            >
              <Check className="w-4 h-4" />
              Confirmer la Recette & Ajouter au Log ✓
            </Button>
          </div>

        </div>
      )}
    </div>
  );
}
