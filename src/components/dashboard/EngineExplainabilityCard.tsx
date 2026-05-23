import React from 'react';
import { ModularEngineResult } from '../../services/analysisEngine/types';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, Info, Database } from 'lucide-react';

export function EngineExplainabilityCard({ result, title }: { result: ModularEngineResult, title: string }) {
  if (!result) return null;

  return (
    <div className="bento-card bg-secondary/10 space-y-4 shadow-none border border-border/60">
      <h3 className="font-semibold text-sm flex items-center justify-between">
        <span>Drivers & Limites: {title}</span>
        <span className="text-[10px] text-muted-foreground uppercase opacity-70">
          Aura Engine V1
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Drivers */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Facteurs Impactants</div>
          
          {result.positiveDrivers.map((d, i) => (
            <div key={`pos-${i}`} className="flex items-start gap-2 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
              <ArrowUpCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">{d.label} <span className="font-mono text-emerald-500">{d.value}</span></p>
                <p className="text-[10px] text-muted-foreground">{d.note}</p>
              </div>
            </div>
          ))}

          {result.negativeDrivers.map((d, i) => (
            <div key={`neg-${i}`} className="flex items-start gap-2 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
              <ArrowDownCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">{d.label} <span className="font-mono text-red-500">{d.value}</span></p>
                <p className="text-[10px] text-muted-foreground">{d.note}</p>
              </div>
            </div>
          ))}

          {result.positiveDrivers.length === 0 && result.negativeDrivers.length === 0 && (
            <div className="text-xs text-muted-foreground italic">Aucun facteur déterminé</div>
          )}
        </div>

        {/* Data & Limits */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Données & Limites</div>
          
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-[10px]">
              <Database size={12} className="text-[#0071E3] shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Données mobilisées</span>
                <div className="flex flex-wrap gap-1">
                  {result.dataUsed.map((du, i) => (
                    <span key={i} className="bg-secondary/50 px-1.5 py-0.5 rounded-sm">{du}</span>
                  ))}
                  {result.dataUsed.length === 0 && <span className="italic text-muted-foreground">Aucune</span>}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[10px]">
              <AlertCircle size={12} className="text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Données manquantes / Limites</span>
                {result.dataMissing && result.dataMissing.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {result.dataMissing.map((dm, i) => (
                      <span key={`miss-${i}`} className="bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-sm flex items-center">
                        Manque: {dm}
                      </span>
                    ))}
                  </div>
                )}
                {result.limits && result.limits.length > 0 && (
                  <ul className="list-disc pl-3 text-muted-foreground space-y-1">
                    {result.limits.map((l, i) => (
                      <li key={`lim-${i}`}>{l}</li>
                    ))}
                  </ul>
                )}
                {(!result.dataMissing?.length && !result.limits?.length) && <span className="italic text-muted-foreground">Optimal</span>}
              </div>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-border/50">
             <div className="flex items-start gap-2">
               <Info size={12} className="text-purple-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-muted-foreground leading-tight italic">
                 {result.secureWording}
               </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
