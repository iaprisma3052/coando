import React from 'react';
import { GAMBOL_BROKERS } from '@/lib/gambol-data';
import type { GambolBroker } from '@/types';
import { Server, Activity, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { playClickSound } from '@/lib/sound';

interface GambolCorretorasProps {
  onSelectBroker: (broker: GambolBroker) => void;
  onOpenControlador: () => void;
}

export function GambolCorretoras({
  onSelectBroker,
  onOpenControlador,
}: GambolCorretorasProps) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-4 text-slate-100 font-sans pb-16">
      {/* Header */}
      <div className="bg-[#0b101c] border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-700/40 border border-blue-500/50 flex items-center justify-center text-blue-400 font-mono font-black text-xl shadow-lg shadow-blue-500/20">
          <Server className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-white font-mono font-extrabold text-base tracking-tight">
            Corretoras Conectadas
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Escolha uma corretora, verifique o servidor e volte ao controlador para manipular.
          </p>
        </div>
      </div>

      {/* Broker List */}
      <div className="space-y-2.5">
        {GAMBOL_BROKERS.map((broker) => (
          <div
            key={broker.id}
            className="bg-[#070b14] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 transition-all shadow-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center">
                <img
                  src={broker.logo}
                  alt={broker.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = broker.fallbackLogo;
                  }}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-bold text-sm text-white">{broker.name}</h3>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                  <span className="text-emerald-400">Latência {broker.latency}ms</span>
                  <span>•</span>
                  <span>Payout {broker.payout}%</span>
                  <span>•</span>
                  <span className="text-slate-500 truncate max-w-[120px]">{broker.serverRegion}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectBroker(broker);
                onOpenControlador();
                playClickSound();
              }}
              className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Manipular</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
