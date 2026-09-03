import type { Candle } from '@/types';

// ─── Tipos e Estruturas da Estratégia da Vela de Comando (Lógica do Preço) ───

export type CommandCandleDirection = 'ALTA' | 'BAIXA';
export type CommandCandleType =
  | 'COMANDO_ABERTO' // Sem pavio na abertura, com pavio no fechamento (deixou nova máxima/mínima)
  | 'COMANDO_FECHADO' // Sem pavio na abertura e sem pavio no fechamento (lote fechado / marubozu)
  | 'COMANDO_EXPIRADO'; // Fechou simétrico com comando anterior

export type PullbackStatus =
  | 'AGUARDANDO_PULLBACK' // Preço se afastou, aguardando primeiro retorno à linha de defesa
  | 'TESTANDO_PRIMEIRO_PULLBACK' // A vela atual está realizando o 1º Toque na linha de defesa!
  | 'PULLBACK_EXECUTADO' // 1º Toque já concluído e respeitado (zona mitigada/expirada)
  | 'ROMPIDO_INVALIDADO'; // Linha de defesa foi violada com fechamento além da taxa

export interface CommandCandle {
  id: string;
  index: number; // Índice no array de velas
  time: number;
  direction: CommandCandleDirection;
  type: CommandCandleType;
  openPrice: number; // TAXA DE DEFESA PRINCIPAL (Abertura sem pavio)
  closePrice: number;
  midPrice: number; // 50% do corpo da vela de comando (taxa intermediária)
  high: number;
  low: number;
  bodySize: number;
  openWickRatio: number; // Percentual de pavio na abertura (< 5% para ser comando puro)
  avgBodyMultiplier: number; // Quantas vezes maior que as velas médias recentes (ex: 1.8x)
  status: PullbackStatus;
  firstTouchCandleIndex?: number;
  isFirstPullbackValid: boolean; // Verdadeiro somente se nunca foi tocada antes
  candlesDistance: number; // Quantidade de velas decorridas desde a formação
  filterStatus: {
    noOpenWick: boolean; // Sem pavio na abertura
    strongBody: boolean; // Corpo institucional expressivo
    healthyDistance: boolean; // Preço não nasceu colado na taxa (mínimo 2 velas)
    unbrokenDefense: boolean; // Defesa nunca rompida antes
    isFirstTouchOnly: boolean; // Apenas o 1º toque
  };
}

export interface TrendLinePoint {
  index: number;
  time: number;
  price: number;
}

export interface TrendLine {
  id: string;
  type: 'LTA' | 'LTB';
  p1: TrendLinePoint;
  p2: TrendLinePoint;
  slope: number;
  currentProjectedPrice: number;
  color: string;
  label: string;
  touches: number;
  strength: number;
  style: 'solid' | 'dashed';
}

export type ScenarioType =
  | 'PRIMEIRO_PULLBACK_COMANDO_ALTA' // 1º Toque na Abertura de Comando de Alta -> COMPRA (CALL)
  | 'PRIMEIRO_PULLBACK_COMANDO_BAIXA' // 1º Toque na Abertura de Comando de Baixa -> VENDA (PUT)
  | 'AGUARDANDO_PRIMEIRO_PULLBACK' // Vela de Comando ativa identificada, esperando retorno do preço
  | 'PULLBACK_JA_EXECUTADO' // Zona de comando já foi tocada anteriormente (bloqueio de 2º toque)
  | 'FILTRO_RUIDO_BLOQUEADO' // Bloqueado por filtro de ruído (ex: vela colada ou corpo fraco)
  | 'CICLO_EM_MATURACAO' // Cooldown anti-spam (5 velas de maturação)
  | 'PROCURANDO_COMANDO'; // Procurando nova Vela de Comando institucional no gráfico

export type CandlestickPattern =
  | 'COMANDO_ABERTO_ALTA'
  | 'COMANDO_ABERTO_BAIXA'
  | 'COMANDO_FECHADO_ALTA'
  | 'COMANDO_FECHADO_BAIXA'
  | 'REJEICAO_PULLBACK_SUPORTE'
  | 'REJEICAO_PULLBACK_RESISTENCIA'
  | 'NENHUM';

export interface MarketCycleStatus {
  phase: 'AGUARDANDO_COMANDO' | 'COMANDO_ATIVO' | 'PRIMEIRO_PULLBACK' | 'CICLO_EM_MATURACAO';
  phaseLabel: string;
  flowDirection: 'ALTA' | 'BAIXA' | 'LATERAL';
  flowLabel: string;
  bullishCandlesCount: number;
  bearishCandlesCount: number;
  cycleMaturityPct: number;
  candlesSinceLastSignal: number;
  cycleRequiredCandles: number;
  isCycleActive: boolean;
  description: string;
}

