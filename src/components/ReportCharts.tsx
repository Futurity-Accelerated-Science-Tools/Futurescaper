import { useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { Lightbulb, PlusCircle, Globe, Link2 } from 'lucide-react';
import {
  Consequence,
  STEEPCategory,
  Sentiment,
  ConsequenceOrder,
  Probability,
  Importance,
  InsightType,
  InsightCard as InsightCardType,
  IdeaRecommendation,
  STEEP_LABELS,
  STEEP_COLORS,
  GraphStatistics,
} from '../types';
import { ConsequenceChip, ConsequenceCardPreview, parseReportProse } from './ConsequenceRef';
import type { RelevantSubject } from '../api/subjects';

// ── Shared constants ─────────────────────────────────────────────

const CHART_FONT = "'JetBrains Mono', monospace";
const LABEL_FONT = "'TT Norms Pro Normal', -apple-system, sans-serif";
const MUTED_STROKE = '#d1d5db';
const MUTED_TEXT = '#6b7280';

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: '#3DB462',
  negative: '#FF4D53',
  neutral: '#8891a0',
};

const PROBABILITY_COLORS: Record<Probability, string> = {
  probable: '#00d4aa',
  plausible: '#7c5cfc',
  possible: '#ff9f1c',
  wildcard: '#ff4d6d',
};

const IMPORTANCE_COLORS: Record<Importance, string> = {
  critical: '#ff4d6d',
  high: '#ff9f1c',
  medium: '#7c5cfc',
  low: '#8891a0',
};

const STEEP_ORDER: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];

// ── 1. STEEPE Radar / Spider Chart ──────────────────────────────

interface RadarChartProps {
  stats: GraphStatistics;
}

