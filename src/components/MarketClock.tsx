import React, { useState, useEffect } from 'react';
import { Globe, Clock, ShieldCheck, Flame } from 'lucide-react';

interface SessionInfo {
  id: string;
  name: string;
  city: string;
  utcWindow: string;
  startHourUtc: number;
  endHourUtc: number;
  startHourBrt: number;
  endHourBrt: number;
  volatility: 'Baixa' | 'Média' | 'Alta';
  pairs: string[];
}

const SESSIONS: SessionInfo[] = [
  {
    id: 'london',
    name: 'Sessão de Londres',
    city: 'Londres (Europa)',
    utcWindow: '07:00–16:00 UTC',
    startHourUtc: 7,
    endHourUtc: 16,
    startHourBrt: 4,
    endHourBrt: 13,
    volatility: 'Alta',
    pairs: ['EUR/USD', 'GBP/USD', 'EUR/GBP', 'GBP/JPY'],
  },
  {
    id: 'newyork',
    name: 'Sessão de Nova York',
    city: 'Nova York (EUA)',
    utcWindow: '12:00–21:00 UTC',
    startHourUtc: 12,
    endHourUtc: 21,
    startHourBrt: 9,
    endHourBrt: 18,
    volatility: 'Alta',
    pairs: ['EUR/USD', 'USD/CAD', 'USD/JPY', 'USD/CHF'],
  },
  {
    id: 'tokyo',
    name: 'Sessão de Tóquio',
    city: 'Tóquio (Ásia)',
    utcWindow: '23:00–08:00 UTC',
    startHourUtc: 23,
    endHourUtc: 8,
    startHourBrt: 20,
    endHourBrt: 5,
    volatility: 'Média',
    pairs: ['USD/JPY', 'EUR/JPY', 'AUD/JPY', 'NZD/USD'],
  },
  {
    id: 'sydney',
    name: 'Sessão de Sydney',
    city: 'Sydney (Oceania)',
    utcWindow: '21:00–06:00 UTC',
    startHourUtc: 21,
    endHourUtc: 6,
    startHourBrt: 18,
    endHourBrt: 3,
    volatility: 'Baixa',
    pairs: ['AUD/USD', 'NZD/USD', 'AUD/NZD', 'AUD/JPY'],
  },
];

function isSessionActive(s: SessionInfo, currentUtcHour: number): boolean {
  if (s.startHourUtc < s.endHourUtc) {
    return currentUtcHour >= s.startHourUtc && currentUtcHour < s.endHourUtc;
  }
  return currentUtcHour >= s.startHourUtc || currentUtcHour < s.endHourUtc;
}

export function MarketClock() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Brasília Time (UTC-3)
  const brtFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const brtDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const brtTimeStr = brtFormatter.format(now);
  const brtDateStr = brtDateFormatter.format(now);
  const utcTimeStr = now.toISOString().slice(11, 19);

  const currentUtcHour = now.getUTCHours();
  const activeSessions = SESSIONS.filter((s) => isSessionActive(s, currentUtcHour));
  const hasOverlap = activeSessions.length >= 2;

  return (
    <div id="market-clock-section" className="bg-[#050a12]/95 border border-emerald-500/25 rounded-2xl p-5 shadow-2xl backdrop-blur-xl space-y-4">
      {/* Top Header with Real Brasília Time */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                Relógio de Sessões Globais (Market Clock)
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                TEMPO REAL 100%
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Monitoramento das janelas mundiais de liquidez e OTC da Optgo Broker
            </p>
          </div>
        </div>

        {/* Brasília & UTC Time Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Horário de Brasília */}
          <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl shadow-lg shadow-emerald-500/10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <div className="font-mono">
              <span className="text-[10px] text-emerald-300 font-bold block uppercase tracking-wider">
                Horário de Brasília (BRT)
              </span>
              <span className="text-sm font-black text-white">
                {brtTimeStr} <span className="text-[10px] text-emerald-400 font-normal">({brtDateStr})</span>
              </span>
            </div>
          </div>

          {/* UTC Clock */}
          <div className="flex items-center gap-2 bg-[#020509] border border-emerald-500/20 px-3 py-1.5 rounded-xl font-mono">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Horário Padrão UTC</span>
              <span className="text-xs font-bold text-slate-200">{utcTimeStr} UTC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Status Banner */}
      <div className="flex items-center justify-between p-3 bg-[#020509]/80 border border-emerald-500/20 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">
            Sessões Ativas Agora:{' '}
            <strong className="text-emerald-400">
              {activeSessions.length > 0
                ? activeSessions.map((s) => s.name).join(' + ')
                : 'Mercado OTC 24/7 Ativo'}
            </strong>
          </span>
        </div>

        {hasOverlap ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
            <Flame className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Overlap de Alta Confluência</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400">
            Fluxo Normal de Operações OTC
          </div>
        )}
      </div>

      {/* Session Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SESSIONS.map((session) => {
          const active = isSessionActive(session, currentUtcHour);
          return (
            <div
              key={session.id}
              id={`session-card-${session.id}`}
              className={`p-3.5 rounded-xl border transition-all ${
                active
                  ? 'bg-gradient-to-b from-emerald-950/40 to-[#020509] border-emerald-500/50 shadow-xl shadow-emerald-500/10'
                  : 'bg-[#020509]/60 border-emerald-500/15 opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-slate-700'}`} />
                  <div>
                    <span className="text-sm font-bold text-white font-mono block leading-tight">{session.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{session.city}</span>
                  </div>
                </div>
                <span
                  className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded border ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {active ? 'ABERTA' : 'FECHADA'}
                </span>
              </div>

              {/* Time Window */}
              <div className="space-y-1 my-2.5 text-[11px] font-mono bg-black/40 p-2 rounded-lg border border-emerald-500/10">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Horário Brasília:</span>
                  <span className="font-bold text-emerald-400">{session.startHourBrt.toString().padStart(2, '0')}:00 às {session.endHourBrt.toString().padStart(2, '0')}:00</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Janela UTC:</span>
                  <span>{session.utcWindow}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400 font-mono text-[11px]">Volatilidade:</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                    session.volatility === 'Alta'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : session.volatility === 'Média'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                  }`}
                >
                  {session.volatility}
                </span>
              </div>

              {/* Pairs */}
              <div className="flex flex-wrap gap-1 pt-1 border-t border-emerald-500/10">
                {session.pairs.map((p) => (
                  <span
                    key={p}
                    className="text-[9px] font-mono bg-black/60 text-slate-300 px-1.5 py-0.5 rounded border border-emerald-500/15"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

