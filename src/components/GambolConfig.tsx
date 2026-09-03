import React, { useState } from 'react';
import { Settings, Volume2, VolumeX, Shield, MessageCircle, RefreshCw, KeyRound } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playClickSound } from '@/lib/sound';

export function GambolConfig() {
  const [sound, setSound] = useState<boolean>(isSoundEnabled());
  const [maxTimeout, setMaxTimeout] = useState<number>(60);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playClickSound();
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 text-slate-100 font-sans pb-16">
      <div className="bg-[#0b101c] border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border border-white/15 flex items-center justify-center text-slate-300 font-mono font-black text-xl shadow-lg">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-white font-mono font-extrabold text-base tracking-tight">
            Configurações
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Parâmetros do sistema, som e servidores de corretoras.
          </p>
        </div>
      </div>

      <div className="bg-[#070b14] border border-white/10 rounded-2xl divide-y divide-white/5 text-xs font-mono">
        {/* Sound toggle */}
        <div className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-white font-bold block">Efeitos Sonoros</span>
            <span className="text-slate-400 text-[11px]">Sons de clique, vitória e loss</span>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className={`p-2.5 rounded-xl border transition-all ${
              sound
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : 'bg-slate-800 border-white/10 text-slate-400'
            }`}
          >
            {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Max Timeout */}
        <div className="p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-white font-bold block">Tempo Limite de Manipulação</span>
            <span className="text-slate-400 text-[11px]">Retorno automático para o mercado</span>
          </div>
          <span className="font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-lg">
            60 segundos
          </span>
        </div>

        {/* Telegram support */}
        <a
          href="https://t.me/Hacklandiaoficial"
          target="_blank"
          rel="noreferrer"
          className="p-4 flex items-center justify-between hover:bg-white/5 transition-all text-slate-200"
        >
          <div className="space-y-0.5">
            <span className="text-white font-bold block flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              Canal Oficial &amp; Suporte (Telegram)
            </span>
            <span className="text-slate-400 text-[11px]">@Hacklandiaoficial</span>
          </div>
          <span className="text-blue-400 text-xs font-bold">Abrir ↗</span>
        </a>
      </div>
    </div>
  );
}
