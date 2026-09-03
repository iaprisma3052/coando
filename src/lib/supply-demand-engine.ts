import type { Candle } from '@/types';

export interface SupplyDemandZone {
  id: string;
  type: 'SUPPLY' | 'DEMAND';
  topPrice: number;
  bottomPrice: number;
  pocPrice: number; // Point of Control (ponto central de maior liquidez institucional)
  startTime: number;
  startIdx: number;
  endTime?: number;
  strength: 'FORTE' | 'MODERADA' | 'TESTADA';
  testedCount: number;
  isMitigated: boolean; // se foi rompida pelo fechamento de vela
  statusText: string;
}

export interface SupplyDemandAnalysis {
  supplyZones: SupplyDemandZone[];
  demandZones: SupplyDemandZone[];
  activeSupplyZones: SupplyDemandZone[];
  activeDemandZones: SupplyDemandZone[];
  nearestSupply: SupplyDemandZone | null;
  nearestDemand: SupplyDemandZone | null;
  inSupplyZone: boolean;
  inDemandZone: boolean;
  bouncedSupply: boolean;
  bouncedDemand: boolean;
  distToSupplyPips: number;
  distToDemandPips: number;
  summary: string;
}

/**
 * Identifica as Verdadeiras Zonas de Oferta e Demanda (True Supply & Demand Levels)
 * com Point of Control (POC) baseado em desbalanceamento institucional e pivôs de volume.
 */
