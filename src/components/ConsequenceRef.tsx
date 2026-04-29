/**
 * ConsequenceRef — inline consequence/solution chips + hover tooltip previews.
 *
 * ConsequenceCardPreview: exact visual replica of the map's ConsequenceNode
 * ConsequenceChip: small inline pill for embedding in report prose
 * parseReportProse: converts text with node IDs into React elements with chips
 */
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Box, Flex, Text } from '@chakra-ui/react';
import { Lightbulb, Wrench } from 'lucide-react';
import {
  Consequence,
  STEEP_LABELS,
  PROBABILITY_SYMBOLS,
} from '../types';
import { SteepIcon, getSteepMutedBgSolid, getSteepTextColor } from './SteepIcon';
import { useColorMode } from '../theme/ColorModeProvider';

// ── Styling constants (matching ConsequenceNode exactly) ────────

const SENTIMENT_BADGE: Record<string, { light: { bg: string; color: string }; dark: { bg: string; color: string }; label: string; symbol: string }> = {
  positive: { light: { bg: '#e6fff5', color: '#0a6847' }, dark: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' }, label: 'Positive', symbol: '↑' },
  negative: { light: { bg: '#fff0f3', color: '#a4133c' }, dark: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' }, label: 'Negative', symbol: '↓' },
  neutral:  { light: { bg: '#e8eaef', color: '#2d3341' }, dark: { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' }, label: 'Neutral', symbol: '—' },
};

const SENTIMENT_BORDER: Record<string, string> = { positive: '#22c55e', negative: '#ef4444', neutral: '#94a3b8' };

const TIMEFRAME_LABELS: Record<string, string> = { immediate: '0–1 yr', 'short-term': '1–3 yrs', 'long-term': '3–10+ yrs' };

const IMPORTANCE_CONFIG: Record<string, {
  label: string; textColor: string; textOpacity: number;
  fontWeight: number; fontSize: number; letterSpacing: string; textTransform: string;
  lineColor: string; lineWidth: number; lineOpacity: number;
}> = {
  critical: { label: 'CRITICAL', textColor: '#92400e', textOpacity: 1, fontWeight: 800, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', lineColor: '#92400e', lineWidth: 2, lineOpacity: 0.4 },
  high:     { label: 'High', textColor: 'var(--chakra-colors-fg, #1B1B1D)', textOpacity: 0.7, fontWeight: 600, fontSize: 10, letterSpacing: '0', textTransform: 'none', lineColor: 'var(--chakra-colors-fg, #1B1B1D)', lineWidth: 1.5, lineOpacity: 0.25 },
  medium:   { label: 'Medium', textColor: 'var(--chakra-colors-fg-muted, #7D858C)', textOpacity: 0.6, fontWeight: 400, fontSize: 9, letterSpacing: '0', textTransform: 'none', lineColor: 'var(--chakra-colors-fg-muted, #7D858C)', lineWidth: 1, lineOpacity: 0.2 },
  low:      { label: 'Low', textColor: 'var(--chakra-colors-fg-muted, #7D858C)', textOpacity: 0.4, fontWeight: 300, fontSize: 9, letterSpacing: '0', textTransform: 'none', lineColor: 'var(--chakra-colors-fg-muted, #7D858C)', lineWidth: 0.5, lineOpacity: 0.15 },
};

// Idea/Solution importance config (white text on brand blue)
const IMPORTANCE_CONFIG_IDEA: Record<string, typeof IMPORTANCE_CONFIG[string]> = {
  critical: { label: 'CRITICAL', textColor: '#fff', textOpacity: 1, fontWeight: 800, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', lineColor: 'rgba(255,255,255,0.5)', lineWidth: 2, lineOpacity: 0.4 },
  high:     { label: 'High', textColor: 'rgba(255,255,255,0.85)', textOpacity: 0.85, fontWeight: 600, fontSize: 10, letterSpacing: '0', textTransform: 'none', lineColor: 'rgba(255,255,255,0.3)', lineWidth: 1.5, lineOpacity: 0.3 },
  medium:   { label: 'Medium', textColor: 'rgba(255,255,255,0.6)', textOpacity: 0.6, fontWeight: 400, fontSize: 9, letterSpacing: '0', textTransform: 'none', lineColor: 'rgba(255,255,255,0.2)', lineWidth: 1, lineOpacity: 0.2 },
  low:      { label: 'Low', textColor: 'rgba(255,255,255,0.4)', textOpacity: 0.4, fontWeight: 300, fontSize: 9, letterSpacing: '0', textTransform: 'none', lineColor: 'rgba(255,255,255,0.12)', lineWidth: 0.5, lineOpacity: 0.15 },
};

// ── ConsequenceCardPreview ──────────────────────────────────────
// Exact visual replica of the map ConsequenceNode — used in tooltips.
// Supports consequence, solution, and idea node types.

interface CardPreviewProps {
  consequence: Consequence;
}

export function ConsequenceCardPreview({ consequence: c }: CardPreviewProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const importance = c.importance || 'medium';
  const isSolutionOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
  const cfg = isSolutionOrIdea ? IMPORTANCE_CONFIG_IDEA[importance] : IMPORTANCE_CONFIG[importance];
  const sentBadge = SENTIMENT_BADGE[c.sentiment] || SENTIMENT_BADGE.neutral;
  const badge = isDark ? sentBadge.dark : sentBadge.light;

  const IDEA_BRAND = '#0005e9';
  const textColor = isSolutionOrIdea ? '#fff' : 'var(--chakra-colors-fg, #1B1B1D)';
  const nodeBg = isSolutionOrIdea ? IDEA_BRAND : 'var(--chakra-colors-bg-canvas, #FFFFFF)';

  return (
    <div
      style={{
        width: 280,
        padding: '14px 16px',
        borderRadius: 12,
        backgroundColor: nodeBg,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: isSolutionOrIdea ? 'rgba(255,255,255,0.12)' : (SENTIMENT_BORDER[c.sentiment] || '#94a3b8'),
        boxShadow: isSolutionOrIdea ? '0 2px 16px rgba(0,5,233,0.35)' : '0 4px 16px rgba(0,0,0,0.15)',
        position: 'relative',
        overflow: 'visible',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* STEEP category pill — floating top-left (consequences only) */}
      {!isSolutionOrIdea && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: -6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 22,
            borderRadius: 11,
            backgroundColor: getSteepMutedBgSolid(c.category, isDark),
            color: getSteepTextColor(c.category, isDark),
            fontSize: 8,
            fontWeight: 600,
            padding: '0 8px',
            zIndex: 10,
            border: `2px solid var(--chakra-colors-bg-canvas, #fff)`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <SteepIcon category={c.category} size={11} />
          {STEEP_LABELS[c.category]}
        </div>
      )}

      {/* Idea/solution type badge */}
      {isSolutionOrIdea && (
        <Flex align="center" gap={1} mb={1.5}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff',
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
          }}>
            {c.nodeType === 'idea'
              ? <Lightbulb style={{ width: 11, height: 11 }} />
              : <Wrench style={{ width: 11, height: 11 }} />
            }
            {c.nodeType === 'idea' ? 'Idea' : 'Solution'}
          </span>
        </Flex>
      )}

      {/* Main text */}
      <Box mt={isSolutionOrIdea ? 0 : 1}>
        {isSolutionOrIdea && c.title ? (
          <>
            <Flex align="center" gap={1}>
              {c.nodeType === 'idea'
                ? <Lightbulb style={{ width: 14, height: 14, color: '#fff', flexShrink: 0 }} />
                : <Wrench style={{ width: 14, height: 14, color: '#fff', flexShrink: 0 }} />
              }
              <Text fontWeight="bold" lineHeight="snug" style={{ color: textColor, fontSize: 14, fontFamily: "'TT Norms Pro Normal', -apple-system, sans-serif" }}>
                {c.title}
              </Text>
            </Flex>
            <Text lineHeight="snug" mt={0.5} style={{ color: textColor, fontSize: 11, opacity: 1 }}>
              {c.text}
            </Text>
          </>
        ) : (
          <Text fontWeight="medium" lineHeight="snug" style={{ color: textColor, fontSize: 11 }}>
            {c.text}
          </Text>
        )}
      </Box>

      {/* Badge row: sentiment + probability + timeframe */}
      <Flex gap={1} mt={2} flexWrap="nowrap" style={{ whiteSpace: 'nowrap' }}>
        {!isSolutionOrIdea && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontWeight: 600, backgroundColor: badge.bg, color: badge.color,
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
          }}>
            {sentBadge.symbol} {sentBadge.label}
          </span>
        )}

        {c.probability && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontWeight: 600,
            backgroundColor: isSolutionOrIdea ? 'rgba(255,255,255,0.15)' : 'var(--chakra-colors-bg-hover, #f5f5f5)',
            color: textColor,
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
          }}>
            {PROBABILITY_SYMBOLS[c.probability]} {c.probability}
          </span>
        )}

        {c.timeFrame && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontWeight: 600,
            backgroundColor: isSolutionOrIdea ? 'rgba(255,255,255,0.15)' : 'var(--chakra-colors-bg-hover, #f5f5f5)',
            color: textColor,
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
          }}>
            {TIMEFRAME_LABELS[c.timeFrame] || c.timeFrame}
          </span>
        )}
      </Flex>

      {/* Importance indicator — graduated line + text */}
      <div style={{ width: '100%', marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{
          width: '100%',
          height: `${cfg.lineWidth}px`,
          backgroundColor: cfg.lineColor,
          opacity: cfg.lineOpacity,
          borderRadius: cfg.lineWidth >= 1.5 ? 1 : 0,
        }} />
        <div style={{
          fontFamily: "'TT Norms Pro Normal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          fontSize: cfg.fontSize,
          fontWeight: cfg.fontWeight,
          letterSpacing: cfg.letterSpacing,
          textTransform: cfg.textTransform as React.CSSProperties['textTransform'],
          color: cfg.textColor,
          opacity: cfg.textOpacity,
          marginTop: 2,
        }}>
          {cfg.label}
        </div>
      </div>
    </div>
  );
}

