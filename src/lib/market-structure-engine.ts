import type { Candle } from '@/types';
import {
  calculateSuperTrend,
  calculateRSI,
  calculateTrueSupplyDemandZones,
  type SuperTrendPoint,
  type SupplyDemandAnalysis,
} from './supertrend-rsi-engine';

export type CandleType =
  | 'STRENGTH_BULLISH'
  | 'STRENGTH_BEARISH'
  | 'ENGULFING_BULLISH'
  | 'ENGULFING_BEARISH'
  | 'PINBAR_BULLISH'
  | 'PINBAR_BEARISH'
  | 'INDECISION'
  | 'STANDARD_BULLISH'
  | 'STANDARD_BEARISH';

export type StructureEventType =
  | 'BOS_BULL'
  | 'BOS_BEAR'
  | 'CHOCH_BULL'
  | 'CHOCH_BEAR'
  | 'DOUBLE_BOTTOM'
  | 'DOUBLE_TOP'
  | 'LIQUIDITY_SWEEP_LOW'
  | 'LIQUIDITY_SWEEP_HIGH'
  | 'NONE';

export interface CandleAnalysis {
  index: number;
  time: number;
  candleType: CandleType;
  candleTypeLabel: string;
  structureEvent: StructureEventType;
  structureLabel?: string;
  isStrength: boolean;
  isControlShift: boolean;
  isIndecision: boolean;
  signalTrigger?: 'CALL' | 'PUT';
  signalReason?: string;
  confidence?: number;
}

export interface MarketStructureSignal {
  verdict: 'CALL' | 'PUT' | 'NO_TRADE';
  patternName: string;
  structureEvent: StructureEventType;
  structureLabel: string;
  candlePattern: CandleType;
  candlePatternLabel: string;
  candleColor: 'VERDE_ALTA' | 'VERMELHA_BAIXA' | 'DOJI_NEUTRA';
  cooldownActive: boolean;
  cooldownCandlesRemaining: number;
  // Confluências Adicionais
  confluence: {
    superTrendDirection: 'BULLISH' | 'BEARISH';
    superTrendValue: number;
    superTrendOk: boolean;
    rsiValue: number;
    rsiOk: boolean;
    supplyDemandOk: boolean;
    supplyDemandStatus: string;
    score: number; // 0 a 100%
  };
  reasons: string[];
  blocks: string[];
  confidence: number;
  summary: string;
}

// ─── 1. Classificação Anatômica de Candlesticks (JeaFx Shorts & Price Action) ─
export function classifyCandle(c: Candle, prev?: Candle): {
  type: CandleType;
  label: string;
  isStrength: boolean;
  isControlShift: boolean;
  isIndecision: boolean;
} {
  const range = Math.max(0.00001, c.high - c.low);
  const body = Math.abs(c.close - c.open);
  const bodyRatio = body / range;
  const isGreen = c.close >= c.open;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;

  // A. Vela de Indecisão (Doji / Spinning Top)
  if (bodyRatio < 0.16) {
    return {
      type: 'INDECISION',
      label: 'DOJI',
      isStrength: false,
      isControlShift: false,
      isIndecision: true,
    };
  }

  // B. Velas de Troca de Controle / Rejeição (Pinbar & Engulfing)
  // Pinbar de Alta (Martelo com pavio inferior longo >= 55% do range total)
  if (lowerWick / range >= 0.55 && upperWick / range <= 0.25) {
    return {
      type: 'PINBAR_BULLISH',
      label: 'PINBAR',
      isStrength: false,
      isControlShift: true,
      isIndecision: false,
    };
  }

  // Pinbar de Baixa (Estrela Cadente com pavio superior longo >= 55% do range total)
  if (upperWick / range >= 0.55 && lowerWick / range <= 0.25) {
    return {
      type: 'PINBAR_BEARISH',
      label: 'PINBAR',
      isStrength: false,
      isControlShift: true,
      isIndecision: false,
    };
  }

  // Engolfo Institucional (Vela atual engole o corpo da vela anterior com cor oposta)
  if (prev) {
    const prevBody = Math.abs(prev.close - prev.open);
    const prevIsGreen = prev.close >= prev.open;

    if (isGreen && !prevIsGreen && body > prevBody * 1.08 && c.close >= prev.open && c.open <= prev.close) {
      return {
        type: 'ENGULFING_BULLISH',
        label: 'ENGULF',
        isStrength: false,
        isControlShift: true,
        isIndecision: false,
      };
    }

    if (!isGreen && prevIsGreen && body > prevBody * 1.08 && c.close <= prev.open && c.open >= prev.close) {
      return {
        type: 'ENGULFING_BEARISH',
        label: 'ENGULF',
        isStrength: false,
        isControlShift: true,
        isIndecision: false,
      };
    }
  }

  // C. Velas de Força (Strength Candles / Marubozu institucional dos Shorts JeaFx)
  // Corpo grande (>= 65% do range total) com fechamento dominante
  if (bodyRatio >= 0.65) {
    if (isGreen && upperWick / range <= 0.18) {
      return {
        type: 'STRENGTH_BULLISH',
        label: 'FORÇA',
        isStrength: true,
        isControlShift: false,
        isIndecision: false,
      };
    }
    if (!isGreen && lowerWick / range <= 0.18) {
      return {
        type: 'STRENGTH_BEARISH',
        label: 'FORÇA',
        isStrength: true,
        isControlShift: false,
        isIndecision: false,
      };
    }
  }

  // D. Velas Padrão de Fluxo
  return {
    type: isGreen ? 'STANDARD_BULLISH' : 'STANDARD_BEARISH',
    label: isGreen ? 'ALTA' : 'BAIXA',
    isStrength: false,
    isControlShift: false,
    isIndecision: false,
  };
}

