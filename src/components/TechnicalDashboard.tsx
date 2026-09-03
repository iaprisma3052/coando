import React from 'react';
import {
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Info,
  Layers,
  Zap,
} from 'lucide-react';
import type { Analysis } from '@/types';

interface TechnicalDashboardProps {
  analysis: Analysis | null;
  symbol: string;
}

export function TechnicalDashboard({ analysis }: TechnicalDashboardProps) {
  if (!analysis) {
    return (
      <div className="bg-[#0e1426]/90 rounded-2xl border border-white/10 p-4 text-center text-slate-500 text-xs">
        Calculando indicadores técnicos e consenso de 3 votos...
      </div>
    );
  }

  const isCall = analysis.direction === 'call';
  const isReady = analysis.signalReady;

  // Calculate approximate Bulls vs Bears strength from indicators
  const bullsPercent = Math.min(
    95,
    Math.max(
      5,
      Math.round(
        analysis.rsi * 0.4 +
          (analysis.direction === 'call' ? analysis.strength * 0.5 : (100 - analysis.strength) * 0.2) +
          (analysis.lastPrice > (analysis.emaInter || 1) ? 10 : 0)
      )
    )
  );
  const bearsPercent = 100 - bullsPercent;

  return (
    <div className="bg-[#0e1426]/90 rounded-2xl border border-white/10 p-4 flex flex-col gap-4 shadow-xl backdrop-blur-md">
      {/* Strategy Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-400">ESTRATÉGIA</span>
            <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              PRISMA IA VECTOR OTC · 3 VOTOS
            </span>
          </div>
          <p className="text-sm font-bold text-white mt-1 font-mono">
            {analysis.statusText}
          </p>
        </div>

        {/* Confidence & Signal Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-md ${
              isReady
                ? isCall
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 animate-pulse'
                  : 'bg-rose-500/20 border-rose-500/60 text-rose-300 animate-pulse'
                : 'bg-slate-800 border-white/10 text-slate-400'
            }`}
          >
            {isReady ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isCall ? 'SINAL CALL (:00s)' : 'SINAL PUT (:00s)'}</span>
              </>
            ) : (
              <span>AGUARDANDO CONVERGÊNCIA</span>
            )}
          </div>

          <div className="px-2.5 py-1 bg-slate-900 border border-white/10 rounded-lg text-xs font-mono">
            <span className="text-[10px] text-slate-500 mr-1">CONFIANÇA:</span>
            <strong
              className={
                analysis.confidence === 'HIGH'
                  ? 'text-emerald-400'
                  : analysis.confidence === 'MED'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }
            >
              {analysis.confidence} ({analysis.strength}%)
            </strong>
          </div>
        </div>
      </div>

      {/* Thermometer: Ursos vs Touros */}
      <div className="bg-slate-900/80 rounded-xl p-3 border border-white/5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1 text-emerald-400 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>COMPRA (TOUROS): {bullsPercent}%</span>
          </div>
          <div className="flex items-center gap-1 text-rose-400 font-bold">
            <span>VENDA (URSOS): {bearsPercent}%</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-l-full transition-all duration-300"
            style={{ width: `${bullsPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full transition-all duration-300"
            style={{ width: `${bearsPercent}%` }}
          />
        </div>
      </div>

      {/* Indicator Matrix Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* RSI 14 */}
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
          <span className="text-[10px] text-slate-400 font-semibold block">RSI (14)</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-extrabold font-mono text-white">
              {analysis.rsi.toFixed(1)}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                analysis.rsi > 70
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : analysis.rsi < 30
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {analysis.rsi > 70 ? 'Sobrecompra' : analysis.rsi < 30 ? 'Sobrevenda' : 'Neutro'}
            </span>
          </div>
        </div>

        {/* EMA 9 */}
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
          <span className="text-[10px] text-slate-400 font-semibold block">EMA Rápida (9)</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-mono font-bold text-emerald-400">
              {analysis.ema9?.toFixed(4) || '—'}
            </span>
            <span className="text-[9px] font-mono text-slate-500">Fast</span>
          </div>
        </div>

        {/* EMA 21 */}
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
          <span className="text-[10px] text-slate-400 font-semibold block">EMA Lenta (21)</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-mono font-bold text-amber-400">
              {analysis.ema21?.toFixed(4) || '—'}
            </span>
            <span className="text-[9px] font-mono text-slate-500">Slow</span>
          </div>
        </div>

        {/* EMA 50 / Macro */}
        <div className="bg-slate-900/70 p-2.5 rounded-xl border border-white/5">
          <span className="text-[10px] text-slate-400 font-semibold block">EMA Macro (50)</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-mono font-bold text-indigo-400">
              {analysis.emaMacro?.toFixed(4) || '—'}
            </span>
            <span className="text-[9px] font-mono text-slate-500">Macro</span>
          </div>
        </div>
      </div>

      {/* 3-Analyst Consensus Panel */}
      <div className="bg-slate-900/70 rounded-xl border border-white/5 p-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>Consenso dos 3 Pilares da IA</span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            {analysis.analysts?.filter((a) => a.direction === analysis.direction).length || 3}/3 Alinhados
          </span>
        </h4>

        <div className="space-y-2">
          {analysis.analysts?.map((analyst, i) => (
            <div
              key={i}
              className="flex items-start justify-between text-xs bg-slate-950/60 p-2.5 rounded-lg border border-white/5 gap-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{analyst.icon}</span>
                <div>
                  <span className="font-semibold text-slate-200 block">{analyst.name}</span>
                  <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                    {analyst.opinion}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    analyst.direction === 'call'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : analyst.direction === 'put'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {analyst.direction.toUpperCase()}
                </span>
                <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                  {analyst.confidence}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reasons & Validation Checks */}
      <div className="space-y-1 text-xs">
        <span className="text-[11px] font-bold text-slate-400 block mb-1">
          Gatilhos & Justificativas Técnicas:
        </span>
        {analysis.reasons.map((reason, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 text-emerald-300 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 text-[11px]"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{reason}</span>
          </div>
        ))}
        {analysis.blocks.map((block, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 text-amber-300 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 text-[11px]"
          >
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{block}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
