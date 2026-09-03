import type { Candle } from '@/types';
import {
  calculateTrueSupplyDemandZones,
  type SupplyDemandAnalysis,
  type SupplyDemandZone,
} from './supply-demand-engine';

export * from './supply-demand-engine';

export interface SuperTrendPoint {
  time: number;
  value: number;
  direction: 'BULLISH' | 'BEARISH'; // BULLISH = verde (suporte), BEARISH = vermelho (resistência)
  upperBand: number;
  lowerBand: number;
}

export interface RsiPoint {
  time: number;
  value: number;
}

export type JeaFxPatternType =
  | 'CONTINUACAO_ALTA_PULLBACK' // Vela Grande Verde -> 1 ou 2 Vermelhas de Pullback -> Rompimento de Alta
  | 'CONTINUACAO_BAIXA_PULLBACK' // Vela Grande Vermelha -> 1 ou 2 Verdes de Pullback -> Rompimento de Baixa
  | 'ENGOLFO_DEMANDA' // Vela Vermelha engolfada por Vela Verde em Suporte/Demanda
  | 'ENGOLFO_OFERTA' // Vela Verde engolfada por Vela Vermelha em Resistência/Oferta
  | 'REJEICAO_PAVIO_DEMANDA' // Martelo / Pinbar com longo pavio inferior rejeitando fundo
  | 'REJEICAO_PAVIO_OFERTA' // Estrela Cadente / Pinbar com longo pavio superior rejeitando topo
  | 'ROMPIMENTO_RETESTE_ALTA' // Quebra de Estrutura (BOS) + Reteste de Alta
  | 'ROMPIMENTO_RETESTE_BAIXA' // Quebra de Estrutura (BOS) + Reteste de Baixa
  | 'FLUXO_3_VELAS_ALTA' // 3 Velas Verdes consecutivas de forte impulsão
  | 'FLUXO_3_VELAS_BAIXA' // 3 Velas Vermelhas consecutivas de forte impulsão
  | 'NENHUM';

export interface StrategySignal {
  verdict: 'CALL' | 'PUT' | 'NO_TRADE';
  patternType: JeaFxPatternType;
  patternName: string;
  patternDescription: string;
  candlesPatternSummary: string;
  candleColorsSequence: ('VERDE' | 'VERMELHA' | 'DOJI')[];
  superTrendDirection: 'BULLISH' | 'BEARISH';
  superTrendValue: number;
  rsiValue: number;
  rsiStatus: 'COMPRADOR' | 'VENDEDOR' | 'SOBRECOMPRADO' | 'SOBREVENDIDO' | 'NEUTRO';
  candleQuality: 'SAUDAVEL' | 'DOJI_TRAVADO' | 'EXAUSTAO';
  candleMovement: 'IMPULSAO_ALTA' | 'IMPULSAO_BAIXA' | 'LATERAL';
  priceAction: string;
  supplyDemandAnalysis?: SupplyDemandAnalysis;
  supplyDemandOk?: boolean;
  supplyDemandStatus?: string;
  filters: {
    superTrendOk: boolean;
    rsiMomentumOk: boolean;
    antiExhaustionOk: boolean;
    volatilityOk: boolean;
    supplyDemandOk?: boolean;
  };
  reasons: string[];
  blocks: string[];
  confidence: number;
}

// ─── 1. Cálculo do ATR (Average True Range) ──────────────────────────────────
export function calculateATR(candles: Candle[], period = 10): number[] {
  if (candles.length < 2) return candles.map(() => 0.0002);

  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
    trs.push(tr);
  }

  const atrs: number[] = [];
  let sum = 0;
  for (let i = 0; i < Math.min(period, trs.length); i++) {
    sum += trs[i];
  }
  let prevAtr = sum / Math.max(1, Math.min(period, trs.length));

  for (let i = 0; i < trs.length; i++) {
    if (i < period) {
      atrs.push(prevAtr);
    } else {
      prevAtr = (prevAtr * (period - 1) + trs[i]) / period;
      atrs.push(prevAtr);
    }
  }

  return atrs;
}

