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
  // Multi-parent support (DAG):
  //   [] = unattached (floating node, no parents)
  //   ['seed'] or ['c1-...'] = single parent (normal tree node)
  //   ['c1-...', 'c2-...'] = multiple parents (DAG node)
  parentIds: string[];
  timeFrame?: TimeFrame;
  probability?: Probability;
  geographicScope?: GeographicScope;
  importance?: Importance;
  isManual?: boolean; // True if manually added by user
  expandedAt?: number; // Timestamp when added via expansion (free prompt or node expand)
  nodeType?: NodeType; // 'solution' or 'idea' for yellow action nodes, defaults to 'consequence'
  pinned?: boolean; // True if user manually dragged this node — auto-layout won't reposition it
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
  verbosity?: 'concise' | 'detailed';
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

// ── STEEP colors (muted tints — used as subtle background hints) ──
// The primary differentiator is the symbol; color is secondary.
export const STEEP_COLORS: Record<STEEPCategory, string> = {
  social: '#e91e8c',       // Legacy vivid — use STEEP_COLORS_MUTED for new UI
  technological: '#00d4aa',
  economic: '#c8e600',
  environmental: '#22c55e',
  political: '#ff6b35',
  ethical: '#7c5cfc',
};

// Muted STEEP colors for node backgrounds (light mode values)
export const STEEP_COLORS_MUTED: Record<STEEPCategory, string> = {
  social: '#F5E0EA',
  technological: '#DFF5EF',
  economic: '#F5F2D9',
  environmental: '#E0F5E6',
  political: '#FDE8DF',
  ethical: '#EDDFFF',
};

// STEEP symbols — primary category differentiator
export const STEEP_SYMBOLS: Record<STEEPCategory, string> = {
  social: '◉',         // People / community
  technological: '⬡',  // Hexagon / tech
  economic: '◆',       // Diamond / value
  environmental: '❋',  // Leaf-like / nature
  political: '⬟',      // Pentagon / governance
  ethical: '◎',        // Target / moral compass
};

// Chakra semantic token names for STEEP backgrounds
export function getSTEEPBgToken(category: STEEPCategory): string {
  return `steepBg.${category}`;
}

// ── Sentiment: monochrome symbols only ──
// No color differentiation — sentiment communicated through symbols
export const SENTIMENT_SYMBOLS: Record<Sentiment, string> = {
  positive: '↑',
  negative: '↓',
  neutral: '—',
};

// Legacy sentiment colors kept for backward compat during migration
export const SENTIMENT_COLORS: Record<Sentiment, { bg: string; border: string; text: string }> = {
  positive: { bg: '#e6fff5', border: '#00d4aa', text: '#0a6847' },
  negative: { bg: '#fff0f3', border: '#ff4d6d', text: '#a4133c' },
  neutral: { bg: '#e8eaef', border: '#8891a0', text: '#2d3341' },
};

// Safe accessor — falls back to neutral when sentiment is undefined/invalid
export function getSentimentColors(sentiment: Sentiment | undefined | string) {
  return SENTIMENT_COLORS[sentiment as Sentiment] || SENTIMENT_COLORS.neutral;
}

// Solution/Opportunity colors (kept for backward compat, will move to theme tokens)
export const SOLUTION_COLORS = {
  bg: '#fff7e6',
  border: '#ff9f1c',
  text: '#7a4100',
};

