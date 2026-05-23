import { DataRepository } from './DataRepository';
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

export const LocalDataRepository: DataRepository = {
  async saveUserProfile(profile: UserProfile): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveMealLog(mealLog: MealLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async deleteMealLog(id: string): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveRecipe(recipe: Recipe): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async deleteRecipe(id: string): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveFoodProduct(foodProduct: any): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async getFoodProduct(barcode: string): Promise<any | null> {
    return null;
  },

  async saveUserFood(food: UserFood): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },

  async getUserFood(id: string): Promise<UserFood | null> {
    return null;
  },
  
  async saveFavoriteFood(fav: FavoriteFood): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async deleteFavoriteFood(id: string): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveHooperLog(log: HooperLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveSessionRpe(log: SessionRPE): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async savePainLog(log: PainLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveMenstrualLog(log: MenstrualLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveContextLog(log: LifeContextLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveWeeklyScreeningLog(log: WeeklyScreeningLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveAllergenBypassLog(log: AllergenBypassLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveMetrics(metrics: NormalizedMetric[]): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveActivities(activities: GarminActivity[]): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveGarminImportLog(log: GarminImportLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveNutritionDraft(draft: NutritionDraft): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },

  async saveVoiceDraft(draft: VoiceDraft): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },

  async deleteVoiceDraft(id: string): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async saveAiUsageLog(log: AiUsageLog): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },

  async saveMediaAsset(asset: MediaAsset): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },

  async deleteMediaAsset(id: string, reason?: string): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async checkAndIncrementAiQuota(feature: "meal_photo" | "label_ocr" | "recipe_text" | "voice_form"): Promise<{ allowed: boolean; remaining: number }> {
    return { allowed: true, remaining: 10 };
  },
  
  async saveMigrationStatus(status: MigrationStatus): Promise<void> {
    // Local persistence is handled by Zustand and IndexedDB automatically
  },
  
  async getMigrationStatus(): Promise<MigrationStatus | null> {
    return null;
  },
  
  async clearAllUserDataByDomain(domain: "metrics" | "meals" | "pains" | "menstrual" | "hooper" | "all"): Promise<void> {
    // Local deletion is handled in Zustand store actions
  },
  
  setupZustandRealtimeListeners(uid: string, onUpdateComplete?: () => void) {
    // Offline local mode does not subscribe to cloud listeners
    return () => {};
  }
};