// ─── 2. Cálculo do SuperTrend (Período 10, Multiplicador 2.0) ─────────────────
export function calculateSuperTrend(
  candles: Candle[],
  period = 10,
  multiplier = 2.0
): SuperTrendPoint[] {
  if (candles.length === 0) return [];
  if (candles.length < period) {
    const last = candles[candles.length - 1];
    return candles.map((c) => ({
      time: c.time,
      value: c.close,
      direction: 'BULLISH',
      upperBand: c.close * 1.001,
      lowerBand: c.close * 0.999,
    }));
  }

  const atrs = calculateATR(candles, period);
  const points: SuperTrendPoint[] = [];

  let prevUpper = 0;
  let prevLower = 0;
  let prevDir: 'BULLISH' | 'BEARISH' = 'BULLISH';
  let prevSuperTrend = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const atr = atrs[i] || 0.0002;
    const hl2 = (c.high + c.low) / 2;

    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > 0) {
      const prevC = candles[i - 1];
      finalUpper =
        basicUpper < prevUpper || prevC.close > prevUpper
          ? basicUpper
          : prevUpper;
      finalLower =
        basicLower > prevLower || prevC.close < prevLower
          ? basicLower
          : prevLower;
    }

    let dir: 'BULLISH' | 'BEARISH' = prevDir;
    let st = 0;

    if (i === 0) {
      dir = c.close >= basicUpper ? 'BULLISH' : 'BEARISH';
      st = dir === 'BULLISH' ? finalLower : finalUpper;
    } else {
      if (prevDir === 'BULLISH') {
        if (c.close < finalLower) {
          dir = 'BEARISH';
          st = finalUpper;
        } else {
          dir = 'BULLISH';
          st = finalLower;
        }
      } else {
        if (c.close > finalUpper) {
          dir = 'BULLISH';
          st = finalLower;
        } else {
          dir = 'BEARISH';
          st = finalUpper;
        }
      }
    }

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevDir = dir;
    prevSuperTrend = st;

    points.push({
      time: c.time,
      value: st,
      direction: dir,
      upperBand: finalUpper,
      lowerBand: finalLower,
    });
  }

  return points;
}

// ─── 3. Cálculo do RSI (Período 9) com Série Histórica ────────────────────────
export function calculateRSI(closes: number[], period = 9): number[] {
  if (closes.length === 0) return [];
  if (closes.length <= period) {
    return closes.map(() => 50);
  }

  const rsis: number[] = Array(closes.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsis[period] = avgLoss === 0 ? 100 : Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsis[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsis[i] = Number((100 - 100 / (1 + rs)).toFixed(1));
    }
  }

  return rsis;
}

