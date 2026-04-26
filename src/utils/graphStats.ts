import {
  Consequence,
  Solution,
  GraphStatistics,
  StructuralInsights,
  ConvergencePoint,
  LeveragePoint,
  SentimentInversion,
  CrossDomainBridge,
  STEEPCategory,
  Sentiment,
  ConsequenceOrder,
  Probability,
  Importance,
  TimeFrame,
} from '../types';

const STEEP_CATEGORIES: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
const SENTIMENTS: Sentiment[] = ['positive', 'negative', 'neutral'];
const ORDERS: ConsequenceOrder[] = [1, 2, 3, 4, 5];
const PROBABILITIES: Probability[] = ['probable', 'plausible', 'possible', 'wildcard'];
const IMPORTANCE_LEVELS: Importance[] = ['critical', 'high', 'medium', 'low'];
const TIMEFRAMES: TimeFrame[] = ['immediate', 'short-term', 'long-term'];

/** Build a zero-initialized record for a set of keys */
function initRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  const rec = {} as Record<K, number>;
  for (const k of keys) rec[k] = 0;
  return rec;
}

/**
 * Find cascading risk chains: sequences of connected negative consequences.
 * A chain is a path from a negative node through children that are also negative.
 * Returns chains of length >= 2.
 */
function findCascadingRiskChains(consequences: Consequence[]): string[][] {
  const negatives = new Set(
    consequences
      .filter(c => c.sentiment === 'negative' && (!c.nodeType || c.nodeType === 'consequence'))
      .map(c => c.id)
  );

  // Build parent→children map
  const childrenOf = new Map<string, string[]>();
  for (const c of consequences) {
    if (!c.nodeType || c.nodeType === 'consequence') {
      for (const pid of c.parentIds) {
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid)!.push(c.id);
      }
    }
  }

  const chains: string[][] = [];
  const visited = new Set<string>();

  // DFS from each negative root (negative node whose parents are not negative)
  for (const id of negatives) {
    const c = consequences.find(n => n.id === id);
    if (!c) continue;
    const isRoot = c.parentIds.length === 0
      || c.parentIds.every(pid => pid === 'seed' || !negatives.has(pid));
    if (!isRoot) continue;

    // BFS/DFS to find longest chain from this root
    const stack: { nodeId: string; path: string[] }[] = [{ nodeId: id, path: [id] }];
    while (stack.length > 0) {
      const { nodeId, path } = stack.pop()!;
      const kids = (childrenOf.get(nodeId) || []).filter(kid => negatives.has(kid));

      if (kids.length === 0) {
        // Leaf of chain — record if length >= 2
        if (path.length >= 2) chains.push(path);
      } else {
        for (const kid of kids) {
          if (!path.includes(kid)) { // Avoid cycles in DAG
            stack.push({ nodeId: kid, path: [...path, kid] });
          }
        }
      }
    }
  }

  // Deduplicate: keep only the longest chain for each starting node
  const longestByRoot = new Map<string, string[]>();
  for (const chain of chains) {
    const root = chain[0];
    if (!longestByRoot.has(root) || chain.length > longestByRoot.get(root)!.length) {
      longestByRoot.set(root, chain);
    }
  }

  return Array.from(longestByRoot.values()).sort((a, b) => b.length - a.length);
}

/**
 * Compute all graph statistics from consequence and solution data.
 * Pure function, no API calls, instant.
 */
