import React from 'react';
import { History, TrendingUp, TrendingDown, Award, DollarSign, Percent, CheckCircle, XCircle } from 'lucide-react';
import type { OrderResult } from '@/types';

interface TradeHistoryProps {
  orders: OrderResult[];
  onClearHistory: () => void;
}

export function TradeHistory({ orders, onClearHistory }: TradeHistoryProps) {
  const closedOrders = orders.filter((o) => o.status !== 'open');
  const wins = closedOrders.filter((o) => o.status === 'win').length;
  const losses = closedOrders.filter((o) => o.status === 'loss').length;
  const total = closedOrders.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalProfit = closedOrders.reduce((acc, o) => acc + (o.profit || 0), 0);

  return (
    <div className="bg-gray-900/90 rounded-2xl border border-gray-800/90 p-4 shadow-xl flex flex-col gap-4">
      {/* Header & Metrics */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <h3 className="font-extrabold text-sm text-white">Histórico de Operações</h3>
          <span className="text-xs text-gray-500 font-mono">({orders.length})</span>
        </div>

        {orders.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-950 p-2 rounded-xl border border-gray-800 text-center">
          <span className="text-[9px] text-gray-500 font-semibold uppercase block">Operações</span>
          <span className="text-sm font-extrabold font-mono text-white">{total}</span>
        </div>
        <div className="bg-gray-950 p-2 rounded-xl border border-gray-800 text-center">
          <span className="text-[9px] text-emerald-500 font-semibold uppercase block">Vitórias (W)</span>
          <span className="text-sm font-extrabold font-mono text-emerald-400">{wins}</span>
        </div>
        <div className="bg-gray-950 p-2 rounded-xl border border-gray-800 text-center">
          <span className="text-[9px] text-rose-500 font-semibold uppercase block">Derrotas (L)</span>
          <span className="text-sm font-extrabold font-mono text-rose-400">{losses}</span>
        </div>
        <div className="bg-gray-950 p-2 rounded-xl border border-gray-800 text-center">
          <span className="text-[9px] text-cyan-500 font-semibold uppercase block">Assertividade</span>
          <span className={`text-sm font-extrabold font-mono ${winRate >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {winRate}%
          </span>
        </div>
      </div>

      {/* Net Profit Bar */}
      <div className="bg-gray-950/70 p-2.5 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
        <span className="text-gray-400">Resultado Financeiro:</span>
        <span
          className={`font-mono font-black text-sm ${
            totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
        </span>
      </div>

      {/* Orders List */}
      <div className="overflow-y-auto max-h-72 space-y-2 pr-1">
        {orders.length === 0 ? (
          <div className="py-8 text-center text-gray-600 text-xs">
            Nenhuma operação realizada ainda nesta sessão.
          </div>
        ) : (
          orders.map((order) => {
            const isWin = order.status === 'win';
            const isLoss = order.status === 'loss';
            const isOpen = order.status === 'open';

            return (
              <div
                key={order.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  isOpen
                    ? 'bg-cyan-950/20 border-cyan-700/40 animate-pulse'
                    : isWin
                    ? 'bg-emerald-950/20 border-emerald-800/40'
                    : 'bg-rose-950/20 border-rose-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      order.direction === 'call'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {order.direction === 'call' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs">{order.symbol}</span>
                      <span
                        className={`text-[9px] font-bold px-1 rounded ${
                          order.direction === 'call'
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-rose-900 text-rose-300'
                        }`}
                      >
                        {order.direction.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                      Entrada: {order.openPrice ? order.openPrice.toFixed(4) : '--'}
                    </span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-1.5 font-mono font-bold">
                    <span className="text-gray-400">${order.amount}</span>
                    {isOpen ? (
                      <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 rounded animate-pulse">
                        EM CURSO
                      </span>
                    ) : isWin ? (
                      <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" /> +${order.profit?.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-extrabold flex items-center gap-0.5">
                        <XCircle className="w-3 h-3" /> -${order.amount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-500 mt-0.5">
                    {new Date(order.openTime * 1000).toLocaleTimeString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
