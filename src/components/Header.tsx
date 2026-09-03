import React, { useState, useEffect } from 'react';
import {
  Activity,
  Clock,
  Volume2,
  VolumeX,
  KeyRound,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import type { AccountInfo } from '@/types';
import { isSoundEnabled, setSoundEnabled, playClickSound } from '@/lib/sound';

interface HeaderProps {
  currentTab: 'terminal';
  onSelectTab: (tab: 'terminal') => void;
  account: AccountInfo;
  isDemo: boolean;
  onToggleDemo: (demo: boolean) => void;
  onOpenSsidModal: () => void;
  onLogout?: () => void;
}

export function Header({
  account,
  isDemo,
  onToggleDemo,
  onOpenSsidModal,
  onLogout,
}: HeaderProps) {
  const [brasiliaTime, setBrasiliaTime] = useState<string>('--:--:--');
  const [seconds, setSeconds] = useState<number>(0);
  const [sound, setSound] = useState<boolean>(true);

  useEffect(() => {
    setSound(isSoundEnabled());

    const updateClock = () => {
      const now = new Date();
      const formatted = now.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setBrasiliaTime(formatted);
      setSeconds(now.getSeconds());
    };

    updateClock();
    const timer = setInterval(updateClock, 250);
    return () => clearInterval(timer);
  }, []);

  const handleSoundToggle = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playClickSound();
  };

  return (
    <header className="border-b border-emerald-500/20 bg-[#080d1a]/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-5 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/40 shadow-lg shadow-emerald-500/25 bg-black flex items-center justify-center">
                <img
                  src="/prisma_ia_logo.jpg"
                  alt="PRISMA IA - VECTOR OTC"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-black rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-white font-mono">
                  PRISMA IA <span className="text-emerald-400 font-extrabold">VECTOR OTC</span>
                </span>
                <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 tracking-wider">
                  CONSENSO 3 VOTOS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                <span>trade.optgobroker.com</span>
                <span className="text-emerald-400 font-bold">•</span>
                <span className="text-emerald-300">148 OTC</span>
              </p>
            </div>
          </div>
        </div>

        {/* Center: Brasília Clock & Candle Seconds */}
        <div className="flex items-center gap-3 bg-[#020509]/90 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl font-mono">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Brasília (UTC-3):</span>
            <strong className="font-bold text-white tracking-wider text-sm">{brasiliaTime}</strong>
          </div>

          <div className="h-4 w-px bg-emerald-500/30" />

          {/* Candle Seconds */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Vela M1:</span>
            <span className="text-xs font-black text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
              :{String(seconds).padStart(2, '0')}s
            </span>
          </div>
        </div>

        {/* Right: Account & Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Demo / Real Switch */}
          <div className="flex items-center bg-[#020509] p-0.5 rounded-lg border border-emerald-500/20 font-mono">
            <button
              id="mode-demo-btn"
              onClick={() => onToggleDemo(true)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                isDemo
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DEMO
            </button>
            <button
              id="mode-real-btn"
              onClick={() => onToggleDemo(false)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                !isDemo
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              REAL
            </button>
          </div>

          {/* Balance display */}
          <div className="hidden sm:flex flex-col items-end px-2.5 py-1 bg-[#020509] rounded-lg border border-emerald-500/20">
            <span className="text-[9px] text-slate-400 font-semibold font-mono uppercase">
              {isDemo ? 'Saldo Demo' : 'Saldo Real'}
            </span>
            <span className="text-xs font-mono font-extrabold text-white">
              $ {isDemo ? account.demoBalance.toFixed(2) : account.balance.toFixed(2)}
            </span>
          </div>

          {/* SSID Broker Connection Button */}
          <button
            id="ssid-modal-trigger"
            onClick={onOpenSsidModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
              account.connected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-[#020509] border-emerald-500/20 text-slate-300 hover:text-white'
            }`}
            title="Conexão com a corretora via SSID"
          >
            <KeyRound className={`w-3.5 h-3.5 ${account.connected ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="hidden lg:inline">{account.connected ? 'SSID Conectado' : 'Conectar SSID'}</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={handleSoundToggle}
            className={`p-1.5 rounded-lg border transition-all ${
              sound
                ? 'bg-[#020509] border-emerald-500/20 text-slate-300 hover:text-white'
                : 'bg-[#020509] border-emerald-500/10 text-slate-500 hover:text-slate-400'
            }`}
            title={sound ? 'Som ativado' : 'Som desativado'}
          >
            {sound ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              id="logout-btn"
              onClick={onLogout}
              className="p-1.5 rounded-lg border border-rose-500/20 bg-[#020509] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
              title="Sair do Terminal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
