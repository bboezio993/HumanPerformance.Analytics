/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { useAuth } from "../components/FirebaseProvider";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { validateAndCleanOcrDraft, OcrNutrientItem } from "../domain/nutrition/ocrDraftSchema";
import { 
  UploadCloud, 
  Loader2, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  FileText, 
  Sliders, 
  Info,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LabelOCRCapture({ onAddMealItem }: { onAddMealItem: (item: any) => void }) {
  const { user } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [success, setSuccess] = useState(false);

  // States for portion and manual edits
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState("g");
  const [editedNutrients, setEditedNutrients] = useState<OcrNutrientItem[]>([]);
  const [editedName, setEditedName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setOcrResult(null);
      setError(null);
    };
    reader.readAsDataURL(files[0]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyzeLabel = async () => {
    if (!imageSrc) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/gemini/extract-nutrition-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imageSrc })
      });

      if (!res.ok) {
        throw new Error("L'intelligence artificielle n'a pas pu décoder l'étiquette. Veuillez prendre une photo plus nette.");
      }

      const rawData = await res.json();
      
      // STEP 1: Strict Zod Validation & Cleaning
      const validatedOcr = validateAndCleanOcrDraft(rawData);
      setOcrResult(validatedOcr);
      setEditedNutrients(validatedOcr.valuesPer100g || []);
      setEditedName(validatedOcr.productName || "Produit OCRisé");

      // STEP 2: Write usage log structure into FireStore if uid present
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
      setError("Délai d'attente d'analyse vision dépassé. Essayez de recadrer pour n'afficher que le tableau d'ingrédients.");
    } finally {
      setLoading(false);
    }
  };

  const updateNutrientValue = (idx: number, newVal: number) => {
    const updated = [...editedNutrients];
    updated[idx] = { ...updated[idx], value: Number(newVal) };
    setEditedNutrients(updated);
  };

  // Compute final values from selection portion
  const gramsSelected = unit === "g" ? quantity : quantity * 50; 
  const getNutrient = (id: string) => {
    const nut = editedNutrients.find(n => n.nutrientId === id);
    return nut ? nut.value : 0;
  };

  const finalCals = Math.round((getNutrient("calories") * gramsSelected) / 100);
  const finalProtein = Number(((getNutrient("protein") * gramsSelected) / 100).toFixed(1));
  const finalCarbs = Number(((getNutrient("carbs") * gramsSelected) / 100).toFixed(1));
  const finalFat = Number(((getNutrient("fat") * gramsSelected) / 100).toFixed(1));

  const handleConfirmAndAdd = () => {
    if (!ocrResult) return;

    onAddMealItem({
      foodId: `ocr_${Date.now()}`,
      foodName: `${editedName} (Extrait par OCR)`,
      quantity,
      unit,
      gramsSelected,
      conversionConfidence: 90,
      conversionAssumptions: `Extrait de photo d'étiquette d'emballage par Vision OCR. Certitude moyenne de l'IA: 90%.`,
      sourceType: "label_ocr",
      calories: finalCals,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat
    });

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setOcrResult(null);
      setImageSrc(null);
    }, 1500);
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {!imageSrc ? (
        <div 
          onClick={handleUploadClick}
          className="border-2 border-dashed border-border/80 hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer bg-secondary/15 hover:bg-secondary/25 transition-all space-y-2 flex flex-col items-center justify-center py-8"
        >
          <FileText className="w-8 h-8 text-muted-foreground animate-pulse" />
          <p className="font-semibold text-foreground text-xs">Scanner l'étiquette d'un paquet d'aliment 📸</p>
          <p className="text-[10px] text-muted-foreground max-w-xs leading-relaxed">
            Glissez-déposez ou cliquez pour charger la photo d'un tableau nutritionnel. Notre IA extraira automatiquement les macros pour 100g.
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
            <img src={imageSrc} alt="Nutrition label" className="max-h-full object-contain" />
            <button 
              onClick={() => {
                setImageSrc(null);
                setOcrResult(null);
              }}
              className="absolute top-2 right-2 p-1 bg-black/80 text-white rounded-lg px-2 text-[10px] font-bold uppercase transition-all"
            >
              Changer d'image ❌
            </button>
          </div>

          {!ocrResult && (
            <div className="flex justify-end">
              <Button
                onClick={handleAnalyzeLabel}
                disabled={loading}
                className="text-xs h-9 font-bold bg-primary text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Extraction du tableau d'ingrédients...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400 animate-pulse" />
                    Extraire les macros par OCR ✨
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
          <span>Brouillon validé ! Les valeurs nutritionnelles de l'étiquette ont été importées.</span>
        </div>
      )}

      {ocrResult && (
        <div className="p-4 border rounded-2xl bg-secondary/5 border-border/80 space-y-4 animate-fade-in text-xs">
          <div className="flex justify-between items-center border-b pb-2">
            <div>
              <span className="text-[9px] uppercase font-bold text-muted-foreground block">Valeurs OCR extraites pour 100g</span>
              <input 
                type="text" 
                value={editedName} 
                onChange={(e) => setEditedName(e.target.value)}
                className="text-xs font-bold text-foreground bg-background border px-1.5 py-0.5 rounded"
              />
            </div>
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] animate-pulse">
              <Sparkles size={10} />
              Brouillon non validé ⚠️
            </Badge>
          </div>

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
                    onChange={(e) => updateNutrientValue(idx, Number(e.target.value))}
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
            <div className="col-span-2 text-[10px] uppercase font-bold text-muted-foreground">Calculateur de portion à inscrire :</div>
            
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

          <div className="pt-2 flex justify-end">
            <Button
              onClick={handleConfirmAndAdd}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Valider la portion ({quantity} {unit})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
