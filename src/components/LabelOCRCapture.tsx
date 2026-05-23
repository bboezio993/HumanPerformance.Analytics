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
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabelReviewScreen } from "../features/nutrition/LabelReviewScreen";
import { saveUserFoodProduct } from "../services/repository/foodProductRepository";

export function LabelOCRCapture({ onAddMealItem }: { onAddMealItem: (item: any) => void }) {
  const { user } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [success, setSuccess] = useState(false);

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
      
      const validatedOcr = validateAndCleanOcrDraft(rawData);
      setOcrResult(validatedOcr);

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

  const handleConfirmAndAdd = async (correctedData: {
    productName: string;
    nutrients: OcrNutrientItem[];
    quantity: number;
    unit: string;
  }) => {
    if (!ocrResult) return;

    const gramsSelected = correctedData.unit === "g" ? correctedData.quantity : correctedData.quantity * 50; 
    const getNutrient = (id: string) => {
      const nut = correctedData.nutrients.find(n => n.nutrientId === id);
      return nut ? nut.value : 0;
    };

    const finalCals = Math.round((getNutrient("calories") * gramsSelected) / 100);
    const finalProtein = Number(((getNutrient("protein") * gramsSelected) / 100).toFixed(1));
    const finalCarbs = Number(((getNutrient("carbs") * gramsSelected) / 100).toFixed(1));
    const finalFat = Number(((getNutrient("fat") * gramsSelected) / 100).toFixed(1));
    
    const foodId = `ocr_${Date.now()}`;

    // Sprint 7.5: Create UserFoodProduct to make it reusable
    if (user) {
      try {
        await saveUserFoodProduct(user.uid, {
          id: foodId,
          name: correctedData.productName,
          servingSize: ocrResult.servingSize,
          caloriesPer100g: getNutrient("calories"),
          proteinPer100g: getNutrient("protein"),
          carbsPer100g: getNutrient("carbs"),
          fatPer100g: getNutrient("fat"),
          allergensText: ocrResult.allergensText,
          sourceType: "label_ocr"
        });
      } catch (err) {
        console.warn("Failed to save user food product:", err);
      }
    }

    onAddMealItem({
      foodId,
      foodName: `${correctedData.productName} (Extrait par OCR)`,
      quantity: correctedData.quantity,
      unit: correctedData.unit,
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
        <LabelReviewScreen 
          ocrResult={ocrResult} 
          onConfirm={handleConfirmAndAdd} 
          onCancel={() => { setOcrResult(null); setImageSrc(null); }} 
        />
      )}
    </div>
  );
}
