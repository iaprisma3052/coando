import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  X,
  Check,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Unlink,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Save,
  Trash2,
} from 'lucide-react';
import type { AccountInfo } from '@/types';

interface SsidModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountInfo;
  onConnectSsid: (ssid: string) => Promise<boolean>;
  onConnectCredentials?: (email: string, pass: string) => Promise<{ ok: boolean; msg?: string }>;
  onDisconnectSsid: () => Promise<void>;
}

export function SsidModal({
  isOpen,
  onClose,
  account,
  onConnectSsid,
  onConnectCredentials,
  onDisconnectSsid,
}: SsidModalProps) {
  const [tab, setTab] = useState<'credentials' | 'ssid'>('credentials');

  // Credentials Tab State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // SSID Tab State
  const [ssidInput, setSsidInput] = useState('');
  const [rememberSsid, setRememberSsid] = useState(true);

  // General State
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load saved credentials from localStorage on modal open
  useEffect(() => {
    if (isOpen) {
      try {
        const savedCreds = localStorage.getItem('optgo_saved_credentials');
        if (savedCreds) {
          const parsed = JSON.parse(savedCreds);
          if (parsed?.email) setEmail(parsed.email);
          if (parsed?.password) setPassword(parsed.password);
          setRememberCredentials(true);
        }

        const savedSsid = localStorage.getItem('optgo_saved_ssid');
        if (savedSsid) {
          setSsidInput(savedSsid);
          setRememberSsid(true);
        }
      } catch {
        // ignore parse error
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Clear saved credentials
  const handleClearSavedCredentials = () => {
    localStorage.removeItem('optgo_saved_credentials');
    setEmail('');
    setPassword('');
    setFeedback({ ok: true, msg: 'Credenciais salvas foram apagadas.' });
  };

  // Clear saved SSID
  const handleClearSavedSsid = () => {
    localStorage.removeItem('optgo_saved_ssid');
    setSsidInput('');
    setFeedback({ ok: true, msg: 'SSID salvo foi apagado.' });
  };

  // Handle Login via Email + Password
  const handleConnectCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setFeedback(null);
    try {
      if (rememberCredentials) {
        localStorage.setItem(
          'optgo_saved_credentials',
          JSON.stringify({ email: email.trim(), password: password.trim() })
        );
      } else {
        localStorage.removeItem('optgo_saved_credentials');
      }

      if (onConnectCredentials) {
        const res = await onConnectCredentials(email.trim(), password.trim());
        if (res.ok) {
          setFeedback({ ok: true, msg: 'Conectado com sucesso à sua conta OPTGO!' });
        } else {
          setFeedback({ ok: false, msg: res.msg || 'Credenciais inválidas ou erro na corretora.' });
        }
      }
    } catch (err: any) {
      setFeedback({ ok: false, msg: err?.message || 'Falha de comunicação com o servidor de login.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Connect via Direct SSID
  const handleConnectSsid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssidInput.trim()) return;

    setLoading(true);
    setFeedback(null);
    try {
      if (rememberSsid) {
        localStorage.setItem('optgo_saved_ssid', ssidInput.trim());
      } else {
        localStorage.removeItem('optgo_saved_ssid');
      }

      const ok = await onConnectSsid(ssidInput.trim());
      if (ok) {
        setFeedback({ ok: true, msg: 'Sessão SSID sincronizada com sucesso!' });
      } else {
        setFeedback({ ok: false, msg: 'Não foi possível conectar com esse SSID no momento.' });
      }
    } catch (err) {
      setFeedback({ ok: false, msg: 'Falha de comunicação com o servidor de corretagem.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await onDisconnectSsid();
      setFeedback({ ok: true, msg: 'Sua conta foi desconectada com sucesso.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0b0f17] border border-emerald-500/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800/80 flex items-center justify-between bg-[#070a10]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5 font-mono">
                CONEXÃO <span className="text-emerald-400">OPTGO BROKER</span>
              </h2>
              <p className="text-xs text-gray-400">Conecte sua conta para operar em tempo real</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Direct Broker Link Bar */}
          <div className="flex items-center justify-between p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl">
            <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Corretora: <strong>trade.optgobroker.com</strong></span>
            </div>
            <a
              href="https://trade.optgobroker.com/traderoom"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl text-[10px] flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20"
            >
              <span>Abrir Corretora</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Status Badge */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
              account.connected
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-gray-950/70 border-gray-800 text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  account.connected ? 'bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50' : 'bg-gray-600'
                }`}
              />
              <div>
                <div className="font-bold font-mono text-xs text-white">
                  {account.connected ? `Conta Conectada: ID #${account.id || 'OPTGO'}` : 'Nenhuma conta conectada'}
                </div>
                {account.connected && (
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    Saldo Real: ${account.balance.toFixed(2)} | Demo: ${account.demoBalance.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            {account.connected && (
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
              >
                <Unlink className="w-3.5 h-3.5" /> Desconectar
              </button>
            )}
          </div>

          {/* Tabs Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-950 rounded-2xl border border-gray-800">
            <button
              type="button"
              onClick={() => {
                setTab('credentials');
                setFeedback(null);
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                tab === 'credentials'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>E-mail & Senha</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('ssid');
                setFeedback(null);
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                tab === 'ssid'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Token SSID</span>
            </button>
          </div>

          {/* Tab 1: E-mail + Password */}
          {tab === 'credentials' && (
            <form onSubmit={handleConnectCredentials} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                  E-mail da sua conta OPTGO:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                  Senha da sua conta:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Salvar Credenciais Checkbox & Clear */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={rememberCredentials}
                    onChange={(e) => setRememberCredentials(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-[11px] flex items-center gap-1">
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Lembrar e salvar meus dados neste navegador</span>
                  </span>
                </label>

                {(email || password) && (
                  <button
                    type="button"
                    onClick={handleClearSavedCredentials}
                    className="text-[10px] text-gray-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    title="Limpar campos e dados salvos"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>

              <p className="text-[10px] text-gray-500 leading-tight">
                * Seus dados ficam salvos apenas localmente no seu próprio navegador de forma segura.
              </p>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-[11px] flex items-center gap-2 ${
                    feedback.ok
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                  }`}
                >
                  {feedback.ok ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{feedback.msg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 text-black font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 uppercase tracking-wide text-xs cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Conectar e Salvar Minha Conta</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Tab 2: SSID Token */}
          {tab === 'ssid' && (
            <div className="space-y-3 pt-1">
              <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 space-y-1.5 text-[11px] text-gray-400">
                <span className="font-bold text-gray-300 block">Como pegar seu SSID:</span>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                  <li>Abra <strong>trade.optgobroker.com/traderoom</strong> logado</li>
                  <li>Aperte <strong>F12</strong> → aba <strong>Application</strong> → <strong>Cookies</strong></li>
                  <li>Copie o valor do cookie <strong>ssid</strong> e cole abaixo</li>
                </ol>
              </div>

              <form onSubmit={handleConnectSsid} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    Token SSID:
                  </label>
                  <input
                    type="password"
                    placeholder="ex: 4a8f9c2d1b0e..."
                    value={ssidInput}
                    onChange={(e) => setSsidInput(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Salvar SSID Checkbox & Clear */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 hover:text-white">
                    <input
                      type="checkbox"
                      checked={rememberSsid}
                      onChange={(e) => setRememberSsid(e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
                    />
                    <span className="text-[11px] flex items-center gap-1">
                      <Save className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Lembrar token SSID</span>
                    </span>
                  </label>

                  {ssidInput && (
                    <button
                      type="button"
                      onClick={handleClearSavedSsid}
                      className="text-[10px] text-gray-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                      title="Limpar SSID salvo"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Limpar</span>
                    </button>
                  )}
                </div>

                {feedback && (
                  <div
                    className={`p-3 rounded-xl text-[11px] flex items-center gap-2 ${
                      feedback.ok
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                        : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                    }`}
                  >
                    {feedback.ok ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{feedback.msg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !ssidInput.trim()}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 uppercase tracking-wide text-xs cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Salvar e Conectar por SSID</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#070a10] border-t border-gray-800/80 text-[11px] text-gray-500 text-center font-mono">
          Isolamento de sessão por usuário · Suporte a contas Demo e Real
        </div>
      </div>
    </div>
  );
}
