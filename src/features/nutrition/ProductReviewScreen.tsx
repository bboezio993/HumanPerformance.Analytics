/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { FoodProductDraft } from "../../domain/nutrition/openFoodFactsMapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Heart, 
  AlertTriangle, 
  Check, 
  Edit3, 
  Info, 
  Sliders, 
  Sparkles, 
  Utensils 
} from "lucide-react";

interface ProductReviewScreenProps {
  product: FoodProductDraft;
  onConfirm: (correctedProduct: FoodProductDraft, portionGrams: number, mealType: string, rawCooked: "raw" | "cooked") => void;
  onCancel: () => void;
  isFavorite: boolean;
  onToggleFavorite: (product: FoodProductDraft) => void;
}

export function ProductReviewScreen({
  product,
  onConfirm,
  onCancel,
  isFavorite,
  onToggleFavorite
}: ProductReviewScreenProps) {
  // Editorial state of the product
  const [editedName, setEditedName] = useState(product.productName);
  const [editedBrand, setEditedBrand] = useState(product.brand);
  
  // States of macros per 100g
  const [editedCalories, setEditedCalories] = useState<number | "">(
    product.nutrimentsPer100g.calories.value ?? ""
  );
  const [editedProtein, setEditedProtein] = useState<number | "">(
    product.nutrimentsPer100g.protein.value ?? ""
  );
  const [editedCarbs, setEditedCarbs] = useState<number | "">(
    product.nutrimentsPer100g.carbs.value ?? ""
  );
  const [editedFat, setEditedFat] = useState<number | "">(
    product.nutrimentsPer100g.fat.value ?? ""
  );

  // States of portion sizes
  const [portionGrams, setPortionGrams] = useState(100);
  const [mealType, setMealType] = useState("Déjeuner");
  const [rawCooked, setRawCooked] = useState<"raw" | "cooked">("raw");

  // Track if the athlete has explicitly validated/reviewed the data
  const [hasReviewed, setHasReviewed] = useState(false);

  // Identify missing fields to display to the user
  const missingFields: string[] = [];
  if (product.nutrimentsPer100g.calories.isMissing) missingFields.push("Calories");
  if (product.nutrimentsPer100g.protein.isMissing) missingFields.push("Protéines");
  if (product.nutrimentsPer100g.carbs.isMissing) missingFields.push("Glucides");
  if (product.nutrimentsPer100g.fat.isMissing) missingFields.push("Lipides");

  const handleValidation = () => {
    // Inject corrected values into the draft before return
    const corrected: FoodProductDraft = {
      ...product,
      productName: editedName,
      brand: editedBrand,
      nutrimentsPer100g: {
        ...product.nutrimentsPer100g,
        calories: {
          ...product.nutrimentsPer100g.calories,
          value: editedCalories === "" ? null : Number(editedCalories),
          isMissing: editedCalories === ""
        },
        protein: {
          ...product.nutrimentsPer100g.protein,
          value: editedProtein === "" ? null : Number(editedProtein),
          isMissing: editedProtein === ""
        },
        carbs: {
          ...product.nutrimentsPer100g.carbs,
          value: editedCarbs === "" ? null : Number(editedCarbs),
          isMissing: editedCarbs === ""
        },
        fat: {
          ...product.nutrimentsPer100g.fat,
          value: editedFat === "" ? null : Number(editedFat),
          isMissing: editedFat === ""
        }
      }
    };
    onConfirm(corrected, portionGrams, mealType, rawCooked);
  };

  return (
    <div className="p-4 border border-border/80 rounded-2xl bg-secondary/15 space-y-4 animate-fade-in text-xs max-w-lg mx-auto">
      {/* Header and source verification */}
      <div className="flex justify-between items-start gap-2">
        <div>
          <h5 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500 shrink-0" />
            Vérification de l'Aliment Scanné
          </h5>
          <span className="text-[10px] text-muted-foreground block">
            ID: <span className="font-mono">{product.id}</span>
          </span>
        </div>
        <Badge variant={product.sourceCompleteness >= 90 ? "default" : "secondary"} className="text-[9px] font-mono">
          Complétude : {product.sourceCompleteness}%
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-border/60">
        <div>
          <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Désignation</label>
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="w-full text-xs rounded-lg border border-border bg-background p-2 focus:ring-1 focus:outline-none"
            placeholder="Nom du produit"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Marque</label>
          <input
            type="text"
            value={editedBrand}
            onChange={(e) => setEditedBrand(e.target.value)}
            className="w-full text-xs rounded-lg border border-border bg-background p-2 focus:ring-1 focus:outline-none"
            placeholder="Marque ou fabriquant"
          />
        </div>
      </div>

      {/* Allergens Warn */}
      {product.allergens && product.allergens.length > 0 && (
        <div className="p-2.5 bg-red-500/5 border border-red-500/20 text-red-600 rounded-xl flex gap-2 items-start leading-tight">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
          <div>
            <span className="font-bold block text-[10px] uppercase text-red-600">Alerte Allergènes de sécurité</span>
            <span className="text-[10px] font-mono">{product.allergens.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Missing attributes warning */}
      {missingFields.length > 0 && (
        <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 text-amber-600 rounded-xl flex gap-2 items-start leading-tight">
          <Info size={15} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-bold block text-[10px] uppercase text-amber-600">Valeurs manquantes dans le registre OFF</span>
            <span className="text-[10px]">
              Veuillez compléter avant validation : {missingFields.join(", ")} (Pas de remplacement automatique par 0).
            </span>
          </div>
        </div>
      )}

      {/* Nutrient Review grid */}
      <div>
        <h6 className="font-bold text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <Edit3 size={11} className="text-primary" />
          Apports Nutritionnels Réels (/100g)
        </h6>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-1 border border-border bg-background rounded-xl">
            <label className="text-[8px] block uppercase text-muted-foreground font-bold">Calories (kcal)</label>
            <input
              type="number"
              value={editedCalories}
              onChange={(e) => setEditedCalories(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full text-center font-mono font-bold text-xs bg-transparent border-none text-emerald-500 p-0 focus:outline-none"
              placeholder="-"
            />
          </div>
          <div className="p-1 border border-border bg-background rounded-xl">
            <label className="text-[8px] block uppercase text-muted-foreground font-bold">Protéines (g)</label>
            <input
              type="number"
              step="0.1"
              value={editedProtein}
              onChange={(e) => setEditedProtein(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full text-center font-mono font-bold text-xs bg-transparent border-none text-indigo-400 p-0 focus:outline-none"
              placeholder="-"
            />
          </div>
          <div className="p-1 border border-border bg-background rounded-xl">
            <label className="text-[8px] block uppercase text-muted-foreground font-bold">Glucides (g)</label>
            <input
              type="number"
              step="0.1"
              value={editedCarbs}
              onChange={(e) => setEditedCarbs(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full text-center font-mono font-bold text-xs bg-transparent border-none text-amber-500 p-0 focus:outline-none"
              placeholder="-"
            />
          </div>
          <div className="p-1 border border-border bg-background rounded-xl">
            <label className="text-[8px] block uppercase text-muted-foreground font-bold">Lipides (g)</label>
            <input
              type="number"
              step="0.1"
              value={editedFat}
              onChange={(e) => setEditedFat(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full text-center font-mono font-bold text-xs bg-transparent border-none text-rose-400 p-0 focus:outline-none"
              placeholder="-"
            />
          </div>
        </div>
      </div>

      {/* Portion parameters */}
      <div className="pt-2 border-t border-border/60">
        <h6 className="font-bold text-[10px] uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <Sliders size={11} className="text-indigo-400" />
          Portion sélectionnée
        </h6>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] block text-muted-foreground font-semibold mb-0.5">Portion (g)</label>
            <input
              type="number"
              value={portionGrams}
              onChange={(e) => setPortionGrams(Number(e.target.value))}
              className="w-full text-xs rounded border border-border bg-background p-1.5 font-mono"
            />
          </div>
          <div>
            <label className="text-[9px] block text-muted-foreground font-semibold mb-0.5">Repas</label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="w-full text-xs rounded border border-border bg-background p-1.5"
            >
              <option value="Petit déjeuner">Petit déjeuner</option>
              <option value="Déjeuner">Déjeuner</option>
              <option value="Dîner">Dîner</option>
              <option value="En-cas">En-cas</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] block text-muted-foreground font-semibold mb-0.5">État de cuisson</label>
            <select
              value={rawCooked}
              onChange={(e) => setRawCooked(e.target.value as any)}
              className="w-full text-xs rounded border border-border bg-background p-[5px]"
            >
              <option value="raw">Cru</option>
              <option value="cooked">Cuit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic portion feedback */}
      <div className="p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex justify-between items-center">
        <div>
          <span className="font-bold text-[10px] text-indigo-500">APPORTS ESTIMÉS POUR CETTE PORTION ({portionGrams}g)</span>
          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
            Calories : <span className="text-emerald-500 font-bold">{editedCalories !== "" ? Math.round((editedCalories * portionGrams) / 100) : "-"} kcal</span> • 
            Prots : <span className="text-indigo-400 font-bold">{editedProtein !== "" ? ((editedProtein * portionGrams) / 100).toFixed(1) : "-"}g</span> • 
            Glucides : <span className="text-amber-500 font-bold">{editedCarbs !== "" ? ((editedCarbs * portionGrams) / 100).toFixed(1) : "-"}g</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onToggleFavorite(product)}
          className={`h-7 px-2 text-[9px] font-bold ${isFavorite ? "text-red-500 bg-red-500/5 hover:text-red-600" : "text-muted-foreground hover:text-red-500"}`}
        >
          <Heart size={10} className={`mr-1 ${isFavorite ? "fill-current" : ""}`} />
          {isFavorite ? "Favori !" : "Favorisé"}
        </Button>
      </div>

      {/* Mandatory user checkbox to enable save button */}
      <label className="flex items-center gap-2 p-2 bg-background border border-border/80 rounded-xl cursor-pointer">
        <input
          type="checkbox"
          checked={hasReviewed}
          onChange={(e) => setHasReviewed(e.target.checked)}
          className="accent-emerald-500 h-3.5 w-3.5"
        />
        <span className="text-[10px] font-semibold text-foreground">
          Je confirme avoir relu, corrigé s'il y a lieu, et vérifié les éventuels allergènes de ce produit.
        </span>
      </label>

      {/* Action triggers */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="text-xs h-8 text-muted-foreground hover:bg-secondary/20 font-bold"
        >
          Annuler
        </Button>
        <Button
          onClick={handleValidation}
          disabled={!hasReviewed}
          className={`text-xs h-8 px-4 font-bold flex items-center gap-1 rounded-lg ${
            hasReviewed ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm" : "bg-secondary text-muted-foreground cursor-not-allowed"
          }`}
        >
          <Check size={14} />
          Confirmer & Ajouter au repas
        </Button>
      </div>
    </div>
  );
}
