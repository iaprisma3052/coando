import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Clock,
  Shield,
  Activity,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Sparkles,
  Bot,
  GitBranch,
  Crosshair,
  Layers,
  Repeat,
  Compass,
  ShieldCheck,
  Target,
} from 'lucide-react';
import type { OtcAsset, Candle, AccountInfo } from '@/types';
import {
  playClickSound,
  playPreAnalysisSound,
  playSignalTriggerSound,
  speakVoiceNotification,
} from '@/lib/sound';
import { CandleChart } from '@/components/CandleChart';
import { MarketVoiceAssistant } from '@/components/MarketVoiceAssistant';
import {
  evaluateZonasCenariosStrategy,
  type ZonasCenariosSignal,
} from '@/lib/zonas-cenarios-fibo-engine';

interface ChineseBotPanelProps {
  assets: OtcAsset[];
  selectedAsset: OtcAsset;
  onSelectAsset: (asset: OtcAsset) => void;
  candles: Candle[];
  account: AccountInfo;
  onOpenSsidModal: () => void;
  onOpenAssetModal: () => void;
}

interface AssetCycleRecord {
  lastSignalTime: number; // timestamp da vela do sinal
  lastSignalType: 'CALL' | 'PUT';
  signal: ZonasCenariosSignal;
  signalFormattedTime: string;
}

const TIMEFRAMES = [
  { id: '5S', label: '5S' },
  { id: '10S', label: '10S' },
  { id: '15S', label: '15S' },
  { id: '30S', label: '30S' },
  { id: '1M', label: '1M' },
  { id: '2M', label: '2M' },
  { id: '3M', label: '3M' },
  { id: '5M', label: '5M' },
  { id: '10M', label: '10M' },
  { id: '15M', label: '15M' },
  { id: '30M', label: '30M' },
];

