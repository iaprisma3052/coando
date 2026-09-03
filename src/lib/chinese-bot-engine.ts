/**
 * PRISMA IA VECTOR OTC — Three-Vote AI Consensus Engine
 *
 * Estratégia dos 3 Indicadores Clássicos:
 * 1. Tendência (Trend — Cruzamento de EMAs 9 e 21):
 *    - EMA rápida (9) > EMA lenta (21) e preço sustentando acima: Voto COMPRA (CALL).
 *    - EMA rápida (9) < EMA lenta (21) e preço abaixo: Voto VENDA (PUT).
 *    - Médias cruzadas ou indefinidas: Voto Neutro.
 *
 * 2. Momento / Força (Momentum — RSI 14):
 *    - RSI > 50 (força compradora): Voto COMPRA (CALL).
 *    - RSI < 50 (força vendedora): Voto VENDA (PUT).
 *    - RSI entre 49 e 51 / plano: Voto Neutro.
 *
 * 3. Volatilidade (Volatility — ATR 14):
 *    - Filtro de qualidade contra mercado travado (sem amplitude) ou ultra errático.
 *    - Se o mercado estiver normal/estável: Voto Aprovado.
 *
 * Regra de Confluência e Filtro NO TRADE:
 * - CALL (Verde): Aprovado quando os 3 indicadores concordam na alta.
 * - PUT (Vermelho): Aprovado quando os 3 indicadores concordam na baixa.
 * - NO TRADE (Neutro): Quando os indicadores discordam ou o mercado está sem direção clara,
 *   o sistema emite "NO TRADE" para proteger o capital.
 */

import type { Candle, AnalystVerdict, Analysis } from '@/types';

// ─── Mathematical Indicators ──────────────────────────────────────────────────

export function calcBollingerBands(closes: number[], period = 20, multiplier = 2): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1] ?? 1.0;
    return { upper: last * 1.002, middle: last, lower: last * 0.998 };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: mean + multiplier * std,
    middle: mean,
    lower: mean - multiplier * std,
  };
}

export function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return values.map(() => NaN);
  const k = 2 / (period + 1);
  const result: number[] = Array.from({ length: values.length }, () => NaN);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + (result[i - 1] ?? 0) * (1 - k);
  }
  return result;
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

export function calcATR(candles: Candle[], period = 14): { currentAtr: number; baselineAtr: number } {
  if (candles.length < period + 1) {
    const last = candles[candles.length - 1];
    const range = last ? Math.max(0.0001, last.high - last.low) : 0.0005;
    return { currentAtr: range, baselineAtr: range };
  }

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);
  }

  const recent = trs.slice(-period);
  const currentAtr = recent.reduce((a, b) => a + b, 0) / period;
  const older = trs.slice(-Math.min(trs.length, period * 3));
  const baselineAtr = older.reduce((a, b) => a + b, 0) / older.length;

  return { currentAtr, baselineAtr };
}

// ─── 1. Supertrend Indicator (Fast & Slow Dual Supertrend) ───────────────────

export interface SupertrendPoint {
  supertrend: number;
  direction: 'call' | 'put'; // 'call' = uptrend (green), 'put' = downtrend (red)
  upperBand: number;
  lowerBand: number;
}

export function calcSupertrend(candles: Candle[], period = 7, multiplier = 2.0): SupertrendPoint[] {
  if (candles.length < period + 1) {
    const last = candles[candles.length - 1] ?? { close: 1.0, high: 1.0, low: 1.0 };
    return [{
      supertrend: last.close,
      direction: 'call',
      upperBand: last.close * 1.002,
      lowerBand: last.close * 0.998,
    }];
  }

  const results: SupertrendPoint[] = [];
  let prevFinalUpper = 0;
  let prevFinalLower = 0;
  let prevSupertrend = 0;
  let prevDir: 'call' | 'put' = 'call';

  // Compute ATR over the series
  for (let i = period; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    const { currentAtr } = calcATR(slice, period);
    const curr = candles[i];
    const prev = candles[i - 1];

    const hl2 = (curr.high + curr.low) / 2;
    const basicUpper = hl2 + multiplier * currentAtr;
    const basicLower = hl2 - multiplier * currentAtr;

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > period) {
      finalUpper = (basicUpper < prevFinalUpper || prev.close > prevFinalUpper) ? basicUpper : prevFinalUpper;
      finalLower = (basicLower > prevFinalLower || prev.close < prevFinalLower) ? basicLower : prevFinalLower;
    }

    let dir: 'call' | 'put' = prevDir;
    let st = 0;

    if (i === period) {
      dir = curr.close >= basicUpper ? 'call' : 'put';
      st = dir === 'call' ? finalLower : finalUpper;
    } else {
      if (prevDir === 'call') {
        if (curr.close < finalLower) {
          dir = 'put';
          st = finalUpper;
        } else {
          dir = 'call';
          st = finalLower;
        }
      } else {
        if (curr.close > finalUpper) {
          dir = 'call';
          st = finalLower;
        } else {
          dir = 'put';
          st = finalUpper;
        }
      }
    }

    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevSupertrend = st;
    prevDir = dir;

    results.push({
      supertrend: st,
      direction: dir,
      upperBand: finalUpper,
      lowerBand: finalLower,
    });
  }

  return results;
}

