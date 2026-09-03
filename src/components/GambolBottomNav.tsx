import React from 'react';
import type { GambolTab } from '@/types';
import { Home, Sliders, Radio, Bot, Server, History, Settings } from 'lucide-react';
import { playClickSound } from '@/lib/sound';

interface GambolBottomNavProps {
  currentTab: GambolTab;
  onSelectTab: (tab: GambolTab) => void;
}

export function GambolBottomNav({ currentTab, onSelectTab }: GambolBottomNavProps) {
  const tabs: { id: GambolTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'painel', label: 'Home', icon: Home },
    { id: 'simulador', label: 'Simulador', icon: Sliders },
    { id: 'controlador', label: 'Controlador', icon: Radio },
    { id: 'vector_otc', label: 'Vector OTC', icon: Bot },
    { id: 'corretoras', label: 'Corretoras', icon: Server },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'config', label: 'Config', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#070b14]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 max-w-lg mx-auto sm:max-w-2xl">
      <div className="grid grid-cols-7 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onSelectTab(tab.id);
                playClickSound();
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all font-mono ${
                isActive
                  ? 'text-emerald-400 bg-emerald-500/15 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-emerald-400 scale-110' : 'text-slate-400'}`} />
              <span className="text-[9px] leading-tight truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