export function ChineseBotPanel({
  assets,
  selectedAsset,
  onSelectAsset,
  candles,
  account,
  onOpenSsidModal,
  onOpenAssetModal,
}: ChineseBotPanelProps) {
  // Estado de controle de análise
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [analyzedSignal, setAnalyzedSignal] = useState<ZonasCenariosSignal | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string>('');

  // Toggles visuais
  const [enableCommandCandles, setEnableCommandCandles] = useState<boolean>(true);
  const [enableTrendLines, setEnableTrendLines] = useState<boolean>(true);
  const [autoVoiceAlerts, setAutoVoiceAlerts] = useState<boolean>(true);

  // Timeframe selecionado
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');

  // Relógio BRT
  const [brtTimeStr, setBrtTimeStr] = useState<string>('');
  const [secondsToNextCandle, setSecondsToNextCandle] = useState<number>(60);
  const [candleSeconds, setCandleSeconds] = useState<number>(0);

  // Histórico de ciclos operacionais por ativo (5 velas anti-spam)
  const [assetCycles, setAssetCycles] = useState<Record<number, AssetCycleRecord>>({});

  // Atualiza relógio e tempo de vela
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const brt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setBrtTimeStr(brt);

      const sec = now.getSeconds();
      setCandleSeconds(sec);
      setSecondsToNextCandle(60 - sec);
    };

    updateTime();
    const interval = setInterval(updateTime, 500);
    return () => clearInterval(interval);
  }, []);

  // Ciclo atual do ativo selecionado
  const currentAssetCycle = assetCycles[selectedAsset.id] || null;

  // Cálculo de métricas da Estratégia da Vela de Comando em tempo real
  const realtimeMetrics: ZonasCenariosSignal = useMemo(() => {
    return evaluateZonasCenariosStrategy(
      candles,
      currentAssetCycle ? currentAssetCycle.lastSignalTime : 0,
      5
    );
  }, [candles, currentAssetCycle]);

  // Sincroniza o sinal analisado com o ciclo ativo se houver
  useEffect(() => {
    if (currentAssetCycle) {
      setAnalyzedSignal(currentAssetCycle.signal);
      setLastAnalysisTime(currentAssetCycle.signalFormattedTime);
    } else {
      setAnalyzedSignal(null);
      setLastAnalysisTime('');
    }
  }, [selectedAsset.id, currentAssetCycle]);

  // Disparo manual do Botão de Análise: Respeita estritamente a Vela de Comando e Só 1º Pullback
  const handleRunAnalysis = useCallback(() => {
    if (isAnalyzing) return;
    playClickSound();
    playPreAnalysisSound();
    setIsAnalyzing(true);
    setScanStatusText('IDENTIFICANDO VELA DE COMANDO (SEM PAVIO NA ABERTURA)...');

    setTimeout(() => {
      setScanStatusText('APLICANDO FILTROS ANTI-RUÍDO (CORPO INSTITUCIONAL & AFASTAMENTO)...');
    }, 350);

    setTimeout(() => {
      setScanStatusText('ANALISANDO 1º TOQUE / PULLBACK EXCLUSIVO NA LINHA DE DEFESA...');
    }, 700);

    setTimeout(() => {
      const computedSignal = evaluateZonasCenariosStrategy(
        candles,
        currentAssetCycle ? currentAssetCycle.lastSignalTime : 0,
        5
      );

      setAnalyzedSignal(computedSignal);
      setIsAnalyzing(false);

      const nowStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date());

      setLastAnalysisTime(nowStr);

      const lastCandle = candles[candles.length - 1];

      // Se for um novo sinal de COMPRA ou VENDA no 1º Pullback da Vela de Comando
      if (computedSignal.verdict === 'CALL' || computedSignal.verdict === 'PUT') {
        if (lastCandle) {
          setAssetCycles((prev) => ({
            ...prev,
            [selectedAsset.id]: {
              lastSignalTime: lastCandle.time,
              lastSignalType: computedSignal.verdict as 'CALL' | 'PUT',
              signal: computedSignal,
              signalFormattedTime: nowStr,
            },
          }));
        }

        if (computedSignal.verdict === 'CALL') {
          playSignalTriggerSound('call');
          speakVoiceNotification(
            `Atenção operador! Primeiro Pullback de Compra CALL confirmado na Vela de Comando de Alta em ${selectedAsset.label}. Linha de defesa ${computedSignal.defensePrice.toFixed(5)} respeitada com rejeição. Entrada aos 00 segundos!`
          );
        } else {
          playSignalTriggerSound('put');
          speakVoiceNotification(
            `Atenção operador! Primeiro Pullback de Venda PUT confirmado na Vela de Comando de Baixa em ${selectedAsset.label}. Linha de defesa ${computedSignal.defensePrice.toFixed(5)} respeitada com rejeição. Entrada aos 00 segundos!`
          );
        }
      } else if (computedSignal.scenarioType === 'CICLO_EM_MATURACAO') {
        playClickSound();
        speakVoiceNotification(
          `Ciclo em maturação na paridade ${selectedAsset.label}. O robô aguarda o término da operação para proteger sua banca contra entradas consecutivas vela a vela.`
        );
      } else if (computedSignal.scenarioType === 'PULLBACK_JA_EXECUTADO') {
        playClickSound();
        speakVoiceNotification(
          `Aviso de proteção em ${selectedAsset.label}. O Primeiro Pullback desta Vela de Comando já foi executado no passado. O segundo toque foi descartado por segurança.`
        );
      } else {
        playClickSound();
        speakVoiceNotification(
          `Aguardando vela testar a Linha de Defesa da Vela de Comando para ${selectedAsset.label}. Somente o Primeiro Pullback será operado.`
        );
      }
    }, 1100);
  }, [isAnalyzing, candles, currentAssetCycle, selectedAsset.id, selectedAsset.label]);

  // Alerta automático do robô aos 00s (com estrito bloqueio anti-spam e respeito ao ciclo)
  useEffect(() => {
    if (!autoVoiceAlerts || isAnalyzing) return;
    if (candles.length < 15) return;

    const lastCandle = candles[candles.length - 1];
    if (!lastCandle) return;

    // Dispara no nascimento da vela atual (:00s a :06s)
    if (candleSeconds <= 6 || candleSeconds >= 59) {
      // Se o ciclo estiver ativo ou já houve sinal recente, NÃO DISPARA!
      if (realtimeMetrics.cycleStatus?.isCycleActive) return;

      if (realtimeMetrics.verdict === 'CALL' || realtimeMetrics.verdict === 'PUT') {
        const nowStr = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date());

        // Registra o ciclo deste ativo (5 velas de bloqueio vela a vela)
        setAssetCycles((prev) => ({
          ...prev,
          [selectedAsset.id]: {
            lastSignalTime: lastCandle.time,
            lastSignalType: realtimeMetrics.verdict as 'CALL' | 'PUT',
            signal: realtimeMetrics,
            signalFormattedTime: `${nowStr} (Auto)`,
          },
        }));

        setAnalyzedSignal(realtimeMetrics);
        setLastAnalysisTime(`${nowStr} (Auto)`);

        if (realtimeMetrics.verdict === 'CALL') {
          playSignalTriggerSound('call');
          speakVoiceNotification(
            `Alerta automático! 1º Pullback de Compra CALL na Vela de Comando em ${selectedAsset.label}. Linha de defesa respeitada. Entrada aos 00 segundos!`
          );
        } else if (realtimeMetrics.verdict === 'PUT') {
          playSignalTriggerSound('put');
          speakVoiceNotification(
            `Alerta automático! 1º Pullback de Venda PUT na Vela de Comando em ${selectedAsset.label}. Linha de defesa respeitada. Entrada aos 00 segundos!`
          );
        }
      }
    }
  }, [
    candleSeconds,
    autoVoiceAlerts,
    isAnalyzing,
    candles,
    realtimeMetrics,
    selectedAsset.id,
    selectedAsset.label,
  ]);

  const quickPairs = useMemo(() => {
    return assets.slice(0, 10);
  }, [assets]);

  const payoutPct = selectedAsset.payout || 88;
  const precision = selectedAsset.precision || 5;

  const cycleInfo = realtimeMetrics.cycleStatus;
  const isCycleActive = cycleInfo?.isCycleActive || false;
  const candlesElapsed = cycleInfo?.candlesSinceLastSignal || 0;
  const cycleRequired = cycleInfo?.cycleRequiredCandles || 5;

  const activeCmd = (analyzedSignal || realtimeMetrics).activeCommandCandle;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Hero Banner */}
      <div
        id="prisma-ia-vector-hero-card"
        className="relative overflow-hidden rounded-2xl border border-sky-500/30 p-5 md:p-6 bg-gradient-to-b from-[#060c14]/98 to-[#020509]/98 shadow-2xl shadow-sky-950/40 backdrop-blur-xl"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative group flex-shrink-0">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-amber-500/60 shadow-lg shadow-amber-500/30 bg-black flex items-center justify-center">
                <img
                  src="/prisma_ia_logo.jpg"
                  alt="PRISMA IA - VELA DE COMANDO"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-black rounded-full animate-ping" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white font-mono tracking-tight flex items-center gap-2">
                  <span>PRISMA IA</span>
                  <span className="text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                    ESTRATÉGIA VELA DE COMANDO
                  </span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  LÓGICA DO PREÇO
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  SÓ O 1º PULLBACK
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  FILTRO ANTI-RUÍDO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-1.5 flex-wrap">
                <span className="text-white font-semibold">{selectedAsset.label}</span>
                <span>•</span>
                <span className="text-emerald-400">Payout {payoutPct}%</span>
                <span>•</span>
                <span className="text-slate-300">trade.optgobroker.com/traderoom</span>
                <span>•</span>
                <span className="text-sky-300">Brasília: {brtTimeStr}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botão de Análise Vela de Comando & 1º Pullback */}
            <button
              type="button"
              id="btn-analisar-mercado-topo"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-mono font-black border transition-all bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 text-slate-950 hover:brightness-110 shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer disabled:opacity-70"
              title="Analisa a Vela de Comando e identifica o 1º Pullback exclusivo com rejeição na linha de defesa"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>ANALISANDO VELA DE COMANDO...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-slate-950 animate-pulse" />
                  <span>ANALISAR VELA DE COMANDO &amp; 1º PULLBACK</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* NOVO: CARD DO ENTENDIMENTO DO CICLO DE MERCADO & FLUXO */}
      <div className="bg-[#040913]/95 border border-sky-500/25 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-500/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white font-mono tracking-tight">
                  CICLO OPERACIONAL &amp; PROTEÇÃO ANTI-SPAM
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                  5 VELAS DE PROTEÇÃO
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                O robô não opera vela atrás de vela. Cada sinal de 1º Pullback gera um ciclo de maturação para proteger sua banca e aguardar uma nova Vela de Comando genuína.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                isCycleActive
                  ? 'bg-sky-950/80 border-sky-500/60 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                  : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              }`}
            >
              <Compass className="w-4 h-4 animate-spin" />
              <span>{cycleInfo?.phaseLabel || 'MONITORANDO COMANDOS'}</span>
            </div>
          </div>
        </div>

        {/* Régua de Maturação do Ciclo (1 a 5 velas) */}
        <div className="p-3 rounded-xl bg-black/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-bold">Ciclo Operacional:</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((candleStep) => {
                const isCompleted = isCycleActive && candlesElapsed >= candleStep;
                const isCurrent = isCycleActive && candlesElapsed === candleStep - 1;
                return (
                  <div
                    key={candleStep}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-black transition-all flex items-center gap-1 ${
                      isCompleted
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : isCurrent
                        ? 'bg-sky-500/30 border-sky-400 text-white shadow-md shadow-sky-500/20 animate-pulse'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span>Vela {candleStep}</span>
                    {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-300 flex items-center gap-2">
            {isCycleActive ? (
              <span className="text-sky-300 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                Maturação em andamento ({candlesElapsed}/{cycleRequired} velas concluídas)
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ciclo disponível para novo 1º Pullback de Vela de Comando
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card Central da Estratégia da Vela de Comando (Lógica do Preço) */}
      <div className="bg-[#050a12]/95 border border-amber-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white font-mono tracking-tight">
                  LÓGICA DO PREÇO · VELA DE COMANDO &amp; 1º PULLBACK
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                  MARCAÇÃO AUTOMÁTICA
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                  APENAS O 1º TOQUE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                O robô identifica a Vela de Comando (sem pavio na abertura) e projeta a Linha de Defesa. O sinal só é gerado no PRIMEIRO PULLBACK com rejeição confirmada.
              </p>
            </div>
          </div>

          {/* Veredicto do Sinal (Vela Atual) */}
          <div className="flex items-center gap-3">
            {isCycleActive ? (
              <div className="px-4 py-2 rounded-xl border border-sky-500/60 bg-sky-950/80 text-sky-300 shadow-lg flex items-center gap-3 font-mono">
                <Clock className="w-6 h-6 text-sky-400 animate-spin" />
                <div>
                  <div className="text-[10px] text-sky-400 font-bold uppercase">
                    CICLO OPERACIONAL EM MATURAÇÃO
                  </div>
                  <div className="text-base font-black text-white">
                    VELA {candlesElapsed}/{cycleRequired} (BLOQUEIO ATIVO)
                  </div>
                </div>
              </div>
            ) : analyzedSignal === null ? (
              <div className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/80 flex items-center gap-3 font-mono">
                <Bot className="w-5 h-5 text-amber-400 animate-pulse" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">ROBÔ EM ESPERA</div>
                  <div className="text-sm font-black text-amber-400">CLIQUE EM 'ANALISAR VELA DE COMANDO'</div>
                </div>
              </div>
            ) : analyzedSignal.verdict === 'CALL' ? (
              <div className="px-4 py-2 rounded-xl border border-emerald-500/70 bg-emerald-950/90 text-emerald-300 shadow-lg shadow-emerald-950/60 flex items-center gap-2.5 font-mono">
                <TrendingUp className="w-6 h-6 text-emerald-400 animate-bounce" />
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5">
                    <span>{analyzedSignal.candlePatternName}</span>
                    <span className="text-slate-400">({lastAnalysisTime})</span>
                  </div>
                  <div className="text-base font-black text-white">1º PULLBACK: COMPRA (CALL) ▲</div>
                </div>
              </div>
            ) : analyzedSignal.verdict === 'PUT' ? (
              <div className="px-4 py-2 rounded-xl border border-rose-500/70 bg-rose-950/90 text-rose-300 shadow-lg shadow-rose-950/60 flex items-center gap-2.5 font-mono">
                <TrendingDown className="w-6 h-6 text-rose-400 animate-bounce" />
                <div>
                  <div className="text-[10px] text-rose-400 font-bold flex items-center gap-1.5">
                    <span>{analyzedSignal.candlePatternName}</span>
                    <span className="text-slate-400">({lastAnalysisTime})</span>
                  </div>
                  <div className="text-base font-black text-white">1º PULLBACK: VENDA (PUT) ▼</div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl border border-amber-500/60 bg-amber-950/80 text-amber-300 flex items-center gap-2.5 font-mono">
                <ShieldCheck className="w-6 h-6 text-amber-400" />
                <div>
                  <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                    <span>
                      {analyzedSignal.scenarioType === 'PULLBACK_JA_EXECUTADO'
                        ? '1º PULLBACK JÁ EXECUTADO'
                        : 'AGUARDANDO 1º PULLBACK'}
                    </span>
                    <span className="text-slate-400">({lastAnalysisTime})</span>
                  </div>
                  <div className="text-sm font-black text-slate-200">PROTEÇÃO (NO TRADE)</div>
                </div>
              </div>
            )}

            {/* Cronômetro da Vela Atual M1 */}
            <div className="bg-black/60 border border-amber-500/30 px-3 py-2 rounded-xl text-center font-mono">
              <div className="text-[10px] text-slate-400">VELA ATUAL M1</div>
              <div className="text-base font-black text-amber-400">:{String(candleSeconds).padStart(2, '0')}s</div>
              <div className="text-[9px] text-slate-400">decorrido de 60s</div>
            </div>
          </div>
        </div>

        {/* 4 Cards da Estratégia Vela de Comando & 1º Pullback */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Vela de Comando Ativa */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 font-mono text-amber-300">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                1. Vela de Comando
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                SEM PAVIO ABERTURA
              </span>
            </div>
            <div className="text-sm font-black text-white truncate">
              {activeCmd
                ? `Comando de ${activeCmd.direction} (${activeCmd.type === 'COMANDO_ABERTO' ? 'Aberto' : 'Fechado'})`
                : 'Mapeando...'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {activeCmd
                ? `Linha de Defesa: ${activeCmd.openPrice.toFixed(precision)} (50%: ${activeCmd.midPrice.toFixed(precision)})`
                : 'Procurando vela com corpo forte e abertura pura.'}
            </p>
          </div>

          {/* Card 2: Filtros Anti-Ruído & Loss */}
          <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-950/20 font-mono text-sky-300">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                2. Filtros de Loss &amp; Ruído
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                BLINDAGEM
              </span>
            </div>
            <div className="text-sm font-black text-white truncate">
              {activeCmd
                ? `${activeCmd.avgBodyMultiplier}x Média | Distância: ${activeCmd.candlesDistance}v`
                : 'Aguardando Comando'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {activeCmd?.filterStatus.unbrokenDefense
                ? 'Defesa inviolada · Sem fechamento rompido'
                : 'Comando violado ou em consolidação.'}
            </p>
          </div>

          {/* Card 3: Status do 1º Pullback */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 font-mono text-amber-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                3. Primeiro Pullback
              </span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                SÓ 1º TOQUE
              </span>
            </div>
            <div className="text-xs font-black text-white truncate">
              {activeCmd?.status === 'TESTANDO_PRIMEIRO_PULLBACK'
                ? 'TESTANDO 1º TOQUE AGORA!'
                : activeCmd?.status === 'PULLBACK_EXECUTADO'
                ? 'PULLBACK CONCLUÍDO (EXPIRADA)'
                : activeCmd?.status === 'ROMPIDO_INVALIDADO'
                ? 'DEFESA ROMPIDA (CANCELADA)'
                : 'AGUARDANDO RETORNO À TAXA'}
            </div>
            <p className="text-[11px] text-amber-300/80 mt-1 truncate">
              {activeCmd?.status === 'PULLBACK_EXECUTADO'
                ? 'O primeiro toque já ocorreu. 2º toque descartado por segurança.'
                : activeCmd
                ? `Aguardando preço tocar na linha ${activeCmd.openPrice.toFixed(precision)}.`
                : 'Sem comando ativo.'}
            </p>
          </div>

          {/* Card 4: Gatilho no Nascimento dos 00s */}
          <div
            className={`p-3.5 rounded-xl border font-mono transition-all ${
              analyzedSignal && analyzedSignal.verdict !== 'NO_TRADE'
                ? analyzedSignal.verdict === 'CALL'
                  ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/60 text-rose-300'
                : 'bg-slate-900/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                4. Gatilho aos 00s
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {analyzedSignal ? analyzedSignal.verdict : 'STANDBY'}
              </span>
            </div>
            <div className="text-sm font-black text-white truncate">
              {analyzedSignal ? (
                analyzedSignal.verdict === 'CALL' ? (
                  <span className="text-emerald-400">1º PULLBACK: COMPRA (CALL)</span>
                ) : analyzedSignal.verdict === 'PUT' ? (
                  <span className="text-rose-400">1º PULLBACK: VENDA (PUT)</span>
                ) : (
                  <span className="text-amber-400">STANDBY (PROTEÇÃO)</span>
                )
              ) : (
                <span className="text-slate-400">PRONTO PARA SCAN</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {analyzedSignal ? analyzedSignal.candlePatternName : 'Dispara no 1º toque com rejeição de pavio.'}
            </p>
          </div>
        </div>

        {/* Motivos Técnicos e Diagnóstico */}
        <div className="mt-3 pt-3 border-t border-amber-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap text-slate-300">
            <span className="text-amber-400 font-bold">Diagnóstico Vela de Comando:</span>
            {analyzedSignal ? (
              <span className="text-slate-200">{analyzedSignal.reason}</span>
            ) : (
              <span className="text-slate-400">
                Clique em 'Analisar Vela de Comando' para validar a linha de defesa e o primeiro pullback.
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>
              Confiança:{' '}
              <strong className="text-white">
                {analyzedSignal ? `${analyzedSignal.confidence}%` : 'Aguardando Análise'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Assistente de Voz Interativo do Robô (Vela de Comando & 1º Pullback) */}
      <MarketVoiceAssistant
        selectedAsset={selectedAsset}
        candles={candles}
        metrics={realtimeMetrics}
        secondsToNextCandle={secondsToNextCandle}
        autoVoiceAlerts={autoVoiceAlerts}
        onToggleAutoVoice={() => {
          playClickSound();
          setAutoVoiceAlerts((prev) => !prev);
        }}
      />

      {/* Painel de Seleção de Ativos e Timeframes */}
      <div className="bg-[#050a12]/95 border border-sky-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-500/20 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-widest block mb-0.5">
              [ SELEÇÃO DO ATIVO ]
            </span>
            <h2 className="text-lg font-black text-white font-mono tracking-tight">
              Paridades &amp; Tempo Gráfico
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAssetModal}
              className="text-xs font-bold font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Todos os 148 Ativos</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono font-bold">
                Ctrl + V
              </kbd>
            </button>
          </div>
        </div>

        {/* Seleção Rápida de Ativos */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Ativos Rápidos OTC:</span>
            <span className="text-sky-400 font-bold">{selectedAsset.label} selecionado</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickPairs.map((asset) => {
              const isSelected = selectedAsset.id === asset.id;
              const hasCycle = assetCycles[asset.id]?.lastSignalTime;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    onSelectAsset(asset);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm font-bold'
                      : 'bg-slate-900/70 text-slate-300 border-white/10 hover:border-amber-500/30 hover:text-white'
                  }`}
                >
                  <span>{asset.label}</span>
                  {hasCycle && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  )}
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {asset.payout || 88}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Seleção de Timeframe */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Tempo de Vela:</span>
            <span className="text-amber-400 font-bold">{selectedTimeframe} (Gráfico M1 com Marcação Automática de Vela de Comando)</span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1">
            {TIMEFRAMES.map((tf) => {
              const isSelected = selectedTimeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setSelectedTimeframe(tf.id);
                  }}
                  className={`py-1.5 rounded-md text-xs font-bold transition-all border text-center ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black'
                      : 'bg-slate-900/70 text-slate-300 border-white/10 hover:border-amber-500/30 hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gráfico com Velas Gordinhas + Marcação Automática de Vela de Comando + Linhas LTA/LTB (Apenas Guia Visual) */}
      <div id="prisma-zonas-cenarios-chart" className="w-full">
        <CandleChart
          candles={candles}
          activeId={selectedAsset.id}
          symbol={selectedAsset.symbol}
          precision={precision}
          isAnalyzing={isAnalyzing}
          scanStatusText={scanStatusText}
          enableCommandCandles={enableCommandCandles}
          onToggleCommandCandles={() => {
            playClickSound();
            setEnableCommandCandles((prev) => !prev);
          }}
          enableTrendLines={enableTrendLines}
          onToggleTrendLines={() => {
            playClickSound();
            setEnableTrendLines((prev) => !prev);
          }}
          activeSignal={analyzedSignal}
        />
      </div>
    </div>
  );
}