export interface DualSupertrendResult {
  fastDir: 'call' | 'put';
  slowDir: 'call' | 'put';
  consensus: 'call' | 'put' | 'neutral';
  fastValue: number;
  slowValue: number;
  strength: number;
  description: string;
}

export function calcDualSupertrend(candles: Candle[]): DualSupertrendResult {
  const fastST = calcSupertrend(candles, 7, 2.0);
  const slowST = calcSupertrend(candles, 14, 3.0);

  const lastFast = fastST[fastST.length - 1];
  const lastSlow = slowST[slowST.length - 1];

  const fastDir = lastFast?.direction ?? 'call';
  const slowDir = lastSlow?.direction ?? 'call';

  let consensus: 'call' | 'put' | 'neutral' = 'neutral';
  let strength = 50;
  let description = 'Supertrend em divergência (Neutro)';

  if (fastDir === 'call' && slowDir === 'call') {
    consensus = 'call';
    strength = 95;
    description = 'Supertrend Duplo (7x2 e 14x3) Alinhado em ALTA Rigorosa (CALL)';
  } else if (fastDir === 'put' && slowDir === 'put') {
    consensus = 'put';
    strength = 95;
    description = 'Supertrend Duplo (7x2 e 14x3) Alinhado em BAIXA Rigorosa (PUT)';
  } else if (fastDir === 'call') {
    consensus = 'call';
    strength = 75;
    description = 'Supertrend Rápido (7x2) em Alta / Lento em Transição';
  } else {
    consensus = 'put';
    strength = 75;
    description = 'Supertrend Rápido (7x2) em Baixa / Lento em Transição';
  }

  return {
    fastDir,
    slowDir,
    consensus,
    fastValue: lastFast?.supertrend ?? 0,
    slowValue: lastSlow?.supertrend ?? 0,
    strength,
    description,
  };
}

// ─── 2. CCI (Commodity Channel Index 14) + RSI (14) Momentum ─────────────────

export function calcCCI(candles: Candle[], period = 14): number {
  if (candles.length < period) return 0;
  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3);
  const slice = typicalPrices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const meanDeviation = slice.reduce((acc, tp) => acc + Math.abs(tp - sma), 0) / period;

  if (meanDeviation === 0) return 0;
  const currentTP = typicalPrices[typicalPrices.length - 1];
  const cci = (currentTP - sma) / (0.015 * meanDeviation);
  return Number(cci.toFixed(1));
}

export interface CciRsiResult {
  cci: number;
  rsi: number;
  momentumState: 'overbought' | 'oversold' | 'bull_push' | 'bear_push' | 'neutral';
  signal: 'call' | 'put' | 'neutral';
  description: string;
}

export function calcCciRsiMomentum(candles: Candle[]): CciRsiResult {
  const closes = candles.map((c) => c.close);
  const cci = calcCCI(candles, 14);
  const rsi = calcRSI(closes, 14);

  let momentumState: 'overbought' | 'oversold' | 'bull_push' | 'bear_push' | 'neutral' = 'neutral';
  let signal: 'call' | 'put' | 'neutral' = 'neutral';
  let description = `CCI (${cci}) e RSI (${rsi}) neutros`;

  if (cci <= -100 && rsi <= 35) {
    momentumState = 'oversold';
    signal = 'call';
    description = `Sobrevenda Extrema: CCI (${cci}) < -100 e RSI (${rsi}) < 35 indicando exaustão vendedora e reversão para ALTA`;
  } else if (cci >= 100 && rsi >= 65) {
    momentumState = 'overbought';
    signal = 'put';
    description = `Sobrecompra Extrema: CCI (${cci}) > +100 e RSI (${rsi}) > 65 indicando exaustão compradora e reversão para BAIXA`;
  } else if (cci > 30 && rsi > 52) {
    momentumState = 'bull_push';
    signal = 'call';
    description = `Aceleração Compradora: CCI (${cci}) positivo e RSI (${rsi}) sustentando continuidade de ALTA`;
  } else if (cci < -30 && rsi < 48) {
    momentumState = 'bear_push';
    signal = 'put';
    description = `Aceleração Vendedora: CCI (${cci}) negativo e RSI (${rsi}) sustentando continuidade de BAIXA`;
  }

  return { cci, rsi, momentumState, signal, description };
}

