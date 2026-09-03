export interface Candle {
  time: number; // unix seconds (open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface OtcAsset {
  id: number;
  symbol: string;
  label: string;
  category: 'forex' | 'stock' | 'crypto' | 'commodity' | 'index';
  payout: number;
  precision: number;
  image?: string;
  enabled?: boolean;
}

export interface TaxaDivididaMarker {
  time: number;
  type: 'buy' | 'sell' | 'armed_buy' | 'armed_sell';
  price: number;
  label: string;
}

export interface AnalystVerdict {
  name: string;
  icon: string;
  direction: 'call' | 'put' | 'hold';
  confidence: number;
  opinion: string;
}

export interface Analysis {
  direction: 'call' | 'put';
  strength: number; // 0-100
  confidence: 'LOW' | 'MED' | 'HIGH';
  reasons: string[];
  blocks: string[];
  emaMacro: number; // EMA 100
  emaInter: number; // EMA 50
  ema9: number;
  ema21: number;
  buffer1: number; // SMA(1) - SMA(34)
  buffer2: number; // WMA(Buffer1, 5)
  gatilhoTaxa50: number | null;
  rsi: number;
  bbUpper: number;
  bbLower: number;
  bbMid: number;
  lastPrice: number;
  trend: 'up' | 'down' | 'lateral';
  candleContext: string;
  nextDir: 'call' | 'put';
  nextProb: number;
  pattern: string;
  analysts: AnalystVerdict[];
  signalReady: boolean;
  statusText: string;
  buyOK: boolean;
  sellOK: boolean;
  armedBuy: boolean;
  armedSell: boolean;
  markers: TaxaDivididaMarker[];
}

export interface AccountInfo {
  id: number;
  name: string;
  balance: number;
  demoBalance: number;
  currency: string;
  country?: number;
  connected: boolean;
  ssid?: string;
}

export interface OrderResult {
  id: string;
  activeId: number;
  symbol: string;
  direction: 'call' | 'put';
  amount: number;
  openPrice: number;
  openTime: number;
  expiration: number;
  isDemo: boolean;
  status: 'open' | 'win' | 'loss' | 'tie';
  closePrice?: number;
  payoutPercent?: number;
  profit?: number;
  strategy?: string;
  sorosLevel?: number;
  galeLevel?: number;
}

export interface ScanAlert {
  activeId: number;
  symbol: string;
  label: string;
  category: string;
  direction: 'call' | 'put';
  strength: number;
  confidence: string;
  payout: number;
  reasons: string[];
  blocks: string[];
  candleContext: string;
  signalReady: boolean;
  time: string;
  analysts?: AnalystVerdict[];
}

export interface ExecLog {
  id: string;
  activeId: number;
  label: string;
  direction: 'call' | 'put';
  amount: number;
  time: string;
  success: boolean;
  reason: string;
  sorosLevel: number;
  galeLevel?: number;
  profit?: number;
  status: 'PENDING' | 'WIN' | 'LOSS' | 'OPEN';
}

export type GambolTab = 'controlador' | 'simulador' | 'vector_otc' | 'painel' | 'corretoras' | 'historico' | 'config';

export interface GambolBroker {
  id: string;
  name: string;
  logo: string;
  fallbackLogo: string;
  status: 'online' | 'maintenance' | 'busy';
  latency: number;
  payout: number;
  serverRegion: string;
  tradeRoomUrl?: string;
}

export interface GambolUser {
  nome: string;
  email: string;
  whatsapp?: string;
  planName: string;
  subscriptionStartLabel: string;
  subscriptionEndLabel: string;
  subscriptionActive: boolean;
  lifetime: boolean;
  connectedServers: number;
  balance: number;
  demoBalance: number;
}

export interface GambolManipulation {
  activeId: number;
  direction: 'alta' | 'baixa' | 'none';
  force: number; // 10 - 127%
  broker: string;
  startedAt: number;
  duration: number; // in seconds (default 60s)
  active: boolean;
}
