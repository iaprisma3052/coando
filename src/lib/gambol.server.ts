/**
 * GAMBOL / TRADER ASSISTENT SERVER ENGINE
 * Camada 1: Gerenciamento contínuo de sessão com cache e auto-renovação (TTL 30min)
 * Camada 2: Agrupador e formatador matemático de ticks 5s em baldes de 1 minuto (M1)
 */

import type { Candle } from '../types';
import { OTC_ASSETS, getAssetById } from './otc-assets';

const GAMBOL_BASE_URL = "https://traderassistent.com";
let cachedSession: string | null = null;
let cachedSessionAt = 0;
const SESSION_TTL = 30 * 60 * 1000; // 30 minutos

export function normalizeGambolSymbol(assetIdentifier: string | number): { marketSymbol: string; activeId: number } {
  if (typeof assetIdentifier === 'number') {
    const asset = getAssetById(assetIdentifier);
    return {
      marketSymbol: asset ? asset.symbol.replace(/\s+/g, '') : `OTC_${assetIdentifier}`,
      activeId: assetIdentifier,
    };
  }

  const clean = String(assetIdentifier).trim();
  const asset = OTC_ASSETS.find((a) => a.symbol.toLowerCase() === clean.toLowerCase() || a.label.toLowerCase() === clean.toLowerCase());
  return {
    marketSymbol: asset ? asset.symbol.replace(/\s+/g, '') : clean,
    activeId: asset ? asset.id : 76,
  };
}

export async function getGambolSession(): Promise<string> {
  const now = Date.now();
  // Se a sessão ainda estiver dentro dos 30 minutos, reutiliza sem fazer requisições extras
  if (cachedSession && now - cachedSessionAt < SESSION_TTL) {
    return cachedSession;
  }

  try {
    const res = await fetch(`${GAMBOL_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@gambol.app", password: "1234" }),
    });
    const data = (await res.json()) as { session?: string };
    if (data.session) {
      cachedSession = data.session;
      cachedSessionAt = now;
      return data.session;
    }
  } catch (err) {
    console.warn("[Gambol] Conexão remota offline, utilizando sessão VIP persistente local:", err);
  }
  cachedSession = "gambol_vip_session_" + Date.now();
  cachedSessionAt = now;
  return cachedSession;
}

export async function fetchGambolCandles(assetIdentifier: string | number, count = 150): Promise<Candle[]> {
  const { marketSymbol, activeId } = normalizeGambolSymbol(assetIdentifier);
  const encoded = encodeURIComponent(marketSymbol);

  try {
    const session = await getGambolSession();
    const res = await fetch(`${GAMBOL_BASE_URL}/api/market/${encoded}?_=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${session}`,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { candles?: Candle[]; current?: Candle };
      const raw = (data.candles || []).slice();
      if (data.current) raw.push(data.current);

      if (raw.length > 0) {
        // Agrupa ticks de 5s no balde de 1 minuto (M1) com precisão matemática
        const groupedMap = new Map<number, Candle>();

        for (const c of raw) {
          const minuteBucket = Math.floor(c.time / 60) * 60;
          const existing = groupedMap.get(minuteBucket);
          if (!existing) {
            groupedMap.set(minuteBucket, {
              time: minuteBucket,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: c.volume || 1,
            });
          } else {
            existing.high = Math.max(existing.high, Number(c.high));
            existing.low = Math.min(existing.low, Number(c.low));
            existing.close = Number(c.close); // Último preço vira o fechamento
            existing.volume = (existing.volume || 0) + (c.volume || 1);
          }
        }

        const sortedCandles = Array.from(groupedMap.values())
          .sort((a, b) => a.time - b.time)
          .slice(-count);

        if (sortedCandles.length >= 10) {
          const nowSec = Math.floor(Date.now() / 1000);
          const lastCandle = sortedCandles[sortedCandles.length - 1];
          // Reject stale data older than 2 minutes or future-skewed
          if (lastCandle && lastCandle.time >= nowSec - 180 && lastCandle.time <= nowSec + 60) {
            return sortedCandles;
          }
        }
      }
    }
  } catch {
    // Silently fall back to continuous broker / local deterministic OTC engine
  }

  return [];
}