// ─── 3. Padrão de Exaustão de Pavio (Wick Rejection) ──────────────────────────

export interface WickExhaustionResult {
  hasRejection: boolean;
  type: 'bull_wick' | 'bear_wick' | 'none';
  ratio: number;
  description: string;
}

export function calcWickExhaustion(candles: Candle[]): WickExhaustionResult {
  if (candles.length < 2) {
    return { hasRejection: false, type: 'none', ratio: 0, description: 'Poucas velas' };
  }

  const prev = candles[candles.length - 2] ?? candles[candles.length - 1];
  const range = Math.max(0.00001, prev.high - prev.low);
  const body = Math.abs(prev.close - prev.open);
  const upperWick = prev.high - Math.max(prev.open, prev.close);
  const lowerWick = Math.min(prev.open, prev.close) - prev.low;

  const upperRatio = upperWick / range;
  const lowerRatio = lowerWick / range;

  if (lowerRatio >= 0.35 && lowerWick > body * 0.8) {
    return {
      hasRejection: true,
      type: 'bull_wick',
      ratio: Number(lowerRatio.toFixed(2)),
      description: `Pavio Inferior ${(lowerRatio * 100).toFixed(0)}% — Exaustão de venda e rejeição forte de suporte`,
    };
  }

  if (upperRatio >= 0.35 && upperWick > body * 0.8) {
    return {
      hasRejection: true,
      type: 'bear_wick',
      ratio: Number(upperRatio.toFixed(2)),
      description: `Pavio Superior ${(upperRatio * 100).toFixed(0)}% — Exaustão de compra e rejeição forte de resistência`,
    };
  }

  return {
    hasRejection: false,
    type: 'none',
    ratio: 0,
    description: 'Sem rejeição de pavio superior a 35%',
  };
}

// ─── 4. Filtro de Ruído & Doji (ATR / Amplitude / Anti-Loss) ──────────────────

export interface DojiNoiseFilterResult {
  isDoji: boolean;
  isFlatNoise: boolean;
  blocked: boolean;
  bodyRatio: number;
  reason?: string;
}

export function calcDojiNoiseFilter(candles: Candle[]): DojiNoiseFilterResult {
  if (candles.length < 3) {
    return { isDoji: false, isFlatNoise: false, blocked: false, bodyRatio: 1.0 };
  }

  const prev = candles[candles.length - 2] ?? candles[candles.length - 1];
  const range = Math.max(0.00001, prev.high - prev.low);
  const body = Math.abs(prev.close - prev.open);
  const bodyRatio = Number((body / range).toFixed(2));

  const { currentAtr, baselineAtr } = calcATR(candles, 14);

  const isDoji = bodyRatio < 0.12;
  const isFlatNoise = range < currentAtr * 0.20 || currentAtr < baselineAtr * 0.25;

  if (isDoji) {
    return {
      isDoji: true,
      isFlatNoise,
      blocked: true,
      bodyRatio,
      reason: 'Vela anterior identificada como DOJI (corpo < 12%). Mercado indeciso — Entrada bloqueada.',
    };
  }

  if (isFlatNoise) {
    return {
      isDoji: false,
      isFlatNoise: true,
      blocked: true,
      bodyRatio,
      reason: 'Mercado em compressão lateral / ruído de baixíssima volatilidade — Entrada bloqueada.',
    };
  }

  return {
    isDoji: false,
    isFlatNoise: false,
    blocked: false,
    bodyRatio,
  };
}

// ─── Three-Vote AI Consensus Core Engine ──────────────────────────────────────

