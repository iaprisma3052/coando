import React, { useState, useEffect, useCallback } from 'react';
import { OTC_ASSETS } from '@/lib/otc-assets';
import type { OtcAsset, Candle, Analysis, AccountInfo, OrderResult } from '@/types';
import { Header } from '@/components/Header';
import { ChineseBotPanel } from '@/components/ChineseBotPanel';
import { MarketClock } from '@/components/MarketClock';
import { AssetSelectorModal } from '@/components/AssetSelectorModal';
import { SsidModal } from '@/components/SsidModal';
import { LoginScreen } from '@/components/LoginScreen';
import {
  playWinSound,
  playLossSound,
  playClickSound,
} from '@/lib/sound';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('prisma_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed?.authenticated);
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [assets, setAssets] = useState<OtcAsset[]>(OTC_ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<OtcAsset>(OTC_ASSETS[0]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [account, setAccount] = useState<AccountInfo>({
    connected: false,
    id: 994821,
    name: 'PRISMA Trader (DEMO)',
    balance: 1250.0,
    demoBalance: 10000.0,
    currency: 'USD',
  });
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [robotActive, setRobotActive] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const [, setOrders] = useState<OrderResult[]>([]);
  const [currentSorosLevel, setCurrentSorosLevel] = useState<number>(1);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState<boolean>(false);
  const [isSsidModalOpen, setIsSsidModalOpen] = useState<boolean>(false);

  // Atalho Global: Pressionar Ctrl + V (ou Cmd + V) abre automaticamente a lista de todos os ativos
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        const activeTag = (document.activeElement?.tagName || '').toUpperCase();
        // Se o modal de ativos já estiver aberto e o usuário estiver colando num input de busca, mantém o comportamento padrão de colagem
        if (isAssetModalOpen && (activeTag === 'INPUT' || activeTag === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        playClickSound();
        setIsAssetModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAssetModalOpen]);

  // Fetch initial assets and account
  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAssets(data);
          const found = data.find((a: OtcAsset) => a.id === selectedAsset.id);
          if (found) setSelectedAsset(found);
        }
      })
      .catch(() => {});

    fetch('/api/account')
      .then((r) => r.json())
      .then((acc) => {
        if (acc && acc.id) setAccount(acc);
      })
      .catch(() => {});
  }, [selectedAsset.id]);

  // Fetch candles & technical analysis for the selected asset
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis?activeId=${selectedAsset.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.candles && json.candles.length > 0) {
          setCandles((prev) => {
            if (prev.length === 0) return json.candles;
            const lastPrev = prev[prev.length - 1];
            const lastNew = json.candles[json.candles.length - 1];
            // Scale mismatch protection
            if (lastPrev && lastNew && Math.abs(lastPrev.close - lastNew.close) > Math.max(lastPrev.close, lastNew.close) * 0.35) {
              return json.candles;
            }
            if (lastPrev && lastNew && lastNew.time < lastPrev.time) {
              // Ignore stale historical snapshot that is behind current live stream
              return prev;
            }
            if (lastPrev && lastNew && lastPrev.time === lastNew.time) {
              const copy = [...json.candles.slice(0, -1)];
              copy.push({
                ...lastNew,
                high: Math.max(lastNew.high, lastPrev.high),
                low: Math.min(lastNew.low, lastPrev.low),
                close: lastPrev.close,
              });
              return copy;
            }
            return json.candles;
          });
        }
        if (json.analysis) setAnalysis(json.analysis);
      }
    } catch {
      // offline fallback
    }
  }, [selectedAsset.id]);

  useEffect(() => {
    setCandles([]);
    setAnalysis(null);
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [selectedAsset.id, refreshData]);

  // Live SSE Tick Streaming for continuous price updates
  useEffect(() => {
    const sse = new EventSource(`/api/stream?activeId=${selectedAsset.id}`);

    sse.addEventListener('candle', (e) => {
      try {
        const tickCandle = JSON.parse(e.data);
        if (tickCandle.activeId === selectedAsset.id) {
          setCandles((prev) => {
            if (prev.length === 0) return [tickCandle];
            const first = prev[0];
            // If scale mismatch from previous pair, reset to new candle stream
            if (first && Math.abs(first.close - tickCandle.close) > Math.max(first.close, tickCandle.close) * 0.35) {
              return [tickCandle];
            }
            const last = prev[prev.length - 1];
            if (last.time === tickCandle.time) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                high: Math.max(last.high, tickCandle.high),
                low: Math.min(last.low, tickCandle.low),
                close: tickCandle.close,
              };
              return updated;
            } else if (tickCandle.time > last.time) {
              return [...prev.slice(-150), tickCandle];
            }
            return prev;
          });
        }
      } catch {
        // ignore
      }
    });

    return () => {
      sse.close();
    };
  }, [selectedAsset.id]);

  // Execute Order function directly to broker
  const handleExecuteOrder = useCallback(
    async (direction: 'call' | 'put', amount: number, strategy: string) => {
      setExecuting(true);
      const openPrice = candles[candles.length - 1]?.close || 1.0;

      const tempOrder: OrderResult = {
        id: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        symbol: selectedAsset.symbol,
        activeId: selectedAsset.id,
        direction,
        amount,
        openPrice,
        openTime: Math.floor(Date.now() / 1000),
        expiration: 60,
        isDemo,
        status: 'open',
        strategy,
      };

      setOrders((prev) => [tempOrder, ...prev]);

      try {
        const res = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeId: selectedAsset.id,
            direction,
            amount,
            expiration: 60,
            isDemo,
            strategy,
          }),
        });

        if (res.ok) {
          const placedOrder: OrderResult = await res.json();
          setOrders((prev) => [
            placedOrder,
            ...prev.filter((o) => o.id !== tempOrder.id),
          ]);

          // Update balance
          setAccount((prev) => {
            if (isDemo) {
              return { ...prev, demoBalance: prev.demoBalance - amount };
            }
            return { ...prev, balance: prev.balance - amount };
          });

          // Wait for order resolution
          setTimeout(async () => {
            const latestPrice = candles[candles.length - 1]?.close || openPrice;
            const isWin =
              direction === 'call'
                ? latestPrice > openPrice
                : latestPrice < openPrice;

            const payoutRate = (selectedAsset.payout || 85) / 100;
            const profit = isWin ? Number((amount * payoutRate).toFixed(2)) : -amount;

            if (isWin) {
              playWinSound();
              setCurrentSorosLevel((lvl) => (lvl >= 3 ? 1 : lvl + 1));
              setAccount((prev) => {
                const totalReturn = amount + profit;
                if (isDemo) {
                  return { ...prev, demoBalance: prev.demoBalance + totalReturn };
                }
                return { ...prev, balance: prev.balance + totalReturn };
              });
            } else {
              playLossSound();
              setCurrentSorosLevel(1);
            }

            setOrders((prev) =>
              prev.map((o) =>
                o.id === placedOrder.id
                  ? {
                      ...o,
                      closePrice: latestPrice,
                      closeTime: Math.floor(Date.now() / 1000),
                      status: isWin ? 'win' : 'loss',
                      profit,
                    }
                  : o,
              ),
            );
          }, 5000);
        }
      } catch {
        // Mock fallback if API fails
        setTimeout(() => {
          const isWin = Math.random() > 0.15;
          const payoutRate = (selectedAsset.payout || 85) / 100;
          const profit = isWin ? Number((amount * payoutRate).toFixed(2)) : -amount;

          if (isWin) {
            playWinSound();
            setCurrentSorosLevel((lvl) => (lvl >= 3 ? 1 : lvl + 1));
          } else {
            playLossSound();
            setCurrentSorosLevel(1);
          }
        }, 5000);
      } finally {
        setExecuting(false);
      }
    },
    [analysis, candles, isDemo, selectedAsset],
  );

  // Connect Credentials handler (Email + Password)
  const handleConnectCredentials = async (
    email: string,
    pass: string,
  ): Promise<{ ok: boolean; msg?: string }> => {
    try {
      const res = await fetch('/api/connect-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (data.ok && data.account) {
        setAccount({
          connected: true,
          id: data.account.id,
          name: data.account.name,
          balance: data.account.balance,
          demoBalance: data.account.demoBalance,
          currency: data.account.currency,
        });
        return { ok: true };
      }
      return { ok: false, msg: data.message || 'Erro ao autenticar na corretora.' };
    } catch {
      return { ok: false, msg: 'Falha de conexão com o servidor.' };
    }
  };

  // Connect SSID handler
  const handleConnectSsid = async (ssid: string, broker: string = 'optgo'): Promise<boolean> => {
    try {
      const res = await fetch('/api/connect-ssid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, broker }),
      });
      const data = await res.json();
      if (data.ok && data.account) {
        setAccount({
          connected: true,
          id: data.account.id,
          name: data.account.name,
          balance: data.account.balance,
          demoBalance: data.account.demoBalance,
          currency: data.account.currency,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Disconnect SSID handler
  const handleDisconnectSsid = async () => {
    try {
      await fetch('/api/disconnect-ssid', { method: 'POST' });
    } catch {
      // ignore
    }
    setAccount((prev) => ({ ...prev, connected: false }));
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('prisma_auth_session');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#03070d] text-slate-100 flex flex-col font-sans selection:bg-emerald-400 selection:text-black">
      {/* Top Header */}
      <Header
        currentTab="terminal"
        onSelectTab={() => {}}
        account={account}
        isDemo={isDemo}
        onToggleDemo={setIsDemo}
        onOpenSsidModal={() => setIsSsidModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Screen Container */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl mx-auto w-full space-y-8">
        <div className="space-y-8">
          <ChineseBotPanel
            assets={assets}
            selectedAsset={selectedAsset}
            onSelectAsset={(asset) => setSelectedAsset(asset)}
            candles={candles}
            account={account}
            onOpenSsidModal={() => setIsSsidModalOpen(true)}
            onOpenAssetModal={() => setIsAssetModalOpen(true)}
          />

          {/* Global Market Clock (Real-Time Sessions & Brasília Time) */}
          <MarketClock />
        </div>
      </main>

      {/* Asset Selector Modal (148 OTC Assets) */}
      <AssetSelectorModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        assets={assets}
        selectedAsset={selectedAsset}
        onSelectAsset={(asset) => setSelectedAsset(asset)}
      />

      {/* SSID & Credentials Broker Connection Modal */}
      <SsidModal
        isOpen={isSsidModalOpen}
        onClose={() => setIsSsidModalOpen(false)}
        account={account}
        onConnectSsid={handleConnectSsid}
        onConnectCredentials={handleConnectCredentials}
        onDisconnectSsid={handleDisconnectSsid}
      />
    </div>
  );
}
