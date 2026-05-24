/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { OcrDraft, OcrNutrientItem } from "../../domain/nutrition/ocrDraftSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Check, 
  Info, 
  Sliders, 
  Sparkles 
} from "lucide-react";

interface LabelReviewScreenProps {
  ocrResult: OcrDraft;
  onConfirm: (correctedData: {
    productName: string;
    nutrients: OcrNutrientItem[];
    quantity: number;
    unit: string;
  }) => void;
  onCancel: () => void;
}

export function LabelReviewScreen({
  ocrResult,
  onConfirm,
  onCancel
}: LabelReviewScreenProps) {
  const [editedName, setEditedName] = useState(ocrResult.productName || "Produit Inconnu");
  const [editedNutrients, setEditedNutrients] = useState<OcrNutrientItem[]>(
    ocrResult.valuesPer100g || []
  );
  
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("g");
  
  const [hasReviewed, setHasReviewed] = useState(false);

  const missingOrUncertain = (ocrResult.uncertainFields || []).length > 0;
  
  const handleUpdateNutrientValue = (idx: number, newVal: number) => {
    const updated = [...editedNutrients];
    updated[idx] = { ...updated[idx], value: Number(newVal) };
    setEditedNutrients(updated);
  };

  const getNutrient = (id: string) => {
    const nut = editedNutrients.find(n => n.nutrientId === id);
    return nut ? nut.value : 0;
  };

  const gramsSelected = unit === "g" ? quantity : quantity * 50; 
  const finalCals = Math.round((getNutrient("calories") * gramsSelected) / 100);
  const finalProtein = Number(((getNutrient("protein") * gramsSelected) / 100).toFixed(1));
  const finalCarbs = Number(((getNutrient("carbs") * gramsSelected) / 100).toFixed(1));
  const finalFat = Number(((getNutrient("fat") * gramsSelected) / 100).toFixed(1));

  const handleValidation = () => {
    onConfirm({
      productName: editedName,
      nutrients: editedNutrients,
      quantity,
      unit
    });
  };

  return (
    <div className="p-4 border rounded-2xl bg-secondary/5 border-border/80 space-y-4 animate-fade-in text-xs">
      <div className="flex justify-between items-center border-b pb-2">
        <div>
          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Valeurs OCR extraites pour 100g</span>
          <input 
            type="text" 
            value={editedName} 
            onChange={(e) => setEditedName(e.target.value)}
            className="text-xs font-bold text-foreground bg-background border px-1.5 py-0.5 rounded w-full mt-1"
          />
        </div>
        <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] animate-pulse">
          <Sparkles size={10} />
          Brouillon non validé ⚠️
        </Badge>
      </div>

      {missingOrUncertain && (
        <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 text-amber-600 rounded-xl flex gap-2 items-start leading-tight">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-bold block text-[10px] uppercase text-amber-600">Champs critiques incertains</span>
            <span className="text-[10px]">
              Veuillez vérifier les valeurs extraites. L'IA a signalé des incertitudes sur : {ocrResult.uncertainFields?.join(", ")}.
            </span>
          </div>
        </div>
      )}

      {/* Grid display of nutrition table properties */}
      <div className="grid grid-cols-2 gap-3">
        {editedNutrients.map((nut, idx) => (
          <div key={nut.nutrientId} className="flex flex-col p-2 bg-secondary/15 rounded-xl border border-secondary">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
              {nut.nutrientId === "calories" ? "Calories (kcal)" : nut.nutrientId}
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={nut.value}
                onChange={(e) => handleUpdateNutrientValue(idx, Number(e.target.value))}
                className="w-16 bg-background border rounded px-1.5 py-0.5 font-mono text-xs font-bold text-center"
              />
              <span className="text-[10px] text-muted-foreground font-semibold">{nut.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {ocrResult.servingSize && (
        <div className="p-2 border border-secondary bg-secondary/10 rounded-xl text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Info size={12} className="text-primary" />
          <span>Portion recommandée par le fabriquant : <strong>{ocrResult.servingSize}</strong>.</span>
        </div>
      )}

      {ocrResult.allergensText && (
        <div className="p-2 border border-blue-500/15 bg-blue-500/5 rounded-xl text-[10px] text-muted-foreground/90 flex items-center gap-1.5">
          <Info size={12} className="text-blue-400 shrink-0" />
          <span>Allergènes signalés : <strong>{ocrResult.allergensText}</strong></span>
        </div>
      )}

      {/* Portion calculator block */}
      <div className="p-3 border border-border bg-secondary/10 rounded-2xl grid grid-cols-2 gap-3">
        <div className="col-span-2 text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
          <Sliders size={11} className="text-primary" />
          Calculateur de portion à inscrire :
        </div>
        
        <div>
          <label className="text-[9px] text-muted-foreground block mb-0.5">Quantité</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full bg-background border px-2 py-1 rounded text-xs font-bold font-mono text-center"
          />
        </div>

        <div>
          <label className="text-[9px] text-muted-foreground block mb-0.5">Unité</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full bg-background border px-2 py-1 rounded text-xs focus:outline-none"
          >
            <option value="g">Grammes (g)</option>
            <option value="portion">Portions (x50g)</option>
          </select>
        </div>

        <div className="col-span-2 pt-2 border-t text-[10px] leading-relaxed text-muted-foreground grid grid-cols-4 gap-2 text-center">
          <div>
            <span className="block text-[8px] uppercase">Calories</span>
            <span className="font-mono font-bold text-foreground">{finalCals} kcal</span>
          </div>
          <div>
            <span className="block text-[8px] uppercase">Prot'</span>
            <span className="font-mono font-bold text-foreground">{finalProtein}g</span>
          </div>
          <div>
            <span className="block text-[8px] uppercase">Glu'</span>
            <span className="font-mono font-bold text-foreground">{finalCarbs}g</span>
          </div>
          <div>
            <span className="block text-[8px] uppercase">Lip'</span>
            <span className="font-mono font-bold text-foreground">{finalFat}g</span>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 p-2 bg-background border border-border/80 rounded-xl cursor-pointer">
        <input
          type="checkbox"
          checked={hasReviewed}
          onChange={(e) => setHasReviewed(e.target.checked)}
          className="accent-emerald-500 h-3.5 w-3.5"
        />
        <span className="text-[10px] font-semibold text-foreground">
          Je confirme avoir relu et corrigé les valeurs extraites par l'IA.
        </span>
      </label>

      <div className="pt-2 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="text-muted-foreground text-xs font-bold h-8"
        >
          Annuler
        </Button>
        <Button
          onClick={handleValidation}
          disabled={!hasReviewed}
          className={`text-xs h-8 font-bold ${
            hasReviewed ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Valider le profil nutritionnel
        </Button>
      </div>
    </div>
  );
}