export interface ChineseBotResult {
  verdict: 'CALL' | 'PUT' | 'NO_TRADE';
  verdictWord: 'CALL' | 'PUT' | 'NO TRADE';
  verdictSub: 'COMPRA (ALTA)' | 'VENDA (BAIXA)' | 'SEM ENTRADA (NEUTRO)';
  confidencePct: number; // e.g. 92
  confidenceLevel: 'HIGH' | 'MED' | 'LOW';
  trendScore: number; // 0-100
  trendLabel: string;
  trendDir: 'call' | 'put' | 'neutral';
  momentumScore: number; // 0-100
  momentumLabel: string;
  momentumDir: 'call' | 'put' | 'neutral';
  volatilityScore: number; // 0-100
  volatilityLabel: string;
  volatilityLevel: 'Low' | 'Medium' | 'High' | 'Steady';
  volatilityApproved: boolean;
  rsi: number;
  atr: number;
  emaFast: number;
  emaSlow: number;
  emaMacro: number;
  lastPrice: number;
  supertrend?: DualSupertrendResult;
  cciRsi?: CciRsiResult;
  wickExhaustion?: WickExhaustionResult;
  dojiNoise?: DojiNoiseFilterResult;
  analysts: AnalystVerdict[];
  reasons: string[];
  blocks: string[];
  signalReady: boolean;
}