export interface ZonasCenariosSignal {
  verdict: 'CALL' | 'PUT' | 'NO_TRADE';
  signalName: string;
  scenarioType: ScenarioType;
  candlePattern: CandlestickPattern;
  candlePatternName: string;
  wickRatio: number;
  confidence: number;
  reason: string;
  confluencePoints: string[];
  // Novos campos exclusivos da Estratégia Vela de Comando:
  activeCommandCandle: CommandCandle | null;
  allCommandCandles: CommandCandle[];
  defensePrice: number; // Preço exato da linha de defesa (abertura do comando)
  midDefensePrice: number; // Preço dos 50% do comando
  isFirstTouch: boolean;
  // Campos mantidos para compatibilidade retroativa com os componentes:
  fiboAnalysis: null;
  goldenRatioZone: null;
  trendLines: TrendLine[];
  activeZoneName: string;
  actionCandle: 'NASCIMENTO_00S' | 'RETESTE';
  cycleStatus?: MarketCycleStatus;
}

// ─── 1. Detector de Vela de Comando (Lógica do Preço com Filtros de Ruído) ───
export function detectCommandCandles(candles: Candle[]): CommandCandle[] {
  const n = candles.length;
  if (n < 10) return [];

  const commandCandles: CommandCandle[] = [];
  const lookback = Math.min(n, 60);
  const startIdx = n - lookback;

  // 1. Calcula o tamanho médio do corpo das velas no período para filtro de volume
  let totalBody = 0;
  let countBody = 0;
  for (let i = Math.max(0, startIdx - 10); i < n; i++) {
    const b = Math.abs(candles[i].close - candles[i].open);
    if (b > 0) {
      totalBody += b;
      countBody++;
    }
  }
  const avgBody = countBody > 0 ? totalBody / countBody : 0.0003;

  // 2. Varre o histórico identificando Velas de Comando
  for (let i = startIdx; i < n; i++) {
    const c = candles[i];
    const range = Math.max(0.00001, c.high - c.low);
    const body = Math.abs(c.close - c.open);
    const isGreen = c.close >= c.open;
    const isRed = c.close < c.open;

    // Métricas dos pavios
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Pavio na abertura:
    // Para vela verde de alta: pavio de abertura é o inferior (c.open - c.low)
    // Para vela vermelha de baixa: pavio de abertura é o superior (c.high - c.open)
    const openWick = isGreen ? lowerWick : upperWick;
    const closeWick = isGreen ? upperWick : lowerWick;
    const openWickRatio = openWick / range;

    // FILTRO 1: AUSÊNCIA DE PAVIO NA ABERTURA (Tolerância máxima de 5% do range)
    const hasNoOpenWick = openWickRatio <= 0.06;

    // FILTRO 2: CORPO INSTITUCIONAL EXPRESSIVO (Mínimo 1.35x o corpo médio das últimas velas)
    const isStrongBody = body >= avgBody * 1.35 && body >= 0.00012;

    if (hasNoOpenWick && isStrongBody) {
      // Tipo de comando:
      // Se não tem pavio no fechamento (< 6% do range): Comando Fechado / Expirado
      // Se deixou pavio no fechamento: Comando Aberto (deixou nova máxima/mínima)
      const closeWickRatio = closeWick / range;
      const isClosedCommand = closeWickRatio <= 0.06;
      const type: CommandCandleType = isClosedCommand ? 'COMANDO_FECHADO' : 'COMANDO_ABERTO';

      const openPrice = c.open;
      const closePrice = c.close;
      const midPrice = (openPrice + closePrice) / 2;
      const direction: CommandCandleDirection = isGreen ? 'ALTA' : 'BAIXA';

      // Avalia os toques nas velas posteriores (de i + 1 até n - 1)
      let touchesCount = 0;
      let firstTouchCandleIndex: number | undefined = undefined;
      let isBroken = false;
      const tolerance = Math.max(range * 0.08, 0.0001);

      for (let j = i + 1; j < n; j++) {
        const nextC = candles[j];

        if (direction === 'ALTA') {
          // Em comando de alta, a abertura é SUPORTE
          // Toque na região de defesa (abertura ou 50%):
          const touchedDefense = nextC.low <= openPrice + tolerance && nextC.high >= openPrice - tolerance;
          if (touchedDefense) {
            touchesCount++;
            if (firstTouchCandleIndex === undefined) {
              firstTouchCandleIndex = j;
            }
          }
          // Rompimento com fechamento sólido abaixo da abertura
          if (nextC.close < openPrice - tolerance * 1.5) {
            isBroken = true;
          }
        } else {
          // Em comando de baixa, a abertura é RESISTÊNCIA
          // Toque na região de defesa:
          const touchedDefense = nextC.high >= openPrice - tolerance && nextC.low <= openPrice + tolerance;
          if (touchedDefense) {
            touchesCount++;
            if (firstTouchCandleIndex === undefined) {
              firstTouchCandleIndex = j;
            }
          }
          // Rompimento com fechamento sólido acima da abertura
          if (nextC.close > openPrice + tolerance * 1.5) {
            isBroken = true;
          }
        }
      }

      // Distância de velas decorridas desde a formação
      const candlesDistance = n - 1 - i;

      let status: PullbackStatus = 'AGUARDANDO_PULLBACK';
      if (isBroken) {
        status = 'ROMPIDO_INVALIDADO';
      } else if (touchesCount === 0) {
        status = 'AGUARDANDO_PULLBACK';
      } else if (touchesCount === 1 && firstTouchCandleIndex === n - 1) {
        status = 'TESTANDO_PRIMEIRO_PULLBACK';
      } else {
        // Já teve 1 ou mais toques no passado
        status = 'PULLBACK_EXECUTADO';
      }

      // FILTRO 3: DISTÂNCIA MÍNIMA (Não operar vela que nasce colada)
      // O preço precisa ter tido pelo menos 1 ou 2 velas para respirar antes do pullback
      const hasHealthyDistance = candlesDistance >= 2;

      commandCandles.push({
        id: `cmd-${c.time}-${i}`,
        index: i,
        time: c.time,
        direction,
        type,
        openPrice,
        closePrice,
        midPrice,
        high: c.high,
        low: c.low,
        bodySize: body,
        openWickRatio: Math.round(openWickRatio * 100),
        avgBodyMultiplier: Number((body / avgBody).toFixed(2)),
        status,
        firstTouchCandleIndex,
        isFirstPullbackValid: touchesCount <= 1 && !isBroken,
        candlesDistance,
        filterStatus: {
          noOpenWick: hasNoOpenWick,
          strongBody: isStrongBody,
          healthyDistance: hasHealthyDistance,
          unbrokenDefense: !isBroken,
          isFirstTouchOnly: touchesCount <= 1,
        },
      });
    }
  }

  return commandCandles;
}

