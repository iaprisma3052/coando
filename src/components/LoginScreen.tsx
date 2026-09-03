import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldCheck, Activity, Eye, EyeOff, AlertCircle, Save } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('prisma_saved_login');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user) setEmailOrUser(parsed.user);
        if (parsed?.pass) setPassword(parsed.pass);
        setRememberMe(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const cleanUser = emailOrUser.trim().toLowerCase();
      const cleanPass = password.trim();

      // Credenciais: prismaia (ou email contendo prismaia) e senha 70721472
      const isValidUser =
        cleanUser === 'prismaia' ||
        cleanUser === 'prismaia@gmail.com' ||
        cleanUser === 'prismaia@admin.com';
      const isValidPass = cleanPass === '70721472';

      if (isValidUser && isValidPass) {
        // Salvar login se o checkbox estiver ativo
        if (rememberMe) {
          localStorage.setItem('prisma_saved_login', JSON.stringify({
            user: emailOrUser.trim(),
            pass: password.trim(),
          }));
        } else {
          localStorage.removeItem('prisma_saved_login');
        }

        localStorage.setItem('prisma_auth_session', JSON.stringify({
          authenticated: true,
          user: cleanUser,
          loginTime: Date.now(),
        }));
        onLoginSuccess();
      } else {
        setError('Acesso negado. Usuário ou senha incorretos.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div
      id="prisma-login-screen"
      className="min-h-screen w-full bg-[#020509] text-white flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden font-mono selection:bg-emerald-500 selection:text-black"
    >
      {/* Background Cyber Grid & Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Bar / Status */}
      <div className="w-full max-w-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>MOTOR IA 3.7 ATIVO</span>
        </div>
        <div className="text-[11px] text-slate-500 tracking-wider font-bold">
          TERMINAL V4.8
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md z-10 my-auto">
        <div className="bg-[#050a12]/95 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-emerald-950/40 relative">
          
          {/* Logo Oficial do Robô */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="relative group mb-3">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-xl shadow-emerald-500/30 bg-black flex items-center justify-center">
                <img
                  src="/prisma_ia_logo.jpg"
                  alt="PRISMA IA - VECTOR OTC"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-black rounded-full animate-ping" />
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white font-mono">
                PRISMA IA <span className="text-emerald-400">VECTOR OTC</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                CONSENSO 3 VOTOS
              </span>
              <span className="text-slate-500 text-[10px]">•</span>
              <span className="text-slate-400 text-[10px] font-mono">148 ATIVOS OTC</span>
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Autenticação de Acesso ao Terminal</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Email / User Field */}
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">
                Usuário / E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={emailOrUser}
                  onChange={(e) => setEmailOrUser(e.target.value)}
                  placeholder="Digite seu usuário ou e-mail"
                  className="w-full bg-[#020509]/80 border border-slate-700/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all font-mono"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha de acesso"
                  className="w-full bg-[#020509]/80 border border-slate-700/60 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox Salvar Dados */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950"
                />
                <span className="text-xs flex items-center gap-1 font-mono">
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Salvar dados de acesso</span>
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-70 font-mono"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Acessar Robô Prisma IA</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-md text-center z-10 text-[11px] text-slate-500 font-mono">
        <p>trade.optgobroker.com · Real-Time Vector Engine</p>
      </div>
    </div>
  );
};
