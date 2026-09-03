import React from 'react';
import { History, TrendingUp, TrendingDown, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

export function GambolHistorico() {
  const mockHistory = [
    {
      id: 'MAN-98412',
      symbol: 'EUR/USD OTC',
      direction: 'ALTA',
      broker: 'Broker-Alpha',
      force: '100%',
      time: 'Hoje, 12:28:14',
      result: 'WIN',
      profit: '+$92.00',
    },
    {
      id: 'MAN-98411',
      symbol: 'GBP/USD OTC',
      direction: 'BAIXA',
      broker: 'Quotex',
      force: '125%',
      time: 'Hoje, 12:22:05',
      result: 'WIN',
      profit: '+$88.00',
    },
    {
      id: 'MAN-98410',
      symbol: 'USD/JPY OTC',
      direction: 'ALTA',
      broker: 'OPTGO Broker',
      force: '100%',
      time: 'Hoje, 12:15:30',
      result: 'WIN',
      profit: '+$95.00',
    },
    {
      id: 'MAN-98409',
      symbol: 'AUD/CAD OTC',
      direction: 'ALTA',
      broker: 'IQ Option',
      force: '75%',
      time: 'Hoje, 12:08:44',
      result: 'WIN',
      profit: '+$89.00',
    },
    {
      id: 'MAN-98408',
      symbol: 'EUR/GBP OTC',
      direction: 'BAIXA',
      broker: 'Blaze Invest',
      force: '100%',
      time: 'Hoje, 11:58:12',
      result: 'WIN',
      profit: '+$90.00',
    },
  ];

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 text-slate-100 font-sans pb-16">
      <div className="bg-[#0b101c] border border-white/10 p-4 rounded-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-700/40 border border-amber-500/50 flex items-center justify-center text-amber-400 font-mono font-black text-xl shadow-lg shadow-amber-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-mono font-extrabold text-base tracking-tight">
              Histórico Operacional
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Taxa de acerto acumulada: <b className="text-emerald-400">98.4%</b>
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/30">
          5 Vitórias seguidas
        </span>
      </div>

      <div className="space-y-2">
        {mockHistory.map((item) => (
          <div
            key={item.id}
            className="bg-[#070b14] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <strong className="text-white text-sm">{item.symbol}</strong>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    item.direction === 'ALTA'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {item.direction} ({item.force})
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                {item.broker} • {item.time}
              </div>
            </div>

            <div className="text-right space-y-0.5">
              <div className="text-emerald-400 font-bold text-sm">{item.profit}</div>
              <span className="text-[9px] text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded inline-block font-bold">
                {item.result}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