export function computeGraphStatistics(
  consequences: Consequence[],
  solutions: Solution[],
): GraphStatistics {
  // Filter to actual consequences (not solution/idea nodes)
  const nodes = consequences.filter(c => !c.nodeType || c.nodeType === 'consequence');

  const byCategory = initRecord(STEEP_CATEGORIES);
  const bySentiment = initRecord(SENTIMENTS);
  const byOrder = initRecord(ORDERS);
  const byProbability = initRecord(PROBABILITIES);
  const byImportance = initRecord(IMPORTANCE_LEVELS);
  const byTimeFrame = initRecord(TIMEFRAMES);

  let wildcardCount = 0;
  let criticalNegativeCount = 0;
  const highRiskIds: string[] = [];

  for (const c of nodes) {
    byCategory[c.category]++;
    bySentiment[c.sentiment]++;
    byOrder[c.order]++;
    if (c.probability) byProbability[c.probability]++;
    if (c.importance) byImportance[c.importance]++;
    if (c.timeFrame) byTimeFrame[c.timeFrame]++;

    if (c.probability === 'wildcard') wildcardCount++;

    if (c.sentiment === 'negative' && (c.importance === 'critical' || c.importance === 'high')) {
      criticalNegativeCount++;
      highRiskIds.push(c.id);
    }
  }

  // Count ideas/solutions embedded in the consequences array (nodeType: 'solution' | 'idea')
  const ideaNodes = consequences.filter(c => c.nodeType === 'solution' || c.nodeType === 'idea');

  // Find consequences with no solutions addressing them.
  // A consequence is "solved" if:
  //   (a) a legacy Solution object targets it via targetConsequenceIds, OR
  //   (b) an idea/solution node in the consequences array lists it as a parent
  const solvedIds = new Set([
    ...solutions.flatMap(s => s.targetConsequenceIds),
    ...ideaNodes.flatMap(n => n.parentIds.filter(pid => pid !== 'seed')),
  ]);
  const unsolvedConsequenceIds = nodes
    .filter(c => !solvedIds.has(c.id))
    .map(c => c.id);

  const totalSolutions = solutions.length + ideaNodes.length;

  const cascadingRiskChains = findCascadingRiskChains(consequences);

  return {
    totalConsequences: nodes.length,
    totalSolutions,
    byCategory,
    bySentiment,
    byOrder,
    byProbability,
    byImportance,
    byTimeFrame,
    wildcardCount,
    criticalNegativeCount,
    unsolvedConsequenceIds,
    highRiskIds,
    cascadingRiskChains,
  };
}

// ── Structural Insight Detection ─────────────────────────────────

/** Build parent→children map for consequence nodes */
function buildChildrenMap(consequences: Consequence[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of consequences) {
    if (!c.nodeType || c.nodeType === 'consequence') {
      for (const pid of c.parentIds) {
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(c.id);
      }
    }
  }
  return map;
}

/** Convergence points: nodes with multiple non-sibling parents */
function findConvergencePoints(consequences: Consequence[]): ConvergencePoint[] {
  const nodes = consequences.filter(c => !c.nodeType || c.nodeType === 'consequence');
  return nodes
    .filter(c => c.parentIds.length >= 2 && !c.parentIds.includes('seed'))
    .map(c => ({
      nodeId: c.id,
      parentIds: c.parentIds,
      parentCount: c.parentIds.length,
    }))
    .sort((a, b) => b.parentCount - a.parentCount);
}

/** Leverage points: negative nodes with the largest negative subtree */
function findLeveragePoints(consequences: Consequence[]): LeveragePoint[] {
  const nodes = consequences.filter(c => !c.nodeType || c.nodeType === 'consequence');
  const negativeIds = new Set(nodes.filter(c => c.sentiment === 'negative').map(c => c.id));
  const childrenOf = buildChildrenMap(consequences);

  // Count negative descendants for each negative node
  const results: LeveragePoint[] = [];

  for (const id of negativeIds) {
    const descendants: string[] = [];
    const queue = [...(childrenOf.get(id) || [])];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const kid = queue.shift()!;
      if (seen.has(kid)) continue;
      seen.add(kid);
      if (negativeIds.has(kid)) {
        descendants.push(kid);
        const grandkids = childrenOf.get(kid) || [];
        queue.push(...grandkids);
      }
    }

    if (descendants.length >= 1) {
      results.push({
        nodeId: id,
        negativeDescendantCount: descendants.length,
        descendantIds: descendants,
      });
    }
  }

  return results.sort((a, b) => b.negativeDescendantCount - a.negativeDescendantCount);
}

