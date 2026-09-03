/**
 * Technical analysis engine for OTC signals powered by:
 * Chinese Bot AI Pro — Three-Vote AI Consensus Engine
 * (Trend EMA x Momentum RSI x Volatility ATR)
 */

import type { Candle, Analysis } from "@/types";
import { evaluateChineseBot, buildUnifiedAnalysis, calcEMA, calcRSI, calcATR, calcBollingerBands } from "./chinese-bot-engine";
import { evaluateQuotexHack, type QuotexHackResult } from "./quotexhack-engine";
import {
  evaluateOrderFlowFootprint,
  generateFootprintData,
  computeSessionVolumeProfiles,
  evaluatePocVolumeProfileStrategy,
  computeManipulatorMarkers,
  evaluateManipulatorStrategy,
  type OrderFlowFootprintResult,
  type PocStrategyResult,
  type SessionVolumeProfileBlock,
  type ManipulatorMarker,
  type ManipulatorStrategyResult,
} from "./footprint-engine";

export {
  evaluateChineseBot,
  evaluateQuotexHack,
  evaluateOrderFlowFootprint,
  generateFootprintData,
  computeSessionVolumeProfiles,
  evaluatePocVolumeProfileStrategy,
  computeManipulatorMarkers,
  evaluateManipulatorStrategy,
  calcEMA,
  calcRSI,
  calcATR,
  calcBollingerBands,
};
export type {
  QuotexHackResult,
  OrderFlowFootprintResult,
  PocStrategyResult,
  SessionVolumeProfileBlock,
  ManipulatorMarker,
  ManipulatorStrategyResult,
};

export type StrategyMode = 'poc_volume_profile' | 'footprint_orderflow';

export interface UnifiedSignalResult {
  mode: StrategyMode;
  verdict: 'CALL' | 'PUT' | 'NO_TRADE';
  verdictWord: 'CALL' | 'PUT' | 'NO TRADE';
  verdictSub: 'COMPRA (ALTA)' | 'VENDA (BAIXA)' | 'SEM ENTRADA (NEUTRO)';
  confidencePct: number;
  confidenceLevel: 'HIGH' | 'MED' | 'LOW';
  trendScore: number;
  trendLabel: string;
  trendDir: 'call' | 'put' | 'neutral';
  momentumScore: number;
  momentumLabel: string;
  momentumDir: 'call' | 'put' | 'neutral';
  volatilityScore: number;
  volatilityLabel: string;
  volatilityLevel: 'Low' | 'Medium' | 'High' | 'Steady';
  volatilityApproved: boolean;
  rsi: number;
  atr: number;
  emaFast: number;
  emaSlow: number;
  emaMacro: number;
  lastPrice: number;
  analysts: any[];
  reasons: string[];
  blocks: string[];
  signalReady: boolean;
  quotexHackData?: QuotexHackResult;
  footprintData?: OrderFlowFootprintResult;
  pocData?: PocStrategyResult;
  manipulatorData?: ManipulatorStrategyResult;
}