// ─── 2. Motor de Ciclo Operacional ──────────────────────────────────────────
export function detectMarketCycle(
  candles: Candle[],
  lastSignalTime: number = 0,
  cycleRequiredCandles: number = 5,
  activeCommand?: CommandCandle | null
): MarketCycleStatus {
  const n = candles.length;
  if (n < 10) {
    return {
      phase: 'AGUARDANDO_COMANDO',
      phaseLabel: 'INICIALIZANDO MOTOR',
      flowDirection: 'LATERAL',
      flowLabel: 'Sem Direção',
      bullishCandlesCount: 0,
      bearishCandlesCount: 0,
      cycleMaturityPct: 0,
      candlesSinceLastSignal: 99,
      cycleRequiredCandles,
      isCycleActive: false,
      description: 'Carregando velas de 1M para mapear Velas de Comando.',
    };
  }

  let candlesSinceLastSignal = 999;
  if (lastSignalTime > 0) {
    const lastSignalSeconds = lastSignalTime > 10000000000 ? Math.floor(lastSignalTime / 1000) : lastSignalTime;
    for (let i = n - 1; i >= 0; i--) {
      if (candles[i].time <= lastSignalSeconds) {
        candlesSinceLastSignal = n - 1 - i;
        break;
      }
    }
  }

  const isCycleActive = candlesSinceLastSignal < cycleRequiredCandles;
  const cycleMaturityPct = Math.min(100, Math.round((candlesSinceLastSignal / cycleRequiredCandles) * 100));

  let greenCount = 0;
  let redCount = 0;
  for (let i = Math.max(0, n - 8); i < n; i++) {
    if (candles[i].close >= candles[i].open) greenCount++;
    else redCount++;
  }

  const flowDir: 'ALTA' | 'BAIXA' | 'LATERAL' =
    greenCount >= redCount + 2 ? 'ALTA' : redCount >= greenCount + 2 ? 'BAIXA' : 'LATERAL';

  if (isCycleActive) {
    return {
      phase: 'CICLO_EM_MATURACAO',
      phaseLabel: `CICLO OPERACIONAL: ${candlesSinceLastSignal}/${cycleRequiredCandles} VELAS`,
      flowDirection: flowDir,
      flowLabel: flowDir === 'ALTA' ? 'Fluxo Comprador' : flowDir === 'BAIXA' ? 'Fluxo Vendedor' : 'Consolidado',
      bullishCandlesCount: greenCount,
      bearishCandlesCount: redCount,
      cycleMaturityPct,
      candlesSinceLastSignal,
      cycleRequiredCandles,
      isCycleActive: true,
      description: `Operação anterior em maturação (${candlesSinceLastSignal}/${cycleRequiredCandles} velas). Bloqueio anti-spam ativo para proteger a banca.`,
    };
  }

  if (activeCommand && activeCommand.status === 'TESTANDO_PRIMEIRO_PULLBACK') {
    return {
      phase: 'PRIMEIRO_PULLBACK',
      phaseLabel: 'PRIMEIRO PULLBACK EM ANDAMENTO',
      flowDirection: activeCommand.direction === 'ALTA' ? 'ALTA' : 'BAIXA',
      flowLabel: activeCommand.direction === 'ALTA' ? 'Pullback de Alta' : 'Pullback de Baixa',
      bullishCandlesCount: greenCount,
      bearishCandlesCount: redCount,
      cycleMaturityPct: 100,
      candlesSinceLastSignal,
      cycleRequiredCandles,
      isCycleActive: false,
      description: `A vela atual está testando a taxa de abertura da Vela de Comando (${activeCommand.openPrice.toFixed(5)}) pela primeira vez.`,
    };
  }

  if (activeCommand && activeCommand.status === 'AGUARDANDO_PULLBACK') {
    return {
      phase: 'COMANDO_ATIVO',
      phaseLabel: `VELA DE COMANDO ATIVA (${activeCommand.direction})`,
      flowDirection: activeCommand.direction === 'ALTA' ? 'ALTA' : 'BAIXA',
      flowLabel: activeCommand.direction === 'ALTA' ? 'Defesa Compradora' : 'Defesa Vendedora',
      bullishCandlesCount: greenCount,
      bearishCandlesCount: redCount,
      cycleMaturityPct: 100,
      candlesSinceLastSignal,
      cycleRequiredCandles,
      isCycleActive: false,
      description: `Aguardando preço retornar para o Primeiro Pullback na taxa ${activeCommand.openPrice.toFixed(5)}.`,
    };
  }

  return {
    phase: 'AGUARDANDO_COMANDO',
    phaseLabel: 'BUSCANDO VELA DE COMANDO',
    flowDirection: flowDir,
    flowLabel: flowDir === 'ALTA' ? 'Alta' : flowDir === 'BAIXA' ? 'Baixa' : 'Lateral',
    bullishCandlesCount: greenCount,
    bearishCandlesCount: redCount,
    cycleMaturityPct: 100,
    candlesSinceLastSignal,
    cycleRequiredCandles,
    isCycleActive: false,
    description: 'Monitorando candles para identificar nova Vela de Comando com ausência de pavio na abertura.',
  };
}