export function calculateTrueSupplyDemandZones(
  candles: Candle[],
  lookback = 45,
  pipMultiplier = 10000
): SupplyDemandAnalysis {
  if (!candles || candles.length < 10) {
    return {
      supplyZones: [],
      demandZones: [],
      activeSupplyZones: [],
      activeDemandZones: [],
      nearestSupply: null,
      nearestDemand: null,
      inSupplyZone: false,
      inDemandZone: false,
      bouncedSupply: false,
      bouncedDemand: false,
      distToSupplyPips: 9999,
      distToDemandPips: 9999,
      summary: 'Aguardando histórico suficiente para mapeamento de zonas...',
    };
  }

  const subset = candles.slice(-lookback);
  const offset = candles.length - subset.length;
  const rawSupply: SupplyDemandZone[] = [];
  const rawDemand: SupplyDemandZone[] = [];

  // Média de tamanho do corpo para identificar desbalanceamento (velas de ignição institucional)
  let totalBody = 0;
  for (const c of subset) {
    totalBody += Math.abs(c.close - c.open);
  }
  const avgBody = totalBody / subset.length || 0.0001;

  // 1. Detecção de Pivôs e Padrões Rally-Base-Drop (Supply) e Drop-Base-Rally (Demand)
  for (let i = 2; i < subset.length - 2; i++) {
    const prev2 = subset[i - 2];
    const prev1 = subset[i - 1];
    const curr = subset[i];
    const next1 = subset[i + 1];
    const next2 = subset[i + 2];

    const currHigh = curr.high;
    const currLow = curr.low;

    // Detecção de Supply Zone (Resistência Institucional / Topo com Forte Rejeição)
    const isPivotHigh =
      currHigh > prev1.high &&
      currHigh > prev2.high &&
      currHigh > next1.high &&
      currHigh > next2.high;

    // Ou vela de base anterior a uma grande vela vermelha de queda (Rally-Base-Drop)
    const nextDrop = (next1.close < next1.open && (next1.open - next1.close) > avgBody * 1.1) ||
                     (next2.close < next2.open && (next2.open - next2.close) > avgBody * 1.1);

    if (isPivotHigh || (curr.close > curr.open && nextDrop)) {
      const topPrice = currHigh;
      // Limite inferior: máximo entre a abertura e fechamento da vela de base
      const bottomPrice = Math.max(curr.open, curr.close) - (currHigh - Math.max(curr.open, curr.close)) * 0.2;
      const pocPrice = (topPrice + bottomPrice) / 2;

      rawSupply.push({
        id: `supply_${curr.time}_${i}`,
        type: 'SUPPLY',
        topPrice: Math.max(topPrice, bottomPrice + 0.00005),
        bottomPrice,
        pocPrice,
        startTime: curr.time,
        startIdx: offset + i,
        strength: nextDrop ? 'FORTE' : 'MODERADA',
        testedCount: 0,
        isMitigated: false,
        statusText: 'Zona de Oferta Institucional (Venda)',
      });
    }

    // Detecção de Demand Zone (Suporte Institucional / Fundo com Forte Rejeição)
    const isPivotLow =
      currLow < prev1.low &&
      currLow < prev2.low &&
      currLow < next1.low &&
      currLow < next2.low;

    // Ou vela de base anterior a uma grande vela verde de alta (Drop-Base-Rally)
    const nextRally = (next1.close > next1.open && (next1.close - next1.open) > avgBody * 1.1) ||
                      (next2.close > next2.open && (next2.close - next2.open) > avgBody * 1.1);

    if (isPivotLow || (curr.close < curr.open && nextRally)) {
      const bottomPrice = currLow;
      // Limite superior: mínimo entre a abertura e fechamento da vela de base
      const topPrice = Math.min(curr.open, curr.close) + (Math.min(curr.open, curr.close) - currLow) * 0.2;
      const pocPrice = (topPrice + bottomPrice) / 2;

      rawDemand.push({
        id: `demand_${curr.time}_${i}`,
        type: 'DEMAND',
        topPrice,
        bottomPrice: Math.min(bottomPrice, topPrice - 0.00005),
        pocPrice,
        startTime: curr.time,
        startIdx: offset + i,
        strength: nextRally ? 'FORTE' : 'MODERADA',
        testedCount: 0,
        isMitigated: false,
        statusText: 'Zona de Demanda Institucional (Compra)',
      });
    }
  }

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle ? lastCandle.close : 0;

  // 2. Verificar retestes e mitigação das zonas pelas velas subsequentes
  const processZones = (zones: SupplyDemandZone[], isSupply: boolean): SupplyDemandZone[] => {
    return zones.map((zone) => {
      let tests = 0;
      let mitigated = false;

      for (let k = zone.startIdx + 1; k < candles.length; k++) {
        const c = candles[k];
        if (isSupply) {
          // Preço entrou na zona de oferta
          if (c.high >= zone.bottomPrice && c.low <= zone.topPrice) {
            tests++;
          }
          // Rompimento completo: fechamento acima do topo da zona
          if (c.close > zone.topPrice) {
            mitigated = true;
          }
        } else {
          // Preço entrou na zona de demanda
          if (c.low <= zone.topPrice && c.high >= zone.bottomPrice) {
            tests++;
          }
          // Rompimento completo: fechamento abaixo do fundo da zona
          if (c.close < zone.bottomPrice) {
            mitigated = true;
          }
        }
      }

      const updatedStrength: 'FORTE' | 'MODERADA' | 'TESTADA' =
        tests >= 2 ? 'TESTADA' : zone.strength;

      return {
        ...zone,
        testedCount: tests,
        isMitigated: mitigated,
        strength: updatedStrength,
      };
    });
  };

  const processedSupply = processZones(rawSupply, true);
  const processedDemand = processZones(rawDemand, false);

  // Filtrar apenas zonas ativas recentes (não mitigadas) mais próximas do preço
  const activeSupplyZones = processedSupply
    .filter((z) => !z.isMitigated && z.bottomPrice >= currentPrice * 0.99)
    .slice(-4);

  const activeDemandZones = processedDemand
    .filter((z) => !z.isMitigated && z.topPrice <= currentPrice * 1.01)
    .slice(-4);

  // Encontra a Supply e Demand ativas mais próximas do preço atual
  let nearestSupply: SupplyDemandZone | null = null;
  let minSupplyDist = Infinity;

  activeSupplyZones.forEach((sz) => {
    const dist = sz.bottomPrice - currentPrice;
    if (dist >= 0 && dist < minSupplyDist) {
      minSupplyDist = dist;
      nearestSupply = sz;
    }
  });

  let nearestDemand: SupplyDemandZone | null = null;
  let minDemandDist = Infinity;

  activeDemandZones.forEach((dz) => {
    const dist = currentPrice - dz.topPrice;
    if (dist >= 0 && dist < minDemandDist) {
      minDemandDist = dist;
      nearestDemand = dz;
    }
  });

  // Verifica se o preço na vela atual está dentro ou rejeitando as zonas
  let inSupplyZone = false;
  let bouncedSupply = false;

  if (nearestSupply) {
    const ns = nearestSupply as SupplyDemandZone;
    if (currentPrice >= ns.bottomPrice && currentPrice <= ns.topPrice) {
      inSupplyZone = true;
    }
    // Bateu no POC da oferta e recuou na vela atual
    if (lastCandle && lastCandle.high >= ns.pocPrice && lastCandle.close < lastCandle.open) {
      bouncedSupply = true;
    }
  }

  let inDemandZone = false;
  let bouncedDemand = false;

  if (nearestDemand) {
    const nd = nearestDemand as SupplyDemandZone;
    if (currentPrice <= nd.topPrice && currentPrice >= nd.bottomPrice) {
      inDemandZone = true;
    }
    // Bateu no POC da demanda e rejeitou para cima na vela atual
    if (lastCandle && lastCandle.low <= nd.pocPrice && lastCandle.close > lastCandle.open) {
      bouncedDemand = true;
    }
  }

  // Resumo analítico
  let summary = 'Preço operando em fluxo livre entre as zonas institucionais.';
  if (inDemandZone || bouncedDemand) {
    summary = `Preço testando Zona de Demanda Institucional com POC em ${nearestDemand?.pocPrice.toFixed(5)}. Forte pressão compradora!`;
  } else if (inSupplyZone || bouncedSupply) {
    summary = `Preço testando Zona de Oferta Institucional com POC em ${nearestSupply?.pocPrice.toFixed(5)}. Forte pressão vendedora!`;
  } else if (nearestDemand && nearestSupply) {
    summary = `Preço entre Demanda (${nearestDemand.pocPrice.toFixed(5)}) e Oferta (${nearestSupply.pocPrice.toFixed(5)}).`;
  }

  return {
    supplyZones: processedSupply,
    demandZones: processedDemand,
    activeSupplyZones,
    activeDemandZones,
    nearestSupply,
    nearestDemand,
    inSupplyZone,
    inDemandZone,
    bouncedSupply,
    bouncedDemand,
    distToSupplyPips: minSupplyDist !== Infinity ? minSupplyDist * pipMultiplier : 9999,
    distToDemandPips: minDemandDist !== Infinity ? minDemandDist * pipMultiplier : 9999,
    summary,
  };
}
