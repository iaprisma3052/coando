/**
 * QUOTEXHACK ALGO ENGINE — M1 Flow & Wick Rejection Strategy
 *
 * Baseado na metodologia QUOTEXHACK / QX Pro Bots:
 * 1. Gatilho de Virada de Vela :58s - :59s (Entrada na abertura da vela de 1M)
 * 2. Rejeição de Pavio (Wick Rejection) em Zonas de Suporte/Resistência / Bandas
 * 3. Identificação de Padrões de Reversão / Engolfo M1 com confirmação de Médias
 * 4. Gestão Automatizada com Martingale Inteligente (MG1 / MG2) e Soros
 */

import type { Candle, AnalystVerdict } from '@/types';
import { calcEMA, calcRSI, calcBollingerBands } from './chinese-bot-engine';

export interface QuotexHackResult {
  verdict: 'CALL' | 'PUT' | 'NO_TRADE';
  verdictWord: 'CALL' | 'PUT' | 'NO TRADE';
  verdictSub: 'COMPRA (ALTA)' | 'VENDA (BAIXA)' | 'SEM ENTRADA (NEUTRO)';
  confidencePct: number;
  confidenceLevel: 'HIGH' | 'MED' | 'LOW';
  wickRejection: {
    hasRejection: boolean;
    type: 'bull_wick' | 'bear_wick' | 'none';
    ratio: number;
    description: string;
  };
  flowTrend: {
    direction: 'call' | 'put' | 'neutral';
    strength: number;
    description: string;
  };
  levelReversal: {
    triggered: boolean;
    zone: 'support' | 'resistance' | 'mid' | 'none';
    levelType?: string;
    priceLevel: number;
  };
  triggerTiming: {
    idealSecond: number; // 58 or 59
    timeframe: string;
    action: string;
    entryAt?: string;
  };
  martingalePlan: {
    mg1Multiplier: number;
    mg2Multiplier: number;
    recommended: boolean;
    recommendedMG?: string;
    multiplier?: number;
  };
  analysts: AnalystVerdict[];
  reasons: string[];
  blocks: string[];
  signalReady: boolean;
}

