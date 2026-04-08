import React from 'react';
import { STEEPCategory, Sentiment, ConsequenceOrder, STEEP_LABELS, STEEP_COLORS, ORDER_LABELS } from '../types';
import { TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';

interface FilterPanelProps {
  categories: STEEPCategory[];
  sentiments: Sentiment[];
  orders: ConsequenceOrder[];
  onToggleCategory: (category: STEEPCategory) => void;
  onToggleSentiment: (sentiment: Sentiment) => void;
  onToggleOrder: (order: ConsequenceOrder) => void;
}

export function FilterPanel({
  categories,
  sentiments,
  orders,
  onToggleCategory,
  onToggleSentiment,
  onToggleOrder,
}: FilterPanelProps) {
  const allCategories: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
  const allSentiments: Sentiment[] = ['positive', 'negative', 'neutral'];
  const allOrders: ConsequenceOrder[] = [1, 2, 3];

  const sentimentConfig: Record<Sentiment, { icon: typeof TrendingUp; label: string; color: string }> = {
    positive: { icon: TrendingUp, label: 'Positive', color: '#10b981' },
    negative: { icon: TrendingDown, label: 'Negative', color: '#ef4444' },
    neutral: { icon: Minus, label: 'Neutral', color: '#f59e0b' },
  };

  const orderShortLabels: Record<ConsequenceOrder, string> = {
    1: '1st',
    2: '2nd',
    3: '3rd',
  };

  return (
    <div className="p-4 border-b border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-slate-500" />
        <h3 className="font-semibold text-slate-700">Filters</h3>
      </div>

      {/* STEEP Categories */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">STEEP Categories</p>
        <div className="space-y-1">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                categories.includes(cat)
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: categories.includes(cat) ? STEEP_COLORS[cat] : '#e2e8f0' }}
              />
              {STEEP_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Sentiment */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sentiment</p>
        <div className="flex gap-1">
          {allSentiments.map((sent) => {
            const config = sentimentConfig[sent];
            const Icon = config.icon;
            const isActive = sentiments.includes(sent);
            return (
              <button
                key={sent}
                onClick={() => onToggleSentiment(sent)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                  isActive ? 'text-white' : 'bg-slate-100 text-slate-500'
                }`}
                style={{ backgroundColor: isActive ? config.color : undefined }}
              >
                <Icon className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Order */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Consequence Order</p>
        <div className="flex flex-wrap gap-1">
          {allOrders.map((ord) => (
            <button
              key={ord}
              onClick={() => onToggleOrder(ord)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                orders.includes(ord)
                  ? 'bg-seed text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              title={ORDER_LABELS[ord]}
            >
              {orderShortLabels[ord]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          1: Direct → 2: Ripple → 3: Cascade
        </p>
      </div>
    </div>
  );
}
