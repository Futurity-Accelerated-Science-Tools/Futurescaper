/**
 * shareCodec.ts — Compact serialisation for URL-based graph sharing
 *
 * Encodes the full Futurescaper graph (input + consequences + solutions) into
 * a compressed, URL-safe string that can be pasted as a query parameter.
 *
 * Space-saving techniques used:
 *   1. Short single-char keys instead of full field names
 *   2. Enum fields stored as small integers instead of strings
 *   3. IDs stripped (regenerated deterministically on decode)
 *   4. Optional fields omitted when they match defaults
 *   5. JSON → deflate (pako) → base64url
 *
 * The encoded format is NOT meant to be stable across versions. It is a
 * convenience for ad-hoc sharing of standalone Futurescaper graphs. When the
 * tool is embedded in the FAST parent app, graphs will be stored server-side
 * and referenced by a backend ID instead.
 *
 * ─── KEY MAPS ────────────────────────────────────────────────────────
 *
 * Consequence compact keys:
 *   t  → text            s  → sentiment (enum)    c  → category (enum)
 *   o  → order           p  → parentIndex (int, index into array, -1 = root)
 *   tf → timeFrame       pr → probability         g  → geographicScope
 *   im → importance      tt → title               nt → nodeType
 *
 * Solution compact keys:
 *   t  → text            y  → type (enum)         c  → category (enum)
 *   ti → targetIndices   f  → feasibility (enum)  tm → timeToImplement (enum)
 *
 * FutureInput compact keys:
 *   t  → title           d  → description         h  → horizon (enum)
 *   pe → perspective     v  → verbosity (enum)
 *
 * ─── ENUM TABLES ─────────────────────────────────────────────────────
 * Each enum type maps its string values to sequential integers.
 * See ENUM_MAPS below for the canonical ordering.
 */

import { deflate, inflate } from 'pako';
import type {
  FutureInput,
  Consequence,
  Solution,
  Sentiment,
  STEEPCategory,
  ConsequenceOrder,
  Horizon,
  TimeFrame,
  Probability,
  GeographicScope,
  Importance,
  NodeType,
  SolutionType,
} from './types';

// ── Enum encode/decode tables ────────────────────────────────────────
// Order matters — the index IS the encoded value.

const SENTIMENT_VALUES: Sentiment[] = ['positive', 'negative', 'neutral'];
const CATEGORY_VALUES: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
const HORIZON_VALUES: Horizon[] = ['near', 'medium', 'far'];
const TIMEFRAME_VALUES: TimeFrame[] = ['immediate', 'short-term', 'long-term'];
const PROBABILITY_VALUES: Probability[] = ['probable', 'plausible', 'possible', 'wildcard'];
const SCOPE_VALUES: GeographicScope[] = ['local', 'regional', 'global'];
const IMPORTANCE_VALUES: Importance[] = ['critical', 'high', 'medium', 'low'];
const NODETYPE_VALUES: NodeType[] = ['consequence', 'solution', 'idea'];
const SOLTYPE_VALUES: SolutionType[] = ['macro', 'micro'];
const FEASIBILITY_VALUES: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
const VERBOSITY_VALUES: ('concise' | 'detailed')[] = ['concise', 'detailed'];

/** Encode a string enum value to its integer index (or undefined if not found) */
function enumToInt<T>(values: T[], val: T | undefined): number | undefined {
  if (val === undefined) return undefined;
  const idx = values.indexOf(val);
  return idx >= 0 ? idx : undefined;
}

/** Decode an integer index back to its string enum value */
function intToEnum<T>(values: T[], idx: number | undefined): T | undefined {
  if (idx === undefined || idx < 0 || idx >= values.length) return undefined;
  return values[idx];
}

// ── Compact types (what goes into the JSON before compression) ───────

interface CompactConsequence {
  t: string;              // text
  s: number;              // sentiment (enum index)
  c: number;              // STEEP category (enum index)
  o: number;              // order (1-5, kept as-is since it's already small)
  p: number[];            // parentIndices: indices into consequences array, -1 = seed
  tt?: string;            // title (optional)
  tf?: number;            // timeFrame (enum index)
  pr?: number;            // probability (enum index)
  g?: number;             // geographicScope (enum index)
  im?: number;            // importance (enum index)
  nt?: number;            // nodeType (enum index), omitted when 'consequence' (default)
}

