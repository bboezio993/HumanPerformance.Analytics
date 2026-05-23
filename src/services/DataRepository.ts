import { 
  NormalizedMetric, 
  UserProfile, 
  MealLog, 
  Recipe, 
  HooperLog, 
  SessionRPE, 
  PainLog, 
  MenstrualLog, 
  LifeContextLog, 
  WeeklyScreeningLog, 
  AllergenBypassLog,
  GarminActivity,
  GarminImportLog
} from '../types';
import { FavoriteFood, AiUsageLog, NutritionDraft, MigrationStatus, MediaAsset, VoiceDraft, UserFood } from './CloudDataRepository';

export interface DataRepository {
  saveUserProfile(profile: UserProfile): Promise<void>;
  
  saveMealLog(mealLog: MealLog): Promise<void>;
  deleteMealLog(id: string): Promise<void>;
  
  saveRecipe(recipe: Recipe): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  
  saveFoodProduct(foodProduct: any): Promise<void>;
  getFoodProduct(barcode: string): Promise<any | null>;
  
  saveUserFood(food: UserFood): Promise<void>;
  getUserFood(id: string): Promise<UserFood | null>;
  
  saveFavoriteFood(fav: FavoriteFood): Promise<void>;
  deleteFavoriteFood(id: string): Promise<void>;
  
  saveHooperLog(log: HooperLog): Promise<void>;
  saveSessionRpe(log: SessionRPE): Promise<void>;
  savePainLog(log: PainLog): Promise<void>;
  saveMenstrualLog(log: MenstrualLog): Promise<void>;
  saveContextLog(log: LifeContextLog): Promise<void>;
  saveWeeklyScreeningLog(log: WeeklyScreeningLog): Promise<void>;
  saveAllergenBypassLog(log: AllergenBypassLog): Promise<void>;
  
  saveMetrics(metrics: NormalizedMetric[]): Promise<void>;
  saveActivities(activities: GarminActivity[]): Promise<void>;
  saveGarminImportLog(log: GarminImportLog): Promise<void>;
  
  saveNutritionDraft(draft: NutritionDraft): Promise<void>;
  saveVoiceDraft(draft: VoiceDraft): Promise<void>;
  deleteVoiceDraft(id: string): Promise<void>;
  
  saveAiUsageLog(log: AiUsageLog): Promise<void>;
  
  saveMediaAsset(asset: MediaAsset): Promise<void>;
  deleteMediaAsset(id: string, reason?: string): Promise<void>;
  
  checkAndIncrementAiQuota(feature: "meal_photo" | "label_ocr" | "recipe_text" | "voice_form"): Promise<{ allowed: boolean; remaining: number }>;
  
  saveMigrationStatus(status: MigrationStatus): Promise<void>;
  getMigrationStatus(): Promise<MigrationStatus | null>;
  
  clearAllUserDataByDomain(domain: "metrics" | "meals" | "pains" | "menstrual" | "hooper" | "all"): Promise<void>;
  
  setupZustandRealtimeListeners(uid: string, onUpdateComplete?: () => void): () => void;
}