// ─── 2. Detecção de Swing Highs e Swing Lows (Estrutura de Mercado) ───────────
interface SwingPoint {
  index: number;
  time: number;
  type: 'HIGH' | 'LOW';
  price: number;
}

export function detectSwingPoints(candles: Candle[], lookback = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const curr = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= curr.high) isHigh = false;
      if (candles[j].low <= curr.low) isLow = false;
    }

    if (isHigh) {
      swings.push({ index: i, time: curr.time, type: 'HIGH', price: curr.high });
    }
    if (isLow) {
      swings.push({ index: i, time: curr.time, type: 'LOW', price: curr.low });
    }
  }

  return swings;
}

// ─── 3. Análise Completa de Cada Vela para Desenho no Canvas ──────────────────
export function analyzeAllCandlesForDrawing(candles: Candle[]): CandleAnalysis[] {
  if (candles.length === 0) return [];

  const swings = detectSwingPoints(candles, 2);
  const result: CandleAnalysis[] = [];
  let lastSignalIndex = -999;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : undefined;
    const classified = classifyCandle(c, prev);

    let structureEvent: StructureEventType = 'NONE';
    let structureLabel = '';

    // A. Identificar quebra de estrutura (BOS / CHoCH) e Figuras Gráficas
    const priorHighs = swings.filter((s) => s.type === 'HIGH' && s.index < i);
    const priorLows = swings.filter((s) => s.type === 'LOW' && s.index < i);

    const lastHigh = priorHighs[priorHighs.length - 1];
    const lastLow = priorLows[priorLows.length - 1];
    const prevHigh = priorHighs[priorHighs.length - 2];
    const prevLow = priorLows[priorLows.length - 2];

    const isGreen = c.close >= c.open;

    // 1. Fundo Duplo (Figura W)
    if (
      lastLow &&
      prevLow &&
      Math.abs(c.low - lastLow.price) / lastLow.price < 0.0008 &&
      (classified.type === 'PINBAR_BULLISH' || classified.type === 'ENGULFING_BULLISH' || isGreen) &&
      i - lastLow.index <= 6
    ) {
      structureEvent = 'DOUBLE_BOTTOM';
      structureLabel = 'W (Fundo Duplo)';
    }
    // 2. Topo Duplo (Figura M)
    else if (
      lastHigh &&
      prevHigh &&
      Math.abs(c.high - lastHigh.price) / lastHigh.price < 0.0008 &&
      (classified.type === 'PINBAR_BEARISH' || classified.type === 'ENGULFING_BEARISH' || !isGreen) &&
      i - lastHigh.index <= 6
    ) {
      structureEvent = 'DOUBLE_TOP';
      structureLabel = 'M (Topo Duplo)';
    }
    // 3. Liquidity Sweep (Varredura de Liquidez com pavio e absorção)
    else if (lastHigh && c.high > lastHigh.price && c.close < lastHigh.price && !isGreen) {
      structureEvent = 'LIQUIDITY_SWEEP_HIGH';
      structureLabel = 'SWEEP (Manipulação)';
    } else if (lastLow && c.low < lastLow.price && c.close > lastLow.price && isGreen) {
      structureEvent = 'LIQUIDITY_SWEEP_LOW';
      structureLabel = 'SWEEP (Manipulação)';
    }
    // 4. CHoCH (Change of Character - Reversão de Tendência Institucional)
    else if (lastHigh && c.close > lastHigh.price && prev && prev.close <= lastHigh.price && prevHigh && lastHigh.price < prevHigh.price) {
      structureEvent = 'CHOCH_BULL';
      structureLabel = 'CHoCH (Reversão Alta)';
    } else if (lastLow && c.close < lastLow.price && prev && prev.close >= lastLow.price && prevLow && lastLow.price > prevLow.price) {
      structureEvent = 'CHOCH_BEAR';
      structureLabel = 'CHoCH (Reversão Baixa)';
    }
    // 5. BOS (Break of Structure - Continuação de Tendência)
    else if (lastHigh && c.close > lastHigh.price && prev && prev.close <= lastHigh.price) {
      structureEvent = 'BOS_BULL';
      structureLabel = 'BOS (Continuação Alta)';
    } else if (lastLow && c.close < lastLow.price && prev && prev.close >= lastLow.price) {
      structureEvent = 'BOS_BEAR';
      structureLabel = 'BOS (Continuação Baixa)';
    }

    // B. Lógica de Sinal com Filtro Anti-Overtrading (Intervalo mínimo de 2 a 3 velas)
    let signalTrigger: 'CALL' | 'PUT' | undefined = undefined;
    let signalReason = '';
    const cooldownOk = i - lastSignalIndex >= 2;

    if (cooldownOk && !classified.isIndecision) {
      // Condição de CALL: Estrutura compradora (BOS Bull, CHoCH Bull, W, Sweep Low) + Vela de Força ou Troca de Controle Verde
      const isCallStructure =
        structureEvent === 'BOS_BULL' ||
        structureEvent === 'CHOCH_BULL' ||
        structureEvent === 'DOUBLE_BOTTOM' ||
        structureEvent === 'LIQUIDITY_SWEEP_LOW';

      const isCallCandle =
        classified.type === 'STRENGTH_BULLISH' ||
        classified.type === 'ENGULFING_BULLISH' ||
        classified.type === 'PINBAR_BULLISH' ||
        (isCallStructure && isGreen);

      if (isCallStructure && isCallCandle) {
        signalTrigger = 'CALL';
        signalReason = `${structureEvent === 'DOUBLE_BOTTOM' ? 'FUNDO W' : structureEvent === 'CHOCH_BULL' ? 'CHoCH' : structureEvent === 'LIQUIDITY_SWEEP_LOW' ? 'SWEEP' : 'BOS'} + ${classified.label}`;
        lastSignalIndex = i;
      }

      // Condição de PUT: Estrutura vendedora (BOS Bear, CHoCH Bear, M, Sweep High) + Vela de Força ou Troca de Controle Vermelha
      const isPutStructure =
        structureEvent === 'BOS_BEAR' ||
        structureEvent === 'CHOCH_BEAR' ||
        structureEvent === 'DOUBLE_TOP' ||
        structureEvent === 'LIQUIDITY_SWEEP_HIGH';

      const isPutCandle =
        classified.type === 'STRENGTH_BEARISH' ||
        classified.type === 'ENGULFING_BEARISH' ||
        classified.type === 'PINBAR_BEARISH' ||
        (isPutStructure && !isGreen);

      if (isPutStructure && isPutCandle) {
        signalTrigger = 'PUT';
        signalReason = `${structureEvent === 'DOUBLE_TOP' ? 'TOPO M' : structureEvent === 'CHOCH_BEAR' ? 'CHoCH' : structureEvent === 'LIQUIDITY_SWEEP_HIGH' ? 'SWEEP' : 'BOS'} + ${classified.label}`;
        lastSignalIndex = i;
      }
    }

    result.push({
      index: i,
      time: c.time,
      candleType: classified.type,
      candleTypeLabel: classified.label,
      structureEvent,
      structureLabel: structureLabel || undefined,
      isStrength: classified.isStrength,
      isControlShift: classified.isControlShift,
      isIndecision: classified.isIndecision,
      signalTrigger,
      signalReason,
    });
  }

  return result;
}

