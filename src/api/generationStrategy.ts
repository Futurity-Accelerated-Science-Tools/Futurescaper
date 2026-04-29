/**
 * Generation Strategy Resolver
 *
 * Converts a user-facing GenerationConfig (strategy + density) into
 * concrete branching parameters for each order of consequences.
 *
 * Verbosity silently adjusts the numbers:
 *   concise  → ×1.3 (more nodes fit since each is smaller)
 *   normal   → ×1.0
 *   detailed → ×0.7 (fewer nodes since each is larger)
 */

import {
  GenerationConfig,
  ResolvedGenerationParams,
  BranchingStrategy,
  DensityPreset,
  DEFAULT_GENERATION_CONFIG,
} from '../types';

// ── Raw parameter tables (before verbosity scaling) ─────────────

type RawParams = Omit<ResolvedGenerationParams, 'maxOrders'> & { maxOrders: 3 | 4 | 5 };

const ASYMMETRIC_PARAMS: Record<DensityPreset, RawParams> = {
  focused: {
    firstOrderCount: 6,
    secondOrder: { mode: 'priority', priorityCount: 2, deepChildCount: 2, lightChildCount: 0 },
    thirdOrder: { expandCount: 2, childrenPer: 1 },
    ideas: { leafCount: 2, ideasPer: 1 },
    maxOrders: 3,
  },
  standard: {
    firstOrderCount: 6,
    secondOrder: { mode: 'priority', priorityCount: 2, deepChildCount: 4, lightChildCount: 1 },
    thirdOrder: { expandCount: 4, childrenPer: 2 },
    ideas: { leafCount: 4, ideasPer: 1 },
    maxOrders: 3,
  },
  comprehensive: {
    firstOrderCount: 6,
    secondOrder: { mode: 'priority', priorityCount: 3, deepChildCount: 5, lightChildCount: 2 },
    thirdOrder: { expandCount: 6, childrenPer: 3 },
    ideas: { leafCount: 6, ideasPer: 1 },
    maxOrders: 3,
  },
};

const BALANCED_PARAMS: Record<DensityPreset, RawParams> = {
  focused: {
    firstOrderCount: 6,
    secondOrder: { mode: 'uniform', deepChildCount: 1 },
    thirdOrder: { expandCount: 0, childrenPer: 0 },
    ideas: { leafCount: 2, ideasPer: 1 },
    maxOrders: 3,
  },
  standard: {
    firstOrderCount: 6,
    secondOrder: { mode: 'uniform', deepChildCount: 2 },
    thirdOrder: { expandCount: 4, childrenPer: 2 },
    ideas: { leafCount: 3, ideasPer: 1 },
    maxOrders: 3,
  },
  comprehensive: {
    firstOrderCount: 6,
    secondOrder: { mode: 'uniform', deepChildCount: 3 },
    thirdOrder: { expandCount: 6, childrenPer: 3 },
    ideas: { leafCount: 5, ideasPer: 1 },
    maxOrders: 3,
  },
};

const BREADTH_PARAMS: Record<DensityPreset, RawParams> = {
  focused: {
    firstOrderCount: 8,
    secondOrder: { mode: 'uniform', deepChildCount: 1 },
    thirdOrder: { expandCount: 0, childrenPer: 0 },
    ideas: { leafCount: 2, ideasPer: 1 },
    maxOrders: 3,
  },
  standard: {
    firstOrderCount: 8,
    secondOrder: { mode: 'uniform', deepChildCount: 2 },
    thirdOrder: { expandCount: 3, childrenPer: 1 },
    ideas: { leafCount: 3, ideasPer: 1 },
    maxOrders: 3,
  },
  comprehensive: {
    firstOrderCount: 10,
    secondOrder: { mode: 'uniform', deepChildCount: 3 },
    thirdOrder: { expandCount: 4, childrenPer: 2 },
    ideas: { leafCount: 5, ideasPer: 1 },
    maxOrders: 3,
  },
};

const DEPTH_PARAMS: Record<DensityPreset, RawParams> = {
  focused: {
    firstOrderCount: 4,
    secondOrder: { mode: 'uniform', deepChildCount: 1 },
    thirdOrder: { expandCount: 2, childrenPer: 1 },
    fourthOrder: { expandCount: 1, childrenPer: 1 },
    ideas: { leafCount: 2, ideasPer: 1 },
    maxOrders: 4,
  },
  standard: {
    firstOrderCount: 4,
    secondOrder: { mode: 'priority', priorityCount: 2, deepChildCount: 2, lightChildCount: 1 },
    thirdOrder: { expandCount: 3, childrenPer: 2 },
    fourthOrder: { expandCount: 2, childrenPer: 2 },
    fifthOrder: { expandCount: 2, childrenPer: 1 },
    ideas: { leafCount: 3, ideasPer: 1 },
    maxOrders: 5,
  },
  comprehensive: {
    firstOrderCount: 5,
    secondOrder: { mode: 'priority', priorityCount: 3, deepChildCount: 3, lightChildCount: 2 },
    thirdOrder: { expandCount: 4, childrenPer: 3 },
    fourthOrder: { expandCount: 3, childrenPer: 2 },
    fifthOrder: { expandCount: 2, childrenPer: 2 },
    ideas: { leafCount: 5, ideasPer: 1 },
    maxOrders: 5,
  },
};

