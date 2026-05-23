/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MealPhotoDraftType } from "../../domain/nutrition/mealPhotoDraftSchema";
import { FoodCandidate } from "../../domain/nutrition/matchFoodCandidates";
import { internalFoodDatabase } from "../../domain/nutrition/foodDatabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Check, 
  HelpCircle, 
  Database,
  AlertTriangle,
  X
} from "lucide-react";

interface EditedFoodItem {
  label: string;
  rawCookedGuess: string;
  visualConfidence: number;
  gramsSelected: number;
  candidates: FoodCandidate[];
  selectedCandidateId?: string;
  matchedFoodId?: string;
  matchedFoodName?: string;
}

interface MealPhotoReviewScreenProps {
  analysisResult: MealPhotoDraftType;
  initialEditedFoods: EditedFoodItem[];
  onConfirm: (foods: EditedFoodItem[], keepPhoto: boolean) => void;
  onCancel: () => void;
}

export function MealPhotoReviewScreen({
  analysisResult,
  initialEditedFoods,
  onConfirm,
  onCancel
}: MealPhotoReviewScreenProps) {
  const [editedFoods, setEditedFoods] = useState<EditedFoodItem[]>(initialEditedFoods);
  const [keepPhoto, setKeepPhoto] = useState(false);

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

  const handleRemoveFood = (idx: number) => {
    setEditedFoods(editedFoods.filter((_, i) => i !== idx));
  };
  
  const handleToggleRawCooked = (idx: number) => {
    const updated = [...editedFoods];
    updated[idx].rawCookedGuess = updated[idx].rawCookedGuess === 'cooked' ? 'raw' : 'cooked';
    setEditedFoods(updated);
  };

  return (
    <div className="p-4 border rounded-2xl bg-secondary/5 border-border/80 space-y-4 animate-fade-in text-xs">
      <div className="flex justify-between items-center border-b pb-2">
        <div>
          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Estimation Visuelle Proratisée</span>
          <h5 className="font-bold text-foreground flex items-center gap-1.5">
            Aliments & Portions détectés :
          </h5>
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
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">{food.label}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center flex-wrap gap-1.5">
                      <button 
                        onClick={() => handleToggleRawCooked(idx)}
                        className="text-[9px] font-mono leading-none py-1 px-1.5 border rounded hover:bg-secondary transition-colors"
                      >
                        {food.rawCookedGuess === "cooked" ? "Cuit" : "Cru"}
                      </button>
                      <span className="text-muted-foreground text-[9px]">Confiance visuelle: {food.visualConfidence}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <label className="text-[9px] text-muted-foreground block">Poids (g) :</label>
                      <input 
                        type="number" 
                        value={food.gramsSelected} 
                        onChange={(e) => handleUpdateGrams(idx, Number(e.target.value))}
                        className="w-16 bg-background border rounded text-xs text-foreground font-bold font-mono text-center py-0.5"
                      />
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[9px] text-muted-foreground block">Calories :</span>
                      <span className="font-mono font-bold text-foreground">{customCal}</span>
                    </div>

                    <button onClick={() => handleRemoveFood(idx)} className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="p-2 border border-secondary/80 bg-secondary/10 rounded-xl flex items-center gap-2">
                  <Database size={12} className="text-primary shrink-0" />
                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">Associer au catalogue :</span>
                  {food.candidates.length > 0 ? (
                    <select
                      value={food.selectedCandidateId || ""}
                      onChange={(e) => handleBindCandidate(idx, e.target.value)}
                      className="flex-1 text-[10px] bg-background border rounded px-1.5 py-0.5 font-sans focus:outline-none"
                    >
                      <option value="">-- Mode IA libre (estimation) --</option>
                      {food.candidates.map((c) => (
                        <option key={c.foodId} value={c.foodId}>
                          {c.name} ({c.calories} kcal/100g)
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
        {editedFoods.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-xs italic">
            Tous les aliments ont été supprimés.
          </div>
        )}
      </div>

      {analysisResult.suggestedQuestions && analysisResult.suggestedQuestions.length > 0 && (
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

      {analysisResult.globalUncertainties && analysisResult.globalUncertainties.length > 0 && (
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

      <div className="text-[9px] text-muted-foreground/60 border-t pt-2 flex justify-between items-center">
        <span>Modèle : {analysisResult.modelVersion}</span>
        <span>Règle : v{analysisResult.promptVersion}</span>
      </div>

      {/* Retention controls */}
      <div className="border border-border p-3 rounded-xl flex items-center justify-between bg-background">
        <div>
          <span className="font-bold text-[10px] block text-foreground">Conservation de la photo</span>
          <span className="text-[9px] text-muted-foreground">Stocker pour mon historique ou supprimer immédiatement.</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={keepPhoto} 
            onChange={(e) => setKeepPhoto(e.target.checked)} 
            className="w-3.5 h-3.5 accent-primary" 
          />
          <span className="text-[10px] font-bold">Conserver</span>
        </label>
      </div>

      <div className="pt-2 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="text-xs h-8 text-muted-foreground font-bold"
        >
          Annuler
        </Button>
        <Button
          onClick={() => onConfirm(editedFoods, keepPhoto)}
          disabled={editedFoods.length === 0}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs h-8"
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Valider les portions ({editedFoods.length})
        </Button>
      </div>
    </div>
  );
}
