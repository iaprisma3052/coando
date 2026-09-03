import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Clock,
} from 'lucide-react';
import type { OtcAsset, ScanAlert, ExecLog } from '@/types';
import { playClickSound, playPreAnalysisSound, playSignalTriggerSound } from '@/lib/sound';

interface ScannerViewProps {
  assets: OtcAsset[];
  onSelectAssetForTrading: (asset: OtcAsset) => void;
  isDemo: boolean;
}

export function ScannerView({
  assets,
  onSelectAssetForTrading,
  isDemo,
}: ScannerViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minPayout, setMinPayout] = useState<number>(85);
  const [minStrength, setMinStrength] = useState<number>(75);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [autoExecute, setAutoExecute] = useState<boolean>(false);
  const [tradeAmount, setTradeAmount] = useState<number>(15);
  const [alerts, setAlerts] = useState<ScanAlert[]>([]);
  const [execLogs, setExecLogs] = useState<ExecLog[]>([]);
  const [scanningStatus, setScanningStatus] = useState<string>('Aguardando ciclo das :58s...');
  const [lastScanTime, setLastScanTime] = useState<string>('--:--:--');

  const triggeredMinutesRef = useRef<Set<number>>(new Set());

  // Filtered target assets
  const targetAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
      const matchPayout = (a.payout || 88) >= minPayout;
      return matchCat && matchPayout;
    });
  }, [assets, selectedCategory, minPayout]);

  // Run the batch scan
  const runScan = async () => {
    if (targetAssets.length === 0) return;
    setScanningStatus(`Varrendo ${targetAssets.length} ativos com Consenso de 3 Votos...`);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeIds: targetAssets.map((a) => a.id),
          minStrength,
          minPayout,
        }),
      });

      if (res.ok) {
        const foundAlerts: ScanAlert[] = await res.json();
        setAlerts(foundAlerts);
        setLastScanTime(
          new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        );
        setScanningStatus(
          `Varredura concluída: ${foundAlerts.length} sinais identificados em ${targetAssets.length} ativos`,
        );

        if (foundAlerts.length > 0) {
          playPreAnalysisSound();

          // If auto-execute on scanner is on, fire the highest confidence alert
          if (autoExecute) {
            const bestAlert = foundAlerts[0];
            executeScannerTrade(bestAlert);
          }
        }
      }
    } catch {
      setScanningStatus('Erro ao executar varredura de ativos');
    }
  };

  const executeScannerTrade = async (alert: ScanAlert) => {
    playSignalTriggerSound(alert.direction);

    const logItem: ExecLog = {
      id: `SCAN-${Date.now()}`,
      activeId: alert.activeId,
      label: alert.symbol,
      direction: alert.direction,
      amount: tradeAmount,
      time: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      success: true,
      reason: `Chinese Bot AI Pro (${alert.strength}% Consenso)`,
      sorosLevel: 1,
      status: 'OPEN',
    };

    setExecLogs((prev) => [logItem, ...prev.slice(0, 49)]);

    try {
      await fetch('/api/execute-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeId: alert.activeId,
          direction: alert.direction,
          amount: tradeAmount,
          duration: 60,
          isDemo,
          skipVerify: true,
        }),
      });
    } catch {
      // ignore
    }
  };

  // Clock trigger at :58s
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      const now = new Date();
      const sec = now.getSeconds();
      const minuteKey = now.getMinutes() + now.getHours() * 60;

      // Trigger pre-analysis scan at 58s of each minute
      if (sec === 58 && !triggeredMinutesRef.current.has(minuteKey)) {
        triggeredMinutesRef.current.add(minuteKey);
        runScan();
      }

      // Cleanup old minute keys
      if (triggeredMinutesRef.current.size > 10) {
        triggeredMinutesRef.current.clear();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isScanning, targetAssets, minStrength, minPayout, autoExecute, tradeAmount]);

  // Initial scan on load
  useEffect(() => {
    runScan();
  }, [selectedCategory, minPayout, minStrength]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 flex flex-col gap-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#060c14] via-[#040810] to-[#020509] rounded-2xl border border-emerald-500/30 p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-emerald-500/40 bg-black flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <img
              src="/prisma_ia_logo.jpg"
              alt="PRISMA IA"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white font-mono">
                Auto Scanner · <span className="text-emerald-400">PRISMA IA VECTOR OTC</span>
              </h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                148 ATIVOS OPTGO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Varredura de Consenso de 3 Votos em tempo real (trade.optgobroker.com/traderoom)
            </p>
          </div>
        </div>

        {/* Scan Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              playClickSound();
              runScan();
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-2 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Varredura Agora</span>
          </button>

          <button
            onClick={() => {
              playClickSound();
              setIsScanning(!isScanning);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 shadow-lg ${
              isScanning
                ? 'bg-emerald-400 border-emerald-400 text-slate-950 shadow-emerald-950/40 font-black'
                : 'bg-rose-500/20 border-rose-500 text-rose-300'
            }`}
          >
            {isScanning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isScanning ? 'SCANNER ATIVO' : 'SCANNER PAUSADO'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Filters, Alerts, and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Filters & Parameters (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#0e1426]/90 rounded-2xl border border-white/10 p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Filtros do Scanner</span>
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {targetAssets.length} Ativos
              </span>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Mercado / Categoria:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'all', label: 'Todos (148)' },
                  { id: 'forex', label: 'Forex' },
                  { id: 'stock', label: 'Ações' },
                  { id: 'crypto', label: 'Cripto' },
                  { id: 'commodity', label: 'Commodities' },
                  { id: 'index', label: 'Índices' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      playClickSound();
                      setSelectedCategory(cat.id);
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-400 text-slate-950 font-black shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum Payout Filter */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="text-slate-300 font-semibold">Payout Mínimo:</span>
                <span className="font-mono font-bold text-emerald-400">{minPayout}%</span>
              </div>
              <input
                type="range"
                min={70}
                max={95}
                step={1}
                value={minPayout}
                onChange={(e) => setMinPayout(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* Minimum Consensus Strength */}
            <div>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="text-slate-300 font-semibold">Confiança Mínima IA:</span>
                <span className="font-mono font-bold text-emerald-400">{minStrength}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={minStrength}
                onChange={(e) => setMinStrength(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* Auto-Execution Toggle for Scanner */}
            <div className="bg-slate-900 p-3 rounded-xl border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Auto-Executar Melhores Sinais
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Disparo automático na virada da vela (:00s)
                  </span>
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    setAutoExecute(!autoExecute);
                  }}
                  className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
                    autoExecute ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-slate-950 transition-transform ${
                      autoExecute ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {autoExecute && (
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Valor por Entrada:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">$</span>
                    <input
                      type="number"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                      className="w-20 bg-slate-950 border border-white/10 rounded px-2 py-0.5 text-white font-mono font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/10 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Última Varredura:</span>
                <span className="text-white font-mono font-bold">{lastScanTime}</span>
              </div>
              <div className="text-emerald-400 truncate">{scanningStatus}</div>
            </div>
          </div>
        </div>

        {/* Center/Right Column: Sinais Identificados & Log (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Active Sinais Encontrados */}
          <div className="bg-[#0e1426]/90 rounded-2xl border border-white/10 p-4 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">
                  Oportunidades Filtradas ({alerts.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Consenso 3 Votos • Gatilho :58s
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center">
                <Clock className="w-8 h-8 text-slate-600 mb-2 animate-spin" />
                <p>Nenhum sinal com força &ge; {minStrength}% e Payout &ge; {minPayout}% no momento.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  O scanner varre automaticamente a cada ciclo (:58s).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {alerts.map((alert) => {
                  const isCall = alert.direction === 'call';
                  const targetAsset = assets.find((a) => a.id === alert.activeId);

                  return (
                    <div
                      key={alert.activeId}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCall
                          ? 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400'
                          : 'bg-rose-950/25 border-rose-500/40 hover:border-rose-400'
                      }`}
                    >
                      <div>
                        {/* Top: Symbol & Payout */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded ${
                                isCall
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {isCall ? '▲ CALL' : '▼ PUT'}
                            </span>
                            <span className="font-bold text-white text-sm">{alert.symbol}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {alert.payout}% · {alert.strength}%
                            </span>
                          </div>
                        </div>

                        {/* Status context */}
                        <p className="text-xs text-slate-300 font-semibold mb-1">
                          {alert.candleContext}
                        </p>

                        {/* Key reasons */}
                        <div className="space-y-1 mb-3">
                          {alert.reasons.slice(0, 2).map((r, idx) => (
                            <div key={idx} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => {
                          playClickSound();
                          if (targetAsset) {
                            onSelectAssetForTrading(targetAsset);
                          }
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-emerald-400 hover:text-slate-950 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <span>Operar este Ativo no Painel</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scanner Execution Log */}
          <div className="bg-[#0e1426]/90 rounded-2xl border border-white/10 p-4 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Histórico de Disparos do Auto Scanner
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                {execLogs.length} registros
              </span>
            </div>

            <div className="overflow-y-auto max-h-48 space-y-1.5">
              {execLogs.length === 0 ? (
                <div className="py-6 text-center text-slate-600 text-xs">
                  Nenhuma ordem disparada automaticamente pelo scanner nesta sessão.
                </div>
              ) : (
                execLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">⚡ DISPARO</span>
                      <span className="text-white font-bold">{log.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          log.direction === 'call'
                            ? 'bg-emerald-950 text-emerald-300'
                            : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {log.direction.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                      <span>${log.amount}</span>
                      <span className="text-slate-600">•</span>
                      <span>{log.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