const STRATEGY_TABLE: Record<BranchingStrategy, Record<DensityPreset, RawParams>> = {
  asymmetric: ASYMMETRIC_PARAMS,
  balanced: BALANCED_PARAMS,
  breadth: BREADTH_PARAMS,
  depth: DEPTH_PARAMS,
};

// ── Verbosity multipliers ───────────────────────────────────────

const VERBOSITY_MULTIPLIER: Record<string, number> = {
  concise: 1.3,
  detailed: 0.7,
};

function scaleCount(base: number, multiplier: number): number {
  if (base === 0) return 0;
  return Math.max(1, Math.round(base * multiplier));
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Resolve a user-facing GenerationConfig into concrete branching parameters.
 * Verbosity silently adjusts child counts (not first-order count or structure).
 */
export function resolveGenerationParams(
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  verbosity: 'concise' | 'detailed' = 'concise',
): ResolvedGenerationParams {
  const raw = STRATEGY_TABLE[config.strategy][config.density];
  const m = VERBOSITY_MULTIPLIER[verbosity] ?? 1.0;

  // Scale child counts but NOT firstOrderCount (that's structural)
  const params: ResolvedGenerationParams = {
    firstOrderCount: raw.firstOrderCount,
    secondOrder: {
      mode: raw.secondOrder.mode,
      deepChildCount: scaleCount(raw.secondOrder.deepChildCount, m),
      ...(raw.secondOrder.mode === 'priority' ? {
        priorityCount: raw.secondOrder.priorityCount,
        lightChildCount: raw.secondOrder.lightChildCount === 0 ? 0 : scaleCount(raw.secondOrder.lightChildCount!, m),
      } : {}),
    },
    thirdOrder: {
      expandCount: raw.thirdOrder.expandCount,
      childrenPer: scaleCount(raw.thirdOrder.childrenPer, m),
    },
    ideas: {
      leafCount: raw.ideas.leafCount,
      ideasPer: raw.ideas.ideasPer, // always 1 idea per leaf
    },
    maxOrders: raw.maxOrders,
  };

  if (raw.fourthOrder) {
    params.fourthOrder = {
      expandCount: raw.fourthOrder.expandCount,
      childrenPer: scaleCount(raw.fourthOrder.childrenPer, m),
    };
  }
  if (raw.fifthOrder) {
    params.fifthOrder = {
      expandCount: raw.fifthOrder.expandCount,
      childrenPer: scaleCount(raw.fifthOrder.childrenPer, m),
    };
  }

  return params;
}

/**
 * Estimate total node count for display in the UI.
 * Walks through the resolved params to compute an approximate total.
 */
export function estimateNodeCount(
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  verbosity: 'concise' | 'detailed' = 'concise',
): number {
  const p = resolveGenerationParams(config, verbosity);
  let total = 0;

  // 1st order
  const firstOrder = p.firstOrderCount;
  total += firstOrder;

  // 2nd order
  let secondOrderCount: number;
  if (p.secondOrder.mode === 'priority') {
    const deepBranches = p.secondOrder.priorityCount ?? 2;
    const lightBranches = firstOrder - deepBranches;
    const lightChildren = p.secondOrder.lightChildCount ?? 0;
    secondOrderCount = (deepBranches * p.secondOrder.deepChildCount) + (lightBranches * lightChildren);
  } else {
    secondOrderCount = firstOrder * p.secondOrder.deepChildCount;
  }
  total += secondOrderCount;

  // 3rd order
  let thirdOrderCount = 0;
  if (p.thirdOrder.expandCount > 0 && p.thirdOrder.childrenPer > 0) {
    const expandable = Math.min(p.thirdOrder.expandCount, secondOrderCount);
    thirdOrderCount = expandable * p.thirdOrder.childrenPer;
    total += thirdOrderCount;
  }

  // 4th order
  let fourthOrderCount = 0;
  if (p.fourthOrder && p.fourthOrder.expandCount > 0 && p.fourthOrder.childrenPer > 0) {
    const expandable = Math.min(p.fourthOrder.expandCount, thirdOrderCount);
    fourthOrderCount = expandable * p.fourthOrder.childrenPer;
    total += fourthOrderCount;
  }

  // 5th order
  let fifthOrderCount = 0;
  if (p.fifthOrder && p.fifthOrder.expandCount > 0 && p.fifthOrder.childrenPer > 0) {
    const expandable = Math.min(p.fifthOrder.expandCount, fourthOrderCount);
    fifthOrderCount = expandable * p.fifthOrder.childrenPer;
    total += fifthOrderCount;
  }

  // Ideas
  total += p.ideas.leafCount * p.ideas.ideasPer;

  return total;
}