export function evaluateQuotexHack(candles: Candle[], timeframe = '1M'): QuotexHackResult {
  if (!candles || candles.length < 8) {
    return {
      verdict: 'NO_TRADE',
      verdictWord: 'NO TRADE',
      verdictSub: 'SEM ENTRADA (NEUTRO)',
      confidencePct: 50,
      confidenceLevel: 'LOW',
      wickRejection: {
        hasRejection: false,
        type: 'none',
        ratio: 0,
        description: 'Aguardando velas suficientes',
      },
      flowTrend: {
        direction: 'neutral',
        strength: 50,
        description: 'Fluxo em sincronização',
      },
      levelReversal: {
        triggered: false,
        zone: 'none',
        priceLevel: 1.0,
      },
      triggerTiming: {
        idealSecond: 58,
        timeframe,
        action: 'Aguardando próximo ciclo :58s',
      },
      martingalePlan: {
        mg1Multiplier: 2.2,
        mg2Multiplier: 4.8,
        recommended: true,
      },
      analysts: [],
      reasons: ['Aguardando histórico M1 da corretora'],
      blocks: ['Poucas velas carregadas'],
      signalReady: false,
    };
  }

  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const prev2 = candles[candles.length - 3] ?? prev;

  const lastPrice = last.close;

  // 1. Pavio e Rejeição (Wick Rejection) na vela anterior e atual
  const candleRange = Math.max(0.00001, prev.high - prev.low);
  const bodySize = Math.abs(prev.close - prev.open);
  const topWick = prev.high - Math.max(prev.open, prev.close);
  const bottomWick = Math.min(prev.open, prev.close) - prev.low;

  const topWickRatio = Number((topWick / candleRange).toFixed(2));
  const bottomWickRatio = Number((bottomWick / candleRange).toFixed(2));

  let wickType: 'bull_wick' | 'bear_wick' | 'none' = 'none';
  let wickRatio = 0;
  let wickDesc = 'Sem rejeição expressiva de pavio';

  if (bottomWickRatio >= 0.40 && bottomWick > bodySize) {
    wickType = 'bull_wick';
    wickRatio = bottomWickRatio;
    wickDesc = `Forte rejeição inferior (${(bottomWickRatio * 100).toFixed(0)}% de pavio) indicando defesa de compradores`;
  } else if (topWickRatio >= 0.40 && topWick > bodySize) {
    wickType = 'bear_wick';
    wickRatio = topWickRatio;
    wickDesc = `Forte rejeição superior (${(topWickRatio * 100).toFixed(0)}% de pavio) indicando defesa de vendedores`;
  }

  // 2. Análise de Suporte & Resistência Dinâmico (Bollinger Bands + Mínimas/Máximas Recentes)
  const bb = calcBollingerBands(closes, 20, 2);
  const recentHigh = Math.max(...candles.slice(-15).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-15).map((c) => c.low));

  let zone: 'support' | 'resistance' | 'mid' | 'none' = 'none';
  let zonePrice = lastPrice;

  const distToLower = Math.abs(lastPrice - bb.lower);
  const distToUpper = Math.abs(lastPrice - bb.upper);
  const distToRecentLow = Math.abs(lastPrice - recentLow);
  const distToRecentHigh = Math.abs(lastPrice - recentHigh);

  if (lastPrice <= bb.lower * 1.0005 || distToRecentLow <= (recentHigh - recentLow) * 0.08) {
    zone = 'support';
    zonePrice = Math.min(bb.lower, recentLow);
  } else if (lastPrice >= bb.upper * 0.9995 || distToRecentHigh <= (recentHigh - recentLow) * 0.08) {
    zone = 'resistance';
    zonePrice = Math.max(bb.upper, recentHigh);
  } else {
    zone = 'mid';
  }

  // 3. Indicadores de Fluxo e Médias Rápidas (EMA 9 e EMA 21)
  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const e9 = !isNaN(ema9Arr[ema9Arr.length - 1]) ? ema9Arr[ema9Arr.length - 1] : lastPrice;
  const e21 = !isNaN(ema21Arr[ema21Arr.length - 1]) ? ema21Arr[ema21Arr.length - 1] : lastPrice;
  const rsi = calcRSI(closes, 14);

  let flowDir: 'call' | 'put' | 'neutral' = 'neutral';
  let flowStrength = 50;
  let flowDesc = 'Fluxo equilibrado';

  if (e9 > e21 && rsi >= 50) {
    flowDir = 'call';
    flowStrength = Math.min(95, Math.round(75 + (rsi - 50) * 0.8));
    flowDesc = `Tendência de alta QUOTEXHACK com EMA9 > EMA21 e RSI (${rsi.toFixed(1)}) favorável`;
  } else if (e9 < e21 && rsi <= 50) {
    flowDir = 'put';
    flowStrength = Math.min(95, Math.round(75 + (50 - rsi) * 0.8));
    flowDesc = `Tendência de baixa QUOTEXHACK com EMA9 < EMA21 e RSI (${rsi.toFixed(1)}) favorável`;
  } else {
    flowDir = 'neutral';
    flowStrength = 50;
    flowDesc = 'Médias em cruzamento lateral';
  }

  // 4. Confluência QUOTEXHACK:
  // Condição CALL:
  // - Rejeição inferior de suporte (bull_wick) OU fluxo de rompimento de alta confirmado (EMA9 > EMA21 + RSI > 52 + Engolfo)
  // Condição PUT:
  // - Rejeição superior de resistência (bear_wick) OU fluxo de rompimento de baixa confirmado (EMA9 < EMA21 + RSI < 48 + Engolfo)

  const isBullEngulf = prev.close > prev.open && prev2.close < prev2.open && prev.close > prev2.open;
  const isBearEngulf = prev.close < prev.open && prev2.close > prev2.open && prev.close < prev2.open;

  const reasons: string[] = [];
  const blocks: string[] = [];

  let verdict: 'CALL' | 'PUT' | 'NO_TRADE' = 'NO_TRADE';
  let verdictWord: 'CALL' | 'PUT' | 'NO TRADE' = 'NO TRADE';
  let verdictSub: 'COMPRA (ALTA)' | 'VENDA (BAIXA)' | 'SEM ENTRADA (NEUTRO)' = 'SEM ENTRADA (NEUTRO)';
  let confidencePct = 50;

  const callReversalTrigger = (wickType === 'bull_wick' && (zone === 'support' || lastPrice <= e21));
  const callTrendTrigger = (flowDir === 'call' && (isBullEngulf || lastPrice > e9) && rsi > 52);

  const putReversalTrigger = (wickType === 'bear_wick' && (zone === 'resistance' || lastPrice >= e21));
  const putTrendTrigger = (flowDir === 'put' && (isBearEngulf || lastPrice < e9) && rsi < 48);

  if (callReversalTrigger || callTrendTrigger) {
    verdict = 'CALL';
    verdictWord = 'CALL';
    verdictSub = 'COMPRA (ALTA)';
    confidencePct = callReversalTrigger && callTrendTrigger ? 96 : callReversalTrigger ? 91 : 88;

    reasons.push('QUOTEXHACK: Gatilho de compra programado para o segundo :58s na virada de vela M1.');
    if (callReversalTrigger) {
      reasons.push(`Rejeição de Pavio de Compra: ${wickDesc} em região de suporte.`);
    }
    if (callTrendTrigger) {
      reasons.push(`Alinhamento de Médias: EMA 9 acima da EMA 21 sustentando fluxo de alta.`);
    }
    reasons.push('Gerenciamento recomendado: Entrada direta com recuperação automática em MG1 (2.2x).');
  } else if (putReversalTrigger || putTrendTrigger) {
    verdict = 'PUT';
    verdictWord = 'PUT';
    verdictSub = 'VENDA (BAIXA)';
    confidencePct = putReversalTrigger && putTrendTrigger ? 96 : putReversalTrigger ? 91 : 88;

    reasons.push('QUOTEXHACK: Gatilho de venda programado para o segundo :58s na virada de vela M1.');
    if (putReversalTrigger) {
      reasons.push(`Rejeição de Pavio de Venda: ${wickDesc} em região de resistência.`);
    }
    if (putTrendTrigger) {
      reasons.push(`Alinhamento de Médias: EMA 9 abaixo da EMA 21 sustentando fluxo de baixa.`);
    }
    reasons.push('Gerenciamento recomendado: Entrada direta com recuperação automática em MG1 (2.2x).');
  } else {
    verdict = 'NO_TRADE';
    verdictWord = 'NO TRADE';
    verdictSub = 'SEM ENTRADA (NEUTRO)';
    confidencePct = 50;

    blocks.push('Sem rejeição de pavio ou fluxo direcional claro no segundo atual.');
    blocks.push('QUOTEXHACK Filtro Anti-Loss: Aguardando padrão de alta probabilidade.');
  }

  const confidenceLevel = confidencePct >= 88 ? 'HIGH' : confidencePct >= 70 ? 'MED' : 'LOW';

  // 3-Analyst cards for UI
  const analysts: AnalystVerdict[] = [
    {
      name: 'QX Filtro 1: Gatilho de Virada :58s / :00s',
      icon: '⏱️',
      direction: verdict === 'CALL' ? 'call' : verdict === 'PUT' ? 'put' : 'hold',
      confidence: confidencePct,
      opinion: verdict !== 'NO_TRADE' ? `Timing exato na virada de vela M1 (${verdictWord})` : 'Aguardando fechamento da vela M1',
    },
    {
      name: 'QX Filtro 2: Rejeição de Pavio & Suporte/Resistência',
      icon: '🎯',
      direction: wickType === 'bull_wick' ? 'call' : wickType === 'bear_wick' ? 'put' : zone === 'support' ? 'call' : zone === 'resistance' ? 'put' : 'hold',
      confidence: wickType !== 'none' ? 92 : 70,
      opinion: wickDesc,
    },
    {
      name: 'QX Filtro 3: Fluxo EMA 9/21 & Gestão MG',
      icon: '⚡',
      direction: flowDir === 'call' ? 'call' : flowDir === 'put' ? 'put' : 'hold',
      confidence: flowStrength,
      opinion: flowDesc,
    },
  ];

  return {
    verdict,
    verdictWord,
    verdictSub,
    confidencePct,
    confidenceLevel,
    wickRejection: {
      hasRejection: wickType !== 'none',
      type: wickType,
      ratio: wickRatio,
      description: wickDesc,
    },
    flowTrend: {
      direction: flowDir,
      strength: flowStrength,
      description: flowDesc,
    },
    levelReversal: {
      triggered: zone === 'support' || zone === 'resistance',
      zone,
      priceLevel: zonePrice,
    },
    triggerTiming: {
      idealSecond: 58,
      timeframe,
      action: 'Disparo de ordem aos :58s / :59s para abertura exata :00s',
      entryAt: 'Entrada aos :58s (Vela :00s)',
    },
    martingalePlan: {
      mg1Multiplier: 2.2,
      mg2Multiplier: 4.8,
      recommended: true,
      recommendedMG: '1 Martingale (MG1)',
      multiplier: 2.2,
    },
    analysts,
    reasons,
    blocks,
    signalReady: verdict !== 'NO_TRADE',
  };
}
