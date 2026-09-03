import React, { useState, useMemo } from 'react';
import { Search, X, TrendingUp, Check, ChevronRight } from 'lucide-react';
import type { OtcAsset } from '@/types';
import { playClickSound } from '@/lib/sound';

interface AssetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: OtcAsset[];
  selectedAsset: OtcAsset;
  onSelectAsset: (asset: OtcAsset) => void;
}

export function AssetSelectorModal({
  isOpen,
  onClose,
  assets,
  selectedAsset,
  onSelectAsset,
}: AssetSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'forex' | 'stock' | 'crypto' | 'commodity' | 'index'>('all');

  const categories = [
    { id: 'all', label: 'Todos', count: assets.length },
    { id: 'forex', label: 'Forex OTC', count: assets.filter((a) => a.category === 'forex').length },
    { id: 'stock', label: 'Ações OTC', count: assets.filter((a) => a.category === 'stock').length },
    { id: 'crypto', label: 'Cripto OTC', count: assets.filter((a) => a.category === 'crypto').length },
    { id: 'commodity', label: 'Commodities', count: assets.filter((a) => a.category === 'commodity').length },
    { id: 'index', label: 'Índices OTC', count: assets.filter((a) => a.category === 'index').length },
  ];

  const filteredAssets = useMemo(() => {
    return assets.filter((item) => {
      const matchCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchSearch =
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.label.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [assets, activeCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Catálogo de Ativos OTC ({assets.length})</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Ctrl + V
                </span>
              </div>
              <p className="text-xs text-gray-400">Selecione o par para operar no modo 1 Minuto</p>
            </div>
          </div>
          <button
            id="close-asset-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-4 border-b border-gray-800 space-y-3 bg-gray-950/40">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="asset-search-input"
              type="text"
              placeholder="Buscar por par (ex: EURUSD, BTC, Apple, Gold, SP500)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/80 transition-colors"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  playClickSound();
                  setActiveCategory(cat.id as any);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? 'bg-emerald-500 text-gray-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-gray-800/80 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeCategory === cat.id ? 'bg-emerald-950/40 text-emerald-950' : 'bg-gray-900 text-gray-500'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Assets Grid / List */}
        <div className="p-3 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {filteredAssets.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 text-sm">
              Nenhum ativo encontrado para &ldquo;{searchTerm}&rdquo;
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isSelected = asset.id === selectedAsset.id;
              return (
                <button
                  key={asset.id}
                  id={`asset-card-${asset.id}`}
                  onClick={() => {
                    playClickSound();
                    onSelectAsset(asset);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all group ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/50'
                      : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60 hover:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white truncate group-hover:text-emerald-400 transition-colors">
                        {asset.symbol}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 truncate mt-0.5">
                      {asset.label}
                    </span>
                    <span className="text-[10px] uppercase font-mono text-gray-500 mt-1">
                      {asset.category}
                    </span>
                  </div>

                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <div className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                      {asset.payout || 88}%
                    </div>
                    <span className="text-[9px] text-gray-500 mt-1 font-mono">
                      {asset.precision || 5} dec
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-gray-950 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>Exibindo {filteredAssets.length} de {assets.length} ativos OTC</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-medium">
            Payout médio: 88% • Tempo de expiração: 1M
          </div>
        </div>
      </div>
    </div>
  );
}
