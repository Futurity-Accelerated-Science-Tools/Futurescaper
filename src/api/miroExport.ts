// Unified export: Futurescape applet reload + Miro REST API v2 compatible
// Produces a single JSON that serves both purposes.

import { Consequence, Solution, FutureInput, STEEPCategory, Sentiment } from '../types';

// ── Miro card theme colors (by sentiment) ─────────────────────────
const CARD_THEME: Record<Sentiment, string> = {
  positive: '#27AE60',
  negative: '#E74C3C',
  neutral: '#7F8C8D',
};

const SOLUTION_THEME = '#3498DB';
const SEED_THEME = '#F39C12';

// ── Miro tag color names (valid values for fillColor) ─────────────
// red, magenta, violet, light_green, green, dark_green,
// cyan, blue, dark_blue, yellow, gray, black

interface MiroTag {
  title: string;
  fillColor: string;
}

interface MiroCard {
  type: 'card';
  data: { title: string; description: string };
  style: { cardTheme: string };
  position: { x: number; y: number; origin: 'center' };
  geometry: { width: number };
  _meta: {
    futurescapeId: string;
    parentId?: string | null;
    tagTitles: string[];
  };
}

interface MiroConnector {
  from: string;
  to: string;
}

interface MiroExportSection {
  tags: Record<string, MiroTag>;
  cards: MiroCard[];
  connectors: MiroConnector[];
}

export interface UnifiedExport {
  // Section 1: Applet reload (existing format, unchanged)
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
  generatedAt: string;
  methodology: string;
  stats: {
    totalConsequences: number;
    totalSolutions: number;
    byOrder: Array<{ order: number; count: number }>;
    bySentiment: { positive: number; negative: number; neutral: number };
  };
  // Section 2: Miro-ready data
  miro: MiroExportSection;
}

// ── Layout: Radial flower (matches applet) ────────────────────────

const MIRO_CARD_W = 320;
const NODE_WIDTH = 250;
const MIN_ARC_SPACING = 30;

function calculateRadius(nodeCount: number, minRadius: number): number {
  if (nodeCount === 0) return minRadius;
  const circumferenceNeeded = nodeCount * (NODE_WIDTH + MIN_ARC_SPACING);
  const radiusFromCircumference = circumferenceNeeded / (2 * Math.PI);
  return Math.max(minRadius, radiusFromCircumference);
}