interface CompactSolution {
  t: string;              // text
  y: number;              // type: macro/micro (enum index)
  c: number;              // STEEP category (enum index)
  ti: number[];           // targetIndices: indices into consequences array
  f: number;              // feasibility (enum index)
  tm: number;             // timeToImplement (enum index)
}

interface CompactInput {
  t: string;              // title
  d: string;              // description
  h: number;              // horizon (enum index)
  pe?: string;            // perspective (optional)
  v?: number;             // verbosity (enum index)
}

interface CompactPayload {
  i: CompactInput;        // input
  c: CompactConsequence[]; // consequences
  s?: CompactSolution[];  // solutions (omitted if empty)
}

// ── Encode ───────────────────────────────────────────────────────────

/**
 * Encode graph data into a URL-safe compressed string.
 *
 * Flow: structured data → compact JSON → deflate → base64url
 */
export function encodeGraphForURL(
  input: FutureInput,
  consequences: Consequence[],
  solutions: Solution[],
): string {
  // Build an id→index lookup so parent references become compact indices
  const idToIndex = new Map<string, number>();
  consequences.forEach((c, i) => idToIndex.set(c.id, i));

  // Compact consequences — strip IDs, convert enums to ints
  const compactConsequences: CompactConsequence[] = consequences.map(c => {
    const cc: CompactConsequence = {
      t: c.text,
      s: enumToInt(SENTIMENT_VALUES, c.sentiment)!,
      c: enumToInt(CATEGORY_VALUES, c.category)!,
      o: c.order,
      // parentIds → array of indices into this array (-1 = seed)
      p: c.parentIds.map(pid => pid === 'seed' ? -1 : (idToIndex.get(pid) ?? -1)),
    };

    // Only include optional fields when present and non-default
    if (c.title) cc.tt = c.title;
    if (c.timeFrame) cc.tf = enumToInt(TIMEFRAME_VALUES, c.timeFrame);
    if (c.probability) cc.pr = enumToInt(PROBABILITY_VALUES, c.probability);
    if (c.geographicScope) cc.g = enumToInt(SCOPE_VALUES, c.geographicScope);
    if (c.importance && c.importance !== 'medium') cc.im = enumToInt(IMPORTANCE_VALUES, c.importance);
    if (c.nodeType && c.nodeType !== 'consequence') cc.nt = enumToInt(NODETYPE_VALUES, c.nodeType);

    return cc;
  });

  // Compact solutions — target IDs become indices into consequences array
  const compactSolutions: CompactSolution[] | undefined =
    solutions.length > 0
      ? solutions.map(s => ({
          t: s.text,
          y: enumToInt(SOLTYPE_VALUES, s.type)!,
          c: enumToInt(CATEGORY_VALUES, s.category)!,
          ti: s.targetConsequenceIds.map(id => idToIndex.get(id) ?? -1).filter(i => i >= 0),
          f: enumToInt(FEASIBILITY_VALUES, s.feasibility)!,
          tm: enumToInt(TIMEFRAME_VALUES, s.timeToImplement)!,
        }))
      : undefined;

  const compactInput: CompactInput = {
    t: input.title,
    d: input.description,
    h: enumToInt(HORIZON_VALUES, input.horizon)!,
  };
  if (input.perspective) compactInput.pe = input.perspective;
  if (input.verbosity && input.verbosity !== 'concise') compactInput.v = enumToInt(VERBOSITY_VALUES, input.verbosity);

  const payload: CompactPayload = {
    i: compactInput,
    c: compactConsequences,
  };
  if (compactSolutions) payload.s = compactSolutions;

  // JSON → deflate → base64url
  const json = JSON.stringify(payload);
  const compressed = deflate(new TextEncoder().encode(json));

  // base64url: standard base64 with + → -, / → _, no trailing =
  const base64 = btoa(String.fromCharCode(...compressed))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64;
}

// ── Decode ───────────────────────────────────────────────────────────