// ─── 3. Linhas de Tendência Auxiliares (LTA / LTB) ───────────────────────────
// Observação: Conforme pedido pelo usuário, LTA e LTB ficam apenas no gráfico para
// visualização estrutural e NÃO confluem para a decisão do sinal!
export function calculateAutoTrendLines(candles: Candle[]): TrendLine[] {
  const n = candles.length;
  if (n < 15) return [];

  const lookback = Math.min(n, 50);
  const startIndex = n - lookback;
  const subset = candles.slice(startIndex);

  interface Pivot {
    index: number;
    candle: Candle;
  }

  const swingLows: Pivot[] = [];
  const swingHighs: Pivot[] = [];
  const window = 2;

  for (let i = window; i < subset.length - window; i++) {
    const c = subset[i];
    let isLow = true;
    let isHigh = true;

    for (let j = 1; j <= window; j++) {
      if (subset[i - j].low <= c.low || subset[i + j].low < c.low) isLow = false;
      if (subset[i - j].high >= c.high || subset[i + j].high > c.high) isHigh = false;
    }

    if (isLow) swingLows.push({ index: startIndex + i, candle: c });
    if (isHigh) swingHighs.push({ index: startIndex + i, candle: c });
  }

  const trendLines: TrendLine[] = [];

  // LTA
  if (swingLows.length >= 2) {
    for (let a = swingLows.length - 2; a >= 0; a--) {
      const p1 = swingLows[a];
      const p2 = swingLows[swingLows.length - 1];

      if (p2.index > p1.index && p2.candle.low >= p1.candle.low - 0.00005) {
        const dx = p2.index - p1.index;
        const dy = p2.candle.low - p1.candle.low;
        const slope = dy / dx;
        const currentProjectedPrice = p2.candle.low + slope * (n - 1 - p2.index);

        trendLines.push({
          id: `lta-${p1.index}-${p2.index}`,
          type: 'LTA',
          p1: { index: p1.index, time: p1.candle.time, price: p1.candle.low },
          p2: { index: p2.index, time: p2.candle.time, price: p2.candle.low },
          slope,
          currentProjectedPrice,
          color: '#10b981',
          label: 'LTA SUPORTE DE FLUXO',
          touches: 2,
          strength: 4,
          style: 'solid',
        });
        break;
      }
    }
  }

  // LTB
  if (swingHighs.length >= 2) {
    for (let a = swingHighs.length - 2; a >= 0; a--) {
      const p1 = swingHighs[a];
      const p2 = swingHighs[swingHighs.length - 1];

      if (p2.index > p1.index && p2.candle.high <= p1.candle.high + 0.00005) {
        const dx = p2.index - p1.index;
        const dy = p2.candle.high - p1.candle.high;
        const slope = dy / dx;
        const currentProjectedPrice = p2.candle.high + slope * (n - 1 - p2.index);

        trendLines.push({
          id: `ltb-${p1.index}-${p2.index}`,
          type: 'LTB',
          p1: { index: p1.index, time: p1.candle.time, price: p1.candle.high },
          p2: { index: p2.index, time: p2.candle.time, price: p2.candle.high },
          slope,
          currentProjectedPrice,
          color: '#ef4444',
          label: 'LTB RESISTÊNCIA DE FLUXO',
          touches: 2,
          strength: 4,
          style: 'solid',
        });
        break;
      }
    }
  }

  return trendLines;
}