// ─── 4. Motor Principal da Nova Estratégia JeaFx (Market Structure + Shorts de Velas) ──
export function evaluateMarketStructureStrategy(
  candles: Candle[],
  enableSupplyDemand = true
): MarketStructureSignal {
  if (candles.length < 15) {
    return {
      verdict: 'NO_TRADE',
      patternName: 'Aguardando Velas',
      structureEvent: 'NONE',
      structureLabel: 'Histórico insuficiente',
      candlePattern: 'INDECISION',
      candlePatternLabel: 'Aguardando',
      candleColor: 'DOJI_NEUTRA',
      cooldownActive: false,
      cooldownCandlesRemaining: 0,
      confluence: {
        superTrendDirection: 'BULLISH',
        superTrendValue: 0,
        superTrendOk: false,
        rsiValue: 50,
        rsiOk: false,
        supplyDemandOk: false,
        supplyDemandStatus: 'Aguardando...',
        score: 0,
      },
      reasons: ['Aguardando histórico mínimo de 15 velas para mapear estrutura...'],
      blocks: ['Histórico insuficiente'],
      confidence: 0,
      summary: 'Aguardando dados de mercado.',
    };
  }

  // A. Análise Estrutural e Anatômica de todas as velas
  const allAnalyses = analyzeAllCandlesForDrawing(candles);
  const lastIndex = candles.length - 1;
  const currentAnalysis = allAnalyses[lastIndex];
  const lastCandle = candles[lastIndex];
  const prevCandle = candles[lastIndex - 1];

  // B. Cálculo dos Indicadores Secundários (Confluência Adicional)
  const stPoints = calculateSuperTrend(candles, 10, 2.0);
  const rsiValues = calculateRSI(candles.map((c) => c.close), 9);
  const sdAnalysis = calculateTrueSupplyDemandZones(candles);

  const lastSt = stPoints[stPoints.length - 1];
  const lastRsi = rsiValues[rsiValues.length - 1] ?? 50;

  // C. Anti-Overtrading: Verifica se houve sinal recente nos últimos 2 candles
  let recentSignalIndex = -1;
  for (let i = lastIndex - 1; i >= Math.max(0, lastIndex - 3); i--) {
    if (allAnalyses[i].signalTrigger) {
      recentSignalIndex = i;
      break;
    }
  }

  const candlesSinceRecent = recentSignalIndex >= 0 ? lastIndex - recentSignalIndex : 999;
  const cooldownActive = candlesSinceRecent < 2 && currentAnalysis.structureEvent !== 'CHOCH_BULL' && currentAnalysis.structureEvent !== 'CHOCH_BEAR';
  const cooldownCandlesRemaining = cooldownActive ? 2 - candlesSinceRecent : 0;

  const isGreen = lastCandle.close >= lastCandle.open;
  const isDoji = currentAnalysis.isIndecision;
  const candleColor = isDoji ? 'DOJI_NEUTRA' : isGreen ? 'VERDE_ALTA' : 'VERMELHA_BAIXA';

  // D. Avaliação de Gatilho Primário (JeaFx Market Structure + Shorts de Velas)
  let verdict: 'CALL' | 'PUT' | 'NO_TRADE' = 'NO_TRADE';
  let patternName = 'Monitorando Estrutura';
  const reasons: string[] = [];
  const blocks: string[] = [];

  // Confluência Adicional: SuperTrend, RSI(9) e True Supply & Demand (POC)
  let confluenceScore = 40; // Base estrutural
  let stConfluenceOk = false;
  let rsiConfluenceOk = false;
  let sdConfluenceOk = false;
  let sdStatus = 'Zonas Livres';

  // Gatilho CALL (Compra):
  // 1. Estrutura de Mercado: BOS de Alta, CHoCH de Alta, Fundo Duplo (W) ou Sweep no Fundo
  // 2. Anatomia da Vela: Vela de Força Verde, Engolfo de Alta ou Pinbar de Rejeição
  // 3. Vela saudável (sem Doji)
  const hasCallStructure =
    currentAnalysis.structureEvent === 'BOS_BULL' ||
    currentAnalysis.structureEvent === 'CHOCH_BULL' ||
    currentAnalysis.structureEvent === 'DOUBLE_BOTTOM' ||
    currentAnalysis.structureEvent === 'LIQUIDITY_SWEEP_LOW';

  const hasCallCandle =
    currentAnalysis.candleType === 'STRENGTH_BULLISH' ||
    currentAnalysis.candleType === 'ENGULFING_BULLISH' ||
    currentAnalysis.candleType === 'PINBAR_BULLISH' ||
    (hasCallStructure && isGreen && !isDoji);

  // Gatilho PUT (Venda):
  // 1. Estrutura de Mercado: BOS de Baixa, CHoCH de Baixa, Topo Duplo (M) ou Sweep no Topo
  // 2. Anatomia da Vela: Vela de Força Vermelha, Engolfo de Baixa ou Pinbar de Rejeição
  // 3. Vela saudável (sem Doji)
  const hasPutStructure =
    currentAnalysis.structureEvent === 'BOS_BEAR' ||
    currentAnalysis.structureEvent === 'CHOCH_BEAR' ||
    currentAnalysis.structureEvent === 'DOUBLE_TOP' ||
    currentAnalysis.structureEvent === 'LIQUIDITY_SWEEP_HIGH';

  const hasPutCandle =
    currentAnalysis.candleType === 'STRENGTH_BEARISH' ||
    currentAnalysis.candleType === 'ENGULFING_BEARISH' ||
    currentAnalysis.candleType === 'PINBAR_BEARISH' ||
    (hasPutStructure && !isGreen && !isDoji);

  if (cooldownActive) {
    blocks.push(`Anti-Overtrading Ativo: Aguardando ${cooldownCandlesRemaining} vela(s) de intervalo para evitar sinais seguidos.`);
  }

  if (isDoji) {
    blocks.push('Vela atual de Indecisão (Doji/Spinning Top) - Proteção ativada contra ruído.');
  }

  if (!cooldownActive && !isDoji) {
    if (hasCallStructure && hasCallCandle) {
      verdict = 'CALL';
      patternName = currentAnalysis.structureLabel || `Padrão de Alta (${currentAnalysis.candleTypeLabel})`;
      reasons.push(`Estrutura JeaFx: ${currentAnalysis.structureLabel || 'Quebra e Fluxo de Alta confirmados'}.`);
      reasons.push(`Anatomia da Vela (Shorts): ${currentAnalysis.candleType === 'STRENGTH_BULLISH' ? 'Vela de Força Compradora (Grande corpo, sem rejeição)' : currentAnalysis.candleType === 'ENGULFING_BULLISH' ? 'Engolfo Institucional de Alta' : 'Pinbar de Rejeição no Suporte'}.`);

      // Verifica Confluência SuperTrend
      if (lastSt.direction === 'BULLISH') {
        stConfluenceOk = true;
        confluenceScore += 20;
        reasons.push('Confluência SuperTrend: Linha Verde de suporte dinâmico confirmando a compra.');
      } else {
        blocks.push('Nota: SuperTrend ainda em transição (Reversão precoce por CHoCH/W).');
      }

      // Verifica Confluência RSI(9)
      if (lastRsi >= 48 && lastRsi <= 72) {
        rsiConfluenceOk = true;
        confluenceScore += 20;
        reasons.push(`Confluência RSI(9) = ${lastRsi.toFixed(1)}: Momentum comprador saudável sem sobrecompra.`);
      } else if (lastRsi > 72) {
        blocks.push(`Alerta: RSI(${lastRsi.toFixed(1)}) próximo de sobrecompra extrema.`);
      }

      // Verifica Confluência True Supply & Demand / POC
      if (enableSupplyDemand) {
        if (sdAnalysis.inDemandZone || sdAnalysis.bouncedDemand) {
          sdConfluenceOk = true;
          confluenceScore += 19;
          sdStatus = `Demanda Institucional + POC (${sdAnalysis.nearestDemand?.pocPrice.toFixed(5)})`;
          reasons.push(`Confluência POC: Preço apoiado no Point of Control da Demanda (${sdAnalysis.nearestDemand?.pocPrice.toFixed(5)}).`);
        } else {
          sdConfluenceOk = true;
          confluenceScore += 10;
          sdStatus = 'Espaço Livre até Resistência';
          reasons.push('Confluência POC: Trajetória desimpedida até a próxima Oferta.');
        }
      }
    } else if (hasPutStructure && hasPutCandle) {
      verdict = 'PUT';
      patternName = currentAnalysis.structureLabel || `Padrão de Baixa (${currentAnalysis.candleTypeLabel})`;
      reasons.push(`Estrutura JeaFx: ${currentAnalysis.structureLabel || 'Quebra e Fluxo de Baixa confirmados'}.`);
      reasons.push(`Anatomia da Vela (Shorts): ${currentAnalysis.candleType === 'STRENGTH_BEARISH' ? 'Vela de Força Vendedora (Grande corpo, sem rejeição)' : currentAnalysis.candleType === 'ENGULFING_BEARISH' ? 'Engolfo Institucional de Baixa' : 'Pinbar de Rejeição na Resistência'}.`);

      // Verifica Confluência SuperTrend
      if (lastSt.direction === 'BEARISH') {
        stConfluenceOk = true;
        confluenceScore += 20;
        reasons.push('Confluência SuperTrend: Linha Vermelha de resistência dinâmica confirmando a venda.');
      } else {
        blocks.push('Nota: SuperTrend ainda em transição (Reversão precoce por CHoCH/M).');
      }

      // Verifica Confluência RSI(9)
      if (lastRsi <= 52 && lastRsi >= 28) {
        rsiConfluenceOk = true;
        confluenceScore += 20;
        reasons.push(`Confluência RSI(9) = ${lastRsi.toFixed(1)}: Momentum vendedor saudável sem sobrevenda.`);
      } else if (lastRsi < 28) {
        blocks.push(`Alerta: RSI(${lastRsi.toFixed(1)}) próximo de sobrevenda extrema.`);
      }

      // Verifica Confluência True Supply & Demand / POC
      if (enableSupplyDemand) {
        if (sdAnalysis.inSupplyZone || sdAnalysis.bouncedSupply) {
          sdConfluenceOk = true;
          confluenceScore += 19;
          sdStatus = `Oferta Institucional + POC (${sdAnalysis.nearestSupply?.pocPrice.toFixed(5)})`;
          reasons.push(`Confluência POC: Preço rejeitado no Point of Control da Oferta (${sdAnalysis.nearestSupply?.pocPrice.toFixed(5)}).`);
        } else {
          sdConfluenceOk = true;
          confluenceScore += 10;
          sdStatus = 'Espaço Livre até Suporte';
          reasons.push('Confluência POC: Trajetória desimpedida até a próxima Demanda.');
        }
      }
    }
  }

  // Se nenhum padrão tiver disparado nesta vela:
  if (verdict === 'NO_TRADE') {
    confluenceScore = 0;
    if (blocks.length === 0) {
      blocks.push('Aguardando alinhamento de Estrutura (BOS / CHoCH / Topo ou Fundo Duplo) com Vela de Força dos Shorts.');
    }
  }

  const summary =
    verdict === 'CALL'
      ? `Sinal CALL gerado por ${patternName} + ${currentAnalysis.candleTypeLabel} com confluência de ${Math.min(99, confluenceScore)}%.`
      : verdict === 'PUT'
      ? `Sinal PUT gerado por ${patternName} + ${currentAnalysis.candleTypeLabel} com confluência de ${Math.min(99, confluenceScore)}%.`
      : 'Robô rastreando estruturas e figuras gráficas na vela atual. Proteção ativada.';

  return {
    verdict,
    patternName,
    structureEvent: currentAnalysis.structureEvent,
    structureLabel: currentAnalysis.structureLabel || 'Sem quebra imediata',
    candlePattern: currentAnalysis.candleType,
    candlePatternLabel: currentAnalysis.candleTypeLabel,
    candleColor,
    cooldownActive,
    cooldownCandlesRemaining,
    confluence: {
      superTrendDirection: lastSt.direction,
      superTrendValue: lastSt.value,
      superTrendOk: stConfluenceOk,
      rsiValue: lastRsi,
      rsiOk: rsiConfluenceOk,
      supplyDemandOk: sdConfluenceOk,
      supplyDemandStatus: sdStatus,
      score: Math.min(99, confluenceScore),
    },
    reasons,
    blocks,
    confidence: Math.min(99, confluenceScore),
    summary,
  };
}
