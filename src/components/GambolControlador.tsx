import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { OtcAsset, Candle, GambolBroker } from '@/types';
import { GAMBOL_BROKERS } from '@/lib/gambol-data';
import { playClickSound, playWinSound } from '@/lib/sound';
import {
  Activity,
  Sliders,
  RotateCcw,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Server,
  AlertTriangle,
  ChevronDown,
  Clock,
  Radio,
  Search,
  ExternalLink,
} from 'lucide-react';

interface GambolControladorProps {
  assets: OtcAsset[];
  selectedAsset: OtcAsset;
  onSelectAsset: (asset: OtcAsset) => void;
  candles: Candle[];
  onOpenConfig?: () => void;
  onOpenAssetModal?: () => void;
}

export function GambolControlador({
  assets,
  selectedAsset,
  onSelectAsset,
  candles,
  onOpenAssetModal,
}: GambolControladorProps) {
  const [selectedBroker, setSelectedBroker] = useState<GambolBroker>(GAMBOL_BROKERS[0]);
  const [isBrokerDropdownOpen, setIsBrokerDropdownOpen] = useState(false);
  const [force, setForce] = useState<number>(100);
  const [manipulationActive, setManipulationActive] = useState<boolean>(false);
  const [manipulationDir, setManipulationDir] = useState<'alta' | 'baixa' | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [clock, setClock] = useState<string>('--:--:--');
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Top fast tabs for OTC assets
  const quickAssets = assets.slice(0, 8);

  // Live Brasília Clock
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

  // Poll manipulation status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/controlador/status?activeId=${selectedAsset.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.active && data.remainingSeconds > 0) {
          setManipulationActive(true);
          setManipulationDir(data.direction);
          setRemainingSeconds(data.remainingSeconds);
        } else {
          setManipulationActive(false);
          setManipulationDir(null);
          setRemainingSeconds(0);
        }
      }
    } catch {
      // offline fallback
    }
  }, [selectedAsset.id]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Handle ALTA manipulation
  const handleManipulateAlta = async () => {
    playClickSound();
    setStatusMessage(`Enviando comando ALTA (${force}%) para ${selectedBroker.name}...`);
    try {
      const res = await fetch('/api/controlador/manipulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeId: selectedAsset.id,
          direction: 'alta',
          force,
          broker: selectedBroker.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        playWinSound();
        setManipulationActive(true);
        setManipulationDir('alta');
        setRemainingSeconds(60);
        setStatusMessage(`⚡ Manipulação ALTA ativada com ${force}% no servidor ${selectedBroker.name}!`);
      }
    } catch {
      setManipulationActive(true);
      setManipulationDir('alta');
      setRemainingSeconds(60);
      setStatusMessage(`Manipulação ALTA simulada (${force}%)`);
    }
  };

  // Handle BAIXA manipulation
  const handleManipulateBaixa = async () => {
    playClickSound();
    setStatusMessage(`Enviando comando BAIXA (${force}%) para ${selectedBroker.name}...`);
    try {
      const res = await fetch('/api/controlador/manipulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeId: selectedAsset.id,
          direction: 'baixa',
          force,
          broker: selectedBroker.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        playWinSound();
        setManipulationActive(true);
        setManipulationDir('baixa');
        setRemainingSeconds(60);
        setStatusMessage(`⚡ Manipulação BAIXA ativada com ${force}% no servidor ${selectedBroker.name}!`);
      }
    } catch {
      setManipulationActive(true);
      setManipulationDir('baixa');
      setRemainingSeconds(60);
      setStatusMessage(`Manipulação BAIXA simulada (${force}%)`);
    }
  };

  // Handle Return to Market
  const handleResetMarket = async () => {
    playClickSound();
    try {
      await fetch('/api/controlador/reset', { method: 'POST' });
    } catch {
      // ignore
    }
    setManipulationActive(false);
    setManipulationDir(null);
    setRemainingSeconds(0);
    setStatusMessage('Preço retornado ao fluxo natural do mercado.');
  };

  // High-FPS Smooth Canvas Candlestick Rendering
  useEffect(() => {
    const canvas = chartCanvasRef.current;
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

    // Grid lines
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

    const padding = (maxPrice - minPrice) * 0.12 || 0.0001;
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

    // Last Price line
    const last = displayCandles[displayCandles.length - 1];
    if (last) {
      const lastY = h - ((last.close - minPrice) / priceRange) * (h - 40) - 20;
      ctx.strokeStyle = manipulationActive
        ? manipulationDir === 'alta'
          ? '#10b981'
          : '#ef4444'
        : '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, lastY);
      ctx.lineTo(w - 70, lastY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price Tag on right
      ctx.fillStyle = manipulationActive
        ? manipulationDir === 'alta'
          ? '#10b981'
          : '#ef4444'
        : '#1e293b';
      ctx.fillRect(w - 68, lastY - 11, 65, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(last.close.toFixed(selectedAsset.precision || 5), w - 35, lastY);
    }
  }, [candles, selectedAsset, manipulationActive, manipulationDir]);

  const lastPrice = candles[candles.length - 1]?.close || 1.0;

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#070b13] border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-0 text-slate-100">
      {/* Top App Header */}
      <div className="bg-[#0b101c] border-b border-white/10 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-white font-bold text-base tracking-tight font-mono">
                Controlador Gambol
              </strong>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                VIP VITALÍCIO
              </span>
            </div>
            <small className="text-slate-400 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
              Alpha OTC ao vivo · 100% Desbloqueado
            </small>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <Server className="w-3 h-3" />
            <span>12 Servidores ON</span>
          </span>
        </div>
      </div>

      {/* Status Row */}
      <div className="bg-[#05080e] px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">
          Ativo: <span className="text-emerald-400 font-bold">{selectedAsset.symbol} OTC</span>
        </span>
        <span className="text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          {clock}
        </span>
        <span className="text-slate-300">
          Modo:{' '}
          <span
            className={`font-bold ${
              manipulationActive
                ? manipulationDir === 'alta'
                  ? 'text-emerald-400'
                  : 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {manipulationActive
              ? `MANIPULAÇÃO (${manipulationDir?.toUpperCase()} ${force}%)`
              : 'Mercado'}
          </span>
        </span>
      </div>

      {/* Asset Tabs & Search Lupa Button */}
      <div className="flex items-center gap-1.5 p-2.5 bg-[#080d17] border-b border-white/5">
        {/* Lupa / Search Catalog Button */}
        {onOpenAssetModal && (
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onOpenAssetModal();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-all active:scale-95 group"
            title="Abrir catálogo completo com 148 ativos da corretora"
          >
            <Search className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span>Todos Ativos ({assets.length})</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
          {quickAssets.map((asset) => {
            const isSel = asset.id === selectedAsset.id;
            return (
              <button
                key={asset.id}
                onClick={() => onSelectAsset(asset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSel
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                    : 'bg-[#0f172a] text-slate-300 hover:bg-slate-800 border border-white/5'
                }`}
              >
                <span>{asset.symbol}</span>
                <span className={`text-[10px] ${isSel ? 'text-black/80' : 'text-emerald-400'}`}>
                  {asset.payout}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Canvas Wrap */}
      <div className="relative w-full h-72 bg-[#060a12] border-b border-white/10">
        <canvas ref={chartCanvasRef} className="w-full h-full block" />
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <div className="bg-emerald-950/80 backdrop-blur border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            ALPHA · 1m ao vivo
          </div>
          <div className="bg-black/80 backdrop-blur border border-white/10 text-slate-300 px-2.5 py-1 rounded-md text-[11px] font-mono">
            {selectedBroker.name} ({selectedBroker.latency}ms)
          </div>
        </div>

        {/* Live Floating Price Tag */}
        <div className="absolute top-3 right-3 bg-black/85 backdrop-blur border border-emerald-500/30 px-3 py-1.5 rounded-lg font-mono text-sm font-bold text-white shadow-xl">
          <span className="text-slate-400 text-xs mr-1">PREÇO:</span>
          <span className={manipulationActive ? 'text-emerald-400' : 'text-slate-100'}>
            {lastPrice.toFixed(selectedAsset.precision || 5)}
          </span>
        </div>

        {/* Active Manipulation Banner overlay */}
        {manipulationActive && (
          <div className="absolute bottom-3 left-3 right-3 bg-gradient-to-r from-emerald-950/90 via-black/90 to-emerald-950/90 border border-emerald-500/50 p-2.5 rounded-xl flex items-center justify-between shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full animate-ping ${
                  manipulationDir === 'alta' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span className="text-xs font-mono font-bold text-white">
                Manipulação Ativa: {manipulationDir?.toUpperCase()} ({force}%) no servidor {selectedBroker.name}
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-black/60 px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-400">
              ⏱ {remainingSeconds}s restantes
            </span>
          </div>
        )}
      </div>

      {/* Control Deck */}
      <section className="p-4 sm:p-5 space-y-4 bg-[#080d19]">
          {/* Broker Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-400 block font-semibold">
              Corretora Conectada
            </label>
            {selectedBroker.tradeRoomUrl && (
              <a
                href={selectedBroker.tradeRoomUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
              >
                <span>Abrir Sala de Operações</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBrokerDropdownOpen(!isBrokerDropdownOpen)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#04070e] border border-white/10 hover:border-emerald-500/40 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center border border-white/10">
                  <img
                    src={selectedBroker.logo}
                    alt={selectedBroker.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = selectedBroker.fallbackLogo;
                    }}
                  />
                </div>
                <div>
                  <span className="font-mono font-bold text-sm text-white block">
                    {selectedBroker.name}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    🟢 Servidor Online · Latência {selectedBroker.latency}ms · {selectedBroker.serverRegion}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isBrokerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto bg-[#04070e] border border-emerald-500/30 rounded-xl shadow-2xl divide-y divide-white/5 scrollbar-thin">
                {GAMBOL_BROKERS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBroker(b);
                      setIsBrokerDropdownOpen(false);
                      playClickSound();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 text-left transition-all ${
                      b.id === selectedBroker.id ? 'bg-emerald-500/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center border border-white/10">
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = b.fallbackLogo;
                          }}
                        />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs text-white block">
                          {b.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Latência {b.latency}ms · Payout {b.payout}%
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      ONLINE
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-xs font-mono text-slate-400">
          Toque <b className="text-emerald-400">ALTA</b> / <b className="text-rose-400">BAIXA</b> · barra = força · máx 1 min
        </p>

        {/* Force Slider */}
        <div className="bg-[#04070e] p-3.5 rounded-xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              Força da vela
            </span>
            <strong className="text-emerald-400 font-extrabold text-sm">{force}%</strong>
          </div>

          <input
            type="range"
            min="10"
            max="127"
            step="1"
            value={force}
            onChange={(e) => setForce(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-0.5">
            <span>10%</span>
            <span className="text-emerald-400 font-bold">100%</span>
            <span>127%</span>
          </div>
        </div>

        {/* Action Manipulation Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleManipulateAlta}
            className="w-full py-4 rounded-xl font-mono font-black text-base text-black bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 transition-all transform active:scale-98 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 border border-emerald-300"
          >
            <TrendingUp className="w-5 h-5" />
            <span>ALTA</span>
          </button>

          <button
            type="button"
            onClick={handleManipulateBaixa}
            className="w-full py-4 rounded-xl font-mono font-black text-base text-white bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:from-rose-500 hover:to-rose-400 transition-all transform active:scale-98 shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 border border-rose-400"
          >
            <TrendingDown className="w-5 h-5" />
            <span>BAIXA</span>
          </button>
        </div>

        {/* Return to Market Price Button */}
        <button
          type="button"
          onClick={handleResetMarket}
          className="w-full py-2.5 rounded-xl font-mono text-xs font-semibold text-slate-300 bg-[#04070e] hover:bg-white/5 border border-white/10 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Voltar preço de mercado</span>
        </button>

        {/* Safety Footer note */}
        <p className="text-[11px] font-mono text-slate-500 text-center leading-relaxed">
          Segurança: manipulação máx. 1 minuto — depois volta sozinha ao mercado.
        </p>

        {statusMessage && (
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono text-center">
            {statusMessage}
          </div>
        )}
      </section>

      {/* Modal Corretora em Manutenção */}
      {isMaintenanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101c] border border-emerald-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-mono font-bold text-base text-white">
                Corretora em Manutenção
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-300 leading-relaxed">
              Para uma <b>assertividade maior</b>, selecione <b>outra corretora</b> com menor latência.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl font-mono text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