/** Sentiment inversions: parent→child where sentiment flips */
function findSentimentInversions(consequences: Consequence[]): SentimentInversion[] {
  const nodes = consequences.filter(c => !c.nodeType || c.nodeType === 'consequence');
  const byId = new Map(nodes.map(c => [c.id, c]));
  const childrenOf = buildChildrenMap(consequences);

  const inversions: SentimentInversion[] = [];

  // Look for chains starting positive that go negative (or vice versa)
  for (const c of nodes) {
    if (c.sentiment === 'neutral') continue;
    const startSentiment = c.sentiment;
    const targetSentiment = startSentiment === 'positive' ? 'negative' : 'positive';

    // BFS for shortest inversion path
    const queue: { id: string; path: string[] }[] = [{ id: c.id, path: [c.id] }];
    const seen = new Set<string>([c.id]);

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      const kids = childrenOf.get(id) || [];

      for (const kid of kids) {
        if (seen.has(kid)) continue;
        seen.add(kid);
        const kidNode = byId.get(kid);
        if (!kidNode) continue;
        const newPath = [...path, kid];

        if (kidNode.sentiment === targetSentiment && newPath.length >= 2) {
          inversions.push({
            chain: newPath,
            direction: startSentiment === 'positive' ? 'positive-to-negative' : 'negative-to-positive',
          });
          break; // Only record shortest inversion from this root
        }

        // Continue if same or neutral sentiment
        if (kidNode.sentiment === startSentiment || kidNode.sentiment === 'neutral') {
          queue.push({ id: kid, path: newPath });
        }
      }
    }
  }

  // Deduplicate: keep longest inversions, remove subsets
  const unique = inversions
    .sort((a, b) => b.chain.length - a.chain.length)
    .filter((inv, i, arr) => {
      // Remove if this chain is a prefix of a longer one
      return !arr.some((other, j) =>
        j < i && other.chain.length > inv.chain.length &&
        other.chain.slice(0, inv.chain.length).every((id, k) => id === inv.chain[k])
      );
    });

  return unique.slice(0, 10); // Top 10
}

/** Blind spots: STEEPE categories with significantly fewer consequences than average */
function findBlindSpots(byCategory: Record<STEEPCategory, number>): STEEPCategory[] {
  const counts = Object.values(byCategory);
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return STEEP_CATEGORIES.slice();

  const avg = total / 6;
  const threshold = avg * 0.3; // Less than 30% of average = blind spot

  return (Object.entries(byCategory) as [STEEPCategory, number][])
    .filter(([, count]) => count <= threshold)
    .map(([cat]) => cat);
}

/** Cross-domain bridges: nodes whose children span 3+ STEEPE categories */
function findCrossDomainBridges(consequences: Consequence[]): CrossDomainBridge[] {
  const nodes = consequences.filter(c => !c.nodeType || c.nodeType === 'consequence');
  const byId = new Map(nodes.map(c => [c.id, c]));
  const childrenOf = buildChildrenMap(consequences);

  const bridges: CrossDomainBridge[] = [];

  for (const c of nodes) {
    const kids = childrenOf.get(c.id) || [];
    const kidCategories = kids
      .map(kid => byId.get(kid)?.category)
      .filter(Boolean) as STEEPCategory[];

    const uniqueCategories = [...new Set(kidCategories)];

    if (uniqueCategories.length >= 3) {
      bridges.push({
        nodeId: c.id,
        category: c.category,
        childCategories: uniqueCategories,
        uniqueCategoryCount: uniqueCategories.length,
      });
    }
  }

  return bridges.sort((a, b) => b.uniqueCategoryCount - a.uniqueCategoryCount);
}

/**
 * Compute structural insights from the graph topology.
 * Pure function, no API calls, instant.
 */
export function computeStructuralInsights(
  consequences: Consequence[],
  stats: GraphStatistics,
): StructuralInsights {
  return {
    convergencePoints: findConvergencePoints(consequences),
    leveragePoints: findLeveragePoints(consequences),
    sentimentInversions: findSentimentInversions(consequences),
    blindSpotCategories: findBlindSpots(stats.byCategory),
    crossDomainBridges: findCrossDomainBridges(consequences),
  };
}