// ── Tooltip Portal ──────────────────────────────────────────────
// Renders tooltip at document.body level to prevent layout reflow.

function TooltipPortal({ children, style }: { children: React.ReactNode; style: React.CSSProperties }) {
  return ReactDOM.createPortal(
    <div style={style}>{children}</div>,
    document.body,
  );
}

// ── ConsequenceChip ─────────────────────────────────────────────
// Small inline pill for embedding in report prose text.

interface ChipProps {
  consequence: Consequence;
  /** Max characters for the inline label (ignored when fullWidth is true) */
  maxLength?: number;
  /** When true, chip fills available width and truncates via CSS ellipsis instead of character count */
  fullWidth?: boolean;
}

export function ConsequenceChip({ consequence: c, maxLength = 40, fullWidth = false }: ChipProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const [showTooltip, setShowTooltip] = useState(false);
  const chipRef = useRef<HTMLSpanElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const isSolutionOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';

  // Position tooltip — prefer below, flip above if near bottom
  useEffect(() => {
    if (!showTooltip || !chipRef.current) return;
    const rect = chipRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const tooltipH = 200;
    const goAbove = spaceBelow < tooltipH + 20;

    let left = rect.left + rect.width / 2 - 140;
    left = Math.max(8, Math.min(left, window.innerWidth - 288));

    setTooltipStyle(goAbove
      ? { position: 'fixed' as const, bottom: window.innerHeight - rect.top + 8, left, zIndex: 9999 }
      : { position: 'fixed' as const, top: rect.bottom + 8, left, zIndex: 9999 }
    );
  }, [showTooltip]);

  // Chip colors for ideas/solutions
  const ideaChipColor = isDark ? '#93b4ff' : '#0005e9';
  const ideaChipBg = isDark ? 'rgba(0,5,233,0.15)' : 'rgba(0,5,233,0.08)';
  const ideaChipBorder = isDark ? 'rgba(0,5,233,0.3)' : 'rgba(0,5,233,0.15)';

  // Chip colors for consequences
  const sentColor = isDark
    ? (c.sentiment === 'negative' ? '#f87171' : c.sentiment === 'positive' ? '#4ade80' : '#94a3b8')
    : (c.sentiment === 'negative' ? '#a4133c' : c.sentiment === 'positive' ? '#0a6847' : '#434B53');

  const sentBg = isDark
    ? (c.sentiment === 'negative' ? 'rgba(239,68,68,0.12)' : c.sentiment === 'positive' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)')
    : (c.sentiment === 'negative' ? 'rgba(239,68,68,0.08)' : c.sentiment === 'positive' ? 'rgba(34,197,94,0.08)' : 'rgba(148,163,184,0.08)');

  const sentBorder = isDark
    ? (c.sentiment === 'negative' ? 'rgba(239,68,68,0.2)' : c.sentiment === 'positive' ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.2)')
    : (c.sentiment === 'negative' ? 'rgba(239,68,68,0.15)' : c.sentiment === 'positive' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)');

  const chipColor = isSolutionOrIdea ? ideaChipColor : sentColor;
  const chipBg = isSolutionOrIdea ? ideaChipBg : sentBg;
  const chipBorder = isSolutionOrIdea ? ideaChipBorder : sentBorder;

  const symbol = isSolutionOrIdea
    ? (c.nodeType === 'idea' ? '💡' : '🔧')
    : (c.sentiment === 'negative' ? '↓' : c.sentiment === 'positive' ? '↑' : '—');

  const displayText = c.title || c.text;
  const label = fullWidth ? displayText : (displayText.length > maxLength ? displayText.slice(0, maxLength) + '…' : displayText);
  // Native tooltip: show title + description for ideas/solutions, full text for consequences
  const tooltipText = c.title && c.text && c.title !== c.text
    ? `${c.title}\n${c.text}`
    : displayText;

  return (
    <>
      <span
        ref={chipRef}
        data-chip-id={c.id}
        title={tooltipText}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          display: fullWidth ? 'flex' : 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '1px 7px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', monospace",
          backgroundColor: chipBg,
          color: chipColor,
          border: `0.5px solid ${chipBorder}`,
          cursor: 'pointer',
          verticalAlign: 'baseline',
          lineHeight: 1.6,
          transition: 'background 0.15s',
          ...(fullWidth ? { maxWidth: '100%', overflow: 'hidden' } : {}),
        }}
      >
        <span style={{ flexShrink: 0 }}>{symbol}</span>
        {fullWidth ? (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
        ) : (
          <> {label}</>
        )}
      </span>

      {showTooltip && (
        <TooltipPortal style={tooltipStyle}>
          <ConsequenceCardPreview consequence={c} />
        </TooltipPortal>
      )}
    </>
  );
}

