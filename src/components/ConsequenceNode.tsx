import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Consequence,
  STEEP_COLORS,
  STEEP_LABELS,
  getSentimentColors,
  SOLUTION_COLORS,
  IMPORTANCE_SIZES,
  PROBABILITY_COLORS,
  STEEPCategory,
  Sentiment,
  Probability,
  Importance,
} from '../types';
import {
  TrendingUp, TrendingDown, Minus, Zap, Star, Clock, Target,
  Lightbulb, Wrench, Pencil, Plus, Sparkles, Trash2, Loader2,
  Check, X,
} from 'lucide-react';

// ─── Shared NodeHandles ───────────────────────────────────────────
function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Right} id="right" className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-slate-400" />
    </>
  );
}

// ─── ActionToolbar ────────────────────────────────────────────────
// Horizontal toolbar below the node with two grouped containers:
//   Left group (management): Edit, Delete
//   Right group (creation): Add Child, AI Expand, Ideas
// Colored icon-only square buttons with staggered spring pop-in animation
function ActionToolbar({
  onEdit,
  onAddChild,
  onGenerateChildren,
  onGenerateIdeas,
  onDelete,
  isGeneratingChildren,
  isGeneratingIdeas,
}: {
  onEdit: () => void;
  onAddChild: () => void;
  onGenerateChildren: () => void;
  onGenerateIdeas: () => void;
  onDelete: () => void;
  isGeneratingChildren?: boolean;
  isGeneratingIdeas?: boolean;
}) {
  return (
    <div
      className="node-action-toolbar absolute flex items-center gap-2 z-50"
      style={{ top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Management group */}
      <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 p-1 gap-1">
        <ActionBtn icon={<Pencil className="w-3.5 h-3.5" />} label="Edit" onClick={onEdit} bg="bg-blue-500" hoverBg="hover:bg-blue-600" delay={0} />
        <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={onDelete} bg="bg-red-500" hoverBg="hover:bg-red-600" delay={1} />
      </div>

      {/* Creation group */}
      <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 p-1 gap-1">
        <ActionBtn icon={<Plus className="w-3.5 h-3.5" />} label="Add Child" onClick={onAddChild} bg="bg-green-500" hoverBg="hover:bg-green-600" delay={2} />
        <ActionBtn
          icon={isGeneratingChildren ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          label={isGeneratingChildren ? 'Generating...' : 'AI Expand'}
          onClick={onGenerateChildren}
          disabled={isGeneratingChildren}
          bg="bg-purple-500"
          hoverBg="hover:bg-purple-600"
          delay={3}
        />
        <ActionBtn
          icon={isGeneratingIdeas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
          label={isGeneratingIdeas ? 'Generating...' : 'Ideas'}
          onClick={onGenerateIdeas}
          disabled={isGeneratingIdeas}
          bg="bg-amber-500"
          hoverBg="hover:bg-amber-600"
          delay={4}
        />
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
  bg,
  hoverBg,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  bg: string;
  hoverBg: string;
  delay: number;
}) {
  return (
    <button
      className={`node-action-btn relative w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm transition-colors group ${bg} ${hoverBg} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ animationDelay: `${delay * 40}ms` }}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={disabled}
    >
      {icon}
      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {label}
      </span>
    </button>
  );
}

// ─── EditModeView ─────────────────────────────────────────────────
function EditModeView({
  consequence,
  onSave,
  onCancel,
}: {
  consequence: Consequence;
  onSave: (updates: Partial<Consequence>) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(consequence.text);
  const [sentiment, setSentiment] = useState<Sentiment>(consequence.sentiment);
  const [category, setCategory] = useState<STEEPCategory>(consequence.category);
  const [probability, setProbability] = useState<Probability>(consequence.probability || 'plausible');
  const [importance, setImportance] = useState<Importance>(consequence.importance || 'medium');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleSave = () => {
    onSave({ text, sentiment, category, probability, importance });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const sentimentOptions: { value: Sentiment; label: string; color: string; icon: React.ReactNode }[] = [
    { value: 'positive', label: 'Positive', color: '#22c55e', icon: <TrendingUp className="w-3 h-3" /> },
    { value: 'negative', label: 'Negative', color: '#ef4444', icon: <TrendingDown className="w-3 h-3" /> },
    { value: 'neutral', label: 'Neutral', color: '#6b7280', icon: <Minus className="w-3 h-3" /> },
  ];

  const steepOptions: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
  const probabilityOptions: Probability[] = ['probable', 'plausible', 'possible', 'wildcard'];
  const importanceOptions: Importance[] = ['critical', 'high', 'medium', 'low'];

  return (
    <div
      className="consequence-node px-3 py-3 rounded-xl shadow-lg border-2 border-blue-400 bg-white"
      style={{ width: '340px', position: 'relative' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <NodeHandles />

      {/* Text */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
        rows={3}
        placeholder="Describe the consequence..."
        onPointerDown={(e) => e.stopPropagation()}
      />

      {/* Sentiment */}
      <div className="flex gap-1 mt-2">
        {sentimentOptions.map((opt) => (
          <button
            key={opt.value}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              sentiment === opt.value ? 'outline outline-2 outline-offset-1' : 'bg-slate-100 text-slate-600'
            }`}
            style={sentiment === opt.value ? { outlineColor: opt.color, color: opt.color } : {}}
            onClick={(e) => { e.stopPropagation(); setSentiment(opt.value); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* STEEP Category */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {steepOptions.map((cat) => (
          <button
            key={cat}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              category === cat ? 'outline outline-2 outline-offset-1' : 'bg-slate-100 text-slate-500'
            }`}
            style={category === cat ? { outlineColor: STEEP_COLORS[cat], color: STEEP_COLORS[cat] } : {}}
            onClick={(e) => { e.stopPropagation(); setCategory(cat); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {STEEP_LABELS[cat].slice(0, 4)}
          </button>
        ))}
      </div>

      {/* Probability */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {probabilityOptions.map((p) => (
          <button
            key={p}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              probability === p ? 'outline outline-2 outline-offset-1 text-purple-600' : 'bg-slate-100 text-slate-500'
            }`}
            style={probability === p ? { outlineColor: PROBABILITY_COLORS[p], color: PROBABILITY_COLORS[p] } : {}}
            onClick={(e) => { e.stopPropagation(); setProbability(p); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Importance */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {importanceOptions.map((imp) => (
          <button
            key={imp}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              importance === imp ? 'outline outline-2 outline-offset-1 font-semibold' : 'bg-slate-100 text-slate-500'
            }`}
            style={importance === imp ? { outlineColor: '#6366f1', color: '#4f46e5' } : {}}
            onClick={(e) => { e.stopPropagation(); setImportance(imp); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {imp}
          </button>
        ))}
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 mt-3">
        <button
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Check className="w-3 h-3" /> Save
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mt-1 text-center">⌘+Enter to save · Esc to cancel</p>
    </div>
  );
}

// ─── ConsequenceNodeData Interface ────────────────────────────────
export interface ConsequenceNodeData {
  consequence: Consequence;
  isGenerating?: boolean;
  isDimmed?: boolean;
  isFocusDimmed?: boolean;
  isNewlyExpanded?: boolean;
  // Interactive fields
  isSelected?: boolean;
  isEditing?: boolean;
  isNewNode?: boolean;
  isGeneratingChildren?: boolean;
  isGeneratingIdeas?: boolean;
  isPlaceholder?: boolean;
  isGenerationInProgress?: boolean;
  // Callbacks
  onClick?: (id: string) => void;
  onStartEdit?: (id: string) => void;
  onSaveEdit?: (id: string, updates: Partial<Consequence>) => void;
  onCancelEdit?: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onGenerateChildren?: (parentId: string) => void;
  onGenerateIdeas?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// ─── ConsequenceNode ──────────────────────────────────────────────
export const ConsequenceNode = memo(({ data, draggable }: NodeProps<ConsequenceNodeData>) => {
  const {
    consequence,
    isGenerating,
    isDimmed = false,
    isFocusDimmed = false,
    isNewlyExpanded = false,
    isSelected,
    isEditing,
    isGeneratingChildren,
    isGeneratingIdeas,
    isPlaceholder,
    isGenerationInProgress,
    onClick,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onAddChild,
    onGenerateChildren,
    onGenerateIdeas,
    onDelete,
  } = data;

  // ── Hover expansion state ──
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsHoverExpanded(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHoverExpanded(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // ── Placeholder rendering ──
  if (isPlaceholder) {
    return (
      <div
        className="consequence-node px-3 py-2 rounded-xl shadow-md border-2 border-dashed border-purple-300 bg-purple-50/80 generating-pulse"
        style={{ width: '220px', position: 'relative' }}
      >
        <NodeHandles />
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
          <span className="text-xs font-semibold text-purple-600">AI Generating...</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 bg-purple-200/60 rounded animate-pulse" />
          <div className="h-3 bg-purple-200/40 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-purple-200/30 rounded animate-pulse w-3/5" />
        </div>
        <div className="flex gap-1 mt-2">
          <div className="h-4 w-12 bg-purple-200/40 rounded animate-pulse" />
          <div className="h-4 w-8 bg-purple-200/30 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Edit mode rendering ──
  if (isEditing && onSaveEdit && onCancelEdit) {
    return (
      <EditModeView
        consequence={consequence}
        onSave={(updates) => onSaveEdit(consequence.id, updates)}
        onCancel={() => onCancelEdit(consequence.id)}
      />
    );
  }

  // ── Normal display ──
  const isSolutionOrIdea = consequence.nodeType === 'solution' || consequence.nodeType === 'idea';
  const colors = isSolutionOrIdea ? SOLUTION_COLORS : getSentimentColors(consequence.sentiment);
  const steepColor = STEEP_COLORS[consequence.category];
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
  const borderWidth = isCritical ? 3 : isHighImportance ? 2.5 : 2;
  const probabilityColor = consequence.probability ? PROBABILITY_COLORS[consequence.probability] : PROBABILITY_COLORS.plausible;

  const showExpanded = isHoverExpanded || isSelected;

  return (
    <div
      onClick={() => onClick?.(consequence.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`consequence-node px-3 py-2 rounded-xl shadow-md cursor-pointer hover:shadow-lg ${isGenerating ? 'generating-pulse' : ''} ${isCritical && !isDimmed ? 'ring-2 ring-offset-2 ring-amber-400' : ''} ${isNewlyExpanded ? 'newly-expanded-glow' : ''} ${isSelected ? 'ring-2 ring-offset-2 ring-blue-400' : ''} ${isFocusDimmed ? 'focus-dimmed' : ''}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: isNewlyExpanded ? '#d69e2e' : isSolutionOrIdea ? SOLUTION_COLORS.border : isWildcard ? '#8b5cf6' : colors.border,
        borderWidth: isNewlyExpanded ? '3px' : `${borderWidth}px`,
        width: showExpanded ? `${Math.max(nodeWidth, 280)}px` : `${nodeWidth}px`,
        borderStyle: isWildcard ? 'dashed' : 'solid',
        opacity: isDimmed ? 0.35 : 1,
        filter: isDimmed ? 'grayscale(50%)' : 'none',
        transition: 'opacity 0.3s, filter 0.3s, width 0.25s ease, box-shadow 0.2s ease',
        position: 'relative',
      }}
    >
      <NodeHandles />

      {/* Action Toolbar */}
      {isSelected && !isDimmed && !isGenerationInProgress && onStartEdit && onAddChild && onGenerateChildren && onGenerateIdeas && onDelete && (
        <ActionToolbar
          onEdit={() => onStartEdit(consequence.id)}
          onAddChild={() => onAddChild(consequence.id)}
          onGenerateChildren={() => onGenerateChildren(consequence.id)}
          onGenerateIdeas={() => onGenerateIdeas(consequence.id)}
          onDelete={() => onDelete(consequence.id)}
          isGeneratingChildren={isGeneratingChildren}
          isGeneratingIdeas={isGeneratingIdeas}
        />
      )}

      <div className="flex items-start gap-2 mb-1.5">
        <SentimentIcon
          className="flex-shrink-0 mt-0.5"
          style={{ color: colors.text, width: 14 * scale, height: 14 * scale }}
        />
        <div>
          {isSolutionOrIdea && consequence.title ? (
            <>
              <p className="font-bold leading-snug" style={{ color: colors.text, fontSize: `${12 * scale}px`, lineHeight: 1.2 }}>
                {consequence.title}
              </p>
              <p className="leading-snug mt-0.5" style={{ color: colors.text, fontSize: showExpanded ? `${10 * scale}px` : `${9 * scale}px`, lineHeight: 1.3, opacity: 0.8 }}>
                {consequence.text}
              </p>
            </>
          ) : (
            <p className="font-medium leading-snug" style={{ color: colors.text, fontSize: `${11 * scale}px`, lineHeight: 1.3 }}>
              {consequence.text}
            </p>
          )}
        </div>
      </div>

      {/* Expanded metadata on hover/select */}
      {showExpanded && (
        <div className="node-expanded-meta border-t border-slate-200/60 pt-1.5 mt-1 mb-1">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Order:</span>
              <span className="font-semibold" style={{ color: colors.text }}>{consequence.order}° — {consequence.order === 1 ? 'Direct' : consequence.order === 2 ? 'Ripple' : consequence.order === 3 ? 'Cascade' : consequence.order === 4 ? 'Deep' : 'Systemic'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Importance:</span>
              <span className="font-semibold capitalize" style={{ color: importance === 'critical' ? '#d97706' : importance === 'high' ? '#2563eb' : colors.text }}>{importance}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Probability:</span>
              <span className="font-semibold capitalize" style={{ color: probabilityColor }}>{consequence.probability || 'plausible'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Sentiment:</span>
              <span className="font-semibold capitalize" style={{ color: colors.text }}>{consequence.sentiment}</span>
            </div>
            {consequence.timeFrame && (
              <div className="flex items-center gap-1 col-span-2">
                <span className="text-slate-400">Timeframe:</span>
                <span className="font-semibold capitalize" style={{ color: colors.text }}>{consequence.timeFrame}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {/* Solution/Idea badge */}
        {isSolutionOrIdea && (
          <span
            className="steep-badge flex items-center gap-0.5"
            style={{ backgroundColor: SOLUTION_COLORS.bg, color: SOLUTION_COLORS.text, fontSize: `${9 * scale}px`, padding: `${2 * scale}px ${6 * scale}px`, border: `1px solid ${SOLUTION_COLORS.border}` }}
          >
            {consequence.nodeType === 'idea' ? (<><Lightbulb style={{ width: 10 * scale, height: 10 * scale }} /> Idea</>) : (<><Wrench style={{ width: 10 * scale, height: 10 * scale }} /> Solution</>)}
          </span>
        )}

        {/* STEEP Category */}
        <span className="steep-badge" style={{ backgroundColor: `${steepColor}20`, color: steepColor, fontSize: `${9 * scale}px`, padding: `${2 * scale}px ${6 * scale}px` }}>
          {STEEP_LABELS[consequence.category]}
        </span>

        {/* Probability indicator */}
        {consequence.probability && (
          <span
            className="steep-badge flex items-center gap-0.5"
            style={{ backgroundColor: `${probabilityColor}20`, color: probabilityColor, fontSize: `${8 * scale}px`, padding: `${2 * scale}px ${5 * scale}px` }}
            title={`${consequence.probability} likelihood`}
          >
            <Target style={{ width: 8 * scale, height: 8 * scale }} />
            {consequence.probability === 'probable' ? '●●●' : consequence.probability === 'plausible' ? '●●○' : consequence.probability === 'possible' ? '●○○' : '◇'}
          </span>
        )}

        {/* Wildcard indicator */}
        {isWildcard && (
          <span className="steep-badge bg-purple-100 text-purple-700 flex items-center gap-0.5" style={{ fontSize: `${9 * scale}px`, padding: `${2 * scale}px ${6 * scale}px` }}>
            <Zap style={{ width: 10 * scale, height: 10 * scale }} /> Wild
          </span>
        )}

        {/* Importance indicators */}
        {isCritical && (
          <span className="steep-badge bg-amber-100 text-amber-700 flex items-center gap-0.5" style={{ fontSize: `${9 * scale}px`, padding: `${2 * scale}px ${6 * scale}px` }}>
            <Star style={{ width: 10 * scale, height: 10 * scale, fill: 'currentColor' }} /> Critical
          </span>
        )}
        {isHighImportance && !isCritical && (
          <span className="steep-badge bg-blue-100 text-blue-700 flex items-center gap-0.5" style={{ fontSize: `${8 * scale}px`, padding: `${2 * scale}px ${5 * scale}px` }}>
            <Star style={{ width: 9 * scale, height: 9 * scale }} /> High
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
            {consequence.timeFrame === 'immediate' ? 'Now' : consequence.timeFrame === 'short-term' ? 'Soon' : 'Later'}
          </span>
        )}
      </div>
    </div>
  );
});

ConsequenceNode.displayName = 'ConsequenceNode';

// ─── SeedNodeData Interface ───────────────────────────────────────
export interface SeedNodeData {
  title: string;
  description: string;
  isSelected?: boolean;
  isGeneratingChildren?: boolean;
  isGenerationInProgress?: boolean;
  onClick?: () => void;
  onAddChild?: () => void;
  onGenerateChildren?: () => void;
}

// ─── SeedActionToolbar ───────────────────────────────────────────
// Matches the ActionToolbar style: below node, colored squares, spring pop-in
function SeedActionToolbar({
  onAddChild,
  onGenerateChildren,
  isGeneratingChildren,
}: {
  onAddChild: () => void;
  onGenerateChildren: () => void;
  isGeneratingChildren?: boolean;
}) {
  return (
    <div
      className="node-action-toolbar absolute flex items-center gap-2 z-50"
      style={{ top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/80 p-1 gap-1">
        <ActionBtn icon={<Plus className="w-3.5 h-3.5" />} label="Add Child" onClick={onAddChild} bg="bg-green-500" hoverBg="hover:bg-green-600" delay={0} />
        <ActionBtn
          icon={isGeneratingChildren ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          label={isGeneratingChildren ? 'Generating...' : 'AI Generate'}
          onClick={onGenerateChildren}
          disabled={isGeneratingChildren}
          bg="bg-purple-500"
          hoverBg="hover:bg-purple-600"
          delay={1}
        />
      </div>
    </div>
  );
}

// ─── SeedNode ─────────────────────────────────────────────────────
export const SeedNode = memo(({ data }: NodeProps<SeedNodeData>) => {
  const { title, description, isSelected, isGeneratingChildren, isGenerationInProgress, onClick, onAddChild, onGenerateChildren } = data;

  return (
    <div
      className={`consequence-node px-6 py-4 rounded-2xl shadow-lg border-2 bg-seed-light border-seed max-w-[280px] cursor-pointer ${isSelected ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
      style={{ position: 'relative' }}
      onClick={() => onClick?.()}
    >
      <Handle type="source" position={Position.Right} id="right-source" className="w-3 h-3 !bg-seed" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-3 h-3 !bg-seed" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-3 h-3 !bg-seed" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-3 h-3 !bg-seed" />

      {/* Seed Action Toolbar */}
      {isSelected && !isGenerationInProgress && onAddChild && onGenerateChildren && (
        <SeedActionToolbar
          onAddChild={onAddChild}
          onGenerateChildren={onGenerateChildren}
          isGeneratingChildren={isGeneratingChildren}
        />
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-seed flex items-center justify-center">
          <span className="text-white text-lg">🌱</span>
        </div>
        <span className="text-xs font-semibold text-seed uppercase tracking-wider">Seed</span>
      </div>

      <h3 className="font-bold text-seed-dark text-base mb-1">{title}</h3>
      <p className="text-xs text-seed-dark/70 line-clamp-3">{description}</p>
    </div>
  );
});

SeedNode.displayName = 'SeedNode';