function computeRadialPositions(
  consequences: Consequence[],
  solutions: Solution[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {
    seed: { x: 0, y: 0 },
  };

  // Group by order
  const byOrder: Record<number, Consequence[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const c of consequences) {
    const o = c.order || 1;
    if (!byOrder[o]) byOrder[o] = [];
    byOrder[o].push(c);
  }

  // Dynamic radii
  const orderRadii: Record<number, number> = {
    1: calculateRadius(byOrder[1].length, 500),
    2: calculateRadius(byOrder[2].length, 900),
    3: calculateRadius(byOrder[3].length, 1400),
    4: calculateRadius(byOrder[4].length, 1900),
    5: calculateRadius(byOrder[5].length, 2400),
  };

  // 1st order: evenly around the seed
  byOrder[1].forEach((c, idx) => {
    const angle = (idx / byOrder[1].length) * 2 * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * orderRadii[1];
    const y = Math.sin(angle) * orderRadii[1];
    positions[c.id] = { x, y };
  });

  // 2nd through 5th order: fan out from their parents
  [2, 3, 4, 5].forEach((order) => {
    const items = byOrder[order];
    if (!items.length) return;

    // Group by parent
    const byParent: Record<string, Consequence[]> = {};
    for (const c of items) {
      const pid = c.parentId || 'seed';
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(c);
    }

    Object.entries(byParent).forEach(([parentId, children]) => {
      const parentPos = positions[parentId] || { x: 0, y: 0 };
      const parentAngle = Math.atan2(parentPos.y, parentPos.x);

      const maxSpread = Math.PI / 2;
      const spreadPerChild = Math.min(Math.PI / 6, maxSpread / Math.max(children.length, 1));

      children.forEach((c, idx) => {
        const centerIdx = (children.length - 1) / 2;
        const offset = idx - centerIdx;
        const angle = parentAngle + offset * spreadPerChild;

        const baseDistance = 350 + (order - 2) * 100;
        const jitter = Math.sin(idx * 7.3) * 30;
        const distance = baseDistance + jitter;

        const x = parentPos.x + Math.cos(angle) * distance;
        const y = parentPos.y + Math.sin(angle) * distance;
        positions[c.id] = { x, y };
      });
    });
  });

  // Solutions: ring outside the outermost consequences
  if (solutions.length > 0) {
    const maxRadius = Math.max(
      ...Object.values(positions).map((p) => Math.sqrt(p.x * p.x + p.y * p.y)),
      500
    );
    const solutionRadius = maxRadius + 500;

    solutions.forEach((s, idx) => {
      const angle = (idx / solutions.length) * 2 * Math.PI - Math.PI / 2;
      const x = Math.cos(angle) * solutionRadius;
      const y = Math.sin(angle) * solutionRadius;
      positions[s.id] = { x, y };
    });
  }

  return positions;
}

// ── Tag builder ───────────────────────────────────────────────────

function buildTagSet(): Record<string, MiroTag> {
  const tags: Record<string, MiroTag> = {};

  // importance
  const impColors: Record<string, string> = { critical: 'dark_green', high: 'green', medium: 'yellow', low: 'gray' };
  for (const [level, color] of Object.entries(impColors)) {
    tags[`importance:${level}`] = { title: `importance:${level}`, fillColor: color };
  }

  // probability
  const probColors: Record<string, string> = { probable: 'green', plausible: 'cyan', possible: 'yellow', wildcard: 'red' };
  for (const [level, color] of Object.entries(probColors)) {
    tags[`probability:${level}`] = { title: `probability:${level}`, fillColor: color };
  }

  // STEEP categories
  const catColors: Record<string, string> = {
    economic: 'yellow', social: 'light_green', political: 'blue',
    environmental: 'green', technological: 'cyan',
  };
  for (const [cat, color] of Object.entries(catColors)) {
    tags[`category:${cat}`] = { title: `category:${cat}`, fillColor: color };
  }

  // sentiment
  const sentColors: Record<string, string> = { positive: 'green', negative: 'red', neutral: 'gray' };
  for (const [s, color] of Object.entries(sentColors)) {
    tags[`sentiment:${s}`] = { title: `sentiment:${s}`, fillColor: color };
  }

  // order
  const orderColors: Record<number, string> = { 1: 'blue', 2: 'dark_blue', 3: 'violet', 4: 'magenta', 5: 'red' };
  for (const [o, color] of Object.entries(orderColors)) {
    tags[`order:${o}`] = { title: `order:${o}`, fillColor: color };
  }

  // timeframe
  const tfColors: Record<string, string> = { immediate: 'red', 'short-term': 'yellow', 'long-term': 'gray' };
  for (const [tf, color] of Object.entries(tfColors)) {
    tags[`timeFrame:${tf}`] = { title: `timeFrame:${tf}`, fillColor: color };
  }

  // geographic scope
  const geoColors: Record<string, string> = { local: 'light_green', regional: 'cyan', global: 'blue' };
  for (const [gs, color] of Object.entries(geoColors)) {
    tags[`scope:${gs}`] = { title: `scope:${gs}`, fillColor: color };
  }

  // solution types
  tags['type:macro'] = { title: 'type:macro', fillColor: 'dark_blue' };
  tags['type:micro'] = { title: 'type:micro', fillColor: 'light_green' };

  // feasibility
  const feasColors: Record<string, string> = { high: 'green', medium: 'yellow', low: 'red' };
  for (const [f, color] of Object.entries(feasColors)) {
    tags[`feasibility:${f}`] = { title: `feasibility:${f}`, fillColor: color };
  }

  return tags;
}

// ── Tag extraction ────────────────────────────────────────────────

function getConsequenceTags(c: Consequence): string[] {
  const t: string[] = [];
  if (c.importance) t.push(`importance:${c.importance}`);
  if (c.probability) t.push(`probability:${c.probability}`);
  if (c.category) t.push(`category:${c.category}`);
  if (c.sentiment) t.push(`sentiment:${c.sentiment}`);
  if (c.order) t.push(`order:${c.order}`);
  if (c.timeFrame) t.push(`timeFrame:${c.timeFrame}`);
  if (c.geographicScope) t.push(`scope:${c.geographicScope}`);
  return t;
}

function getSolutionTags(s: Solution): string[] {
  const t: string[] = [];
  if (s.category) t.push(`category:${s.category}`);
  if (s.type) t.push(`type:${s.type}`);
  if (s.feasibility) t.push(`feasibility:${s.feasibility}`);
  if (s.timeToImplement) t.push(`timeFrame:${s.timeToImplement}`);
  return t;
}

// ── Card builders ─────────────────────────────────────────────────

function buildSeedCard(input: FutureInput, pos: { x: number; y: number }): MiroCard {
  const desc = `${input.description}\n\nHorizon: ${input.horizon || 'N/A'}\nPerspective: ${input.perspective || 'N/A'}`;
  return {
    type: 'card',
    data: { title: `SEED: ${input.title}`, description: desc },
    style: { cardTheme: SEED_THEME },
    position: { x: pos.x, y: pos.y, origin: 'center' },
    geometry: { width: MIRO_CARD_W },
    _meta: { futurescapeId: 'seed', tagTitles: [] },
  };
}

function buildConsequenceCard(c: Consequence, pos: { x: number; y: number }): MiroCard {
  const prefix = `[${c.order}] ${(c.category || '').toUpperCase()}`;
  const text = c.text;
  const title = text.length > 80 ? `${prefix}: ${text.slice(0, 80)}...` : `${prefix}: ${text}`;

  return {
    type: 'card',
    data: { title, description: text },
    style: { cardTheme: CARD_THEME[c.sentiment] || CARD_THEME.neutral },
    position: { x: pos.x, y: pos.y, origin: 'center' },
    geometry: { width: MIRO_CARD_W },
    _meta: {
      futurescapeId: c.id,
      parentId: c.parentId,
      tagTitles: getConsequenceTags(c),
    },
  };
}

function buildSolutionCard(s: Solution, pos: { x: number; y: number }): MiroCard {
  const text = s.text;
  const title = text.length > 80 ? `SOLUTION: ${text.slice(0, 80)}...` : `SOLUTION: ${text}`;

  return {
    type: 'card',
    data: { title, description: text },
    style: { cardTheme: SOLUTION_THEME },
    position: { x: pos.x, y: pos.y, origin: 'center' },
    geometry: { width: MIRO_CARD_W },
    _meta: {
      futurescapeId: s.id,
      tagTitles: getSolutionTags(s),
    },
  };
}

// ── Main export function ──────────────────────────────────────────

export function buildUnifiedExport(
  input: FutureInput,
  consequences: Consequence[],
  solutions: Solution[]
): UnifiedExport {
  // Compute radial positions for all nodes
  const positions = computeRadialPositions(consequences, solutions);

  // Build Miro cards
  const cards: MiroCard[] = [
    buildSeedCard(input, positions.seed),
  ];

  for (const c of consequences) {
    const pos = positions[c.id] || { x: 0, y: 0 };
    cards.push(buildConsequenceCard(c, pos));
  }

  for (const s of solutions) {
    const pos = positions[s.id] || { x: 0, y: 0 };
    cards.push(buildSolutionCard(s, pos));
  }

  // Build connectors (consequence -> parent)
  const connectors: MiroConnector[] = [];
  for (const c of consequences) {
    if (c.parentId) {
      connectors.push({ from: c.parentId, to: c.id });
    }
  }

  // Also connect solutions to their target consequences
  for (const s of solutions) {
    if (s.targetConsequenceIds && s.targetConsequenceIds.length > 0) {
      for (const targetId of s.targetConsequenceIds) {
        connectors.push({ from: targetId, to: s.id });
      }
    }
  }

  return {
    // Applet reload section (unchanged format)
    input,
    consequences,
    solutions,
    generatedAt: new Date().toISOString(),
    methodology: 'Synthesizing Futures - Futurescape',
    stats: {
      totalConsequences: consequences.length,
      totalSolutions: solutions.length,
      byOrder: [1, 2, 3, 4, 5].map((order) => ({
        order,
        count: consequences.filter((c) => c.order === order).length,
      })),
      bySentiment: {
        positive: consequences.filter((c) => c.sentiment === 'positive').length,
        negative: consequences.filter((c) => c.sentiment === 'negative').length,
        neutral: consequences.filter((c) => c.sentiment === 'neutral').length,
      },
    },
    // Miro section
    miro: {
      tags: buildTagSet(),
      cards,
      connectors,
    },
  };
}