// Probability symbols
export const PROBABILITY_SYMBOLS: Record<Probability, string> = {
  probable: '●',    // Solid — high confidence
  plausible: '◐',   // Half — medium confidence
  possible: '○',    // Open — low confidence
  wildcard: '✦',    // Star — unexpected
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

// ── Generation Configuration ──────────────────────────────────────

export type BranchingStrategy = 'asymmetric' | 'balanced' | 'breadth' | 'depth';
export type DensityPreset = 'focused' | 'standard' | 'comprehensive';

export interface GenerationConfig {
  strategy: BranchingStrategy;
  density: DensityPreset;
}

/** Internal resolved parameters — not user-facing */
export interface ResolvedGenerationParams {
  firstOrderCount: number;
  secondOrder: {
    mode: 'uniform' | 'priority';
    priorityCount?: number;       // how many branches get deep treatment (priority mode)
    deepChildCount: number;       // children per deep/uniform branch
    lightChildCount?: number;     // children per light branch (priority mode only)
  };
  thirdOrder: {
    expandCount: number;          // how many 2nd-order nodes to expand
    childrenPer: number;          // children per expanded node
  };
  fourthOrder?: {
    expandCount: number;
    childrenPer: number;
  };
  fifthOrder?: {
    expandCount: number;
    childrenPer: number;
  };
  ideas: {
    leafCount: number;
    ideasPer: number;
  };
  maxOrders: 3 | 4 | 5;
}

export const STRATEGY_LABELS: Record<BranchingStrategy, string> = {
  asymmetric: 'Asymmetric Priority',
  balanced: 'Balanced',
  breadth: 'Breadth-First',
  depth: 'Depth-First',
};

export const STRATEGY_DESCRIPTIONS: Record<BranchingStrategy, string> = {
  asymmetric: 'Importance-driven. Top nodes get deep exploration, others light.',
  balanced: 'Equal branching. Every node gets the same number of children.',
  breadth: 'Wide and shallow. Many first-order nodes, fewer children each.',
  depth: 'Narrow and deep. Fewer starting nodes, long causal chains.',
};

export const DENSITY_LABELS: Record<DensityPreset, string> = {
  focused: 'Focused',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

export const DENSITY_DESCRIPTIONS: Record<DensityPreset, string> = {
  focused: 'Quick overview',
  standard: 'Balanced analysis',
  comprehensive: 'Deep dive',
};

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  strategy: 'asymmetric',
  density: 'standard',
};

// ── Report Types ─────────────────────────────────────────────────

export type ReportGenerationPhase = 'idle' | 'computing-stats' | 'linking-subjects' | 'synthesizing' | 'ready';

export type InsightType = 'critical-risk' | 'hidden-opportunity' | 'convergence-warning' | 'sentiment-inversion' | 'blind-spot' | 'cross-domain-bridge' | 'leverage-point';

/** A convergence point: a node with multiple non-sibling parents */
export interface ConvergencePoint {
  nodeId: string;
  parentIds: string[];
  parentCount: number;
}

/** A leverage point: a negative node whose subtree has the most negative descendants */
export interface LeveragePoint {
  nodeId: string;
  negativeDescendantCount: number;
  descendantIds: string[];
}

/** A sentiment inversion: a chain where sentiment flips */
export interface SentimentInversion {
  /** The chain of consequence IDs showing the inversion path */
  chain: string[];
  /** 'positive-to-negative' or 'negative-to-positive' */
  direction: 'positive-to-negative' | 'negative-to-positive';
}

/** A cross-domain bridge: a node whose children span many STEEPE categories */
export interface CrossDomainBridge {
  nodeId: string;
  category: STEEPCategory;
  childCategories: STEEPCategory[];
  uniqueCategoryCount: number;
}

/** Structural insights derived from graph topology (no API call) */
export interface StructuralInsights {
  convergencePoints: ConvergencePoint[];
  leveragePoints: LeveragePoint[];
  sentimentInversions: SentimentInversion[];
  blindSpotCategories: STEEPCategory[];
  crossDomainBridges: CrossDomainBridge[];
}

/** AI-generated insight card */
export interface InsightCard {
  type: InsightType;
  title: string;
  description: string;
  consequenceIds: string[];
}

/** AI-generated or graph-derived idea recommendation */
export interface IdeaRecommendation {
  title: string;
  description: string;
  addressesInsight: string;
  feasibility: 'high' | 'medium' | 'low';
  isExisting: boolean;
  existingNodeId?: string;
}

/** Layer 1 — algorithmic statistics computed from graph data (no API call) */
export interface GraphStatistics {
  totalConsequences: number;
  totalSolutions: number;
  byCategory: Record<STEEPCategory, number>;
  bySentiment: Record<Sentiment, number>;
  byOrder: Record<ConsequenceOrder, number>;
  byProbability: Record<Probability, number>;
  byImportance: Record<Importance, number>;
  byTimeFrame: Record<TimeFrame, number>;
  wildcardCount: number;
  criticalNegativeCount: number;
  /** Consequence IDs that have no solutions targeting them */
  unsolvedConsequenceIds: string[];
  /** Consequence IDs with importance critical/high AND sentiment negative */
  highRiskIds: string[];
  /** Cascading risk: negative consequences whose children are also negative */
  cascadingRiskChains: string[][];
}

/** A single section of the report */
export interface ReportSection {
  id: string;
  title: string;
  icon: string;
  type: 'ai-prose' | 'statistics' | 'methodology';
  content: string;
  /** Consequence IDs that should be rendered as callout boxes in this section */
  highlightedConsequenceIds?: string[];
  /** Optional sub-sections for structured content within a section */
  subsections?: ReportSubSection[];
}

export interface ReportSubSection {
  id: string;
  title: string;
  type: 'text' | 'metric' | 'list' | 'distribution';
  content: string;
  /** For 'distribution' type — category label → count */
  data?: Record<string, number>;
}

/** Complete report output from the generation pipeline */
export interface ReportData {
  generatedAt: string;
  input: FutureInput;
  statistics: GraphStatistics;
  structuralInsights: StructuralInsights;
  sections: ReportSection[];
  insightCards: InsightCard[];
  ideaRecommendations: IdeaRecommendation[];
  /** Full consequence array for rendering callout boxes and the embedded map */
  consequences: Consequence[];
  /** Connected subjects from FAST knowledge base */
  subjects?: import('./api/subjects').RelevantSubject[];
}
