import { GarminActivity, NormalizedMetric, GarminImportLog } from '../../types';
import { useStore } from '../../store/useStore';

export const GarminImportService = {
  deduplicateActivities: (newActivities: GarminActivity[]): { added: GarminActivity[], ignored: number, duplicates: number } => {
    const { garminActivities } = useStore.getState();
    const existingIds = new Set(garminActivities.map(a => a.id));
    
    let duplicates = 0;
    const added: GarminActivity[] = [];
    
    newActivities.forEach(activity => {
      // Basic deduplication on ID.
      // ID should be a hash combining date, type, distance, duration.
      if (existingIds.has(activity.id)) {
        duplicates++;
      } else {
        added.push(activity);
        existingIds.add(activity.id);
      }
    });

    return { added, ignored: 0, duplicates };
  },

  deduplicateMetrics: (newMetrics: NormalizedMetric[]): { added: NormalizedMetric[], ignored: number, duplicates: number } => {
    const { metrics } = useStore.getState();
    const existingIds = new Set(metrics.map(m => m.id));
    
    let duplicates = 0;
    const added: NormalizedMetric[] = [];
    
    newMetrics.forEach(metric => {
      if (existingIds.has(metric.id)) {
        duplicates++;
      } else {
        added.push(metric);
        existingIds.add(metric.id);
      }
    });

    return { added, ignored: 0, duplicates };
  },

  processLogResult: (logId: string, addedCount: number, duplicatesCount: number, ignoredCount: number, errorCount: number) => {
    const { garminImportLogs, updateGarminImportLog } = useStore.getState();
    const log = garminImportLogs.find(l => l.id === logId);
    
    if (!log) return;

    let status: GarminImportLog['status'] = 'success';
    let errorMessage = undefined;

    if (errorCount > 0 && addedCount === 0) {
      status = 'error';
      errorMessage = `${errorCount} erreurs fatales, aucun ajout.`;
    } else if (errorCount > 0 && addedCount > 0) {
      status = 'partial';
      errorMessage = `${errorCount} erreurs, mais des données ont été importées.`;
    } else if (addedCount === 0 && duplicatesCount > 0) {
      status = 'duplicate';
      errorMessage = 'Fichier ignoré : données déjà présentes.';
    } else if (addedCount === 0) {
      status = 'warning';
      errorMessage = 'Aucune donnée pertinente trouvée.';
    }

    updateGarminImportLog(logId, {
      recordsAdded: (log.recordsAdded || 0) + addedCount,
      recordsIgnored: (log.recordsIgnored || 0) + duplicatesCount + ignoredCount,
      status,
      errorMessage,
      details: {
        ...log.details,
        duplicates: (log.details?.duplicates || 0) + duplicatesCount,
        ignored: (log.details?.ignored || 0) + ignoredCount,
        errors: (log.details?.errors || 0) + errorCount
      }
    });
  }
};