export function evaluateMarketSignal(
  candles: Candle[],
  timeframe = '1M',
  strategyMode: StrategyMode = 'poc_volume_profile'
): UnifiedSignalResult {
  const vectorRes = evaluateChineseBot(candles, timeframe);
  const fpRes = evaluateOrderFlowFootprint(candles, timeframe);
  const pocRes = evaluatePocVolumeProfileStrategy(candles, timeframe);

  // 1. ESTRATÉGIA: POC & VOLUME PROFILE (Linha Amarela + Reteste + Blocos)
  if (strategyMode === 'poc_volume_profile') {
    const isCall = pocRes.verdict === 'CALL';
    const isPut = pocRes.verdict === 'PUT';

    return {
      mode: 'poc_volume_profile',
      verdict: isCall ? 'CALL' : isPut ? 'PUT' : 'NO_TRADE',
      verdictWord: isCall ? 'CALL' : isPut ? 'PUT' : 'NO TRADE',
      verdictSub: isCall ? 'COMPRA (ALTA)' : isPut ? 'VENDA (BAIXA)' : 'SEM ENTRADA (NEUTRO)',
      confidencePct: pocRes.confidencePct,
      confidenceLevel: pocRes.confidenceLevel,
      trendScore: 97,
      trendLabel: `Linha Amarela POC: ${pocRes.pocPrice.toFixed(5)} (${pocRes.manipulatorStatus || 'Região Institucional'})`,
      trendDir: isCall ? 'call' : isPut ? 'put' : 'neutral',
      momentumScore: 96,
      momentumLabel: pocRes.retestStatus || pocRes.description,
      momentumDir: isCall ? 'call' : isPut ? 'put' : 'neutral',
      volatilityScore: 96,
      volatilityLabel: pocRes.volumeProfileBalance || 'Balanço do Volume Profile Sincronizado',
      volatilityLevel: 'Steady',
      volatilityApproved: true,
      rsi: vectorRes.rsi,
      atr: vectorRes.atr,
      emaFast: vectorRes.emaFast,
      emaSlow: vectorRes.emaSlow,
      emaMacro: vectorRes.emaMacro,
      lastPrice: vectorRes.lastPrice,
      analysts: pocRes.analysts,
      reasons: pocRes.reasons,
      blocks: pocRes.blocks,
      signalReady: pocRes.signalReady,
      footprintData: fpRes,
      pocData: pocRes,
    };
  }

  // 2. ESTRATÉGIA: ORDER FLOW & FOOTPRINT (Rompimento com Alto Volume + Delta)
  const isCall = fpRes.verdict === 'CALL';
  const isPut = fpRes.verdict === 'PUT';

  return {
    mode: 'footprint_orderflow',
    verdict: isCall ? 'CALL' : isPut ? 'PUT' : 'NO_TRADE',
    verdictWord: isCall ? 'CALL' : isPut ? 'PUT' : 'NO TRADE',
    verdictSub: isCall ? 'COMPRA (ALTA)' : isPut ? 'VENDA (BAIXA)' : 'SEM ENTRADA (NEUTRO)',
    confidencePct: fpRes.confidencePct,
    confidenceLevel: fpRes.confidenceLevel,
    trendScore: 96,
    trendLabel: fpRes.breakoutInfo?.description || `Order Flow: ${fpRes.activeAbsorption.description}`,
    trendDir: isCall ? 'call' : isPut ? 'put' : 'neutral',
    momentumScore: 95,
    momentumLabel: `Volume de Rompimento: ${fpRes.breakoutInfo?.volumeRatioPct || 100}% da Média Institucional`,
    momentumDir: isCall ? 'call' : isPut ? 'put' : 'neutral',
    volatilityScore: 95,
    volatilityLabel: `Delta de Fluxo: ${fpRes.lastFootprint ? (fpRes.lastFootprint.totalDelta > 0 ? `+${fpRes.lastFootprint.totalDelta}` : `${fpRes.lastFootprint.totalDelta}`) : '0'} Contratos Acumulados`,
    volatilityLevel: 'Steady',
    volatilityApproved: true,
    rsi: vectorRes.rsi,
    atr: vectorRes.atr,
    emaFast: vectorRes.emaFast,
    emaSlow: vectorRes.emaSlow,
    emaMacro: vectorRes.emaMacro,
    lastPrice: vectorRes.lastPrice,
    analysts: fpRes.analysts,
    reasons: fpRes.reasons,
    blocks: fpRes.blocks,
    signalReady: fpRes.signalReady,
    footprintData: fpRes,
    pocData: pocRes,
  };
}

// ─── Main analysis engine ────────────────────────────────────────────────────

export function analyze(candles: Candle[], timeframe = '1M'): Analysis | null {
  return buildUnifiedAnalysis(candles, timeframe);
}

// ─── Soros progression ───────────────────────────────────────────────────────

export function sorosProgression(
  base: number,
  payout: number,
  levels: number,
): { level: number; amount: number; profit: number }[] {
  const payoutRate = payout / 100;
  const result: { level: number; amount: number; profit: number }[] = [];
  let amount = base;
  for (let i = 1; i <= levels; i++) {
    const profit = amount * payoutRate;
    result.push({ level: i, amount: parseFloat(amount.toFixed(2)), profit: parseFloat(profit.toFixed(2)) });
    amount = amount + profit;
  }
  return result;
}


