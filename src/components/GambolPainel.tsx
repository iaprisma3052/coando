import React from 'react';
import { GAMBOL_VIP_USER, GAMBOL_BROKERS } from '@/lib/gambol-data';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Server,
  Play,
  HelpCircle,
  MessageCircle,
  FileText,
  Lock,
  Sparkles,
} from 'lucide-react';

interface GambolPainelProps {
  onStartSystem: () => void;
  onNavigateToCorretoras: () => void;
}

export function GambolPainel({
  onStartSystem,
  onNavigateToCorretoras,
}: GambolPainelProps) {
  const user = GAMBOL_VIP_USER;

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 text-slate-100 font-sans pb-16">
      {/* Brand Card */}
      <div className="bg-[#0b101c] border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-700/40 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-mono font-black text-xl shadow-lg shadow-emerald-500/20">
          G
        </div>
        <div>
          <h1 className="text-white font-mono font-extrabold text-base tracking-tight">
            Gambol - Trader Assistent
          </h1>
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Área do Assinante VIP · Acesso Vitalício
          </span>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="bg-[#070b14] border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          <h2 className="text-lg font-mono font-bold text-white flex items-center gap-2">
            <span>{user.nome}</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40">
              VIP
            </span>
          </h2>
          <p className="text-xs font-mono text-slate-400">{user.email}</p>
          {user.whatsapp && (
            <p className="text-xs font-mono text-slate-400 mt-1">WhatsApp: {user.whatsapp}</p>
          )}
        </div>

        <div className="bg-[#03060c] p-3.5 rounded-xl border border-white/5 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-slate-400">Plano</span>
            <strong className="text-emerald-400 font-bold">{user.planName}</strong>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-slate-400">Início da assinatura</span>
            <strong className="text-white">{user.subscriptionStartLabel}</strong>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-white/5">
            <span className="text-slate-400">Válido até</span>
            <strong className="text-emerald-300 font-bold">{user.subscriptionEndLabel}</strong>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-slate-400">Status</span>
            <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Assinatura Ativa (Sem Bloqueios)
            </span>
          </div>
        </div>

        {/* Countdown / Lifetime Badge */}
        <div className="bg-gradient-to-r from-emerald-950/60 via-[#040810] to-emerald-950/60 p-4 rounded-xl border border-emerald-500/30 text-center space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Tempo restante
          </div>
          <div className="text-xl font-mono font-extrabold text-emerald-400 flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span>Acesso Vitalício Desbloqueado</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Controlador e Simulador 100% liberados permanentemente.
          </p>
        </div>
      </div>

      {/* Start System Button */}
      <button
        type="button"
        onClick={onStartSystem}
        className="w-full py-4 rounded-2xl font-mono font-black text-base text-black bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-400 hover:from-emerald-300 hover:to-emerald-200 transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transform active:scale-98"
      >
        <Play className="w-5 h-5 fill-current" />
        <span>Iniciar Sistema (Controlador Alpha)</span>
      </button>

      {/* Server Status Box */}
      <div className="bg-[#070b14] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Servidores de Corretoras ({GAMBOL_BROKERS.length})</span>
          </div>
          <button
            onClick={onNavigateToCorretoras}
            className="text-[11px] font-mono text-emerald-400 hover:underline"
          >
            Ver todos
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {GAMBOL_BROKERS.slice(0, 4).map((b) => (
            <div
              key={b.id}
              className="p-2 bg-[#04070e] rounded-xl border border-white/5 flex items-center justify-between"
            >
              <span className="text-slate-300 font-bold truncate">{b.name}</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                {b.latency}ms
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Support & Menu Links */}
      <div className="bg-[#070b14] border border-white/10 rounded-2xl divide-y divide-white/5 text-xs font-mono overflow-hidden">
        <a
          href="https://t.me/Hacklandiaoficial"
          target="_blank"
          rel="noreferrer"
          className="p-3.5 flex items-center justify-between text-slate-300 hover:bg-white/5 transition-all"
        >
          <span className="flex items-center gap-2.5">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            Suporte VIP (Telegram)
          </span>
          <span className="text-[10px] text-emerald-400">Online</span>
        </a>

        <div className="p-3.5 flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-500" />
            Termos de Uso &amp; Privacidade
          </span>
          <span className="text-[10px] text-slate-500">v19.4</span>
        </div>
      </div>
    </div>
  );
}