export function STEEPERadarChart({ stats }: RadarChartProps) {
  const [hoveredAxis, setHoveredAxis] = useState<STEEPCategory | null>(null);
  const cx = 160, cy = 150, maxR = 110;
  const values = STEEP_ORDER.map(cat => stats.byCategory[cat]);
  const maxVal = Math.max(...values, 1);

  // Compute polygon points
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const r = (value / maxVal) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const polyPoints = STEEP_ORDER.map((_, i) => {
    const p = getPoint(i, values[i]);
    return `${p.x},${p.y}`;
  }).join(' ');

  // Concentric grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={3}>
        STEEPE Category Distribution
      </Text>
      <svg width="320" height="310" viewBox="0 0 320 310" style={{ display: 'block', margin: '0 auto' }}>
        {/* Grid rings */}
        {rings.map(scale => {
          const ringPoints = STEEP_ORDER.map((_, i) => {
            const p = getPoint(i, maxVal * scale);
            return `${p.x},${p.y}`;
          }).join(' ');
          return (
            <polygon
              key={scale}
              points={ringPoints}
              fill="none"
              stroke={MUTED_STROKE}
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        })}

        {/* Axis lines */}
        {STEEP_ORDER.map((cat, i) => {
          const end = getPoint(i, maxVal);
          return (
            <line
              key={cat}
              x1={cx} y1={cy} x2={end.x} y2={end.y}
              stroke={MUTED_STROKE}
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={polyPoints}
          fill="rgba(0, 5, 233, 0.12)"
          stroke="#0005E9"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {STEEP_ORDER.map((cat, i) => {
          const p = getPoint(i, values[i]);
          const isHovered = hoveredAxis === cat;
          return (
            <g key={cat}
              onMouseEnter={() => setHoveredAxis(cat)}
              onMouseLeave={() => setHoveredAxis(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={p.x} cy={p.y} r={isHovered ? 5 : 3.5} fill={STEEP_COLORS[cat]} stroke="white" strokeWidth={1.5} />
              {isHovered && (
                <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fontFamily={CHART_FONT} fill={STEEP_COLORS[cat]} fontWeight="600">
                  {values[i]}
                </text>
              )}
            </g>
          );
        })}

        {/* Labels */}
        {STEEP_ORDER.map((cat, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const labelR = maxR + 22;
          const lx = cx + labelR * Math.cos(angle);
          const ly = cy + labelR * Math.sin(angle);
          return (
            <text
              key={`label-${cat}`}
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontFamily={LABEL_FONT}
              fill={hoveredAxis === cat ? STEEP_COLORS[cat] : MUTED_TEXT}
              fontWeight={hoveredAxis === cat ? '600' : '400'}
            >
              {STEEP_LABELS[cat]}
            </text>
          );
        })}
      </svg>
    </Box>
  );
}

// ── 2. Sentiment Flow by Order ──────────────────────────────────

interface SentimentFlowProps {
  consequences: Consequence[];
}

export function SentimentFlowChart({ consequences }: SentimentFlowProps) {
  const [hoveredOrder, setHoveredOrder] = useState<number | null>(null);
  const nodes = consequences.filter(c => !c.nodeType || c.nodeType === 'consequence');

  // Compute sentiment counts per order
  const orders = [1, 2, 3, 4, 5] as ConsequenceOrder[];
  const activeOrders = orders.filter(o => nodes.some(c => c.order === o));

  const data = activeOrders.map(order => {
    const orderNodes = nodes.filter(c => c.order === order);
    return {
      order,
      positive: orderNodes.filter(c => c.sentiment === 'positive').length,
      neutral: orderNodes.filter(c => c.sentiment === 'neutral').length,
      negative: orderNodes.filter(c => c.sentiment === 'negative').length,
      total: orderNodes.length,
    };
  });

  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const w = 440, h = 200, pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const barWidth = Math.min(plotW / data.length * 0.6, 50);
  const gap = plotW / data.length;

  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={3}>
        Sentiment Shift Across Causal Orders
      </Text>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(frac => {
          const y = pad.top + plotH * (1 - frac);
          const val = Math.round(maxTotal * frac);
          return (
            <g key={frac}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke={MUTED_STROKE} strokeWidth={0.5} opacity={0.4} />
              <text x={pad.left - 8} y={y + 3} textAnchor="end" fontSize="9" fontFamily={CHART_FONT} fill={MUTED_TEXT}>{val}</text>
            </g>
          );
        })}

        {/* Stacked bars */}
        {data.map((d, i) => {
          const x = pad.left + gap * i + (gap - barWidth) / 2;
          const isHovered = hoveredOrder === d.order;

          // Stack: negative on bottom, neutral in middle, positive on top
          const segments = [
            { key: 'negative', count: d.negative, color: SENTIMENT_COLORS.negative },
            { key: 'neutral', count: d.neutral, color: SENTIMENT_COLORS.neutral },
            { key: 'positive', count: d.positive, color: SENTIMENT_COLORS.positive },
          ];

          let yOffset = pad.top + plotH;

          return (
            <g key={d.order}
              onMouseEnter={() => setHoveredOrder(d.order)}
              onMouseLeave={() => setHoveredOrder(null)}
              style={{ cursor: 'pointer' }}
            >
              {segments.map(seg => {
                const segH = (seg.count / maxTotal) * plotH;
                yOffset -= segH;
                return (
                  <rect
                    key={seg.key}
                    x={x} y={yOffset}
                    width={barWidth} height={segH}
                    fill={seg.color}
                    opacity={isHovered ? 1 : 0.75}
                    rx={2}
                  />
                );
              })}
              {/* Order label */}
              <text
                x={x + barWidth / 2} y={pad.top + plotH + 16}
                textAnchor="middle" fontSize="10" fontFamily={LABEL_FONT} fill={MUTED_TEXT}
              >
                {d.order === 1 ? '1st' : d.order === 2 ? '2nd' : d.order === 3 ? '3rd' : `${d.order}th`}
              </text>
              {/* Hover totals */}
              {isHovered && (
                <text
                  x={x + barWidth / 2} y={pad.top + plotH - (d.total / maxTotal) * plotH - 6}
                  textAnchor="middle" fontSize="10" fontFamily={CHART_FONT} fill={MUTED_TEXT} fontWeight="600"
                >
                  {d.total}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis label */}
        <text x={pad.left + plotW / 2} y={h - 4} textAnchor="middle" fontSize="10" fontFamily={LABEL_FONT} fill={MUTED_TEXT}>
          Consequence Order
        </text>
      </svg>

      {/* Legend */}
      <Flex justify="center" gap={4} mt={2}>
        {(['positive', 'neutral', 'negative'] as Sentiment[]).map(s => (
          <Flex key={s} align="center" gap={1.5} fontSize="xs" color="fg.muted">
            <Box w="8px" h="8px" rounded="sm" bg={SENTIMENT_COLORS[s]} />
            <Text textTransform="capitalize">{s}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}

// ── 3. Risk / Opportunity Matrix ────────────────────────────────

interface RiskMatrixProps {
  consequences: Consequence[];
}

export function RiskOpportunityMatrix({ consequences }: RiskMatrixProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const nodes = consequences.filter(c =>
    (!c.nodeType || c.nodeType === 'consequence') && c.importance && c.probability
  );

  if (nodes.length === 0) return null;

  const hoveredNode = hoveredId ? nodes.find(c => c.id === hoveredId) : null;

  const w = 440, h = 320, pad = { top: 20, right: 20, bottom: 50, left: 60 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const importanceScale: Record<Importance, number> = { low: 0.15, medium: 0.4, high: 0.65, critical: 0.9 };
  const probabilityScale: Record<Probability, number> = { wildcard: 0.1, possible: 0.35, plausible: 0.6, probable: 0.85 };

  // Jitter in pixel space — spread nodes within each category band to reduce overlap
  const jitter = (seed: number) => ((seed * 2654435761 >>> 0) % 100 - 50) * 0.45;
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={3}>
        Risk / Opportunity Matrix
      </Text>
      <Flex gap={4} align="start">
        {/* Chart */}
        <Box flex="1" minW={0}>
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
            {/* Quadrant backgrounds */}
            <rect x={pad.left} y={pad.top} width={plotW / 2} height={plotH / 2} fill="rgba(255, 77, 83, 0.04)" />
            <rect x={pad.left + plotW / 2} y={pad.top} width={plotW / 2} height={plotH / 2} fill="rgba(255, 77, 83, 0.08)" />
            <rect x={pad.left} y={pad.top + plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(0, 0, 0, 0.02)" />
            <rect x={pad.left + plotW / 2} y={pad.top + plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(255, 77, 83, 0.04)" />

            {/* Quadrant labels */}
            <text x={pad.left + plotW * 0.25} y={pad.top + 14} textAnchor="middle" fontSize="8" fontFamily={LABEL_FONT} fill={MUTED_TEXT} opacity={0.5}>MONITOR</text>
            <text x={pad.left + plotW * 0.75} y={pad.top + 14} textAnchor="middle" fontSize="8" fontFamily={LABEL_FONT} fill="#ff4d6d" opacity={0.5}>ACT NOW</text>
            <text x={pad.left + plotW * 0.25} y={pad.top + plotH - 6} textAnchor="middle" fontSize="8" fontFamily={LABEL_FONT} fill={MUTED_TEXT} opacity={0.5}>LOW PRIORITY</text>
            <text x={pad.left + plotW * 0.75} y={pad.top + plotH - 6} textAnchor="middle" fontSize="8" fontFamily={LABEL_FONT} fill={MUTED_TEXT} opacity={0.5}>PREPARE</text>

            {/* Grid */}
            <line x1={pad.left} y1={pad.top + plotH / 2} x2={pad.left + plotW} y2={pad.top + plotH / 2} stroke={MUTED_STROKE} strokeWidth={0.5} strokeDasharray="4 4" />
            <line x1={pad.left + plotW / 2} y1={pad.top} x2={pad.left + plotW / 2} y2={pad.top + plotH} stroke={MUTED_STROKE} strokeWidth={0.5} strokeDasharray="4 4" />
            <rect x={pad.left} y={pad.top} width={plotW} height={plotH} fill="none" stroke={MUTED_STROKE} strokeWidth={0.5} />

            {/* Data points — render hovered point last for z-index */}
            {nodes
              .map((c, idx) => ({ c, idx }))
              .sort((a, b) => {
                if (a.c.id === hoveredId) return 1;
                if (b.c.id === hoveredId) return -1;
                return 0;
              })
              .map(({ c, idx }) => {
              const probVal = probabilityScale[c.probability!];
              const impVal = importanceScale[c.importance!];
              const x = clamp(pad.left + probVal * plotW + jitter(idx), pad.left + 4, pad.left + plotW - 4);
              const y = clamp(pad.top + (1 - impVal) * plotH + jitter(idx + 100), pad.top + 4, pad.top + plotH - 4);
              const isWildcard = c.probability === 'wildcard';
              const isHovered = hoveredId === c.id;
              const color = c.sentiment === 'negative' ? SENTIMENT_COLORS.negative :
                            c.sentiment === 'positive' ? SENTIMENT_COLORS.positive :
                            SENTIMENT_COLORS.neutral;

              const tooltipText = `${c.text.slice(0, 80)}${c.text.length > 80 ? '…' : ''}\n${c.sentiment} · ${c.probability} · ${c.importance}`;
              return (
                <g key={c.id}
                  data-consequence-id={c.id}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{tooltipText}</title>
                  {isWildcard ? (
                    <text x={x} y={y + 4} textAnchor="middle" fontSize={isHovered ? 16 : 13} fill={color} opacity={isHovered ? 1 : 0.7}>
                      ✦
                    </text>
                  ) : (
                    <circle cx={x} cy={y} r={isHovered ? 6 : 4} fill={color} opacity={isHovered ? 1 : 0.6} stroke="white" strokeWidth={1} />
                  )}
                </g>
              );
            })}

            {/* Axis labels */}
            <text x={pad.left + plotW / 2} y={h - 8} textAnchor="middle" fontSize="10" fontFamily={LABEL_FONT} fill={MUTED_TEXT}>
              Probability →
            </text>
            <text x={14} y={pad.top + plotH / 2} textAnchor="middle" fontSize="10" fontFamily={LABEL_FONT} fill={MUTED_TEXT} transform={`rotate(-90, 14, ${pad.top + plotH / 2})`}>
              Importance →
            </text>
          </svg>

          {/* Legend */}
          <Flex justify="center" gap={4} mt={2}>
            <Flex align="center" gap={1.5} fontSize="xs" color="fg.muted">
              <Box w="8px" h="8px" rounded="full" bg={SENTIMENT_COLORS.negative} /> Negative
            </Flex>
            <Flex align="center" gap={1.5} fontSize="xs" color="fg.muted">
              <Box w="8px" h="8px" rounded="full" bg={SENTIMENT_COLORS.positive} /> Positive
            </Flex>
            <Flex align="center" gap={1.5} fontSize="xs" color="fg.muted">
              <Text fontSize="sm" lineHeight={1}>✦</Text> Wildcard
            </Flex>
          </Flex>
        </Box>

        {/* Detail sidebar — shows hovered node as map-style card */}
        <Box data-risk-sidebar w="296px" flexShrink={0} minH="200px" pt={2}>
          {hoveredNode ? (
            <ConsequenceCardPreview consequence={hoveredNode} />
          ) : (
            <Flex align="center" justify="center" h="200px" color="fg.muted" fontSize="xs" textAlign="center" px={4}>
              <Text>Click a dot to see consequence details</Text>
            </Flex>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

// ── 4. Timeline Distribution ────────────────────────────────────

interface TimelineProps {
  consequences: Consequence[];
}

export function TimelineDistribution({ consequences }: TimelineProps) {
  const nodes = consequences.filter(c =>
    (!c.nodeType || c.nodeType === 'consequence') && c.timeFrame
  );

  if (nodes.length === 0) return null;

  const lanes = [
    { key: 'immediate' as const, label: 'Immediate', sublabel: 'Days – Weeks', color: '#ff4d6d' },
    { key: 'short-term' as const, label: 'Short-term', sublabel: 'Months – 2 Years', color: '#ff9f1c' },
    { key: 'long-term' as const, label: 'Long-term', sublabel: '2+ Years', color: '#7c5cfc' },
  ];

  const laneCounts = lanes.map(l => ({
    ...l,
    nodes: nodes.filter(c => c.timeFrame === l.key),
  }));

  const maxCount = Math.max(...laneCounts.map(l => l.nodes.length), 1);

  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={3}>
        Impact Timeline
      </Text>
      <Flex direction="column" gap={3}>
        {laneCounts.map(lane => (
          <Box key={lane.key}>
            <Flex justify="space-between" mb={1}>
              <Flex align="baseline" gap={1.5}>
                <Text fontSize="xs" fontWeight="semibold" color="fg">{lane.label}</Text>
                <Text fontSize="2xs" color="fg.muted">{lane.sublabel}</Text>
              </Flex>
              <Text fontSize="xs" fontWeight="semibold" color="fg">{lane.nodes.length}</Text>
            </Flex>
            <Box position="relative" h="24px" bg="bg.subtle" rounded="md" overflow="hidden">
              <Box
                h="100%"
                bg={lane.color}
                opacity={0.2}
                rounded="md"
                transition="width 0.5s ease"
                style={{ width: `${(lane.nodes.length / maxCount) * 100}%` }}
              />
              {/* Individual dots for each consequence */}
              <Flex position="absolute" inset={0} align="center" px={2} gap={1}>
                {lane.nodes.slice(0, 30).map((c, i) => (
                  <Box
                    key={c.id}
                    w="6px" h="6px"
                    rounded="full"
                    bg={c.sentiment === 'negative' ? SENTIMENT_COLORS.negative :
                        c.sentiment === 'positive' ? SENTIMENT_COLORS.positive :
                        SENTIMENT_COLORS.neutral}
                    opacity={0.8}
                    flexShrink={0}
                    title={c.text.slice(0, 60)}
                  />
                ))}
                {lane.nodes.length > 30 && (
                  <Text fontSize="2xs" color="fg.muted" ml={1}>+{lane.nodes.length - 30}</Text>
                )}
              </Flex>
            </Box>
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

// ── Risk Callout Box ────────────────────────────────────────────

interface RiskCalloutProps {
  consequence: Consequence;
  cascadeChildren?: Consequence[];
}

export function RiskCallout({ consequence: c, cascadeChildren }: RiskCalloutProps) {
  const sentimentColor = c.sentiment === 'negative' ? '#ff4d6d' :
                          c.sentiment === 'positive' ? '#3DB462' : '#8891a0';

  return (
    <Box
      border="1px solid"
      borderColor="border.muted"
      borderLeft="3px solid"
      borderLeftColor={sentimentColor}
      rounded="lg"
      p={4}
      bg="bg.subtle"
      my={3}
    >
      <Flex align="center" gap={2} mb={2}>
        <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider"
          color={sentimentColor} fontFamily="mono">
          {c.importance?.toUpperCase() || 'MEDIUM'} • {c.probability?.toUpperCase() || 'PLAUSIBLE'}
        </Text>
        <Box
          px={1.5} py={0.5} rounded="sm" fontSize="2xs" fontWeight="semibold"
          bg={`${STEEP_COLORS[c.category]}20`} color={STEEP_COLORS[c.category]}
        >
          {STEEP_LABELS[c.category]}
        </Box>
      </Flex>
      <Text fontSize="sm" color="fg" lineHeight="1.6" fontFamily="sans">
        {c.text}
      </Text>
      {cascadeChildren && cascadeChildren.length > 0 && (
        <Box mt={2} pt={2} borderTop="1px solid" borderColor="border.muted">
          <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb={1}>
            Cascading effects ({cascadeChildren.length})
          </Text>
          {cascadeChildren.slice(0, 3).map(child => (
            <Text key={child.id} fontSize="xs" color="fg.muted" lineHeight="1.5" pl={3} borderLeft="1px solid" borderColor="border.muted" mb={1}>
              {child.text}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Insight Card — Colored header band ───────────────────────

const INSIGHT_STYLES: Record<InsightType, { color: string; bgTint: string; borderTint: string; icon: string; label: string }> = {
  'critical-risk':      { color: '#dc2626', bgTint: 'rgba(220,38,38,0.06)',  borderTint: 'rgba(220,38,38,0.12)',  icon: '⚠', label: 'Critical Risk' },
  'hidden-opportunity': { color: '#16a34a', bgTint: 'rgba(22,163,74,0.05)',  borderTint: 'rgba(22,163,74,0.12)',  icon: '◈', label: 'Hidden Opportunity' },
  'convergence-warning':{ color: '#d97706', bgTint: 'rgba(217,119,6,0.05)',  borderTint: 'rgba(217,119,6,0.12)',  icon: '⊕', label: 'Convergence Warning' },
  'sentiment-inversion':{ color: '#9333ea', bgTint: 'rgba(147,51,234,0.05)', borderTint: 'rgba(147,51,234,0.12)', icon: '⇄', label: 'Sentiment Inversion' },
  'blind-spot':         { color: '#2563eb', bgTint: 'rgba(37,99,235,0.05)',  borderTint: 'rgba(37,99,235,0.12)',  icon: '◌', label: 'Blind Spot' },
  'cross-domain-bridge':{ color: '#0d9488', bgTint: 'rgba(13,148,136,0.05)', borderTint: 'rgba(13,148,136,0.12)', icon: '⬡', label: 'Cross-Domain Bridge' },
  'leverage-point':     { color: '#ea580c', bgTint: 'rgba(234,88,12,0.05)',  borderTint: 'rgba(234,88,12,0.12)',  icon: '◉', label: 'Leverage Point' },
};

interface InsightCardProps {
  card: InsightCardType;
  consequences: Consequence[];
}

export function InsightCard({ card, consequences }: InsightCardProps) {
  const style = INSIGHT_STYLES[card.type] || INSIGHT_STYLES['critical-risk'];
  const referenced = card.consequenceIds
    .map(id => consequences.find(c => c.id === id))
    .filter(Boolean) as Consequence[];

  return (
    <Box
      border="1px solid"
      borderColor="border.muted"
      rounded="lg"
      overflow="hidden"
      bg="bg"
      transition="box-shadow 0.2s"
      _hover={{ shadow: 'sm' }}
    >
      {/* Colored header band */}
      <Flex
        align="center"
        gap={3}
        px={4}
        py={3}
        bg={style.bgTint}
        borderBottom="0.5px solid"
        borderColor={style.borderTint}
      >
        <Flex
          align="center"
          justify="center"
          w="34px" h="34px"
          rounded="md"
          bg={`${style.color}18`}
          fontSize="md"
          flexShrink={0}
        >
          {style.icon}
        </Flex>
        <Text
          fontSize="xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wider"
          color={style.color}
          fontFamily="mono"
        >
          {style.label}
        </Text>
      </Flex>

      {/* Body */}
      <Box px={4} py={4}>
        <Text fontSize="md" fontWeight="semibold" fontFamily="heading" color="fg" mb={2} lineHeight="1.3">
          {card.title}
        </Text>

        <Text fontSize="sm" color="fg" lineHeight="1.7" fontFamily="sans">
          {parseReportProse(card.description, consequences)}
        </Text>

        {/* Referenced consequences with chip tooltips */}
        {referenced.length > 0 && (
          <Flex direction="column" gap={1.5} pt={3} mt={3} borderTop="1px solid" borderColor="border.muted">
            <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontFamily="mono">
              Related consequences
            </Text>
            {referenced.map(c => (
              <Box key={c.id} maxW="100%" overflow="hidden">
                <ConsequenceChip consequence={c} maxLength={200} />
              </Box>
            ))}
          </Flex>
        )}
      </Box>
    </Box>
  );
}

// ── Idea Recommendation Card — Colored header band ──────────

const FEASIBILITY_STYLES: Record<string, { color: string; bg: string }> = {
  high: { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
  medium: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
  low: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
};

interface IdeaCardProps {
  idea: IdeaRecommendation;
  consequences: Consequence[];
}

export function IdeaCard({ idea, consequences }: IdeaCardProps) {
  const feasStyle = FEASIBILITY_STYLES[idea.feasibility] || FEASIBILITY_STYLES.medium;

  return (
    <Box
      border="1px solid"
      borderColor="border.muted"
      rounded="lg"
      overflow="hidden"
      bg="bg"
      transition="box-shadow 0.2s"
      _hover={{ shadow: 'sm' }}
    >
      {/* Header band — purple for existing, amber for new */}
      <Flex
        align="center"
        gap={3}
        px={4}
        py={3}
        bg={idea.isExisting ? 'rgba(124,92,252,0.05)' : 'rgba(234,88,12,0.04)'}
        borderBottom="0.5px solid"
        borderColor={idea.isExisting ? 'rgba(124,92,252,0.12)' : 'rgba(234,88,12,0.1)'}
      >
        <Flex
          align="center"
          justify="center"
          w="34px" h="34px"
          rounded="md"
          bg={idea.isExisting ? 'rgba(124,92,252,0.1)' : 'rgba(234,88,12,0.08)'}
          color={idea.isExisting ? '#7c5cfc' : '#ea580c'}
          flexShrink={0}
        >
          {idea.isExisting
            ? <Lightbulb size={16} />
            : <PlusCircle size={16} />
          }
        </Flex>
        <Text
          fontSize="xs"
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wider"
          color={idea.isExisting ? '#7c5cfc' : '#ea580c'}
          fontFamily="mono"
        >
          {idea.isExisting ? 'Existing Idea' : 'New Recommendation'}
        </Text>
        <Flex ml="auto" gap={1.5}>
          <Box
            px={2} py={0.5} rounded="md"
            fontSize="2xs" fontWeight="bold"
            textTransform="uppercase" letterSpacing="wider"
            bg={feasStyle.bg} color={feasStyle.color}
          >
            {idea.feasibility} feasibility
          </Box>
        </Flex>
      </Flex>

      {/* Body */}
      <Box px={4} py={4}>
        <Text fontSize="md" fontWeight="semibold" fontFamily="heading" color="fg" mb={2} lineHeight="1.3">
          {idea.title}
        </Text>

        <Text fontSize="sm" color="fg" lineHeight="1.7" fontFamily="sans">
          {parseReportProse(idea.description, consequences)}
        </Text>

        {idea.addressesInsight && (
          <Flex align="center" gap={1.5} mt={3} pt={3} borderTop="1px solid" borderColor="border.muted">
            <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontFamily="mono" flexShrink={0}>
              Addresses
            </Text>
            <Text fontSize="xs" color="fg.muted" fontWeight="medium">
              {idea.addressesInsight}
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

// ── Subject Card — connected subject from FAST knowledge base ───

const RELEVANCE_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  direct:     { color: '#7c5cfc', bg: 'rgba(124,92,252,0.08)', border: 'rgba(124,92,252,0.15)', label: 'Direct' },
  tangential: { color: '#0d9488', bg: 'rgba(13,148,136,0.06)', border: 'rgba(13,148,136,0.12)', label: 'Tangential' },
};

interface SubjectCardProps {
  subject: RelevantSubject;
  consequences: Consequence[];
}

export function SubjectCard({ subject, consequences }: SubjectCardProps) {
  const relStyle = RELEVANCE_STYLES[subject.relevance] || RELEVANCE_STYLES.tangential;
  const linked = subject.relatedConsequenceIds
    .map(id => consequences.find(c => c.id === id))
    .filter(Boolean) as Consequence[];

  return (
    <Box
      border="1px solid"
      borderColor="border.muted"
      rounded="lg"
      overflow="hidden"
      bg="bg"
      transition="box-shadow 0.2s"
      _hover={{ shadow: 'sm' }}
    >
      {/* Header band */}
      <Flex
        align="center"
        gap={3}
        px={4}
        py={3}
        bg={relStyle.bg}
        borderBottom="0.5px solid"
        borderColor={relStyle.border}
      >
        <Flex
          align="center"
          justify="center"
          w="34px" h="34px"
          rounded="md"
          bg={`${relStyle.color}18`}
          color={relStyle.color}
          flexShrink={0}
        >
          {subject.relevance === 'direct' ? <Link2 size={16} /> : <Globe size={16} />}
        </Flex>
        <Box flex={1} minW={0}>
          <Text fontSize="md" fontWeight="semibold" fontFamily="heading" color="fg" lineHeight="1.3">
            {subject.name}
          </Text>
        </Box>
        <Box
          px={2} py={0.5} rounded="md"
          fontSize="2xs" fontWeight="bold"
          textTransform="uppercase" letterSpacing="wider"
          bg={relStyle.bg} color={relStyle.color}
          border="0.5px solid"
          borderColor={relStyle.border}
          flexShrink={0}
        >
          {relStyle.label}
        </Box>
      </Flex>

      {/* Body */}
      <Box px={4} py={4}>
        <Text fontSize="sm" color="fg.muted" lineHeight="1.7" fontFamily="sans">
          {subject.reason}
        </Text>

        {linked.length > 0 && (
          <Flex direction="column" gap={1.5} pt={3} mt={3} borderTop="1px solid" borderColor="border.muted">
            <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontFamily="mono">
              Linked consequences
            </Text>
            {linked.map(c => (
              <Box key={c.id} maxW="100%" overflow="hidden">
                <ConsequenceChip consequence={c} maxLength={200} />
              </Box>
            ))}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
