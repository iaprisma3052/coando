/**
 * Comprehensive OTC Pricing and Market Baseline Config
 * Calibrated for all 148 verified assets in OPTGO Broker catalog.
 */

import { getAssetById, OtcAsset } from './otc-assets';

export interface AssetPriceConfig {
  basePrice: number;
  volatility: number;
  precision: number;
}

export function getAssetPriceConfig(activeId: number): AssetPriceConfig {
  const asset = getAssetById(activeId);
  const sym = (asset?.symbol || '').toUpperCase();
  const label = (asset?.label || '').toUpperCase();
  const cat = asset?.category || 'forex';
  const assignedPrecision = asset?.precision || 5;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. INDICES (High value / High integer scale)
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('US30') || sym.includes('DJI') || sym.includes('DOW') || label.includes('DOW')) {
    return { basePrice: 41250.0, volatility: 35.0, precision: 2 };
  }
  if (sym.includes('JP225') || sym.includes('NK225') || sym.includes('NIKKEI') || label.includes('NIKKEI')) {
    return { basePrice: 38650.0, volatility: 30.0, precision: 2 };
  }
  if (sym.includes('NDAQ') || sym.includes('NAS') || sym.includes('USTEC') || sym.includes('NAS100') || label.includes('NASDAQ')) {
    return { basePrice: 19850.0, volatility: 18.0, precision: 2 };
  }
  if (sym.includes('GER') || sym.includes('DAX') || sym.includes('DE40') || label.includes('DAX')) {
    return { basePrice: 18450.0, volatility: 15.0, precision: 2 };
  }
  if (sym.includes('UK100') || sym.includes('FTSE') || label.includes('FTSE')) {
    return { basePrice: 8280.0, volatility: 8.0, precision: 2 };
  }
  if (sym.includes('SP500') || sym.includes('SPX') || sym.includes('US500') || label.includes('S&P')) {
    return { basePrice: 5620.0, volatility: 5.5, precision: 2 };
  }
  if (sym.includes('FRA40') || sym.includes('CAC') || label.includes('CAC')) {
    return { basePrice: 7550.0, volatility: 7.0, precision: 2 };
  }
  if (sym.includes('AUS200') || sym.includes('ASX') || label.includes('ASX')) {
    return { basePrice: 8050.0, volatility: 7.5, precision: 2 };
  }
  if (cat === 'index') {
    return { basePrice: 12500.0, volatility: 12.0, precision: 2 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CRYPTO
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('BTC') || label.includes('BITCOIN')) {
    return { basePrice: 64250.0, volatility: 45.0, precision: 2 };
  }
  if (sym.includes('TAO')) {
    return { basePrice: 320.0, volatility: 1.8, precision: 2 };
  }
  if (sym.includes('BCH') || label.includes('BITCOIN CASH')) {
    return { basePrice: 345.0, volatility: 1.5, precision: 2 };
  }
  if (sym.includes('ETH') || label.includes('ETHEREUM')) {
    return { basePrice: 3480.0, volatility: 4.5, precision: 2 };
  }
  if (sym.includes('BNB') || label.includes('BINANCE')) {
    return { basePrice: 585.0, volatility: 1.2, precision: 2 };
  }
  if (sym.includes('SOL') || label.includes('SOLANA')) {
    return { basePrice: 148.5, volatility: 0.85, precision: 2 };
  }
  if (sym.includes('LTC') || label.includes('LITECOIN')) {
    return { basePrice: 72.5, volatility: 0.45, precision: 2 };
  }
  if (sym.includes('AVAX') || label.includes('AVALANCHE')) {
    return { basePrice: 26.4, volatility: 0.22, precision: 2 };
  }
  if (sym.includes('LINK') || label.includes('CHAINLINK')) {
    return { basePrice: 12.8, volatility: 0.12, precision: 3 };
  }
  if (sym.includes('UNI') || label.includes('UNISWAP')) {
    return { basePrice: 8.4, volatility: 0.08, precision: 3 };
  }
  if (sym.includes('DOT') || label.includes('POLKADOT')) {
    return { basePrice: 4.9, volatility: 0.045, precision: 3 };
  }
  if (sym.includes('NEAR') || label.includes('NEAR PROTOCOL')) {
    return { basePrice: 4.6, volatility: 0.04, precision: 3 };
  }
  if (sym.includes('ATOM') || label.includes('COSMOS')) {
    return { basePrice: 4.85, volatility: 0.04, precision: 3 };
  }
  if (sym.includes('TRUMP')) {
    return { basePrice: 16.5, volatility: 0.25, precision: 3 };
  }
  if (sym.includes('SUI')) {
    return { basePrice: 1.95, volatility: 0.02, precision: 4 };
  }
  if (sym.includes('APT') || label.includes('APTOS')) {
    return { basePrice: 8.2, volatility: 0.08, precision: 3 };
  }
  if (sym.includes('TIA') || label.includes('CELESTIA')) {
    return { basePrice: 5.4, volatility: 0.05, precision: 3 };
  }
  if (sym.includes('SEI')) {
    return { basePrice: 0.385, volatility: 0.004, precision: 4 };
  }
  if (sym.includes('XRP') || label.includes('RIPPLE')) {
    return { basePrice: 0.582, volatility: 0.005, precision: 4 };
  }
  if (sym.includes('ADA') || sym.includes('CARDANO')) {
    return { basePrice: 0.385, volatility: 0.0035, precision: 4 };
  }
  if (sym.includes('DOGE') || label.includes('DOGECOIN')) {
    return { basePrice: 0.124, volatility: 0.0015, precision: 4 };
  }
  if (sym.includes('ARB') || label.includes('ARBITRUM')) {
    return { basePrice: 0.54, volatility: 0.005, precision: 4 };
  }
  if (sym.includes('MATIC') || label.includes('POLYGON')) {
    return { basePrice: 0.42, volatility: 0.004, precision: 4 };
  }
  if (sym.includes('SHIB') || label.includes('SHIBA')) {
    return { basePrice: 0.0000185, volatility: 0.0000002, precision: 7 };
  }
  if (sym.includes('PEPE')) {
    return { basePrice: 0.0000092, volatility: 0.0000001, precision: 8 };
  }
  if (sym.includes('BONK')) {
    return { basePrice: 0.000024, volatility: 0.0000003, precision: 7 };
  }
  if (sym.includes('FLOKI')) {
    return { basePrice: 0.000155, volatility: 0.000002, precision: 6 };
  }
  if (sym.includes('MELANIA')) {
    return { basePrice: 1.25, volatility: 0.02, precision: 4 };
  }
  if (sym.includes('FARTCOIN')) {
    return { basePrice: 0.45, volatility: 0.008, precision: 4 };
  }
  if (cat === 'crypto') {
    return { basePrice: 14.5, volatility: 0.12, precision: 4 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. COMMODITIES
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('XAU/XAG') || sym.includes('GOLD/SILVER')) {
    return { basePrice: 81.2, volatility: 0.45, precision: 3 };
  }
  if (sym.includes('XAU') || sym.includes('GOLD') || label.includes('GOLD')) {
    return { basePrice: 2385.5, volatility: 2.2, precision: 2 };
  }
  if (sym.includes('XAG') || sym.includes('SILVER') || label.includes('SILVER')) {
    return { basePrice: 29.45, volatility: 0.15, precision: 3 };
  }
  if (sym.includes('UKO') || sym.includes('BRENT') || label.includes('BRENT')) {
    return { basePrice: 78.5, volatility: 0.45, precision: 2 };
  }
  if (sym.includes('USO') || sym.includes('WTI') || sym.includes('OIL') || sym.includes('CRUDE')) {
    return { basePrice: 74.2, volatility: 0.42, precision: 2 };
  }
  if (sym.includes('XNG') || sym.includes('GAS') || label.includes('GAS')) {
    return { basePrice: 2.45, volatility: 0.025, precision: 3 };
  }
  if (cat === 'commodity') {
    return { basePrice: 65.0, volatility: 0.35, precision: 2 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. STOCKS
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('NFLX') || label.includes('NETFLIX')) return { basePrice: 675.0, volatility: 1.2, precision: 2 };
  if (sym.includes('META') || label.includes('FACEBOOK')) return { basePrice: 510.8, volatility: 0.95, precision: 2 };
  if (sym.includes('MSFT') || label.includes('MICROSOFT')) return { basePrice: 445.2, volatility: 0.8, precision: 2 };
  if (sym.includes('AAPL') || label.includes('APPLE')) return { basePrice: 224.5, volatility: 0.45, precision: 2 };
  if (sym.includes('TSLA') || label.includes('TESLA')) return { basePrice: 215.3, volatility: 0.65, precision: 2 };
  if (sym.includes('AMZN') || label.includes('AMAZON')) return { basePrice: 188.2, volatility: 0.4, precision: 2 };
  if (sym.includes('GOOG') || label.includes('ALPHABET')) return { basePrice: 175.4, volatility: 0.38, precision: 2 };
  if (sym.includes('NVDA') || label.includes('NVIDIA')) return { basePrice: 128.4, volatility: 0.35, precision: 2 };
  if (sym.includes('COIN') || label.includes('COINBASE')) return { basePrice: 210.0, volatility: 0.75, precision: 2 };
  if (sym.includes('PLTR') || label.includes('PALANTIR')) return { basePrice: 32.5, volatility: 0.15, precision: 2 };
  if (sym.includes('AMD')) return { basePrice: 145.0, volatility: 0.45, precision: 2 };
  if (sym.includes('INTC') || label.includes('INTEL')) return { basePrice: 21.8, volatility: 0.12, precision: 2 };
  if (sym.includes('BABA') || label.includes('ALIBABA')) return { basePrice: 84.0, volatility: 0.25, precision: 2 };
  if (cat === 'stock') {
    return { basePrice: 145.0, volatility: 0.35, precision: 2 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. JPY FOREX CROSSES (Explicitly mapped to avoid EUR/USD scale conflation)
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('GBPJPY') || sym.includes('GBP/JPY')) return { basePrice: 196.45, volatility: 0.065, precision: 3 };
  if (sym.includes('CHFJPY') || sym.includes('CHF/JPY')) return { basePrice: 195.12, volatility: 0.055, precision: 3 };
  if (sym.includes('EURJPY') || sym.includes('EUR/JPY')) return { basePrice: 164.8, volatility: 0.05, precision: 3 };
  if (sym.includes('USDJPY') || sym.includes('USD/JPY')) return { basePrice: 154.25, volatility: 0.045, precision: 3 };
  if (sym.includes('CADJPY') || sym.includes('CAD/JPY')) return { basePrice: 112.5, volatility: 0.04, precision: 3 };
  if (sym.includes('AUDJPY') || sym.includes('AUD/JPY')) return { basePrice: 101.3, volatility: 0.035, precision: 3 };
  if (sym.includes('NZDJPY') || sym.includes('NZD/JPY')) return { basePrice: 92.8, volatility: 0.03, precision: 3 };
  if (sym.includes('SGDJPY') || sym.includes('SGD/JPY')) return { basePrice: 115.4, volatility: 0.035, precision: 3 };
  if (sym.includes('JPY') || label.includes('JPY')) return { basePrice: 150.0, volatility: 0.045, precision: 3 };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. EXOTIC / HIGH-SCALE FOREX
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('TRY')) return { basePrice: 33.85, volatility: 0.015, precision: 4 };
  if (sym.includes('ZAR')) return { basePrice: 18.25, volatility: 0.008, precision: 4 };
  if (sym.includes('MXN')) return { basePrice: 19.85, volatility: 0.008, precision: 4 };
  if (sym.includes('NOK')) {
    if (sym.includes('CHFNOK')) return { basePrice: 12.2, volatility: 0.005, precision: 4 };
    if (sym.includes('EURNOK')) return { basePrice: 11.65, volatility: 0.005, precision: 4 };
    if (sym.includes('GBPNOK')) return { basePrice: 13.85, volatility: 0.006, precision: 4 };
    return { basePrice: 10.65, volatility: 0.005, precision: 4 };
  }
  if (sym.includes('SEK')) return { basePrice: 10.45, volatility: 0.004, precision: 4 };
  if (sym.includes('INR')) return { basePrice: 83.85, volatility: 0.01, precision: 3 };
  if (sym.includes('BRL')) return { basePrice: 5.65, volatility: 0.003, precision: 4 };
  if (sym.includes('CNH') || sym.includes('CNY')) return { basePrice: 7.18, volatility: 0.002, precision: 4 };
  if (sym.includes('PLN')) return { basePrice: 4.28, volatility: 0.002, precision: 4 };
  if (sym.includes('HUF')) return { basePrice: 395.0, volatility: 0.25, precision: 2 };
  if (sym.includes('CZK')) return { basePrice: 25.1, volatility: 0.01, precision: 3 };

  // ──────────────────────────────────────────────────────────────────────────
  // 7. STANDARD G10 FOREX CROSSES
  // ──────────────────────────────────────────────────────────────────────────
  if (sym.includes('GBPAUD') || sym.includes('GBP/AUD')) return { basePrice: 1.942, volatility: 0.00035, precision: assignedPrecision };
  if (sym.includes('GBPCAD') || sym.includes('GBP/CAD')) return { basePrice: 1.775, volatility: 0.0003, precision: assignedPrecision };
  if (sym.includes('GBPNZD') || sym.includes('GBP/NZD')) return { basePrice: 2.145, volatility: 0.0004, precision: assignedPrecision };
  if (sym.includes('GBPCHF') || sym.includes('GBP/CHF')) return { basePrice: 1.142, volatility: 0.0002, precision: assignedPrecision };
  if (sym.includes('GBPUSD') || sym.includes('GBP/USD')) return { basePrice: 1.2934, volatility: 0.0002, precision: assignedPrecision };

  if (sym.includes('EURAUD') || sym.includes('EUR/AUD')) return { basePrice: 1.635, volatility: 0.00025, precision: assignedPrecision };
  if (sym.includes('EURCAD') || sym.includes('EUR/CAD')) return { basePrice: 1.488, volatility: 0.00025, precision: assignedPrecision };
  if (sym.includes('EURNZD') || sym.includes('EUR/NZD')) return { basePrice: 1.802, volatility: 0.0003, precision: assignedPrecision };
  if (sym.includes('EURGBP') || sym.includes('EUR/GBP')) return { basePrice: 0.842, volatility: 0.00012, precision: assignedPrecision };
  if (sym.includes('EURCHF') || sym.includes('EUR/CHF')) return { basePrice: 0.958, volatility: 0.00015, precision: assignedPrecision };
  if (sym.includes('EURUSD') || sym.includes('EUR/USD')) return { basePrice: 1.0845, volatility: 0.00015, precision: assignedPrecision };

  if (sym.includes('AUDNZD') || sym.includes('AUD/NZD')) return { basePrice: 1.104, volatility: 0.00018, precision: assignedPrecision };
  if (sym.includes('AUDCAD') || sym.includes('AUD/CAD')) return { basePrice: 0.914, volatility: 0.00016, precision: assignedPrecision };
  if (sym.includes('AUDCHF') || sym.includes('AUD/CHF')) return { basePrice: 0.588, volatility: 0.00012, precision: assignedPrecision };
  if (sym.includes('AUDUSD') || sym.includes('AUD/USD')) return { basePrice: 0.665, volatility: 0.00014, precision: assignedPrecision };

  if (sym.includes('NZDCAD') || sym.includes('NZD/CAD')) return { basePrice: 0.828, volatility: 0.00015, precision: assignedPrecision };
  if (sym.includes('NZDCHF') || sym.includes('NZD/CHF')) return { basePrice: 0.532, volatility: 0.00011, precision: assignedPrecision };
  if (sym.includes('NZDUSD') || sym.includes('NZD/USD')) return { basePrice: 0.602, volatility: 0.00013, precision: assignedPrecision };

  if (sym.includes('CADCHF') || sym.includes('CAD/CHF')) return { basePrice: 0.642, volatility: 0.00012, precision: assignedPrecision };
  if (sym.includes('USDCAD') || sym.includes('USD/CAD')) return { basePrice: 1.375, volatility: 0.00018, precision: assignedPrecision };
  if (sym.includes('USDCHF') || sym.includes('USD/CHF')) return { basePrice: 0.884, volatility: 0.00015, precision: assignedPrecision };

  return {
    basePrice: 1.085,
    volatility: 0.00015,
    precision: assignedPrecision,
  };
}