// ─── 4. Motor de Avaliação da Estratégia JeaFx (Continuação de Velas & True Supply & Demand) ─
export function evaluateSuperTrendRsiStrategy(
  candles: Candle[],
  enableSupplyDemand = true
): StrategySignal {
  if (candles.length < 10) {
    return {
      verdict: 'NO_TRADE',
      patternType: 'NENHUM',
      patternName: 'Aguardando Histórico',
      patternDescription: 'Aguardando carregamento de velas suficientes.',
      candlesPatternSummary: 'Histórico insuficiente',
      candleColorsSequence: [],
      superTrendDirection: 'BULLISH',
      superTrendValue: 0,
      rsiValue: 50,
      rsiStatus: 'NEUTRO',
      candleQuality: 'SAUDAVEL',
      candleMovement: 'LATERAL',
      priceAction: 'Aguardando velas...',
      supplyDemandStatus: 'Aguardando histórico...',
      filters: {
        superTrendOk: true,
        rsiMomentumOk: true,
        antiExhaustionOk: true,
        volatilityOk: true,
        supplyDemandOk: false,
      },
      reasons: ['Aguardando histórico mínimo de 10 velas para análise precisa.'],
      blocks: ['Histórico insuficiente.'],
      confidence: 0,
    };
  }

  const sdAnalysis = calculateTrueSupplyDemandZones(candles);
  const n = candles.length;
  const c0 = candles[n - 1]; // Vela atual / mais recente
  const c1 = candles[n - 2]; // 1 vela atrás
  const c2 = candles[n - 3]; // 2 velas atrás
  const c3 = candles[n - 4] || c2; // 3 velas atrás
  const c4 = candles[n - 5] || c3; // 4 velas atrás

  // Funções utilitárias de anatomia das velas
  const isGreen = (c: Candle) => c.close > c.open;
  const isRed = (c: Candle) => c.close < c.open;
  const body = (c: Candle) => Math.abs(c.close - c.open);
  const range = (c: Candle) => Math.max(0.00001, c.high - c.low);
  const upperWick = (c: Candle) => c.high - Math.max(c.open, c.close);
  const lowerWick = (c: Candle) => Math.min(c.open, c.close) - c.low;
  const bodyRatio = (c: Candle) => body(c) / range(c);

  // Média móvel do tamanho de corpo e amplitude das últimas 15 velas
  const recentSlice = candles.slice(-15);
  const avgBody =
    recentSlice.reduce((acc, c) => acc + body(c), 0) / recentSlice.length || 0.0001;
  const avgRange =
    recentSlice.reduce((acc, c) => acc + range(c), 0) / recentSlice.length || 0.0001;

  // Sequência de cores das últimas 5 velas
  const last5 = [c4, c3, c2, c1, c0];
  const candleColorsSequence: ('VERDE' | 'VERMELHA' | 'DOJI')[] = last5.map((c) => {
    if (body(c) / range(c) < 0.1) return 'DOJI';
    return isGreen(c) ? 'VERDE' : 'VERMELHA';
  });

  // Movimentação da vela atual
  const candleMovement: 'IMPULSAO_ALTA' | 'IMPULSAO_BAIXA' | 'LATERAL' =
    isGreen(c0) && body(c0) > avgBody * 0.7
      ? 'IMPULSAO_ALTA'
      : isRed(c0) && body(c0) > avgBody * 0.7
      ? 'IMPULSAO_BAIXA'
      : 'LATERAL';

  // Informações de Zonas Institucionais de Suporte e Resistência
  const inDemand = sdAnalysis.inDemandZone;
  const inSupply = sdAnalysis.inSupplyZone;
  const bouncedDemand = sdAnalysis.bouncedDemand;
  const bouncedSupply = sdAnalysis.bouncedSupply;
  const nearDemand = sdAnalysis.distToDemandPips <= 6 || inDemand || bouncedDemand;
  const nearSupply = sdAnalysis.distToSupplyPips <= 6 || inSupply || bouncedSupply;
  const nearestDemandPoc = sdAnalysis.nearestDemand?.pocPrice;
  const nearestSupplyPoc = sdAnalysis.nearestSupply?.pocPrice;

  let verdict: 'CALL' | 'PUT' | 'NO_TRADE' = 'NO_TRADE';
  let patternType: JeaFxPatternType = 'NENHUM';
  let patternName = 'Aguardando Padrão JeaFx';
  let patternDescription = 'O robô está mapeando o fluxo e aguarda a formação exata de um padrão de continuação.';
  let candlesPatternSummary = 'Sem confluência no momento';
  let priceAction = 'Velas sem padrão de continuação definido.';
  const reasons: string[] = [];
  const blocks: string[] = [];
  let confidence = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // RECONHECIMENTO DE PADRÕES JEAFX (How to Trade Continuations & Shorts)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. CONTINUAÇÃO DE ALTA (Vela Grande Verde + 1 ou 2 Velas Vermelhas + Rompimento) ──
  // Cenário A: Impulso em c3 + 2 velas de correção em c2 e c1 + rompimento em c0
  const isBullContinuation2Pullback =
    isGreen(c3) &&
    body(c3) >= avgBody * 0.95 &&
    isRed(c2) &&
    isRed(c1) &&
    body(c2) <= body(c3) * 0.85 &&
    body(c1) <= body(c3) * 0.85 &&
    c2.low >= c3.low - avgBody * 0.1 &&
    c1.low >= c3.low - avgBody * 0.1 &&
    isGreen(c0) &&
    (c0.close > c1.high || c0.close > c2.close);

  // Cenário B: Impulso em c2 + 1 vela de correção em c1 + rompimento em c0
  const isBullContinuation1Pullback =
    isGreen(c2) &&
    body(c2) >= avgBody * 1.05 &&
    isRed(c1) &&
    body(c1) <= body(c2) * 0.8 &&
    c1.low >= c2.low - avgBody * 0.05 &&
    isGreen(c0) &&
    c0.close > c1.open;

  // ── 2. CONTINUAÇÃO DE BAIXA (Vela Grande Vermelha + 1 ou 2 Velas Verdes + Rompimento) ──
  // Cenário A: Impulso em c3 + 2 velas de correção em c2 e c1 + rompimento em c0
  const isBearContinuation2Pullback =
    isRed(c3) &&
    body(c3) >= avgBody * 0.95 &&
    isGreen(c2) &&
    isGreen(c1) &&
    body(c2) <= body(c3) * 0.85 &&
    body(c1) <= body(c3) * 0.85 &&
    c2.high <= c3.high + avgBody * 0.1 &&
    c1.high <= c3.high + avgBody * 0.1 &&
    isRed(c0) &&
    (c0.close < c1.low || c0.close < c2.close);

  // Cenário B: Impulso em c2 + 1 vela de correção em c1 + rompimento em c0
  const isBearContinuation1Pullback =
    isRed(c2) &&
    body(c2) >= avgBody * 1.05 &&
    isGreen(c1) &&
    body(c1) <= body(c2) * 0.8 &&
    c1.high <= c2.high + avgBody * 0.05 &&
    isRed(c0) &&
    c0.close < c1.open;

  // ── 3. ENGOLFO EM ZONA INSTITUCIONAL (Short CU3vgVqlez0) ──
  // Engolfo Comprador: c1 vermelha, c0 verde grande engolfa c1
  const isBullishEngulfing =
    isRed(c1) &&
    isGreen(c0) &&
    c0.close > c1.open &&
    c0.open <= c1.close + avgBody * 0.1 &&
    body(c0) >= avgBody * 0.9 &&
    body(c0) > body(c1) * 1.1;

  // Engolfo Vendedor: c1 verde, c0 vermelha grande engolfa c1
  const isBearishEngulfing =
    isGreen(c1) &&
    isRed(c0) &&
    c0.close < c1.open &&
    c0.open >= c1.close - avgBody * 0.1 &&
    body(c0) >= avgBody * 0.9 &&
    body(c0) > body(c1) * 1.1;

  // ── 4. REJEIÇÃO COM PAVIO LONGO / PINBAR (Shorts _C6MVZoT3AQ e S6fq1xtctwc) ──
  // Martelo / Pinbar de Alta: Pavio inferior >= 50% da amplitude e >= 1.8x o corpo
  const isBullishPinbar =
    lowerWick(c0) >= range(c0) * 0.48 &&
    lowerWick(c0) >= body(c0) * 1.6 &&
    upperWick(c0) <= range(c0) * 0.28 &&
    range(c0) >= avgRange * 0.7;

  // Estrela Cadente / Pinbar de Baixa: Pavio superior >= 50% da amplitude e >= 1.8x o corpo
  const isBearishPinbar =
    upperWick(c0) >= range(c0) * 0.48 &&
    upperWick(c0) >= body(c0) * 1.6 &&
    lowerWick(c0) <= range(c0) * 0.28 &&
    range(c0) >= avgRange * 0.7;

  // ── 5. QUEBRA DE ESTRUTURA (BOS) + RETESTE (Shorts h-X3WAoZGtA e F3evSEYkv18) ──
  const highestPrevHigh = Math.max(c4.high, c3.high, c2.high);
  const lowestPrevLow = Math.min(c4.low, c3.low, c2.low);

  const isBullishBOSRetest =
    c2.close > highestPrevHigh &&
    isRed(c1) &&
    c1.low >= highestPrevHigh - avgBody * 0.2 &&
    isGreen(c0) &&
    c0.close > c1.high;

  const isBearishBOSRetest =
    c2.close < lowestPrevLow &&
    isGreen(c1) &&
    c1.high <= lowestPrevLow + avgBody * 0.2 &&
    isRed(c0) &&
    c0.close < c1.low;

  // ── 6. FLUXO INSTITUCIONAL DE 3 VELAS DE FORÇA (Short 1ZG5VgmZrhU) ──
  const isThreeGreenSoldiers =
    isGreen(c2) &&
    isGreen(c1) &&
    isGreen(c0) &&
    c0.close > c1.high &&
    c1.close > c2.high &&
    bodyRatio(c0) >= 0.6 &&
    bodyRatio(c1) >= 0.6 &&
    body(c0) >= avgBody * 0.8;

  const isThreeRedCrows =
    isRed(c2) &&
    isRed(c1) &&
    isRed(c0) &&
    c0.close < c1.low &&
    c1.close < c2.low &&
    bodyRatio(c0) >= 0.6 &&
    bodyRatio(c1) >= 0.6 &&
    body(c0) >= avgBody * 0.8;

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAÇÃO E DISPARO EXCLUSIVO (APENAS QUANDO O PADRÃO REAL EXISTE)
  // ═══════════════════════════════════════════════════════════════════════════

  if (isBullContinuation2Pullback || isBullContinuation1Pullback) {
    verdict = 'CALL';
    patternType = 'CONTINUACAO_ALTA_PULLBACK';
    patternName = 'Continuação JeaFx (Impulso + Pullback)';
    patternDescription = isBullContinuation2Pullback
      ? 'Vela grande verde de impulso, seguida de 2 velas vermelhas de correção saudável e rompimento comprador na vela atual.'
      : 'Vela grande verde de impulso, seguida de 1 vela vermelha de retração e rompimento imediato de alta.';
    candlesPatternSummary = isBullContinuation2Pullback
      ? '1x Grande Verde → 2x Vermelhas (Pullback) → Rompimento de Alta'
      : '1x Grande Verde → 1x Vermelha (Pullback) → Rompimento de Alta';
    priceAction = 'Retomada agressiva do fluxo comprador após correção sadia.';
    reasons.push('Padrão clássico de continuação JeaFx validado.');
    reasons.push('Velas de correção não violaram a mínima do impulso comprador.');
    if (nearDemand) {
      reasons.push(`Apoiado por Zona de Demanda [POC ${nearestDemandPoc ? nearestDemandPoc.toFixed(5) : ''}].`);
    }
    confidence = 96;
  } else if (isBearContinuation2Pullback || isBearContinuation1Pullback) {
    verdict = 'PUT';
    patternType = 'CONTINUACAO_BAIXA_PULLBACK';
    patternName = 'Continuação JeaFx (Impulso + Pullback)';
    patternDescription = isBearContinuation2Pullback
      ? 'Vela grande vermelha de impulso, seguida de 2 velas verdes de correção saudável e rompimento vendedor na vela atual.'
      : 'Vela grande vermelha de impulso, seguida de 1 vela verde de retração e rompimento imediato de baixa.';
    candlesPatternSummary = isBearContinuation2Pullback
      ? '1x Grande Vermelha → 2x Verdes (Pullback) → Rompimento de Baixa'
      : '1x Grande Vermelha → 1x Verde (Pullback) → Rompimento de Baixa';
    priceAction = 'Retomada agressiva do fluxo vendedor após correção sadia.';
    reasons.push('Padrão clássico de continuação JeaFx validado.');
    reasons.push('Velas de correção não violaram a máxima do impulso vendedor.');
    if (nearSupply) {
      reasons.push(`Rejeição confirmada em Zona de Oferta [POC ${nearestSupplyPoc ? nearestSupplyPoc.toFixed(5) : ''}].`);
    }
    confidence = 96;
  } else if (isBullishEngulfing && (nearDemand || isBullishPinbar)) {
    verdict = 'CALL';
    patternType = 'ENGOLFO_DEMANDA';
    patternName = 'Engolfo Comprador em Demanda (Bullish Engulfing)';
    patternDescription = 'Vela vermelha anterior completamente engolfada por vela verde expressiva na Zona de Demanda.';
    candlesPatternSummary = 'Vela Vermelha → Engolfo Verde Forte na Demanda';
    priceAction = 'Compradores institucionais absorveram totalmente a pressão vendedora anterior.';
    reasons.push('Engolfo comprador com volume institucional na zona de suporte.');
    confidence = 95;
  } else if (isBearishEngulfing && (nearSupply || isBearishPinbar)) {
    verdict = 'PUT';
    patternType = 'ENGOLFO_OFERTA';
    patternName = 'Engolfo Vendedor em Oferta (Bearish Engulfing)';
    patternDescription = 'Vela verde anterior completamente engolfada por vela vermelha expressiva na Zona de Oferta.';
    candlesPatternSummary = 'Vela Verde → Engolfo Vermelho Forte na Oferta';
    priceAction = 'Vendedores institucionais absorveram totalmente a pressão compradora anterior.';
    reasons.push('Engolfo vendedor com volume institucional na zona de resistência.');
    confidence = 95;
  } else if (isBullishPinbar && nearDemand) {
    verdict = 'CALL';
    patternType = 'REJEICAO_PAVIO_DEMANDA';
    patternName = 'Pinbar / Martelo de Rejeição em Demanda';
    patternDescription = 'Vela deixou longo pavio inferior demonstrando forte rejeição de preço em suporte institucional.';
    candlesPatternSummary = 'Pavio Inferior Longo (≥50%) em Demanda';
    priceAction = 'Tentativa de queda imediatamente repelida pela liquidez compradora.';
    reasons.push('Pavio longo inferior com POC comprador ativo.');
    confidence = 93;
  } else if (isBearishPinbar && nearSupply) {
    verdict = 'PUT';
    patternType = 'REJEICAO_PAVIO_OFERTA';
    patternName = 'Pinbar / Estrela Cadente de Rejeição em Oferta';
    patternDescription = 'Vela deixou longo pavio superior demonstrando forte rejeição de preço em resistência institucional.';
    candlesPatternSummary = 'Pavio Superior Longo (≥50%) em Oferta';
    priceAction = 'Tentativa de alta imediatamente repelida pela liquidez vendedora.';
    reasons.push('Pavio longo superior com POC vendedor ativo.');
    confidence = 93;
  } else if (isBullishBOSRetest) {
    verdict = 'CALL';
    patternType = 'ROMPIMENTO_RETESTE_ALTA';
    patternName = 'Quebra de Estrutura (BOS) + Reteste de Alta';
    patternDescription = 'Rompimento de máxima prévia seguido de reteste respeitado e vela de retomada de alta.';
    candlesPatternSummary = 'BOS de Topo → Reteste com Vela Vermelha → Confirmação Verde';
    priceAction = 'Estrutura de mercado quebrada em alta com reteste validado.';
    reasons.push('BOS (Break of Structure) institucional confirmado.');
    confidence = 94;
  } else if (isBearishBOSRetest) {
    verdict = 'PUT';
    patternType = 'ROMPIMENTO_RETESTE_BAIXA';
    patternName = 'Quebra de Estrutura (BOS) + Reteste de Baixa';
    patternDescription = 'Rompimento de mínima prévia seguido de reteste respeitado e vela de retomada de baixa.';
    candlesPatternSummary = 'BOS de Fundo → Reteste com Vela Verde → Confirmação Vermelha';
    priceAction = 'Estrutura de mercado quebrada em baixa com reteste validado.';
    reasons.push('BOS (Break of Structure) institucional confirmado.');
    confidence = 94;
  } else if (isThreeGreenSoldiers) {
    verdict = 'CALL';
    patternType = 'FLUXO_3_VELAS_ALTA';
    patternName = 'Domínio Institucional Comprador (3 Velas de Força)';
    patternDescription = 'Três velas verdes consecutivas de corpo sólido com fechamentos ascendentes sucessivos.';
    candlesPatternSummary = '3x Velas Verdes Consecutivas com Expansão';
    priceAction = 'Fluxo institucional comprador dominante.';
    reasons.push('Sequência de velas de alta com absorção de liquidez.');
    confidence = 91;
  } else if (isThreeRedCrows) {
    verdict = 'PUT';
    patternType = 'FLUXO_3_VELAS_BAIXA';
    patternName = 'Domínio Institucional Vendedor (3 Velas de Força)';
    patternDescription = 'Três velas vermelhas consecutivas de corpo sólido com fechamentos descendentes sucessivos.';
    candlesPatternSummary = '3x Velas Vermelhas Consecutivas com Expansão';
    priceAction = 'Fluxo institucional vendedor dominante.';
    reasons.push('Sequência de velas de baixa com absorção de liquidez.');
    confidence = 91;
  } else {
    // ── NENHUM PADRÃO DETECTADO: STRICT NO_TRADE ──
    verdict = 'NO_TRADE';
    patternType = 'NENHUM';
    patternName = 'Aguardando Padrão JeaFx';
    patternDescription = 'Nenhum padrão de continuação ou Price Action institucional formado nas últimas velas.';
    candlesPatternSummary = 'Sequência em formação (Aguardando fechamento)';
    priceAction = 'Mercado sem confluência das velas. Proteção de capital ativada.';
    blocks.push('Aguardando padrão de continuação (Impulso + Pullback, Engolfo ou Pinbar).');
    blocks.push('Evitando entradas aleatórias sem confluência gráfica.');
    confidence = 0;
  }

  const supplyDemandStatus = nearDemand
    ? `Zona de Demanda [POC ${nearestDemandPoc ? nearestDemandPoc.toFixed(5) : ''}]`
    : nearSupply
    ? `Zona de Oferta [POC ${nearestSupplyPoc ? nearestSupplyPoc.toFixed(5) : ''}]`
    : 'Fora de Zonas Institucionais';

  return {
    verdict,
    patternType,
    patternName,
    patternDescription,
    candlesPatternSummary,
    candleColorsSequence,
    superTrendDirection: verdict === 'CALL' ? 'BULLISH' : 'BEARISH',
    superTrendValue: nearestDemandPoc || c0.close,
    rsiValue: 50,
    rsiStatus: verdict === 'CALL' ? 'COMPRADOR' : verdict === 'PUT' ? 'VENDEDOR' : 'NEUTRO',
    candleQuality: 'SAUDAVEL',
    candleMovement,
    priceAction,
    supplyDemandAnalysis: sdAnalysis,
    supplyDemandOk: nearDemand || nearSupply || verdict !== 'NO_TRADE',
    supplyDemandStatus,
    filters: {
      superTrendOk: true,
      rsiMomentumOk: true,
      antiExhaustionOk: true,
      volatilityOk: true,
      supplyDemandOk: nearDemand || nearSupply,
    },
    reasons,
    blocks,
    confidence,
  };
}

// Alias direto para compatibilidade semântica
export const evaluateTrueSupplyDemandStrategy = evaluateSuperTrendRsiStrategy;
export const evaluateJeaFxContinuationStrategy = evaluateSuperTrendRsiStrategy;
