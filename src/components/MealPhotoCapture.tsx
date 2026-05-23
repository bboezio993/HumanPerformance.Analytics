/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../components/FirebaseProvider";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { CloudFunctionsGateway } from "../services/cloudFunctionsGateway";
import { validateAndCleanMealPhotoDraft, DetectedFoodItem } from "../domain/nutrition/mealPhotoDraftSchema";
import { matchFoodCandidates, FoodCandidate } from "../domain/nutrition/matchFoodCandidates";
import { internalFoodDatabase } from "../domain/nutrition/foodDatabase";
import { 
  UploadCloud, 
  Loader2, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  Utensils, 
  Sliders, 
  Info,
  ChevronRight,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MealPhotoCapture({ onAddMealItem }: { onAddMealItem: (item: any) => void }) {
  const { user } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [success, setSuccess] = useState(false);

  // Re-typed structure model list of detected foods
  const [editedFoods, setEditedFoods] = useState<Array<DetectedFoodItem & { 
    gramsSelected: number;
    candidates: FoodCandidate[];
    selectedCandidateId?: string;
  }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setAnalysisResult(null);
      setError(null);
      setEditedFoods([]);
    };
    reader.readAsDataURL(files[0]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyzeMeal = async () => {
    if (!imageSrc) return;
    setLoading(true);
    setError(null);

    try {
      const rawData = await CloudFunctionsGateway.generateAiInsights("meal_photo", { imageBase64: imageSrc });
      
      // STEP 1: Strict Schema Validation
      const validatedDraft = validateAndCleanMealPhotoDraft(rawData);
      setAnalysisResult(validatedDraft);

      // STEP 2: Enrich foods with numeric parsed grams and fuzzy matching candidates
      const enriched = validatedDraft.detectedFoods.map(food => {
        // Parse grams from label like '150g' or '80 grams'
        let parsedGrams = 100;
        const match = food.estimatedQuantityLabel.match(/(\d+)/);
        if (match) {
          parsedGrams = Number(match[1]);
        }

        // Use core fuzzy database matcher matching against local DB
        const candidates = matchFoodCandidates(food.label);
        const topCandidate = candidates[0];

        return {
          ...food,
          gramsSelected: parsedGrams,
          candidates,
          selectedCandidateId: topCandidate ? topCandidate.foodId : undefined,
          matchedFoodId: topCandidate ? topCandidate.foodId : undefined,
          matchedFoodName: topCandidate ? topCandidate.name : undefined
        };
      });

      setEditedFoods(enriched);

      // STEP 3: Write serverless quota logs structure into Firebase if user connected
      if (user && rawData.usageLog) {
        try {
          const usageDoc = doc(db, "users", user.uid, "aiUsageLogs", rawData.usageLog.id);
          await setDoc(usageDoc, { ...rawData.usageLog, uid: user.uid });
        } catch (fsErr) {
          console.warn("[Firestore] Skipping logging of usage telemetry:", fsErr);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Délai d'attente d'analyse visuelle dépassé. Prenez une photo plus lumineuse ou recadrez votre assiette.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGrams = (idx: number, grams: number) => {
    const updated = [...editedFoods];
    updated[idx] = { ...updated[idx], gramsSelected: Math.max(0, grams) };
    setEditedFoods(updated);
  };

  const handleBindCandidate = (idx: number, candidateId: string) => {
    const updated = [...editedFoods];
    const food = updated[idx];
    const cand = food.candidates.find(c => c.foodId === candidateId);

    if (cand) {
      updated[idx] = {
        ...food,
        selectedCandidateId: candidateId,
        matchedFoodId: cand.foodId,
        matchedFoodName: cand.name
      };
    } else {
      updated[idx] = {
        ...food,
        selectedCandidateId: undefined,
        matchedFoodId: undefined,
        matchedFoodName: undefined
      };
    }
    setEditedFoods(updated);
  };

  const handleConfirmAndAddAll = () => {
    if (editedFoods.length === 0) return;

    editedFoods.forEach(food => {
      let resolvedItem = null;
      if (food.matchedFoodId) {
        resolvedItem = internalFoodDatabase.find(f => f.id === food.matchedFoodId);
      }

      const g = food.gramsSelected;

      // Compute exact/approx macros
      const calories = resolvedItem 
        ? Math.round((resolvedItem.calories * g) / 100) 
        : Math.round(g * 1.3);
      const protein = resolvedItem 
        ? Number(((resolvedItem.protein * g) / 100).toFixed(1)) 
        : Number((g * 0.06).toFixed(1));
      const carbs = resolvedItem 
        ? Number(((resolvedItem.carbs * g) / 100).toFixed(1)) 
        : Number((g * 0.16).toFixed(1));
      const fat = resolvedItem 
        ? Number(((resolvedItem.fat * g) / 100).toFixed(1)) 
        : Number((g * 0.03).toFixed(1));

      onAddMealItem({
        foodId: `photo_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        foodName: food.matchedFoodName ? `${food.matchedFoodName} (Visuel)` : `${food.label} (Visuel)`,
        quantity: g,
        unit: "g",
        gramsSelected: g,
        conversionConfidence: food.visualConfidence || 75,
        conversionAssumptions: `Estimé visuellement par Vision AI. Résolution: ${food.matchedFoodId ? 'Catalog item matched' : 'Generic fallback default'}. État: ${food.rawCookedGuess}.`,
        sourceType: "meal_photo",
        calories,
        protein,
        carbs,
        fat
      });
    });

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setAnalysisResult(null);
      setImageSrc(null);
      setEditedFoods([]);
    }, 1500);
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {!imageSrc ? (
        <div 
          onClick={handleUploadClick}
          className="border-2 border-dashed border-border/80 hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer bg-secondary/15 hover:bg-secondary/25 transition-all space-y-2 flex flex-col items-center justify-center py-8"
        >
          <Utensils className="w-8 h-8 text-muted-foreground animate-pulse" />
          <p className="font-semibold text-foreground text-xs">Photographier votre assiette de repas 📸</p>
          <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">
            Glissez-déposez ou cliquez pour charger une image de votre assiette complète. Gemini identifiera vos ingrédients avec certitude et précision.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl border overflow-hidden aspect-video bg-black flex justify-center items-center">
            <img src={imageSrc} alt="User meal plate" className="max-h-full object-contain" />
            <button 
              onClick={() => {
                setImageSrc(null);
                setAnalysisResult(null);
                setEditedFoods([]);
              }}
              className="absolute top-2 right-2 p-1 bg-black/80 text-white rounded-lg px-2 text-[10px] font-bold uppercase hover:bg-black transition-all"
            >
              Changer d'image ❌
            </button>
          </div>

          {!analysisResult && (
            <div className="flex justify-end">
              <Button
                onClick={handleAnalyzeMeal}
                disabled={loading}
                className="text-xs h-9 font-bold bg-primary text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Interprétation calorique de l'assiette...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400 animate-pulse" />
                    Estimer calories visuellement ✨
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex gap-2 items-center">
          <Check size={16} />
          <span>Brouillon validé ! Les portions estimées ont été intégrées dans votre journal d'entraînement !</span>
        </div>
      )}

      {analysisResult && editedFoods.length > 0 && (
        <div className="p-4 border rounded-2xl bg-secondary/5 border-border/80 space-y-4 animate-fade-in text-xs">
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Estimation Visuelle Proratisée</span>
              <h5 className="font-bold text-foreground">Aliments & Portions détectés :</h5>
            </div>
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] animate-pulse">
              <Sparkles size={10} />
              Brouillon non validé ⚠️
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto pr-1">
              {editedFoods.map((food, idx) => {
                let resolvedItem = null;
                if (food.matchedFoodId) {
                  resolvedItem = internalFoodDatabase.find(f => f.id === food.matchedFoodId);
                }

                const customCal = resolvedItem 
                  ? Math.round((resolvedItem.calories * food.gramsSelected) / 100) 
                  : Math.round(food.gramsSelected * 1.3);

                return (
                  <div key={idx} className="py-3 flex flex-col gap-2.5">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground text-xs">{food.label}</span>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-[8px] font-mono leading-none py-0.5">{food.rawCookedGuess}</Badge>
                          <span className="text-muted-foreground text-[9px]">Confiance visuelle: {food.visualConfidence}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <label className="text-[9px] text-muted-foreground block">Poids Estimé (g) :</label>
                          <input 
                            type="number" 
                            value={food.gramsSelected} 
                            onChange={(e) => handleUpdateGrams(idx, Number(e.target.value))}
                            className="w-16 bg-background border rounded text-xs text-foreground font-bold font-mono text-center py-0.5"
                          />
                        </div>
                        
                        <div className="text-right">
                          <span className="text-[9px] text-muted-foreground block">Calories (kcal) :</span>
                          <span className="font-mono font-bold text-foreground">{customCal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Candidate Mapping */}
                    <div className="p-2 border border-secondary/80 bg-secondary/10 rounded-xl flex items-center gap-2">
                      <Database size={12} className="text-primary shrink-0" />
                      <span className="text-[10px] font-medium text-muted-foreground shrink-0">Associer au catalogue :</span>
                      {food.candidates.length > 0 ? (
                        <select
                          value={food.selectedCandidateId || ""}
                          onChange={(e) => handleBindCandidate(idx, e.target.value)}
                          className="flex-1 text-[10px] bg-background border rounded px-1.5 py-0.5 font-sans focus:outline-none"
                        >
                          <option value="">-- Conserver l'estimation IA standard --</option>
                          {food.candidates.map((c) => (
                            <option key={c.foodId} value={c.foodId}>
                              {c.name} ({c.calories} kcal)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Aucun aliment correspondant trouvé dans le catalogue</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {analysisResult.suggestedQuestions?.length > 0 && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-1 text-[10.5px] leading-relaxed">
              <span className="font-bold text-blue-400 flex items-center gap-1">
                <HelpCircle size={13} />
                Précisions requises de l'athlète :
              </span>
              <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-1">
                {analysisResult.suggestedQuestions.map((q: string, idx: number) => (
                  <li key={idx} className="text-muted-foreground">{q}</li>
                ))}
              </ul>
            </div>
          )}

          {analysisResult.globalUncertainties?.length > 0 && (
            <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl leading-relaxed text-[10.5px] space-y-1">
              <span className="font-bold text-amber-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                Limites & Incertitudes visuelles (matières grasses cachées...) :
              </span>
              <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-0.5">
                {analysisResult.globalUncertainties.map((unc: string, idx: number) => (
                  <li key={idx}>{unc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Model Traceability Info Footer */}
          <div className="text-[9px] text-muted-foreground/60 border-t pt-2 flex justify-between items-center">
            <span>Modèle : {analysisResult.modelVersion}</span>
            <span>Règle d'Analyse : v{analysisResult.promptVersion}</span>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleConfirmAndAddAll}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Valider toutes les portions ({editedFoods.length} aliments)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