// ─── 4. Motor Central: VELA DE COMANDO + PRIMEIRO PULLBACK COM FILTROS DE LOSS ──
export function evaluateZonasCenariosStrategy(
  candles: Candle[],
  lastSignalTime: number = 0,
  cycleRequiredCandles: number = 5
): ZonasCenariosSignal {
  if (candles.length < 12) {
    return {
      verdict: 'NO_TRADE',
      signalName: 'AGUARDANDO HISTÓRICO MÍNIMO',
      scenarioType: 'PROCURANDO_COMANDO',
      candlePattern: 'NENHUM',
      candlePatternName: 'Carregando Velas',
      wickRatio: 0,
      confidence: 0,
      reason: 'Aguardando velas suficientes para mapear Velas de Comando institucionais.',
      confluencePoints: ['Mapeando candles M1'],
      activeCommandCandle: null,
      allCommandCandles: [],
      defensePrice: 0,
      midDefensePrice: 0,
      isFirstTouch: false,
      fiboAnalysis: null,
      goldenRatioZone: null,
      trendLines: [],
      activeZoneName: 'Calculando...',
      actionCandle: 'NASCIMENTO_00S',
    };
  }

  // 1. Detecta todas as Velas de Comando recentes no gráfico
  const commandCandles = detectCommandCandles(candles);

  // 2. Linhas de Tendência apenas visuais
  const trendLines = calculateAutoTrendLines(candles);

  // 3. Encontra a Vela de Comando válida mais recente que ainda pode ser operada
  // (Preferência para comando que ainda não sofreu rompimento)
  const activeCommand =
    commandCandles
      .slice()
      .reverse()
      .find((cmd) => cmd.filterStatus.unbrokenDefense && cmd.filterStatus.healthyDistance) ||
    (commandCandles.length > 0 ? commandCandles[commandCandles.length - 1] : null);

  // 4. Ciclo Operacional Anti-Spam (5 velas)
  const cycleStatus = detectMarketCycle(candles, lastSignalTime, cycleRequiredCandles, activeCommand);

  const n = candles.length;
  const lastCandle = candles[n - 1];
  const prevCandle = candles[n - 2];
  const lastRange = Math.max(0.00001, lastCandle.high - lastCandle.low);
  const lastBody = Math.abs(lastCandle.close - lastCandle.open);
  const lastUpperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lastLowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const lastUpperWickPct = (lastUpperWick / lastRange) * 100;
  const lastLowerWickPct = (lastLowerWick / lastRange) * 100;

  // Se estiver em ciclo de maturação (bloqueio vela a vela)
  if (cycleStatus.isCycleActive) {
    return {
      verdict: 'NO_TRADE',
      signalName: 'CICLO OPERACIONAL EM ANDAMENTO',
      scenarioType: 'CICLO_EM_MATURACAO',
      candlePattern: 'NENHUM',
      candlePatternName: 'Ciclo Ativo',
      wickRatio: 0,
      confidence: 0,
      reason: `Operação anterior em maturação (${cycleStatus.candlesSinceLastSignal}/${cycleRequiredCandles} velas). O robô bloqueia novas entradas consecutivas para proteger sua banca.`,
      confluencePoints: [
        `Ciclo de Maturação: ${cycleStatus.candlesSinceLastSignal}/${cycleRequiredCandles} velas concluídas`,
        'Bloqueio anti-spam ativado para preservar a gestão de risco',
        'Aguardando conclusão para novo 1º Pullback de Vela de Comando',
      ],
      activeCommandCandle: activeCommand,
      allCommandCandles: commandCandles,
      defensePrice: activeCommand ? activeCommand.openPrice : 0,
      midDefensePrice: activeCommand ? activeCommand.midPrice : 0,
      isFirstTouch: false,
      fiboAnalysis: null,
      goldenRatioZone: null,
      trendLines,
      activeZoneName: `CICLO ATIVO (${cycleStatus.candlesSinceLastSignal}/${cycleRequiredCandles} VELAS)`,
      actionCandle: 'NASCIMENTO_00S',
      cycleStatus,
    };
  }

  // Se nenhuma Vela de Comando foi encontrada
  if (!activeCommand) {
    return {
      verdict: 'NO_TRADE',
      signalName: 'BUSCANDO VELA DE COMANDO NO GRÁFICO',
      scenarioType: 'PROCURANDO_COMANDO',
      candlePattern: 'NENHUM',
      candlePatternName: 'Sem Comando Recente',
      wickRatio: 0,
      confidence: 15,
      reason: 'Nenhuma Vela de Comando institucional (sem pavio na abertura e corpo expressivo) foi identificada nas últimas 60 velas.',
      confluencePoints: [
        'Regra da Lógica do Preço: Exige ausência de pavio na abertura (<5%)',
        'Exige corpo de força institucional (>1.35x média)',
        'Aguardando formação de nova Vela de Comando',
      ],
      activeCommandCandle: null,
      allCommandCandles: [],
      defensePrice: 0,
      midDefensePrice: 0,
      isFirstTouch: false,
      fiboAnalysis: null,
      goldenRatioZone: null,
      trendLines,
      activeZoneName: 'BUSCANDO COMANDO',
      actionCandle: 'NASCIMENTO_00S',
      cycleStatus,
    };
  }

  const defensePrice = activeCommand.openPrice;
  const midPrice = activeCommand.midPrice;
  const tolerance = Math.max(activeCommand.bodySize * 0.12, 0.00012);

  // ─── ANÁLISE DE PULLBACK NA VELA DE COMANDO ATIVA ──────────────────────────
  // FILTRO ANTI-LOSS: O comando já teve o primeiro pullback executado no passado?
  if (activeCommand.status === 'PULLBACK_EXECUTADO') {
    return {
      verdict: 'NO_TRADE',
      signalName: 'PRIMEIRO PULLBACK JÁ EXECUTADO (EXPIRADO)',
      scenarioType: 'PULLBACK_JA_EXECUTADO',
      candlePattern: 'NENHUM',
      candlePatternName: 'Pullback Concluído Anteriormente',
      wickRatio: Math.round(Math.max(lastUpperWickPct, lastLowerWickPct)),
      confidence: 30,
      reason: `A Vela de Comando em ${defensePrice.toFixed(5)} já recebeu o Primeiro Pullback anteriormente. A Lógica do Preço determina que APENAS O PRIMEIRO PULLBACK é operável. O 2º toque foi descartado por segurança.`,
      confluencePoints: [
        `Vela de Comando em ${defensePrice.toFixed(5)} (${activeCommand.direction})`,
        'Regra de Ouro: Só operamos o Primeiro Pullback',
        'Região de defesa já mitigada pelo toque anterior',
        'Aguardando formação de uma nova Vela de Comando',
      ],
      activeCommandCandle: activeCommand,
      allCommandCandles: commandCandles,
      defensePrice,
      midDefensePrice: midPrice,
      isFirstTouch: false,
      fiboAnalysis: null,
      goldenRatioZone: null,
      trendLines,
      activeZoneName: `COMANDO JÁ TESTADO (${activeCommand.direction})`,
      actionCandle: 'NASCIMENTO_00S',
      cycleStatus,
    };
  }

  // FILTRO ANTI-LOSS: Vela de Comando foi rompida
  if (activeCommand.status === 'ROMPIDO_INVALIDADO') {
    return {
      verdict: 'NO_TRADE',
      signalName: 'VELA DE COMANDO ROMPIDA · INVALIDADA',
      scenarioType: 'FILTRO_RUIDO_BLOQUEADO',
      candlePattern: 'NENHUM',
      candlePatternName: 'Comando Rompido',
      wickRatio: 0,
      confidence: 10,
      reason: `A Linha de Defesa da Vela de Comando (${defensePrice.toFixed(5)}) foi rompida pelo mercado. Operação cancelada.`,
      confluencePoints: [
        'Filtro de Ruído: Linha de defesa violada',
        'Aguardando novo movimento institucional',
      ],
      activeCommandCandle: activeCommand,
      allCommandCandles: commandCandles,
      defensePrice,
      midDefensePrice: midPrice,
      isFirstTouch: false,
      fiboAnalysis: null,
      goldenRatioZone: null,
      trendLines,
      activeZoneName: 'COMANDO INVALIDADO',
      actionCandle: 'NASCIMENTO_00S',
      cycleStatus,
    };
  }

  // ─── GATILHO 1: COMANDO DE ALTA (VERDE) -> PRIMEIRO PULLBACK DE COMPRA (CALL) ──
  // Abertura da vela de comando verde é SUPORTE INSTITUCIONAL INVIOLADO
  if (activeCommand.direction === 'ALTA') {
    // A vela atual (ou vela anterior imediata) desce para testar a taxa de abertura da vela de comando
    const touchedSupport =
      lastCandle.low <= defensePrice + tolerance &&
      lastCandle.low >= defensePrice - tolerance * 1.5;

    // Respeitou o suporte (fechou acima ou na linha de abertura do comando)
    const defendedSupport = lastCandle.close >= defensePrice - tolerance * 0.5;

    // Pavio de rejeição na mínima ou confirmação de martelo / retração
    const hasLowerRejection = lastLowerWickPct >= 28 || lastCandle.close > lastCandle.open;

    // FILTRO DE PRIMEIRO PULLBACK: É o primeiro toque na linha de abertura
    const isFirstPullback = activeCommand.firstTouchCandleIndex === undefined || activeCommand.firstTouchCandleIndex === n - 1;

    if (touchedSupport && defendedSupport && isFirstPullback && hasLowerRejection) {
      return {
        verdict: 'CALL',
        signalName: 'PRIMEIRO PULLBACK · VELA DE COMANDO (COMPRA) ▲',
        scenarioType: 'PRIMEIRO_PULLBACK_COMANDO_ALTA',
        candlePattern: 'REJEICAO_PULLBACK_SUPORTE',
        candlePatternName: `1º Pullback de Alta (${lastLowerWickPct.toFixed(0)}% Pavio Inferior)`,
        wickRatio: Math.round(lastLowerWickPct),
        confidence: 96,
        reason: `Vela realizou o PRIMEIRO PULLBACK na Linha de Defesa da Vela de Comando de Alta (${defensePrice.toFixed(5)}). Houve rejeição imediata com defesa de suporte institucional. Entrada confirmada de COMPRA (CALL) aos 00s!`,
        confluencePoints: [
          `Vela de Comando de Alta sem pavio na abertura (Taxa: ${defensePrice.toFixed(5)})`,
          `Primeiro Pullback exclusivo (1º Toque na linha de defesa)`,
          `Rejeição confirmada: ${lastLowerWickPct.toFixed(1)}% de pavio na mínima`,
          `Filtros de Loss superados: Afastamento saudável de ${activeCommand.candlesDistance} velas`,
          'Gatilho de COMPRA aos 00s para a continuação do fluxo de comando',
        ],
        activeCommandCandle: activeCommand,
        allCommandCandles: commandCandles,
        defensePrice,
        midDefensePrice: midPrice,
        isFirstTouch: true,
        fiboAnalysis: null,
        goldenRatioZone: null,
        trendLines,
        activeZoneName: `★ DEFESA DE COMANDO DE ALTA (${defensePrice.toFixed(5)}) ★`,
        actionCandle: 'NASCIMENTO_00S',
        cycleStatus: {
          ...cycleStatus,
          phase: 'PRIMEIRO_PULLBACK',
          phaseLabel: 'PRIMEIRO PULLBACK DE COMPRA VALIDADO',
        },
      };
    }
  }

  // ─── GATILHO 2: COMANDO DE BAIXA (VERMELHA) -> PRIMEIRO PULLBACK DE VENDA (PUT) ─
  // Abertura da vela de comando vermelha é RESISTÊNCIA INSTITUCIONAL INVIOLADA
  if (activeCommand.direction === 'BAIXA') {
    // A vela atual sobe para testar a taxa de abertura da vela de comando
    const touchedResistance =
      lastCandle.high >= defensePrice - tolerance &&
      lastCandle.high <= defensePrice + tolerance * 1.5;

    // Respeitou a resistência (fechou abaixo ou na linha de abertura do comando)
    const defendedResistance = lastCandle.close <= defensePrice + tolerance * 0.5;

    // Pavio de rejeição na máxima ou confirmação de estrela cadente / retração
    const hasUpperRejection = lastUpperWickPct >= 28 || lastCandle.close < lastCandle.open;

    // FILTRO DE PRIMEIRO PULLBACK: É o primeiro toque na linha de abertura
    const isFirstPullback = activeCommand.firstTouchCandleIndex === undefined || activeCommand.firstTouchCandleIndex === n - 1;

    if (touchedResistance && defendedResistance && isFirstPullback && hasUpperRejection) {
      return {
        verdict: 'PUT',
        signalName: 'PRIMEIRO PULLBACK · VELA DE COMANDO (VENDA) ▼',
        scenarioType: 'PRIMEIRO_PULLBACK_COMANDO_BAIXA',
        candlePattern: 'REJEICAO_PULLBACK_RESISTENCIA',
        candlePatternName: `1º Pullback de Baixa (${lastUpperWickPct.toFixed(0)}% Pavio Superior)`,
        wickRatio: Math.round(lastUpperWickPct),
        confidence: 96,
        reason: `Vela realizou o PRIMEIRO PULLBACK na Linha de Defesa da Vela de Comando de Baixa (${defensePrice.toFixed(5)}). Houve rejeição imediata com defesa de resistência institucional. Entrada confirmada de VENDA (PUT) aos 00s!`,
        confluencePoints: [
          `Vela de Comando de Baixa sem pavio na abertura (Taxa: ${defensePrice.toFixed(5)})`,
          `Primeiro Pullback exclusivo (1º Toque na linha de defesa)`,
          `Rejeição confirmada: ${lastUpperWickPct.toFixed(1)}% de pavio na máxima`,
          `Filtros de Loss superados: Afastamento saudável de ${activeCommand.candlesDistance} velas`,
          'Gatilho de VENDA aos 00s para a continuação do fluxo de comando',
        ],
        activeCommandCandle: activeCommand,
        allCommandCandles: commandCandles,
        defensePrice,
        midDefensePrice: midPrice,
        isFirstTouch: true,
        fiboAnalysis: null,
        goldenRatioZone: null,
        trendLines,
        activeZoneName: `★ DEFESA DE COMANDO DE BAIXA (${defensePrice.toFixed(5)}) ★`,
        actionCandle: 'NASCIMENTO_00S',
        cycleStatus: {
          ...cycleStatus,
          phase: 'PRIMEIRO_PULLBACK',
          phaseLabel: 'PRIMEIRO PULLBACK DE VENDA VALIDADO',
        },
      };
    }
  }

  // ─── 5. AGUARDANDO PRIMEIRO PULLBACK (STANDBY INTELIGENTE) ─────────────────
  const distToDefense = Math.abs(lastCandle.close - defensePrice);
  const isNear = distToDefense <= tolerance * 2;

  return {
    verdict: 'NO_TRADE',
    signalName: isNear
      ? `APROXIMANDO DA LINHA DE DEFESA (${defensePrice.toFixed(5)})`
      : `AGUARDANDO PRIMEIRO PULLBACK NA VELA DE COMANDO`,
    scenarioType: 'AGUARDANDO_PRIMEIRO_PULLBACK',
    candlePattern: 'NENHUM',
    candlePatternName: isNear ? 'Próximo da Linha de Defesa' : 'Afastado da Linha',
    wickRatio: Math.round(Math.max(lastUpperWickPct, lastLowerWickPct)),
    confidence: isNear ? 55 : 30,
    reason: isNear
      ? `O preço está se aproximando da Linha de Defesa em ${defensePrice.toFixed(5)} (${activeCommand.direction}). Aguardando o toque exato (1º Pullback) e rejeição para disparar o sinal.`
      : `Vela de Comando ativa em ${defensePrice.toFixed(5)} (${activeCommand.direction}). Preço atual: ${lastCandle.close.toFixed(5)}. Aguardando retorno para o Primeiro Pullback.`,
    confluencePoints: [
      `Vela de Comando: ${activeCommand.direction} (${activeCommand.type.replace('_', ' ')})`,
      `Taxa de Abertura / Defesa Principal: ${defensePrice.toFixed(5)}`,
      `Taxa de Equilíbrio (50% do Comando): ${midPrice.toFixed(5)}`,
      `Multiplicador de Força: ${activeCommand.avgBodyMultiplier}x maior que a média`,
      'Status: Aguardando o 1º Toque sem rompimento prévio',
    ],
    activeCommandCandle: activeCommand,
    allCommandCandles: commandCandles,
    defensePrice,
    midDefensePrice: midPrice,
    isFirstTouch: false,
    fiboAnalysis: null,
    goldenRatioZone: null,
    trendLines,
    activeZoneName: `LINHA DE DEFESA: ${defensePrice.toFixed(5)} (${activeCommand.direction})`,
    actionCandle: 'NASCIMENTO_00S',
    cycleStatus,
  };
}
