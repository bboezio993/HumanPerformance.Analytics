import React, { useEffect, useMemo } from 'react';
import { 
  ShieldAlert, 
  Heart, 
  Activity, 
  Moon, 
  Zap, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Info,
  Calendar,
  Frown,
  Meh,
  Smile
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runRecoveryEngine } from '../services/analysisEngine/recoveryEngine';

export function Recovery() {
  const storeState = useStore();
  const { metrics, hooperLogs, engineScores, computeEngineScores } = storeState;

  useEffect(() => {
    if (!engineScores) {
      computeEngineScores();
    }
  }, []);

  // Recalculate local recovery engine values for high fidelity tracking
  const recoveryDetails = useMemo(() => {
    return runRecoveryEngine(useStore.getState());
  }, [metrics, hooperLogs]);

  const hasData = useMemo(() => {
    const hasHrv = metrics.some(m => m.type === 'hrv_rmssd');
    const hasRhr = metrics.some(m => m.type === 'rhr');
    const hasHooper = hooperLogs.length > 0;
    return (hasHrv && hasRhr) || hasHooper;
  }, [metrics, hooperLogs]);

  // Transform Hooper values over last 7 days for the chart
  const recentHooperData = useMemo(() => {
    return [...hooperLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7)
      .map(log => ({
        date: log.date.split('-').slice(1).join('/'),
        fatigue: log.fatigue,
        soreness: log.soreness,
        stress: log.stress,
        sleepQuality: log.sleepQuality
      }));
  }, [hooperLogs]);

  // Compute heart data (HRV & RHR correlation over last 14 days)
  const cardiacRecoveryData = useMemo(() => {
    const hrvList = metrics.filter(m => m.type === 'hrv_rmssd');
    const rhrList = metrics.filter(m => m.type === 'rhr');

    // Group by day
    const grouped: Record<string, { hrv?: number; rhr?: number }> = {};
    hrvList.forEach(m => {
      const d = m.timestamp.split('T')[0];
      if (!grouped[d]) grouped[d] = {};
      grouped[d].hrv = m.value;
    });
    rhrList.forEach(m => {
      const d = m.timestamp.split('T')[0];
      if (!grouped[d]) grouped[d] = {};
      grouped[d].rhr = m.value;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-14)
      .map(([date, val]) => ({
        date: date.split('-').slice(1).join('/'),
        hrv: val.hrv,
        rhr: val.rhr
      }));
  }, [metrics]);

  if (!hasData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mb-6 shadow-sm">
          <Activity size={48} className="text-muted-foreground opacity-50" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Moteur de Récupération</h2>
        <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
          Le module de récupération d'Aura Elite Next analyse conjointement votre variabilité de fréquence cardiaque (HRV),
          votre fréquence cardiaque au repos (RHR) et vos ressentis matinaux (échelle Hooper) pour évaluer vos réserves physiologiques.
        </p>
        <Button nativeButton={false} render={<Link to="/connections/garmin" />} className="bg-[#5856D6] hover:bg-[#5856D6]/90 text-white rounded-xl">
          Importer mes métriques d'adaptation
        </Button>
      </div>
    );
  }

  // Visual formatting for status indicator
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'recovered':
        return {
          title: 'Récupéré',
          banner: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          badge: 'bg-emerald-400 text-black',
          desc: 'Excellente réponse d\'adaptation parasympathique.'
        };
      case 'recovered_active':
      case 'adapting':
        return {
          title: 'En cours d\'adaptation',
          banner: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
          badge: 'bg-indigo-400 text-white',
          desc: 'Organisme régulant activement la charge de travail.'
        };
      case 'fatigued':
        return {
          title: 'Vigilance Fatigue',
          banner: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          badge: 'bg-amber-400 text-black',
          desc: 'Sensation passagère d\'épuisement ou de tension périphérique.'
        };
      case 'exhausted':
        return {
          title: 'Surcharge Signalée',
          banner: 'bg-red-500/10 border-red-500/20 text-red-400',
          badge: 'bg-red-400 text-black',
          desc: 'Signaux d\'adaptation saturés. Recommandations de récupération obligatoire.'
        };
      default:
        return {
          title: 'Indicateurs à calibrer',
          banner: 'bg-muted/10 border-muted-foreground/10 text-muted-foreground',
          badge: 'bg-muted text-foreground',
          desc: 'Quantité de données insuffisante.'
        };
    }
  };

  const currentStatus = getStatusStyle(recoveryDetails.status);

  return (
    <ScrollArea className="flex-1 bg-background">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="text-[#5856D6] w-8 h-8" />
              Récupération & Adaptation Physiologique
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Surveillance de la variabilité cardiaque, des constantes basales et des ressentis subjectifs (Hooper).
            </p>
          </div>
          <Badge variant="outline" className="w-fit font-mono bg-indigo-500/10 border-indigo-500/20 text-indigo-400 py-1 px-2">
            Moteur d'Analyse C-D-G Actif
          </Badge>
        </div>

        {/* Global Summary Card with circular score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bento-card bg-secondary/15 border border-border/80 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 lg:col-span-2">
            
            {/* Round display score */}
            <div className="relative shrink-0 flex items-center justify-center w-36 h-36 rounded-full border-4 border-muted">
              {/* Semi-transparent progress track */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-muted"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 64}`}
                  strokeDashoffset={`${2 * Math.PI * 64 * (1 - recoveryDetails.score / 100)}`}
                  className="text-[#5856D6] transition-all duration-1000"
                />
              </svg>
              <div className="text-center z-10">
                <span className="text-4xl font-black font-mono text-foreground">{recoveryDetails.score}</span>
                <span className="text-xs text-muted-foreground block font-bold mt-0.5">SCORE</span>
              </div>
            </div>

            {/* Assessment */}
            <div className="space-y-4 flex-1">
              <div className="space-y-1.5">
                <Badge className={`${currentStatus.badge} hover:${currentStatus.badge} border-none font-bold text-xs px-2.5 py-0.5`}>
                  {currentStatus.title}
                </Badge>
                <h3 className="text-xl font-bold font-sans tracking-tight">{currentStatus.desc}</h3>
                <p className="text-xs text-muted-foreground font-mono">
                  Indice de confiance du calcul : {recoveryDetails.confidence}% • Basé sur : RHR / HRV / Hooper
                </p>
              </div>

              <div className={`p-4 rounded-xl border flex items-start gap-2.5 ${currentStatus.banner}`}>
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs font-medium leading-relaxed">
                  {recoveryDetails.secureWording}
                </p>
              </div>
            </div>
          </div>

          <div className="bento-card border border-border/80 p-6 flex flex-col justify-between h-full bg-secondary/5">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[#34C759]" />
                Tendance de Récupération
              </h4>
              <p className="text-sm font-semibold text-foreground">
                {recoveryDetails.trends?.recovery === 'improving' ? '🚀 Amélioration mesurée' :
                 recoveryDetails.trends?.recovery === 'declining' ? '📈 Tendance à la baisse' : '➡️ Tendance stable'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                Calculé à partir des dérivés d'EWMA (moyennes mobiles exponentielles pondérées) de votre HRV sur les 7 et 28 derniers jours.
              </p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Mise à jour</span>
              <span>Aujourd'hui</span>
            </div>
          </div>
        </div>

        {/* Dynamic Drivers (Factors enhancing vs suppressing) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Positive Factors */}
          <div className="bento-card p-6 border border-border/80">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#34C759]" />
              Facteurs d'Adaptation Favorables ({recoveryDetails.positiveDrivers?.length || 0})
            </h3>
            {recoveryDetails.positiveDrivers?.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">Aucun facteur positif significatif détecté par le moteur aujourd'hui. Maintenez vos routines.</p>
            ) : (
              <div className="space-y-3">
                {recoveryDetails.positiveDrivers?.map((driver, idx) => (
                  <div key={idx} className="p-3 bg-secondary/10 rounded-xl flex items-center justify-between gap-3 text-xs border border-emerald-500/5">
                    <div>
                      <p className="font-bold text-foreground">{driver.label}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{driver.note}</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/20 font-bold shrink-0 font-mono">
                      {driver.value}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Negative/Watch Factors */}
          <div className="bento-card p-6 border border-border/80">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-500" />
              Facteurs de Vigilance ({recoveryDetails.negativeDrivers?.length || 0})
            </h3>
            {recoveryDetails.negativeDrivers?.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4">Aucun signal défavorable ou inducteur de stress prononcé n'impacte vos indicateurs d'adaptation.</p>
            ) : (
              <div className="space-y-3">
                {recoveryDetails.negativeDrivers?.map((driver, idx) => (
                  <div key={idx} className="p-3 bg-secondary/10 rounded-xl flex items-center justify-between gap-3 text-xs border border-amber-500/5">
                    <div>
                      <p className="font-bold text-foreground">{driver.label}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{driver.note}</p>
                    </div>
                    <Badge variant="outline" className="bg-amber-500/5 text-amber-400 border-amber-500/20 font-bold shrink-0 font-mono">
                      {driver.value}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Charts & Histograms Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Cardiac indices chart */}
          <div className="bento-card p-6 lg:col-span-2 border border-border/80">
            <h3 className="font-bold text-base mb-1.5 flex items-center gap-2">
              <Heart size={18} className="text-red-500" />
              Suivi Physiologique Cardiaque (14j)
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              La corrélation entre votre RHR (bas de barres) et votre HRV (variabilité cardiaque). Une HRV élevée conjuguée à une RHR basse indique une adaptation parasympathique optimale.
            </p>
            
            {cardiacRecoveryData.length === 0 ? (
              <div className="h-64 flex items-center justify-center border border-dashed rounded-xl italic text-muted-foreground text-xs">
                Aucune donnée d'adaptation cardiaque récente.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cardiacRecoveryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5856D6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#5856D6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRhr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF2D55" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#FF2D55" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                    <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1C1C1E', borderRadius: '8px', border: '1px solid #3A3A3C', color: '#fff', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="hrv" stroke="#5856D6" strokeWidth={2} fillOpacity={1} fill="url(#colorHrv)" name="HRV (ms)" />
                    <Area type="monotone" dataKey="rhr" stroke="#FF2D55" strokeWidth={1} strokeDasharray="3 3" fillOpacity={1} fill="url(#colorRhr)" name="RHR (bpm)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Subjective Fatigue trends (Radar or bento) */}
          <div className="bento-card p-6 border border-border/80 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-base mb-1.5 flex items-center gap-2">
                <Smile size={18} className="text-[#30B0C7]" />
                Ressentis Subjectifs (Hooper)
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Fluctuation des variables quotidiennes d'inconfort au cours de vos {recentHooperData.length} dernières saisies (index de 1 à 7, bas est préférable).
              </p>
            </div>
            {recentHooperData.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center border border-dashed rounded-xl p-4 text-center">
                <Meh size={32} className="text-muted-foreground mb-2 opacity-50" />
                <span className="text-xs text-muted-foreground">Aucun check-in d'état récent enregistré.</span>
                <Button nativeButton={false} render={<Link to="/connections" />} size="sm" className="mt-3 bg-secondary py-1 text-xs">
                  Saisir mes ressentis
                </Button>
              </div>
            ) : (
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentHooperData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                    <XAxis dataKey="date" stroke="#888888" fontSize={9} />
                    <YAxis domain={[1, 7]} stroke="#888888" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#1C1C1E', borderRadius: '8px', border: '1px solid #3A3A3C', color: '#fff', fontSize: '10px' }} />
                    <Area type="monotone" dataKey="fatigue" stroke="#5856D6" fill="none" strokeWidth={2} name="Fatigue" />
                    <Area type="monotone" dataKey="soreness" stroke="#FF9500" fill="none" strokeWidth={1.5} name="Courbatures" />
                    <Area type="monotone" dataKey="stress" stroke="#FF2D55" fill="none" strokeWidth={1} name="Stress" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Explainability & Limitations Section */}
        <div className="p-5 bg-card/60 rounded-xl border border-border/80 flex items-start gap-3.5 shadow-sm">
          <Info className="text-muted-foreground shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <h4 className="text-xs font-bold font-sans text-foreground uppercase tracking-wide">
              Limites d'éligibilité analytique & Prudence médicale
            </h4>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 leading-relaxed">
              <li>Aura Elite Next n'est pas un équipement médical de diagnostic thérapeutique. En cas d'inconfort prolongé, de blessure suspectée ou de fatigue anormale durable, consultez votre équipe médicale.</li>
              {recoveryDetails.limits?.map((limit, idx) => (
                <li key={idx} className="text-indigo-400 font-medium">{limit}</li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </ScrollArea>
  );
}
