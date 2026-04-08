export type Sentiment = 'positive' | 'negative' | 'neutral';
export type STEEPCategory = 'social' | 'technological' | 'economic' | 'environmental' | 'political' | 'ethical';
export type ConsequenceOrder = 1 | 2 | 3 | 4 | 5;
export type Horizon = 'near' | 'medium' | 'far';
export type TimeFrame = 'immediate' | 'short-term' | 'long-term';
export type Probability = 'probable' | 'plausible' | 'possible' | 'wildcard';
export type SolutionType = 'macro' | 'micro';
export type GeographicScope = 'local' | 'regional' | 'global';
export type Importance = 'critical' | 'high' | 'medium' | 'low';
export type NodeType = 'consequence' | 'solution' | 'idea';

export interface Consequence {
  id: string;
  text: string;
  title?: string; // Short memorable name for solution/idea nodes (e.g. "digital funerals", "moralgorithm")
  sentiment: Sentiment;
  category: STEEPCategory;
  order: ConsequenceOrder;
  parentId: string | null;
  timeFrame?: TimeFrame;
  probability?: Probability;
  geographicScope?: GeographicScope;
  importance?: Importance;
  isManual?: boolean; // True if manually added by user
  expandedAt?: number; // Timestamp when added via expansion (free prompt or node expand)
  nodeType?: NodeType; // 'solution' or 'idea' for yellow action nodes, defaults to 'consequence'
}

export interface Solution {
  id: string;
  text: string;
  type: SolutionType;
  category: STEEPCategory;
  targetConsequenceIds: string[];
  feasibility: 'high' | 'medium' | 'low';
  timeToImplement: TimeFrame;
}

export interface FutureInput {
  title: string;
  description: string;
  horizon: Horizon;
  perspective?: string;  // Whose perspective are we analyzing from?
  sourceText?: string;
  sourceUrl?: string;
}

export interface FuturescapeState {
  input: FutureInput | null;
  consequences: Consequence[];
  solutions: Solution[];
  generationPhase: 'idle' | 'analyzing' | 'first-order' | 'second-order' | 'third-order' | 'solutions' | 'complete';
  selectedNode: string | null;
  filters: {
    categories: STEEPCategory[];
    sentiments: Sentiment[];
    orders: ConsequenceOrder[];
    timeFrames: TimeFrame[];
    probabilities: Probability[];
    importance: Importance[];
  };
}

export const STEEP_LABELS: Record<STEEPCategory, string> = {
  social: 'Social',
  technological: 'Technological',
  economic: 'Economic',
  environmental: 'Environmental',
  political: 'Political',
  ethical: 'Ethical',
};

export const STEEP_COLORS: Record<STEEPCategory, string> = {
  social: '#e91e8c',       // Hot pink/magenta
  technological: '#00d4aa', // Cyan/teal
  economic: '#c8e600',      // Yellow-lime
  environmental: '#22c55e', // Green
  political: '#ff6b35',     // Orange
  ethical: '#7c5cfc',       // Blue-purple
};

// Sentiment colors: vibrant Cosmograph-inspired
export const SENTIMENT_COLORS: Record<Sentiment, { bg: string; border: string; text: string }> = {
  positive: { bg: '#e6fff5', border: '#00d4aa', text: '#0a6847' },   // Teal-green
  negative: { bg: '#fff0f3', border: '#ff4d6d', text: '#a4133c' },   // Hot coral-red
  neutral: { bg: '#e8eaef', border: '#8891a0', text: '#2d3341' },    // Slate blue-gray
};

// Safe accessor — falls back to neutral when sentiment is undefined/invalid
export function getSentimentColors(sentiment: Sentiment | undefined | string) {
  return SENTIMENT_COLORS[sentiment as Sentiment] || SENTIMENT_COLORS.neutral;
}

// Solution/Opportunity colors (Bright amber-orange)
export const SOLUTION_COLORS = {
  bg: '#fff7e6',
  border: '#ff9f1c',
  text: '#7a4100',
};

export const HORIZON_LABELS: Record<Horizon, string> = {
  near: '1-3 years',
  medium: '3-10 years',
  far: '10+ years',
};

export const TIMEFRAME_LABELS: Record<TimeFrame, string> = {
  immediate: 'Immediate (days-weeks)',
  'short-term': 'Short-term (months-2 years)',
  'long-term': 'Long-term (2+ years)',
};

export const PROBABILITY_LABELS: Record<Probability, string> = {
  probable: 'Probable (>70%)',
  plausible: 'Plausible (30-70%)',
  possible: 'Possible (10-30%)',
  wildcard: 'Wildcard (<10%)',
};

export const PROBABILITY_COLORS: Record<Probability, string> = {
  probable: '#00d4aa',
  plausible: '#7c5cfc',
  possible: '#ff9f1c',
  wildcard: '#ff4d6d',
};

export const ORDER_LABELS: Record<ConsequenceOrder, string> = {
  1: '1st Order (Direct)',
  2: '2nd Order (Ripple)',
  3: '3rd Order (Cascade)',
  4: '4th Order (Systemic)',
  5: '5th Order (Wildcard)',
};

export const IMPORTANCE_SIZES: Record<Importance, number> = {
  critical: 1.4,
  high: 1.2,
  medium: 1.0,
  low: 0.8,
};