// ── parseReportProse ────────────────────────────────────────────
// Converts report text containing node IDs into React elements with ConsequenceChip.
// Supports two ID formats:
//   Normal:     c1-1699482019384-0, sol-c1-1699482019384-1699482019384-0
//   Share link: s-0, s-1, sol-0, sol-1

// Build the regex dynamically based on the actual consequence IDs in the dataset.
// This guarantees we match exactly the IDs that exist, regardless of format.
function buildIdRegex(consequences: { id: string }[]): RegExp {
  if (consequences.length === 0) return /(?!)/g; // never matches
  // Escape special regex chars in IDs and sort longest-first to avoid partial matches
  const escaped = consequences
    .map(c => c.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  // Match IDs wrapped in (), [], or bare ��� capturing just the ID
  return new RegExp(`[\\[(]?(${escaped.join('|')})[\\])]?`, 'g');
}

interface ParseOptions {
  maxChipLength?: number;
}

export function parseReportProse(
  text: string,
  consequences: Consequence[],
  options: ParseOptions = {},
): React.ReactNode[] {
  const byId = new Map(consequences.map(c => [c.id, c]));
  const regex = buildIdRegex(consequences);
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const id = match[1];
    const c = byId.get(id);

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (c) {
      parts.push(
        <ConsequenceChip
          key={`${id}-${match.index}`}
          consequence={c}
          maxLength={options.maxChipLength || 36}
        />
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
