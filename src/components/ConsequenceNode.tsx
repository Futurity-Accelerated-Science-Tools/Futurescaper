import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Consequence, STEEP_COLORS, STEEP_LABELS, getSentimentColors, SOLUTION_COLORS, IMPORTANCE_SIZES, PROBABILITY_COLORS } from '../types';
import { TrendingUp, TrendingDown, Minus, Zap, AlertTriangle, Star, Clock, Target, Lightbulb, Wrench } from 'lucide-react';

interface ConsequenceNodeData {
  consequence: Consequence;
  isGenerating?: boolean;
  isDimmed?: boolean;
  isNewlyExpanded?: boolean;
  onClick?: (id: string) => void;
}

export const ConsequenceNode = memo(({ data }: NodeProps<ConsequenceNodeData>) => {
  const { consequence, isGenerating, isDimmed = false, isNewlyExpanded = false, onClick } = data;
  const isSolutionOrIdea = consequence.nodeType === 'solution' || consequence.nodeType === 'idea';
  const colors = isSolutionOrIdea ? SOLUTION_COLORS : getSentimentColors(consequence.sentiment);
  const steepColor = STEEP_COLORS[consequence.category];

  // Scale based on importance
  const importance = consequence.importance || 'medium';
  const scale = IMPORTANCE_SIZES[importance];
  const baseWidth = 220;
  const nodeWidth = baseWidth * scale;

  const SentimentIcon = isSolutionOrIdea
    ? (consequence.nodeType === 'idea' ? Lightbulb : Wrench)
    : consequence.sentiment === 'positive'
      ? TrendingUp
      : consequence.sentiment === 'negative'
        ? TrendingDown
        : Minus;

  const isWildcard = consequence.probability === 'wildcard';
  const isCritical = importance === 'critical';
  const isHighImportance = importance === 'high';

  // Border width based on importance
  const borderWidth = isCritical ? 3 : isHighImportance ? 2.5 : 2;

  // Probability indicator color
  const probabilityColor = consequence.probability ? PROBABILITY_COLORS[consequence.probability] : PROBABILITY_COLORS.plausible;

  return (
    <div
      onClick={() => onClick?.(consequence.id)}
      className={`consequence-node px-3 py-2 rounded-xl shadow-md cursor-pointer transition-all hover:scale-105 ${isGenerating ? 'generating-pulse' : ''} ${isCritical && !isDimmed ? 'ring-2 ring-offset-2 ring-amber-400' : ''} ${isNewlyExpanded ? 'newly-expanded-glow' : ''}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: isNewlyExpanded ? '#d69e2e' : isSolutionOrIdea ? SOLUTION_COLORS.border : isWildcard ? '#8b5cf6' : colors.border,
        borderWidth: isNewlyExpanded ? '3px' : `${borderWidth}px`,
        width: `${nodeWidth}px`,
        borderStyle: isWildcard ? 'dashed' : 'solid',
        opacity: isDimmed ? 0.35 : 1,
        filter: isDimmed ? 'grayscale(50%)' : 'none',
        transition: 'opacity 0.3s, filter 0.3s',
      }}
    >
      {/* Handles on all sides for flexible connections */}
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Right} id="right" className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-slate-400" />

      <div className="flex items-start gap-2 mb-1.5">
        <SentimentIcon
          className="flex-shrink-0 mt-0.5"
          style={{ color: colors.text, width: 14 * scale, height: 14 * scale }}
        />
        <div>
          {isSolutionOrIdea && consequence.title ? (
            <>
              <p
                className="font-bold leading-snug"
                style={{
                  color: colors.text,
                  fontSize: `${12 * scale}px`,
                  lineHeight: 1.2,
                }}
              >
                {consequence.title}
              </p>
              <p
                className="leading-snug mt-0.5"
                style={{
                  color: colors.text,
                  fontSize: `${9 * scale}px`,
                  lineHeight: 1.3,
                  opacity: 0.8,
                }}
              >
                {consequence.text}
              </p>
            </>
          ) : (
            <p
              className="font-medium leading-snug"
              style={{
                color: colors.text,
                fontSize: `${11 * scale}px`,
                lineHeight: 1.3,
              }}
            >
              {consequence.text}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {/* Solution/Idea badge */}
        {isSolutionOrIdea && (
          <span
            className="steep-badge flex items-center gap-0.5"
            style={{
              backgroundColor: SOLUTION_COLORS.bg,
              color: SOLUTION_COLORS.text,
              fontSize: `${9 * scale}px`,
              padding: `${2 * scale}px ${6 * scale}px`,
              border: `1px solid ${SOLUTION_COLORS.border}`,
            }}
          >
            {consequence.nodeType === 'idea' ? (
              <><Lightbulb style={{ width: 10 * scale, height: 10 * scale }} /> Idea</>
            ) : (
              <><Wrench style={{ width: 10 * scale, height: 10 * scale }} /> Solution</>
            )}
          </span>
        )}

        {/* STEEP Category */}
        <span
          className="steep-badge"
          style={{
            backgroundColor: `${steepColor}20`,
            color: steepColor,
            fontSize: `${9 * scale}px`,
            padding: `${2 * scale}px ${6 * scale}px`,
          }}
        >
          {STEEP_LABELS[consequence.category]}
        </span>

        {/* Probability indicator */}
        {consequence.probability && (
          <span
            className="steep-badge flex items-center gap-0.5"
            style={{
              backgroundColor: `${probabilityColor}20`,
              color: probabilityColor,
              fontSize: `${8 * scale}px`,
              padding: `${2 * scale}px ${5 * scale}px`,
            }}
            title={`${consequence.probability} likelihood`}
          >
            <Target style={{ width: 8 * scale, height: 8 * scale }} />
            {consequence.probability === 'probable' ? '●●●' :
             consequence.probability === 'plausible' ? '●●○' :
             consequence.probability === 'possible' ? '●○○' : '◇'}
          </span>
        )}

        {/* Wildcard indicator */}
        {isWildcard && (
          <span
            className="steep-badge bg-purple-100 text-purple-700 flex items-center gap-0.5"
            style={{ fontSize: `${9 * scale}px`, padding: `${2 * scale}px ${6 * scale}px` }}
          >
            <Zap style={{ width: 10 * scale, height: 10 * scale }} />
            Wild
          </span>
        )}


        {/* Importance indicators */}
        {isCritical && (
          <span
            className="steep-badge bg-amber-100 text-amber-700 flex items-center gap-0.5"
            style={{ fontSize: `${9 * scale}px`, padding: `${2 * scale}px ${6 * scale}px` }}
          >
            <Star style={{ width: 10 * scale, height: 10 * scale, fill: 'currentColor' }} />
            Critical
          </span>
        )}

        {isHighImportance && !isCritical && (
          <span
            className="steep-badge bg-blue-100 text-blue-700 flex items-center gap-0.5"
            style={{ fontSize: `${8 * scale}px`, padding: `${2 * scale}px ${5 * scale}px` }}
          >
            <Star style={{ width: 9 * scale, height: 9 * scale }} />
            High
          </span>
        )}

        {/* Time frame indicator */}
        {consequence.timeFrame && (
          <span
            className="steep-badge bg-slate-100 text-slate-600 flex items-center gap-0.5"
            style={{ fontSize: `${7 * scale}px`, padding: `${1 * scale}px ${4 * scale}px` }}
            title={consequence.timeFrame}
          >
            <Clock style={{ width: 8 * scale, height: 8 * scale }} />
            {consequence.timeFrame === 'immediate' ? 'Now' :
             consequence.timeFrame === 'short-term' ? 'Soon' : 'Later'}
          </span>
        )}
      </div>

      {/* Source handles on all sides */}
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-slate-400" />
    </div>
  );
});

ConsequenceNode.displayName = 'ConsequenceNode';

// Seed node (center)
export const SeedNode = memo(({ data }: NodeProps<{ title: string; description: string }>) => {
  return (
    <div className="px-6 py-4 rounded-2xl shadow-lg border-2 bg-seed-light border-seed max-w-[280px]">
      <Handle type="source" position={Position.Right} id="right-source" className="w-3 h-3 !bg-seed" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-3 h-3 !bg-seed" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-3 h-3 !bg-seed" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-3 h-3 !bg-seed" />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-seed flex items-center justify-center">
          <span className="text-white text-lg">🌱</span>
        </div>
        <span className="text-xs font-semibold text-seed uppercase tracking-wider">Seed</span>
      </div>

      <h3 className="font-bold text-seed-dark text-base mb-1">{data.title}</h3>
      <p className="text-xs text-seed-dark/70 line-clamp-3">{data.description}</p>
    </div>
  );
});

SeedNode.displayName = 'SeedNode';