export function evaluateChineseBot(candles: Candle[], timeframe = '1M'): ChineseBotResult {
  if (!candles || candles.length < 10) {
    return {
      verdict: 'NO_TRADE',
      verdictWord: 'NO TRADE',
      verdictSub: 'SEM ENTRADA (NEUTRO)',
      confidencePct: 50,
      confidenceLevel: 'LOW',
      trendScore: 50,
      trendLabel: 'Sincronizando fluxo...',
      trendDir: 'neutral',
      momentumScore: 50,
      momentumLabel: 'RSI 50.0 · Neutro',
      momentumDir: 'neutral',
      volatilityScore: 50,
      volatilityLabel: 'Volume moderado',
      volatilityLevel: 'Medium',
      volatilityApproved: false,
      rsi: 50,
      atr: 0.0005,
      emaFast: 1.0,
      emaSlow: 1.0,
      emaMacro: 1.0,
      lastPrice: 1.0,
      analysts: [],
      reasons: ['Aguardando sincronização de velas com a corretora.'],
      blocks: ['Dados insuficientes para cálculo de confluência dos 3 votos.'],
      signalReady: false,
    };
  }

  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const lastPrice = last.close;

  // Compute the 4 new indicators from the video
  const dualSupertrend = calcDualSupertrend(candles);
  const cciRsi = calcCciRsiMomentum(candles);
  const wickExhaustion = calcWickExhaustion(candles);
  const dojiNoise = calcDojiNoiseFilter(candles);

  // 1. Pilar 1: Tendência (Cruzamento de EMAs - Rápida 9 vs Lenta 21 + Supertrend Duplo)
  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema50Arr = calcEMA(closes, Math.min(50, closes.length - 2));

  const e9 = !isNaN(ema9Arr[ema9Arr.length - 1]) ? ema9Arr[ema9Arr.length - 1] : lastPrice;
  const e21 = !isNaN(ema21Arr[ema21Arr.length - 1]) ? ema21Arr[ema21Arr.length - 1] : lastPrice;
  const e50 = !isNaN(ema50Arr[ema50Arr.length - 1]) ? ema50Arr[ema50Arr.length - 1] : e21;

  let trendDir: 'call' | 'put' | 'neutral' = 'neutral';
  let trendScore = 50;
  let trendLabel = 'Médias Móveis Sem Cruzamento Claro';

  const isFastAboveSlow = e9 > e21;
  const isFastBelowSlow = e9 < e21;
  const isPriceAboveFast = lastPrice >= e9;
  const isPriceBelowFast = lastPrice <= e9;

  if (isFastAboveSlow && isPriceAboveFast && dualSupertrend.consensus === 'call') {
    trendDir = 'call';
    trendScore = 98;
    trendLabel = `EMA 9 (${e9.toFixed(4)}) > EMA 21 + Supertrend Duplo em ALTA RIGOROSA`;
  } else if (isFastBelowSlow && isPriceBelowFast && dualSupertrend.consensus === 'put') {
    trendDir = 'put';
    trendScore = 98;
    trendLabel = `EMA 9 (${e9.toFixed(4)}) < EMA 21 + Supertrend Duplo em BAIXA RIGOROSA`;
  } else if (isFastAboveSlow && isPriceAboveFast) {
    trendDir = 'call';
    trendScore = 90;
    trendLabel = `EMA 9 (${e9.toFixed(4)}) > EMA 21 (${e21.toFixed(4)}) com preço sustentado acima`;
  } else if (isFastBelowSlow && isPriceBelowFast) {
    trendDir = 'put';
    trendScore = 90;
    trendLabel = `EMA 9 (${e9.toFixed(4)}) < EMA 21 (${e21.toFixed(4)}) com preço caindo abaixo`;
  } else if (isFastAboveSlow) {
    trendDir = 'call';
    trendScore = 75;
    trendLabel = `EMA 9 > EMA 21 (Alta moderada)`;
  } else if (isFastBelowSlow) {
    trendDir = 'put';
    trendScore = 75;
    trendLabel = `EMA 9 < EMA 21 (Baixa moderada)`;
  } else {
    trendDir = 'neutral';
    trendScore = 50;
    trendLabel = `Médias convergindo (Lateralizado)`;
  }

  // 2. Pilar 2: Momento / Força (RSI 14 + CCI 14)
  const rsiVal = calcRSI(closes, 14);
  let momentumDir: 'call' | 'put' | 'neutral' = 'neutral';
  let momentumScore = 50;
  let momentumLabel = `RSI ${rsiVal.toFixed(1)} · Neutro`;

  if (cciRsi.signal === 'call' || (rsiVal > 51.5 && cciRsi.cci > 0)) {
    momentumDir = 'call';
    momentumScore = Math.min(98, Math.round(78 + (rsiVal - 50) * 0.8 + (cciRsi.cci > 0 ? 8 : 0)));
    momentumLabel = `RSI (${rsiVal.toFixed(1)}) + CCI (${cciRsi.cci.toFixed(1)}) — Força Compradora e Aceleração`;
  } else if (cciRsi.signal === 'put' || (rsiVal < 48.5 && cciRsi.cci < 0)) {
    momentumDir = 'put';
    momentumScore = Math.min(98, Math.round(78 + (50 - rsiVal) * 0.8 + (cciRsi.cci < 0 ? 8 : 0)));
    momentumLabel = `RSI (${rsiVal.toFixed(1)}) + CCI (${cciRsi.cci.toFixed(1)}) — Força Vendedora e Aceleração`;
  } else {
    momentumDir = 'neutral';
    momentumScore = 50;
    momentumLabel = `RSI em ${rsiVal.toFixed(1)} / CCI ${cciRsi.cci.toFixed(1)} (Neutro)`;
  }

  // 3. Pilar 3: Volatilidade / Filtro de Qualidade (ATR 14 + Filtro Anti-Doji & Ruído)
  const { currentAtr, baselineAtr } = calcATR(candles, 14);
  const atrRatio = baselineAtr > 0 ? currentAtr / baselineAtr : 1;
  let volatilityLevel: 'Low' | 'Medium' | 'High' | 'Steady' = 'Steady';
  let volatilityScore = 88;
  let volatilityLabel = 'Amplitude Ideal para Operações';
  let volatilityApproved = true;

  if (dojiNoise.blocked) {
    volatilityLevel = 'Low';
    volatilityScore = 30;
    volatilityLabel = dojiNoise.reason || 'Doji / Ruído Detectado';
    volatilityApproved = false;
  } else if (atrRatio < 0.4) {
    volatilityLevel = 'Low';
    volatilityScore = 40;
    volatilityLabel = 'Mercado travado / Amplitude insuficiente';
    volatilityApproved = false;
  } else if (atrRatio > 2.8) {
    volatilityLevel = 'High';
    volatilityScore = 50;
    volatilityLabel = 'Volatilidade excessiva / Ruído errático';
    volatilityApproved = false;
  } else {
    volatilityLevel = 'Steady';
    volatilityScore = Math.min(95, Math.round(82 + (1 - Math.abs(1 - atrRatio)) * 13));
    volatilityLabel = `Filtro ATR Aprovado (Sem Doji, Amplitude Saudável)`;
    volatilityApproved = true;
  }

  // ─── Confluência dos Votos & Regra NO TRADE ────────────────────────────────
  const reasons: string[] = [];
  const blocks: string[] = [];

  let verdict: 'CALL' | 'PUT' | 'NO_TRADE' = 'NO_TRADE';
  let verdictWord: 'CALL' | 'PUT' | 'NO TRADE' = 'NO TRADE';
  let verdictSub: 'COMPRA (ALTA)' | 'VENDA (BAIXA)' | 'SEM ENTRADA (NEUTRO)' = 'SEM ENTRADA (NEUTRO)';
  let confidencePct = 50;

  if (dojiNoise.blocked) {
    verdict = 'NO_TRADE';
    verdictWord = 'NO TRADE';
    verdictSub = 'SEM ENTRADA (NEUTRO)';
    confidencePct = 35;
    blocks.push(`FILTRO ANTI-LOSS: ${dojiNoise.reason}`);
    blocks.push('Operação cancelada preventivamente para proteger capital.');
  }
  // CALL (Verde): Aprovado quando os indicadores concordam na alta
  else if (trendDir === 'call' && momentumDir === 'call' && volatilityApproved) {
    verdict = 'CALL';
    verdictWord = 'CALL';
    verdictSub = 'COMPRA (ALTA)';
    confidencePct = Math.min(98, Math.max(86, Math.round(trendScore * 0.45 + momentumScore * 0.35 + volatilityScore * 0.2)));
    reasons.push(`1. Tendência Rigorosa: EMA 9 (${e9.toFixed(4)}) > EMA 21 e Supertrend Duplo em Alta.`);
    reasons.push(`2. Momento CCI+RSI: RSI (${rsiVal.toFixed(1)}) e CCI (${cciRsi.cci.toFixed(1)}) confirmam aceleração.`);
    if (wickExhaustion.hasRejection && wickExhaustion.type === 'bull_wick') {
      reasons.push(`3. Padrão de Pavio: ${wickExhaustion.description}.`);
    }
    reasons.push(`4. Volatilidade e Ruído: Filtro Anti-Doji aprovado com amplitude saudável.`);
  }
  // PUT (Vermelho): Aprovado quando os indicadores concordam na baixa
  else if (trendDir === 'put' && momentumDir === 'put' && volatilityApproved) {
    verdict = 'PUT';
    verdictWord = 'PUT';
    verdictSub = 'VENDA (BAIXA)';
    confidencePct = Math.min(98, Math.max(86, Math.round(trendScore * 0.45 + momentumScore * 0.35 + volatilityScore * 0.2)));
    reasons.push(`1. Tendência Rigorosa: EMA 9 (${e9.toFixed(4)}) < EMA 21 e Supertrend Duplo em Baixa.`);
    reasons.push(`2. Momento CCI+RSI: RSI (${rsiVal.toFixed(1)}) e CCI (${cciRsi.cci.toFixed(1)}) confirmam aceleração.`);
    if (wickExhaustion.hasRejection && wickExhaustion.type === 'bear_wick') {
      reasons.push(`3. Padrão de Pavio: ${wickExhaustion.description}.`);
    }
    reasons.push(`4. Volatilidade e Ruído: Filtro Anti-Doji aprovado com amplitude saudável.`);
  }
  // NO TRADE (Neutro): Quando os indicadores discordam ou o mercado está sem direção clara
  else {
    verdict = 'NO_TRADE';
    verdictWord = 'NO TRADE';
    verdictSub = 'SEM ENTRADA (NEUTRO)';
    confidencePct = 50;

    if (!volatilityApproved) {
      blocks.push(volatilityLabel);
    }
    if (trendDir === 'neutral' || momentumDir === 'neutral') {
      blocks.push('Indicadores em zona neutra / sem consenso definido.');
    } else if (trendDir !== momentumDir) {
      blocks.push(`Divergência técnica: Tendência aponta ${trendDir === 'call' ? 'ALTA' : 'BAIXA'}, mas Momento RSI+CCI aponta ${momentumDir === 'call' ? 'ALTA' : 'BAIXA'}.`);
    }
    blocks.push('Protegendo capital: entrada rejeitada pelo Motor de Confluência.');
  }

  const confidenceLevel = confidencePct >= 80 ? 'HIGH' : confidencePct >= 65 ? 'MED' : 'LOW';
  const signalReady = verdict !== 'NO_TRADE';

  // 4-Analyst Verdict Structure
  const analysts: AnalystVerdict[] = [
    {
      name: 'Voto 1: Supertrend Duplo & EMAs (9/21)',
      icon: '📈',
      direction: trendDir === 'call' ? 'call' : trendDir === 'put' ? 'put' : 'hold',
      confidence: trendScore,
      opinion:
        trendDir === 'call'
          ? `Supertrend Duplo em ALTA + EMA9 (${e9.toFixed(4)}) > EMA21 — Voto CALL`
          : trendDir === 'put'
            ? `Supertrend Duplo em BAIXA + EMA9 (${e9.toFixed(4)}) < EMA21 — Voto PUT`
            : `Médias e Supertrend divergentes — Voto Neutro`,
    },
    {
      name: 'Voto 2: Momento CCI (14) + RSI (14)',
      icon: '⚡',
      direction: momentumDir === 'call' ? 'call' : momentumDir === 'put' ? 'put' : 'hold',
      confidence: momentumScore,
      opinion:
        momentumDir === 'call'
          ? `CCI (${cciRsi.cci.toFixed(1)}) e RSI (${rsiVal.toFixed(1)}) — Voto CALL`
          : momentumDir === 'put'
            ? `CCI (${cciRsi.cci.toFixed(1)}) e RSI (${rsiVal.toFixed(1)}) — Voto PUT`
            : `CCI/RSI em zona neutra — Sem Voto`,
    },
    {
      name: 'Voto 3: Exaustão de Pavio (Wick Rejection)',
      icon: '🎯',
      direction: wickExhaustion.type === 'bull_wick' ? 'call' : wickExhaustion.type === 'bear_wick' ? 'put' : 'hold',
      confidence: wickExhaustion.hasRejection ? 92 : 70,
      opinion: wickExhaustion.description,
    },
    {
      name: 'Voto 4: Filtro de Ruído & Anti-Doji (ATR)',
      icon: '🛡️',
      direction: volatilityApproved ? (verdict === 'CALL' ? 'call' : verdict === 'PUT' ? 'put' : 'hold') : 'hold',
      confidence: volatilityScore,
      opinion: volatilityApproved
        ? `ATR (${currentAtr.toFixed(5)}) — Mercado Saudável (Sem Doji)`
        : `Bloqueado: ${volatilityLabel}`,
    },
  ];

  return {
    verdict,
    verdictWord,
    verdictSub,
    confidencePct,
    confidenceLevel,
    trendScore,
    trendLabel,
    trendDir,
    momentumScore,
    momentumLabel,
    momentumDir,
    volatilityScore,
    volatilityLabel,
    volatilityLevel,
    volatilityApproved,
    rsi: rsiVal,
    atr: currentAtr,
    emaFast: e9,
    emaSlow: e21,
    emaMacro: e50,
    lastPrice,
    supertrend: dualSupertrend,
    cciRsi,
    wickExhaustion,
    dojiNoise,
    analysts,
    reasons,
    blocks,
    signalReady,
  };
}

