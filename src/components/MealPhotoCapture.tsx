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
  Loader2, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  Utensils 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealPhotoReviewScreen } from "../features/nutrition/MealPhotoReviewScreen";
import { saveMediaAsset, deleteMediaAsset } from "../services/repository/mediaAssetRepository";

export function MealPhotoCapture({ onAddMealItem }: { onAddMealItem: (item: any) => void }) {
  const { user } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [success, setSuccess] = useState(false);

  const [editedFoods, setEditedFoods] = useState<Array<DetectedFoodItem & { 
    gramsSelected: number;
    candidates: FoodCandidate[];
    selectedCandidateId?: string;
  }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setImageSrc(b64);
      setAnalysisResult(null);
      setError(null);
      setEditedFoods([]);
      
      const newPhotoId = `photo_${Date.now()}`;
      setPhotoId(newPhotoId);

      // Create a temporary mediaAsset for tracking
      if (user) {
        try {
          await saveMediaAsset(user.uid, {
            id: newPhotoId,
            url: b64.substring(0, 50) + "...", // pseudo upload URL
            status: "uploaded",
            sourceType: "meal_photo",
          });
        } catch (err) {
          console.error("Failed to save mediaAsset marker", err);
        }
      }
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
      
      const validatedDraft = validateAndCleanMealPhotoDraft(rawData);
      setAnalysisResult(validatedDraft);

      const enriched = validatedDraft.detectedFoods.map(food => {
        let parsedGrams = 100;
        const match = food.estimatedQuantityLabel.match(/(\d+)/);
        if (match) {
          parsedGrams = Number(match[1]);
        }

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

  const handleConfirmAndAddAll = async (foods: any[], keepPhoto: boolean) => {
    if (foods.length === 0) return;

    foods.forEach(food => {
      let resolvedItem = null;
      if (food.matchedFoodId) {
        resolvedItem = internalFoodDatabase.find(f => f.id === food.matchedFoodId);
      }

      const g = food.gramsSelected;

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
    
    // Sprint 8.5 Photo retention controls
    if (!keepPhoto && user && photoId) {
      try {
        await deleteMediaAsset(user.uid, photoId, "User elected not to retain photo after analysis.");
      } catch (err) {
        console.warn("Failed to delete media asset:", err);
      }
    }

    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setAnalysisResult(null);
      setImageSrc(null);
      setEditedFoods([]);
      setPhotoId(null);
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
                setPhotoId(null);
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
        <MealPhotoReviewScreen
          analysisResult={analysisResult}
          initialEditedFoods={editedFoods}
          onConfirm={handleConfirmAndAddAll}
          onCancel={() => { setAnalysisResult(null); setImageSrc(null); setEditedFoods([]); setPhotoId(null); }}
        />
      )}
    </div>
  );
}