/**
 * Decode a URL-safe compressed string back into full graph data.
 *
 * Flow: base64url → inflate → compact JSON → structured data with regenerated IDs
 *
 * Returns null if decoding fails for any reason (corrupt data, truncated URL, etc.)
 */
export function decodeGraphFromURL(encoded: string): {
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
} | null {
  try {
    // base64url → standard base64
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Re-add padding
    while (base64.length % 4 !== 0) base64 += '=';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const json = new TextDecoder().decode(inflate(bytes));
    const payload = JSON.parse(json) as CompactPayload;

    // Regenerate deterministic IDs: "s-0", "s-1", ... for consequences
    const consequenceIds = payload.c.map((_, i) => `s-${i}`);

    // Rebuild full Consequence objects
    const consequences: Consequence[] = payload.c.map((cc, i) => {
      const consequence: Consequence = {
        id: consequenceIds[i],
        text: cc.t,
        sentiment: intToEnum(SENTIMENT_VALUES, cc.s)!,
        category: intToEnum(CATEGORY_VALUES, cc.c)!,
        order: cc.o as Consequence['order'],
        // parentIndices → parentIds (seed for -1, mapped ID for others)
        parentIds: cc.p.map(idx => idx === -1 ? 'seed' : consequenceIds[idx]).filter(Boolean),
      };

      if (cc.tt) consequence.title = cc.tt;
      if (cc.tf !== undefined) consequence.timeFrame = intToEnum(TIMEFRAME_VALUES, cc.tf);
      if (cc.pr !== undefined) consequence.probability = intToEnum(PROBABILITY_VALUES, cc.pr);
      if (cc.g !== undefined) consequence.geographicScope = intToEnum(SCOPE_VALUES, cc.g);
      if (cc.im !== undefined) consequence.importance = intToEnum(IMPORTANCE_VALUES, cc.im);
      if (cc.nt !== undefined) consequence.nodeType = intToEnum(NODETYPE_VALUES, cc.nt);

      return consequence;
    });

    // Rebuild full Solution objects
    const solutions: Solution[] = (payload.s || []).map((cs, i) => ({
      id: `sol-${i}`,
      text: cs.t,
      type: intToEnum(SOLTYPE_VALUES, cs.y)!,
      category: intToEnum(CATEGORY_VALUES, cs.c)!,
      targetConsequenceIds: cs.ti.map(idx => consequenceIds[idx]).filter(Boolean),
      feasibility: intToEnum(FEASIBILITY_VALUES, cs.f)!,
      timeToImplement: intToEnum(TIMEFRAME_VALUES, cs.tm)!,
    }));

    // Rebuild FutureInput
    const input: FutureInput = {
      title: payload.i.t,
      description: payload.i.d,
      horizon: intToEnum(HORIZON_VALUES, payload.i.h)!,
    };
    if (payload.i.pe) input.perspective = payload.i.pe;
    if (payload.i.v !== undefined) input.verbosity = intToEnum(VERBOSITY_VALUES, payload.i.v);

    return { input, consequences, solutions };
  } catch (e) {
    console.warn('Failed to decode share link:', e);
    return null;
  }
}

// ── Size estimation ──────────────────────────────────────────────────

/**
 * Estimate the encoded URL length without actually encoding.
 * Useful for showing warnings before the user copies a link.
 *
 * Returns approximate character count of the base64url string.
 */
export function estimateEncodedSize(
  input: FutureInput,
  consequences: Consequence[],
  solutions: Solution[],
): number {
  // Rough estimate: avg ~40 bytes compressed per consequence, ~50 per solution
  // plus ~100 bytes for input overhead, with base64 adding ~33%
  const rawEstimate = 100 + consequences.length * 40 + solutions.length * 50;
  return Math.ceil(rawEstimate * 1.33);
}

/**
 * Maximum URL length we consider safe for sharing across platforms.
 * Beyond this, users should use JSON file export instead.
 *
 * 8000 chars is conservative — covers most browsers, email clients,
 * Slack/Teams, and common URL shorteners.
 */
export const MAX_SAFE_URL_LENGTH = 8000;
