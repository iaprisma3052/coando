import React, { useState, useEffect, useRef } from 'react';
import type { OtcAsset, Candle, GambolBroker } from '@/types';
import { GAMBOL_BROKERS } from '@/lib/gambol-data';
import { playClickSound, playWinSound, playLossSound } from '@/lib/sound';
import {
  ChevronDown,
  Clock,
  Sliders,
  TrendingUp,
  TrendingDown,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
} from 'lucide-react';

interface GambolSimuladorProps {
  assets: OtcAsset[];
  selectedAsset: OtcAsset;
  onSelectAsset: (asset: OtcAsset) => void;
  candles: Candle[];
  onOpenAssetModal?: () => void;
}

export function GambolSimulador({
  assets,
  selectedAsset,
  onSelectAsset,
  candles,
  onOpenAssetModal,
}: GambolSimuladorProps) {
  const [selectedBroker, setSelectedBroker] = useState<GambolBroker>(GAMBOL_BROKERS[0]); // OPTGO by default
  const [isBrokerDropdownOpen, setIsBrokerDropdownOpen] = useState(false);
  const [expiry, setExpiry] = useState<'5s' | '10s' | '30s' | '1m'>('5s');
  const [candleSizePct, setCandleSizePct] = useState<number>(100);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [customDir, setCustomDir] = useState<'alta' | 'baixa'>('alta');
  const [customPct, setCustomPct] = useState<number>(100);
  const [clock, setClock] = useState<string>('--:--:--');

  // Simulation order state
  const [activeOrder, setActiveOrder] = useState<{
    id: string;
    direction: 'alta' | 'baixa';
    openPrice: number;
    closePrice?: number;
    secondsLeft: number;
    duration: number;
    status: 'running' | 'win' | 'loss';
    profit: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const quickAssets = assets.slice(0, 8);

  // Live Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, []);

  // Expiry in seconds
  const getExpirySeconds = (exp: string): number => {
    switch (exp) {
      case '5s':
        return 5;
      case '10s':
        return 10;
      case '30s':
        return 30;
      case '1m':
        return 60;
      default:
        return 5;
    }
  };

  // Trigger S. Manipulação (Alta / Baixa)
  const handleStartSimManip = (direction: 'alta' | 'baixa') => {
    if (activeOrder && activeOrder.status === 'running') return;
    playClickSound();

    const lastPrice = candles[candles.length - 1]?.close || 1.0;
    const dur = getExpirySeconds(expiry);

    setActiveOrder({
      id: `SIM-${Date.now()}`,
      direction,
      openPrice: lastPrice,
      secondsLeft: dur,
      duration: dur,
      status: 'running',
      profit: 0,
    });

    // Also trigger server manipulation
    fetch('/api/controlador/manipulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeId: selectedAsset.id,
        direction,
        force: candleSizePct,
        broker: selectedBroker.id,
      }),
    }).catch(() => {});
  };

  // Order countdown timer and win resolution
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'running') return;

    const timer = setInterval(() => {
      setActiveOrder((prev) => {
        if (!prev || prev.status !== 'running') return prev;

        if (prev.secondsLeft <= 1) {
          // Finished
          const currentPrice = candles[candles.length - 1]?.close || prev.openPrice;
          const isWin =
            prev.direction === 'alta'
              ? currentPrice >= prev.openPrice
              : currentPrice <= prev.openPrice;

          const payout = selectedAsset.payout || 90;
          const profit = isWin ? Number((100 * (payout / 100)).toFixed(2)) : -100;

          if (isWin) {
            playWinSound();
          } else {
            playLossSound();
          }

          // Auto clear after 3.5s
          setTimeout(() => {
            setActiveOrder(null);
          }, 3500);

          return {
            ...prev,
            secondsLeft: 0,
            status: isWin ? 'win' : 'loss',
            closePrice: currentPrice,
            profit,
          };
        }

        return {
          ...prev,
          secondsLeft: prev.secondsLeft - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeOrder, candles, selectedAsset.payout]);

  // Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const displayCandles = candles.slice(-45);
    if (displayCandles.length === 0) return;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const c of displayCandles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    }

    const padding = (maxPrice - minPrice) * 0.15 || 0.0001;
    minPrice -= padding;
    maxPrice += padding;
    const priceRange = maxPrice - minPrice;

    const candleWidth = Math.max(4, (w - 70) / displayCandles.length - 3);
    const spacing = (w - 70) / displayCandles.length;

    displayCandles.forEach((c, idx) => {
      const x = idx * spacing + spacing / 2;
      const isGreen = c.close >= c.open;
      const color = isGreen ? '#10b981' : '#ef4444';
      const openY = h - ((c.open - minPrice) / priceRange) * (h - 40) - 20;
      const closeY = h - ((c.close - minPrice) / priceRange) * (h - 40) - 20;
      const highY = h - ((c.high - minPrice) / priceRange) * (h - 40) - 20;
      const lowY = h - ((c.low - minPrice) / priceRange) * (h - 40) - 20;

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(2, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, topY, candleWidth, bodyH);
    });

    // Active order entry line
    if (activeOrder) {
      const entryY = h - ((activeOrder.openPrice - minPrice) / priceRange) * (h - 40) - 20;
      ctx.strokeStyle = activeOrder.direction === 'alta' ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(0, entryY);
      ctx.lineTo(w - 70, entryY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Price tag on right
    const last = displayCandles[displayCandles.length - 1];
    if (last) {
      const lastY = h - ((last.close - minPrice) / priceRange) * (h - 40) - 20;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(w - 68, lastY - 11, 65, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(last.close.toFixed(selectedAsset.precision || 5), w - 35, lastY);
    }
  }, [candles, selectedAsset, activeOrder]);

  const lastPrice = candles[candles.length - 1]?.close || 1.0;

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#070b13] border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-0 text-slate-100">
      {/* Header */}
      <div className="bg-[#0b101c] border-b border-white/10 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-700/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-white font-bold text-base tracking-tight font-mono block">
              Simulador Gambol
            </strong>
            <small className="text-slate-400 text-xs">Manipulação de Candlestick OTC</small>
          </div>
        </div>

        <span className="text-[11px] font-mono text-blue-400 bg-blue-950/60 border border-blue-500/30 px-2.5 py-1 rounded-lg">
          Simulador Ativo
        </span>
      </div>

      {/* Broker & Expiry Controls */}
      <div className="grid grid-cols-2 gap-2.5 p-3 bg-[#080d19] border-b border-white/5">
        {/* Broker Dropdown */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-mono font-semibold block">
            Corretora
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBrokerDropdownOpen(!isBrokerDropdownOpen)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-[#04070e] border border-white/10 text-left text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center">
                  <img
                    src={selectedBroker.logo}
                    alt={selectedBroker.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = selectedBroker.fallbackLogo;
                    }}
                  />
                </div>
                <span className="font-bold text-white truncate">{selectedBroker.name}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isBrokerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 max-h-52 overflow-y-auto bg-[#04070e] border border-blue-500/30 rounded-xl shadow-2xl divide-y divide-white/5">
                {GAMBOL_BROKERS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBroker(b);
                      setIsBrokerDropdownOpen(false);
                      playClickSound();
                    }}
                    className="w-full flex items-center justify-between p-2 text-left hover:bg-white/5 text-xs font-mono"
                  >
                    <span>{b.name}</span>
                    <span className="text-[9px] text-emerald-400">{b.latency}ms</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expiry Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-mono font-semibold block">
            Expiração
          </label>
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value as any)}
            className="w-full p-2 rounded-xl bg-[#04070e] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
          >
            <option value="5s">⏱ 5 segundos</option>
            <option value="10s">⏱ 10 segundos</option>
            <option value="30s">⏱ 30 segundos</option>
            <option value="1m">⏱ 1 minuto</option>
          </select>
        </div>
      </div>

      {/* Candle Percentage Bar */}
      <div className="px-3 pt-2 pb-2.5 bg-[#05080e] border-b border-white/5 space-y-1.5">
        <label className="text-[10px] text-slate-400 font-mono font-semibold block">
          Tamanho da vela
        </label>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[25, 50, 75, 100, 125, 150].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                setCandleSizePct(pct);
                playClickSound();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                candleSizePct === pct
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'bg-[#0f172a] text-slate-400 hover:bg-slate-800'
              }`}
            >
              {pct}%
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setIsCustomModalOpen(true);
              playClickSound();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 whitespace-nowrap"
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Status Row */}
      <div className="bg-[#05080e] px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">
          Ativo: <span className="text-blue-400 font-bold">{selectedAsset.symbol} OTC</span>
        </span>
        <span className="text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {clock}
        </span>
        <span className="text-slate-400">Modo: Simulação</span>
      </div>

      {/* Asset Tabs & Lupa Search Button */}
      <div className="flex items-center gap-1.5 p-2 bg-[#080d17] border-b border-white/5">
        {onOpenAssetModal && (
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onOpenAssetModal();
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-all active:scale-95 group"
            title="Abrir catálogo completo com 148 ativos"
          >
            <Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span>Todos Ativos ({assets.length})</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
          {quickAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onSelectAsset(asset)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                asset.id === selectedAsset.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0f172a] text-slate-300 hover:bg-slate-800'
              }`}
            >
              {asset.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Chart with Order Overlay */}
      <div className="relative w-full h-72 bg-[#060a12] border-b border-white/10">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Live Order Overlay Card */}
        {activeOrder && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#0b101c] border border-blue-500/50 rounded-2xl p-4 max-w-xs w-full shadow-2xl text-center space-y-2 animate-in fade-in zoom-in-95">
              <div className="text-xs font-mono text-slate-400">
                {activeOrder.status === 'running'
                  ? 'Operação em Andamento...'
                  : activeOrder.status === 'win'
                  ? '🏆 VITÓRIA CONFIRMADA!'
                  : '❌ LOSS'}
              </div>

              <div className="text-3xl font-mono font-black text-white">
                00:{String(activeOrder.secondsLeft).padStart(2, '0')}
              </div>

              <div
                className={`font-mono font-bold text-sm px-3 py-1 rounded-lg inline-block ${
                  activeOrder.direction === 'alta'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {activeOrder.direction === 'alta' ? '📈 MANIPULAÇÃO ALTA' : '📉 MANIPULAÇÃO BAIXA'}
              </div>

              {activeOrder.status !== 'running' && (
                <div className="text-sm font-mono font-bold pt-1">
                  Resultado:{' '}
                  <span
                    className={
                      activeOrder.status === 'win' ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {activeOrder.status === 'win' ? `+$${activeOrder.profit}` : `-$100`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Manipulation Buttons */}
      <div className="p-4 bg-[#080d19] space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleStartSimManip('alta')}
            disabled={activeOrder?.status === 'running'}
            className="w-full py-4 rounded-xl font-mono font-black text-sm text-black bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 transition-all active:scale-98 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
          >
            📈 S. MANIPULAÇÃO ALTA
          </button>

          <button
            type="button"
            onClick={() => handleStartSimManip('baixa')}
            disabled={activeOrder?.status === 'running'}
            className="w-full py-4 rounded-xl font-mono font-black text-sm text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 transition-all active:scale-98 shadow-lg shadow-rose-600/25 disabled:opacity-50"
          >
            📉 S. MANIPULAÇÃO BAIXA
          </button>
        </div>
      </div>

      {/* Modal Tamanho Personalizado */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-blue-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h2 className="font-mono font-bold text-base text-white">Tamanho Personalizado</h2>
            <p className="text-xs font-mono text-slate-400">
              Escolha a força da vela e a direção de manipulação
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomDir('alta')}
                className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                  customDir === 'alta'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-900 border-white/10 text-slate-400'
                }`}
              >
                Verde (Alta)
              </button>
              <button
                type="button"
                onClick={() => setCustomDir('baixa')}
                className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                  customDir === 'baixa'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-slate-900 border-white/10 text-slate-400'
                }`}
              >
                Vermelha (Baixa)
              </button>
            </div>

            {/* Candle visual preview & slider */}
            <div className="bg-[#04070e] p-4 rounded-xl border border-white/10 flex flex-col items-center justify-center space-y-3">
              <div
                className={`w-10 rounded-sm transition-all ${
                  customDir === 'alta' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{ height: `${Math.max(20, (customPct / 150) * 80)}px` }}
              />
              <div className="text-sm font-mono font-extrabold text-white">{customPct}%</div>
            </div>

            <input
              type="range"
              min="10"
              max="150"
              value={customPct}
              onChange={(e) => setCustomPct(Number(e.target.value))}
              className="w-full accent-blue-500"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCandleSizePct(customPct);
                  setIsCustomModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold bg-blue-600 text-white hover:bg-blue-500"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="py-2.5 px-4 rounded-xl font-mono text-xs font-bold bg-white/5 text-slate-400 hover:bg-white/10"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
