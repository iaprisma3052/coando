import React, { useState } from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Shield,
  Layers,
  Sparkles,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import type { Analysis, OtcAsset } from '@/types';
import { playClickSound, playSignalTriggerSound } from '@/lib/sound';
import { sorosProgression } from '@/lib/analysis';

interface RobotControlPanelProps {
  asset: OtcAsset;
  analysis: Analysis | null;
  isDemo: boolean;
  robotActive: boolean;
  onToggleRobot: () => void;
  onExecuteOrder: (direction: 'call' | 'put', amount: number, strategy: string) => void;
  executing: boolean;
  currentSorosLevel: number;
  onResetSoros: () => void;
}

export function RobotControlPanel({
  asset,
  analysis,
  isDemo,
  robotActive,
  onToggleRobot,
  onExecuteOrder,
  executing,
  currentSorosLevel,
  onResetSoros,
}: RobotControlPanelProps) {
  const [amount, setAmount] = useState<number>(20);
  const [strategyMode, setStrategyMode] = useState<'normal' | 'soros' | 'martingale'>('soros');
  const [galeLevel, setGaleLevel] = useState<number>(1);
  const [stopWin, setStopWin] = useState<number>(200);
  const [stopLoss, setStopLoss] = useState<number>(100);

  const payout = asset.payout || 88;
  const quickAmounts = [10, 20, 50, 100, 250, 500];

  // Calculate soros table
  const sorosTable = sorosProgression(amount, payout, 4);
  const activeSorosAmount = sorosTable[currentSorosLevel - 1]?.amount || amount;

  const currentTradeAmount = strategyMode === 'soros' ? activeSorosAmount : amount;
  const profitPotential = (currentTradeAmount * (payout / 100)).toFixed(2);

  const handleCall = () => {
    playClickSound();
    playSignalTriggerSound('call');
    onExecuteOrder('call', currentTradeAmount, 'MANUAL_CALL');
  };

  const handlePut = () => {
    playClickSound();
    playSignalTriggerSound('put');
    onExecuteOrder('put', currentTradeAmount, 'MANUAL_PUT');
  };

  return (
    <div className="bg-gray-900/90 rounded-2xl border border-gray-800/90 p-4 flex flex-col gap-4 shadow-xl">
      {/* Panel Title & Robot State */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
              robotActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            <Zap className={`w-4 h-4 ${robotActive ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
              <span>Robô de Operações</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                TAXA DIVIDIDA v3
              </span>
            </h3>
            <p className="text-[11px] text-gray-400">
              {robotActive
                ? 'Disparo automático no nascimento da vela (:00s)'
                : 'Execução manual ou ligue o robô'}
            </p>
          </div>
        </div>

        {/* Big On/Off Switch */}
        <button
          id="robot-main-toggle-btn"
          onClick={() => {
            playClickSound();
            onToggleRobot();
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all border ${
            robotActive
              ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 shadow-md shadow-red-950/40'
              : 'bg-emerald-600 border-emerald-500 text-gray-950 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 font-extrabold'
          }`}
        >
          {robotActive ? (
            <>
              <Pause className="w-3.5 h-3.5 text-red-400" />
              <span>PAUSAR ROBÔ</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-gray-950 fill-gray-950" />
              <span>LIGAR ROBÔ</span>
            </>
          )}
        </button>
      </div>

      {/* Auto Settings Notice */}
      <div className="bg-gray-950/70 rounded-xl p-3 border border-gray-800/80 space-y-1.5 text-xs text-gray-300">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400">⏱ Pré-Análise:</span>
          <span className="text-cyan-400 font-semibold font-mono">aos 58s da vela 1M</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400">⚡ Disparo da Ordem:</span>
          <span className="text-emerald-400 font-semibold font-mono">ao nascer a vela (:00s)</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-400">🎯 Filtro de Padrão:</span>
          <span className="text-purple-400 font-semibold">Gatilho 50% + Cruzamento Micro</span>
        </div>
      </div>

      {/* Strategy Management Mode (Soros / Gale / Normal) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gerenciamento de Capital</span>
          </label>
          {strategyMode === 'soros' && currentSorosLevel > 1 && (
            <button
              onClick={() => {
                playClickSound();
                onResetSoros();
              }}
              className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Resetar Nível
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-950 rounded-xl border border-gray-800">
          <button
            onClick={() => {
              playClickSound();
              setStrategyMode('soros');
            }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              strategyMode === 'soros'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            SOROS {strategyMode === 'soros' && `(N${currentSorosLevel})`}
          </button>
          <button
            onClick={() => {
              playClickSound();
              setStrategyMode('martingale');
            }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              strategyMode === 'martingale'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            MARTINGALE
          </button>
          <button
            onClick={() => {
              playClickSound();
              setStrategyMode('normal');
            }}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              strategyMode === 'normal'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            FIXO
          </button>
        </div>

        {/* Soros Progression Preview */}
        {strategyMode === 'soros' && (
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
            {sorosTable.map((s) => (
              <div
                key={s.level}
                className={`p-1.5 rounded-lg border text-[10px] font-mono transition-all ${
                  currentSorosLevel === s.level
                    ? 'bg-purple-950/60 border-purple-500 text-purple-300 font-extrabold shadow-sm'
                    : 'bg-gray-950/50 border-gray-800/80 text-gray-400'
                }`}
              >
                <div>Nível {s.level}</div>
                <div className="font-bold text-white">${s.amount}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Amount Input & Quick Buttons */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-300">
            Valor da Entrada {strategyMode === 'soros' && '(Base)'}
          </label>
          <span className="text-xs font-mono text-emerald-400 font-bold">
            Retorno: +${profitPotential} ({payout}%)
          </span>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono font-bold">
            $
          </span>
          <input
            id="trade-amount-input"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-full pl-8 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Quick Amount Chips */}
        <div className="grid grid-cols-6 gap-1 mt-2">
          {quickAmounts.map((q) => (
            <button
              key={q}
              onClick={() => {
                playClickSound();
                setAmount(q);
              }}
              className={`py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                amount === q
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-gray-950 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              ${q}
            </button>
          ))}
        </div>
      </div>

      {/* Stop Win & Stop Loss */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-950 p-2 rounded-xl border border-gray-800">
          <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">
            🎯 Stop Win ($)
          </div>
          <input
            type="number"
            value={stopWin}
            onChange={(e) => setStopWin(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-white font-mono text-xs font-bold"
          />
        </div>
        <div className="bg-gray-950 p-2 rounded-xl border border-gray-800">
          <div className="text-[10px] text-rose-400 font-bold uppercase mb-1">
            🛑 Stop Loss ($)
          </div>
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-white font-mono text-xs font-bold"
          />
        </div>
      </div>

      {/* Manual Execution Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* CALL BUTTON */}
        <button
          id="manual-call-btn"
          disabled={executing}
          onClick={handleCall}
          className="relative py-3 px-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-gray-950 font-black shadow-lg shadow-emerald-600/30 active:scale-98 transition-all flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-1.5 text-sm tracking-wide">
            <TrendingUp className="w-4 h-4 stroke-[3]" />
            <span>▲ COMPRA</span>
          </div>
          <span className="text-[11px] font-mono opacity-90">
            ${currentTradeAmount} · 1M
          </span>
          {analysis?.buyOK && (
            <span className="absolute -top-2 right-2 bg-yellow-400 text-gray-950 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full animate-bounce shadow">
              SINAL TAXA3
            </span>
          )}
        </button>

        {/* PUT BUTTON */}
        <button
          id="manual-put-btn"
          disabled={executing}
          onClick={handlePut}
          className="relative py-3 px-4 rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-black shadow-lg shadow-rose-600/30 active:scale-98 transition-all flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-1.5 text-sm tracking-wide">
            <TrendingDown className="w-4 h-4 stroke-[3]" />
            <span>▼ VENDA</span>
          </div>
          <span className="text-[11px] font-mono opacity-90 text-rose-100">
            ${currentTradeAmount} · 1M
          </span>
          {analysis?.sellOK && (
            <span className="absolute -top-2 right-2 bg-yellow-400 text-gray-950 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full animate-bounce shadow">
              SINAL TAXA3
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
