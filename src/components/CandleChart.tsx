import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { Candle } from '@/types';
import {
  calculateAutoTrendLines,
  detectCommandCandles,
  type CommandCandle,
  type TrendLine,
  type ZonasCenariosSignal,
} from '@/lib/zonas-cenarios-fibo-engine';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  GitBranch,
  Crosshair,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface CandleChartProps {
  candles: Candle[];
  activeId?: number;
  symbol: string;
  precision?: number;
  isAnalyzing?: boolean;
  scanStatusText?: string;
  enableCommandCandles?: boolean;
  onToggleCommandCandles?: () => void;
  enableTrendLines?: boolean;
  onToggleTrendLines?: () => void;
  activeSignal?: ZonasCenariosSignal | null;
}

export function CandleChart({
  candles,
  activeId = 76,
  symbol,
  precision = 5,
  isAnalyzing = false,
  scanStatusText = 'ESCANEANDO VELA DE COMANDO & 1º PULLBACK...',
  enableCommandCandles = true,
  onToggleCommandCandles,
  enableTrendLines = true,
  onToggleTrendLines,
  activeSignal,
}: CandleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Estados de ativação das Linhas de Vela de Comando e LTA/LTB
  const [showCommandInternal, setShowCommandInternal] = useState<boolean>(true);
  const [showTrendLinesInternal, setShowTrendLinesInternal] = useState<boolean>(true);

  const isCommandActive = enableCommandCandles !== undefined ? enableCommandCandles : showCommandInternal;
  const isTrendLinesActive = enableTrendLines !== undefined ? enableTrendLines : showTrendLinesInternal;

  const handleToggleCommand = () => {
    if (onToggleCommandCandles) onToggleCommandCandles();
    else setShowCommandInternal((prev) => !prev);
  };

  const handleToggleTrendLines = () => {
    if (onToggleTrendLines) onToggleTrendLines();
    else setShowTrendLinesInternal((prev) => !prev);
  };

  // Estados de controle e navegação (Zoom e Pan)
  const [visibleCount, setVisibleCount] = useState<number>(32); // Velas gordinhas e limpas
  const [panOffset, setPanOffset] = useState<number>(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);

  // Cotação e dados em tempo real
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  // 1. Detecção automática de Velas de Comando no histórico
  const commandCandles: CommandCandle[] = useMemo(() => {
    if (candles.length === 0) return [];
    return detectCommandCandles(candles);
  }, [candles]);

  // 2. Linhas de Tendência Auxiliares (LTA e LTB) - apenas visuais
  const trendLines: TrendLine[] = useMemo(() => {
    if (candles.length === 0) return [];
    return calculateAutoTrendLines(candles);
  }, [candles]);

  // Escuta o stream em tempo real SSE
  useEffect(() => {
    const eventSource = new EventSource(`/api/stream?activeId=${activeId}`);

    eventSource.addEventListener('candle', (event) => {
      try {
        const c: Candle = JSON.parse(event.data);
        if (c && !isNaN(c.close)) {
          setCurrentPrice(c.close);
          setPriceChange(c.close - c.open);
        }
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [activeId]);

  // Atualiza preço baseado na última vela disponível
  useEffect(() => {
    if (candles.length > 0) {
      const last = candles[candles.length - 1];
      setCurrentPrice(last.close);
      setPriceChange(last.close - last.open);
    }
  }, [candles]);

  // Handlers de interação com o mouse (Zoom com Scroll e Pan com Arrastar)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 2 : -2;
    setVisibleCount((prev) => Math.min(70, Math.max(16, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }

      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        if (Math.abs(deltaX) > 8) {
          const candleDelta = Math.round(deltaX / 14);
          setPanOffset((prev) => Math.max(0, Math.min(candles.length - visibleCount, prev - candleDelta)));
          setDragStartX(e.clientX);
        }
      }
    },
    [isDragging, dragStartX, candles.length, visibleCount],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setMousePos(null);
  }, []);

  // ─── DESENHO CENTRAL NO CANVAS ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolução Retina HD
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const chartWidth = rect.width;
    const chartHeight = rect.height;
    const priceBarWidth = 75;
    const timeBarHeight = 24;
    const mainWidth = chartWidth - priceBarWidth;
    const mainHeight = chartHeight - timeBarHeight;

    // Fundo limpo azul escuro institucional
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, chartWidth, chartHeight);

    if (candles.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Aguardando dados de mercado...', chartWidth / 2, chartHeight / 2);
      return;
    }

    // Janela de velas visíveis
    const totalCandles = candles.length;
    const count = Math.min(visibleCount, totalCandles);
    const maxPan = Math.max(0, totalCandles - count);
    const safePan = Math.min(maxPan, panOffset);
    const startIdx = Math.max(0, totalCandles - count - safePan);
    const endIdx = Math.min(totalCandles, startIdx + count);
    const visibleCandles = candles.slice(startIdx, endIdx);

    if (visibleCandles.length === 0) return;

    // Cálculo da escala de preço (Mínimo e Máximo)
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    visibleCandles.forEach((c) => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    // Inclui preços de defesa das Velas de Comando visíveis para não cortar linhas
    if (isCommandActive && commandCandles.length > 0) {
      commandCandles.forEach((cmd) => {
        if (cmd.index >= startIdx - 5 && cmd.index <= endIdx + 5) {
          if (cmd.openPrice < minPrice) minPrice = cmd.openPrice;
          if (cmd.openPrice > maxPrice) maxPrice = cmd.openPrice;
          if (cmd.midPrice < minPrice) minPrice = cmd.midPrice;
          if (cmd.midPrice > maxPrice) maxPrice = cmd.midPrice;
        }
      });
    }

    // Margem vertical
    const priceMargin = (maxPrice - minPrice) * 0.12 || 0.0004;
    minPrice -= priceMargin;
    maxPrice += priceMargin;
    const priceRange = maxPrice - minPrice;

    // Funções de Projeção X / Y
    const getX = (idx: number) => {
      const slotWidth = mainWidth / visibleCandles.length;
      return idx * slotWidth + slotWidth / 2;
    };

    const getY = (price: number) => {
      return mainHeight - ((price - minPrice) / priceRange) * mainHeight;
    };

    const getPriceFromY = (y: number) => {
      return maxPrice - (y / mainHeight) * priceRange;
    };

    const slotWidth = mainWidth / visibleCandles.length;
    const candleWidth = Math.max(7, Math.min(26, slotWidth * 0.72));

    // ─── 1. GRADE HORIZONTAL (PREÇOS) ─────────────────────────────────────────
    const priceSteps = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    for (let i = 0; i <= priceSteps; i++) {
      const p = minPrice + (priceRange / priceSteps) * i;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mainWidth, y);
      ctx.stroke();

      // Rótulo de preço à direita
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(precision), mainWidth + 6, y + 3.5);
    }

    // ─── 2. GRADE VERTICAL (TEMPO) ────────────────────────────────────────────
    const timeStep = Math.max(1, Math.floor(visibleCandles.length / 6));
    for (let i = 0; i < visibleCandles.length; i += timeStep) {
      const x = getX(i);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mainHeight);
      ctx.stroke();

      const d = new Date(visibleCandles[i].time * 1000);
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;
      ctx.fillText(timeStr, x, mainHeight - 6);
    }

    // ─── 3. LINHAS DE TENDÊNCIA AUXILIARES (LTA E LTB) ────────────────────────
    // Observação: Conforme pedido, LTA/LTB ficam no gráfico para leitura visual, sem confluir no sinal
    if (isTrendLinesActive && trendLines.length > 0) {
      trendLines.forEach((line) => {
        const localIdx1 = line.p1.index - startIdx;
        const localIdx2 = line.p2.index - startIdx;

        const x1 = getX(localIdx1);
        const y1 = getY(line.p1.price);
        const x2 = getX(localIdx2);
        const y2 = getY(line.p2.price);

        const lastLocalIdx = visibleCandles.length - 1;
        const xEnd = getX(lastLocalIdx) + slotWidth * 1.5;
        const currentPriceAtEnd = line.p2.price + line.slope * (totalCandles - 1 - line.p2.index);
        const yEnd = getY(currentPriceAtEnd);

        ctx.save();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 6;
        ctx.setLineDash(line.style === 'dashed' ? [6, 4] : []);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();

        // Ponto de ancoragem
        [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
        ].forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = line.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });

        // Etiqueta da Linha projetada à direita
        ctx.setLineDash([]);
        ctx.fillStyle = line.type === 'LTA' ? 'rgba(6, 78, 59, 0.9)' : 'rgba(127, 29, 29, 0.9)';
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1;
        const badgeX = Math.min(chartWidth - 110, xEnd - 90);
        const badgeY = Math.max(10, Math.min(mainHeight - 24, yEnd - 9));
        ctx.roundRect(badgeX, badgeY, 95, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`${line.label}`, badgeX + 47.5, badgeY + 12);
        ctx.restore();
      });
    }

    // ─── 4. DESENHO DAS VELAS CANDLESTICK ("GORDINHAS" E LIMPAS) ─────────────
    visibleCandles.forEach((c, i) => {
      const x = getX(i);
      const isGreen = c.close >= c.open;
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);

      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(3, Math.abs(closeY - openY));
      const isLast = i === visibleCandles.length - 1;

      // Cores vibrantes
      const wickColor = isGreen ? '#34d399' : '#f87171';
      const bodyFill = isGreen
        ? 'rgba(16, 185, 129, 0.88)' // Verde esmeralda rico
        : 'rgba(239, 68, 68, 0.88)'; // Vermelho rubi rico
      const strokeColor = isGreen ? '#10b981' : '#ef4444';

      // Pavio (Wick)
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Corpo da Vela Gordinha com Cantos Arredondados
      ctx.save();
      if (isLast) {
        ctx.shadowColor = isGreen ? 'rgba(52, 211, 153, 0.6)' : 'rgba(248, 113, 113, 0.6)';
        ctx.shadowBlur = 12;
      }

      ctx.fillStyle = bodyFill;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;

      const radius = Math.min(5, candleWidth / 4, bodyH / 2);
      ctx.beginPath();
      const left = x - candleWidth / 2;
      ctx.roundRect(left, topY, candleWidth, bodyH, [radius, radius, radius, radius]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Reflexo sutil de volume no corpo da vela
      if (bodyH > 8) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(left + 2, topY + 2, Math.max(2, candleWidth * 0.25), bodyH - 4);
      }
    });

    // ─── 5. MARCAÇÃO AUTOMÁTICA DA VELA DE COMANDO NO GRÁFICO ────────────────
    // Conforme pedido: "nosso robo vai idnir vela de comando e a gente vai operar
    // pullback na vela de comando só o primeiro pullback... marcando automaticamente a vela de comando"
    if (isCommandActive && commandCandles.length > 0) {
      // Localiza o comando ativo ou os comandos dentro da janela visível
      const activeCmd = activeSignal?.activeCommandCandle || commandCandles[commandCandles.length - 1];

      commandCandles.forEach((cmd) => {
        const localIdx = cmd.index - startIdx;
        const isActive = activeCmd && activeCmd.id === cmd.id;

        // Se a vela estiver dentro da tela ou for o comando ativo recente
        if (localIdx >= -2 && localIdx <= visibleCandles.length + 2) {
          const candleX = getX(localIdx);
          const isAlta = cmd.direction === 'ALTA';
          const cmdColor = isAlta ? '#10b981' : '#ef4444';

          ctx.save();
          // Halo/Retângulo luminoso ao redor da Vela de Comando
          const openY = getY(cmd.openPrice);
          const closeY = getY(cmd.closePrice);
          const topBoxY = Math.min(openY, closeY) - 5;
          const boxHeight = Math.abs(openY - closeY) + 10;
          const boxWidth = candleWidth + 10;

          ctx.strokeStyle = cmdColor;
          ctx.lineWidth = isActive ? 2 : 1;
          ctx.setLineDash(isActive ? [] : [3, 3]);
          ctx.shadowColor = cmdColor;
          ctx.shadowBlur = isActive ? 14 : 4;
          ctx.strokeRect(candleX - boxWidth / 2, topBoxY, boxWidth, boxHeight);

          // Tag no topo da vela
          ctx.setLineDash([]);
          ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = isAlta ? 'rgba(6, 78, 59, 0.95)' : 'rgba(127, 29, 29, 0.95)';
          const tagW = 78;
          const tagH = 15;
          const tagY = topBoxY - tagH - 3;
          ctx.roundRect(candleX - tagW / 2, tagY, tagW, tagH, 3);
          ctx.fill();
          ctx.strokeStyle = cmdColor;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(`⚡ COMANDO ${isAlta ? 'ALTA' : 'BAIXA'}`, candleX, tagY + 10.5);
          ctx.restore();
        }

        // Se for o comando ativo, desenha as linhas de projeção estendidas até a lateral direita
        if (isActive) {
          const isAlta = cmd.direction === 'ALTA';
          const mainColor = isAlta ? '#10b981' : '#ef4444';
          const defenseY = getY(cmd.openPrice);
          const midY = getY(cmd.midPrice);
          const localIdx = cmd.index - startIdx;
          const startLineX = Math.max(0, getX(localIdx));

          // 1. LINHA DE DEFESA PRINCIPAL (ABERTURA SEM PAVIO)
          ctx.save();
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = mainColor;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(startLineX, defenseY);
          ctx.lineTo(chartWidth, defenseY);
          ctx.stroke();

          // Badge flutuante na lateral direita com o status do Primeiro Pullback
          ctx.setLineDash([]);
          const isFirstTouchTesting = cmd.status === 'TESTANDO_PRIMEIRO_PULLBACK';
          const isAlreadyDone = cmd.status === 'PULLBACK_EXECUTADO';

          const statusText = isFirstTouchTesting
            ? '🔥 1º PULLBACK ATIVO'
            : isAlreadyDone
            ? '✔ 1º PULLBACK EXECUTADO (EXPIRADA)'
            : '★ AGUARDANDO 1º PULLBACK';

          const badgeW = 210;
          const badgeH = 20;
          const badgeX = Math.max(10, chartWidth - badgeW - 10);
          const badgeY = Math.max(10, Math.min(mainHeight - 26, defenseY - badgeH / 2));

          ctx.fillStyle = isFirstTouchTesting
            ? isAlta ? 'rgba(6, 95, 70, 0.96)' : 'rgba(159, 18, 57, 0.96)'
            : 'rgba(15, 23, 42, 0.94)';
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 1.6;
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(
            `DEFESA ${isAlta ? 'SUPORTE' : 'RESIST'} · ${cmd.openPrice.toFixed(precision)}`,
            badgeX + badgeW / 2,
            badgeY + 9.5
          );

          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillStyle = isFirstTouchTesting ? '#fef08a' : isAlreadyDone ? '#94a3b8' : '#38bdf8';
          ctx.fillText(statusText, badgeX + badgeW / 2, badgeY + 17);

          // 2. LINHA DE DEFESA INTERMEDIÁRIA (50% DO CORPO DA VELA DE COMANDO)
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 1.3;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(startLineX, midY);
          ctx.lineTo(chartWidth - 80, midY);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          const midTagW = 120;
          const midTagH = 15;
          ctx.roundRect(chartWidth - midTagW - 90, midY - 7.5, midTagW, midTagH, 3);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.fillStyle = '#bae6fd';
          ctx.textAlign = 'center';
          ctx.fillText(`50% COMANDO: ${cmd.midPrice.toFixed(precision)}`, chartWidth - 90 - midTagW / 2, midY + 3.5);

          ctx.restore();
        }
      });
    }

    // ─── 6. SINAL VISUAL NO GRÁFICO (PRIMEIRO PULLBACK DISPARADO AOS 00S) ─────
    if (activeSignal && activeSignal.verdict !== 'NO_TRADE') {
      const lastIdx = visibleCandles.length - 1;
      const targetCandle = visibleCandles[lastIdx];
      if (targetCandle) {
        const arrowX = getX(lastIdx);
        const isCall = activeSignal.verdict === 'CALL';
        const arrowColor = isCall ? '#10b981' : '#ef4444';
        const targetY = isCall
          ? getY(targetCandle.low) + 22
          : getY(targetCandle.high) - 22;

        ctx.save();
        ctx.fillStyle = arrowColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = arrowColor;
        ctx.shadowBlur = 16;

        ctx.beginPath();
        if (isCall) {
          // Seta para cima (COMPRA)
          ctx.moveTo(arrowX, targetY);
          ctx.lineTo(arrowX - 12, targetY + 20);
          ctx.lineTo(arrowX + 12, targetY + 20);
        } else {
          // Seta para baixo (VENDA)
          ctx.moveTo(arrowX, targetY);
          ctx.lineTo(arrowX - 12, targetY - 20);
          ctx.lineTo(arrowX + 12, targetY - 20);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Badge de 1º PULLBACK COMPRA / VENDA
        const textY = isCall ? targetY + 36 : targetY - 30;
        ctx.fillStyle = isCall ? 'rgba(6, 78, 59, 0.98)' : 'rgba(127, 29, 29, 0.98)';
        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 1.6;
        ctx.roundRect(arrowX - 85, textY - 10, 170, 22, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          isCall ? '▲ 1º PULLBACK · COMPRA' : '▼ 1º PULLBACK · VENDA',
          arrowX,
          textY + 4
        );
        ctx.restore();
      }
    }

    // ─── 7. MIRA RETÍCULA (CROSSHAIR) E LINHA DO PREÇO ATUAL ──────────────────
    if (currentPrice !== null) {
      const curY = getY(currentPrice);
      if (curY >= 0 && curY <= mainHeight) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, curY);
        ctx.lineTo(mainWidth, curY);
        ctx.stroke();

        // Badge com o preço na barra lateral
        ctx.setLineDash([]);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(mainWidth, curY - 9, priceBarWidth, 18);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(currentPrice.toFixed(precision), mainWidth + 5, curY + 3.5);
      }
    }

    // Retícula do Mouse
    if (mousePos && mousePos.x <= mainWidth && mousePos.y <= mainHeight) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, mainHeight);
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(mainWidth, mousePos.y);
      ctx.stroke();

      const hoverPrice = getPriceFromY(mousePos.y);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
      ctx.fillRect(mainWidth, mousePos.y - 9, priceBarWidth, 18);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(hoverPrice.toFixed(precision), mainWidth + 5, mousePos.y + 3.5);
    }
  }, [
    candles,
    visibleCount,
    panOffset,
    mousePos,
    isCommandActive,
    commandCandles,
    isTrendLinesActive,
    trendLines,
    activeSignal,
    currentPrice,
    precision,
  ]);

  return (
    <div className="bg-[#050a12]/95 border border-sky-500/20 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col">
      {/* Header do Gráfico */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#020509] border-b border-sky-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold font-mono text-sm shadow-[0_0_12px_rgba(56,189,248,0.2)]">
            M1
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black font-mono tracking-wider text-white">
                {symbol}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                1M CANDLES
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SÓ 1º PULLBACK
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
              <span>Lógica do Preço: Vela de Comando &amp; Defesa</span>
              <span>•</span>
              <span className="text-sky-400">Linha Mestre de Abertura</span>
            </div>
          </div>
        </div>

        {/* Controles do Gráfico */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão: Ativar/Desativar Marcação de Vela de Comando */}
          <button
            type="button"
            id="btn-toggle-command"
            onClick={handleToggleCommand}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              isCommandActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Marcação Automática da Vela de Comando e Linha de Defesa"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>VELA DE COMANDO: {isCommandActive ? 'ATIVADO' : 'DESLIGADO'}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isCommandActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Botão: Ativar/Desativar Linhas LTA / LTB */}
          <button
            type="button"
            id="btn-toggle-trendlines"
            onClick={handleToggleTrendLines}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
              isTrendLinesActive
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Linhas Automáticas de Tendência (LTA / LTB) - Apenas Guia Visual"
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span>LTA / LTB: {isTrendLinesActive ? 'ATIVADO' : 'DESLIGADO'}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isTrendLinesActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
          </button>

          {/* Cotação Atual */}
          {currentPrice !== null && (
            <div className="flex items-center gap-1.5 ml-1">
              <span
                className={`text-sm font-black font-mono px-2 py-0.5 rounded border ${
                  priceChange >= 0
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}
              >
                {currentPrice.toFixed(precision)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Área do Canvas com o Gráfico */}
      <div
        ref={containerRef}
        className="relative w-full h-[470px] cursor-crosshair select-none bg-[#030712]"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* HUD Flutuante da Estratégia Vela de Comando & 1º Pullback */}
        {activeSignal && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none max-w-sm">
            {activeSignal.scenarioType === 'CICLO_EM_MATURACAO' ? (
              <div className="bg-sky-950/90 border border-sky-500/80 rounded-xl px-3.5 py-2 shadow-lg shadow-sky-500/20 backdrop-blur-md flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-300 flex-shrink-0">
                  <Activity className="w-4 h-4 text-sky-400 animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-sky-300 font-mono tracking-wide">
                      CICLO EM MATURAÇÃO ({activeSignal.cycleStatus?.candlesSinceLastSignal || 1}/5 VELAS)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold">
                      ANTI-SPAM
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-tight mt-0.5">
                    Operação de 1º Pullback em andamento
                  </div>
                  <div className="text-[10px] text-sky-400/90 font-mono mt-0.5">
                    Bloqueio de sinais consecutivos ativo
                  </div>
                </div>
              </div>
            ) : activeSignal.verdict === 'CALL' ? (
              <div className="bg-emerald-950/90 border border-emerald-500/80 rounded-xl px-3.5 py-2 shadow-lg shadow-emerald-500/20 backdrop-blur-md flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-emerald-300 font-mono tracking-wide">
                      1º PULLBACK · COMPRA ▲
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      {activeSignal.confidence}% Conf.
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-tight mt-0.5">
                    {activeSignal.candlePatternName}
                  </div>
                  <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">
                    Linha de Defesa: {activeSignal.defensePrice.toFixed(precision)} (Pavio: {activeSignal.wickRatio}%)
                  </div>
                </div>
              </div>
            ) : activeSignal.verdict === 'PUT' ? (
              <div className="bg-rose-950/90 border border-rose-500/80 rounded-xl px-3.5 py-2 shadow-lg shadow-rose-500/20 backdrop-blur-md flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400 flex items-center justify-center text-rose-300 flex-shrink-0">
                  <TrendingDown className="w-4 h-4 text-rose-400 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-rose-300 font-mono tracking-wide">
                      1º PULLBACK · VENDA ▼
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">
                      {activeSignal.confidence}% Conf.
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white leading-tight mt-0.5">
                    {activeSignal.candlePatternName}
                  </div>
                  <div className="text-[10px] text-rose-400/90 font-mono mt-0.5">
                    Linha de Defesa: {activeSignal.defensePrice.toFixed(precision)} (Pavio: {activeSignal.wickRatio}%)
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/85 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-sm flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <span>PROTEÇÃO DE CAPITAL · NO TRADE</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">
                      SÓ 1º PULLBACK
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeSignal.activeCommandCandle
                      ? `Vela de Comando em ${activeSignal.defensePrice.toFixed(precision)}. Aguardando 1º toque.`
                      : 'Buscando Vela de Comando sem pavio na abertura'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Efeito Visual de Scanner da Vela de Comando & 1º Pullback */}
        {isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-150">
            <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_20px_#f59e0b] animate-pulse top-1/2 -translate-y-1/2" />
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-amber-500/15 to-transparent animate-pulse" />

            {/* HUD Central de Diagnóstico */}
            <div className="relative z-30 bg-[#03070d]/95 border-2 border-amber-500/80 rounded-2xl px-6 py-4 shadow-2xl shadow-amber-500/40 flex items-center gap-4 font-mono max-w-md mx-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 flex-shrink-0">
                <Crosshair className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <div className="text-xs font-black text-white tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>{scanStatusText}</span>
                </div>
                <p className="text-[11px] text-amber-400/90 mt-0.5">
                  Lógica do Preço · Vela de Comando &amp; 1º Pullback
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer com Legenda da Estratégia de Vela de Comando e Linhas LTA / LTB */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#020509] border-t border-sky-500/20 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-amber-400 rounded-sm shadow-[0_0_6px_#fbbf24]" />
            <span className="text-amber-400 font-bold">Vela de Comando (Sem Pavio Abertura)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-sky-400 rounded-sm shadow-[0_0_6px_#38bdf8]" />
            <span className="text-sky-300 font-bold">Linha de Defesa (1º Pullback)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-emerald-500 rounded-sm shadow-[0_0_6px_#10b981]" />
            <span className="text-emerald-400 font-bold">LTA Suporte (Guia)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 bg-rose-500 rounded-sm shadow-[0_0_6px_#ef4444]" />
            <span className="text-rose-400 font-bold">LTB Resistência (Guia)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>Scroll: Zoom</span>
          <span>•</span>
          <span>Arrastar: Navegar</span>
        </div>
      </div>
    </div>
  );
}
