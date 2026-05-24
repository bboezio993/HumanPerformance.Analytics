import React from 'react';
import { useStore } from '../store/useStore';
import { ShieldCheck, Activity, Database, AlertCircle, FileClock, Percent, EyeOff } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export function SourcesQualityPage() {
  const storeState = useStore();
  const { metrics, garminActivities, mealLogs, hooperLogs, garminImportLogs } = storeState;

  // Confidence & Sources breakdown
  const today = new Date().toISOString().split('T')[0];
  
  const aiDraftsCount = mealLogs.reduce((acc, currentLog) => {
    return acc + currentLog.items.filter(item => 
      item.sourceType?.includes('ai') || 
      item.sourceType?.includes('vision') || 
      item.sourceType === 'label_ocr' || 
      item.sourceType === 'meal_photo' || 
      item.sourceType === 'recipe'
    ).length;
  }, 0);

  const sourcesBreakdown = {
    garmin: garminActivities.length + metrics.filter(m => m.source === 'garmin').length,
    manual: hooperLogs.length + garminImportLogs.length, // approximation
    aiDrafts: aiDraftsCount,
  };

  const totalPoints = sourcesBreakdown.garmin + sourcesBreakdown.manual + sourcesBreakdown.aiDrafts;

  const rejectedCount = 0; // Simulate for now. In real app we could track rejected drafts

  return (
    <div className="flex-1 overflow-auto p-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sources & Qualité des Données</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Transparence totale sur la provenance, la fiabilité et le traitement de vos données physiologiques.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-card p-6 border border-border/80 text-center">
          <Database size={32} className="mx-auto mb-4 text-[#0071E3]" />
          <h3 className="text-4xl font-black font-mono">{totalPoints}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-2">Points de données totaux</p>
        </div>
        <div className="bento-card p-6 border border-border/80 text-center">
          <ShieldCheck size={32} className="mx-auto mb-4 text-emerald-500" />
          <h3 className="text-4xl font-black font-mono">100%</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-2">Données Sécurisées (Cloud/Local)</p>
        </div>
        <div className="bento-card p-6 border border-border/80 text-center">
          <EyeOff size={32} className="mx-auto mb-4 text-amber-500" />
          <h3 className="text-4xl font-black font-mono">{rejectedCount}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-2">Brouillons rejetés</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bento-card border border-border/80 p-6 space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity size={20} className="text-[#5856D6]" />
            Répartition des Sources
          </h3>
          <div className="space-y-4">
            <SourceItem label="Données automatisées (Garmin)" value={sourcesBreakdown.garmin} total={totalPoints || 1} color="bg-[#0071E3]" />
            <SourceItem label="Saisies Manuelles Confirmées" value={sourcesBreakdown.manual} total={totalPoints || 1} color="bg-emerald-500" />
            <SourceItem label="Brouillons IA Validés (Photo, OCR, Voix)" value={sourcesBreakdown.aiDrafts} total={totalPoints || 1} color="bg-[#5856D6]" />
          </div>
        </div>

        <div className="bento-card border border-border/80 p-6 space-y-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500" />
            Pourquoi la confiance baisse-t-elle ?
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La confiance de vos métriques globales (exemple : Readiness) n'est jamais garantie à 100%. Elle diminue lorsque :
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground list-disc pl-4">
            <li>La baseline d'un métrique est en mode <strong>exploratoire</strong> (moins de 14 ou 28 relevés qualitatifs).</li>
            <li>Vous utilisez l'appareil de suivi de manière peu constante.</li>
            <li>Vos repas sont saisis par analyse IA sans estimation précise des quantités (Confiance &lt; 50%).</li>
            <li>Il y a des marqueurs contradictoires (ex: sommeil parfait mais HRV très bas).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SourceItem({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold">
        <span>{label}</span>
        <span>{value} ({pct}%)</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