export function buildUnifiedAnalysis(candles: Candle[], timeframe = '1M'): Analysis | null {
  if (!candles || candles.length < 10) return null;
  const result = evaluateChineseBot(candles, timeframe);
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const bb = calcBollingerBands(closes, 20);

  return {
    direction: result.verdict === 'PUT' ? 'put' : 'call',
    strength: result.confidencePct,
    confidence: result.confidenceLevel,
    reasons: result.reasons,
    blocks: result.blocks,
    emaMacro: result.emaMacro,
    emaInter: result.emaSlow,
    ema9: result.emaFast,
    ema21: result.emaSlow,
    buffer1: 0,
    buffer2: 0,
    gatilhoTaxa50: result.emaFast,
    rsi: result.rsi,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbMid: bb.middle,
    lastPrice: last.close,
    trend: result.trendDir === 'call' ? 'up' : result.trendDir === 'put' ? 'down' : 'lateral',
    candleContext: result.trendLabel,
    nextDir: result.verdict === 'PUT' ? 'put' : 'call',
    nextProb: result.confidencePct,
    pattern: result.verdict === 'CALL' ? 'Consenso de Alta 3 Votos' : result.verdict === 'PUT' ? 'Consenso de Baixa 3 Votos' : 'Sem Consenso (NO TRADE)',
    analysts: result.analysts,
    signalReady: result.signalReady,
    statusText: result.verdictSub,
    buyOK: result.verdict === 'CALL',
    sellOK: result.verdict === 'PUT',
    armedBuy: result.verdict === 'CALL',
    armedSell: result.verdict === 'PUT',
    markers: [],
  };
}
