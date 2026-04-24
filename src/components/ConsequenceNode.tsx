import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Flex, Text } from '@chakra-ui/react';
import {
  Consequence,
  STEEP_COLORS,
  STEEP_LABELS,
  SENTIMENT_SYMBOLS,
  SOLUTION_COLORS,
  PROBABILITY_SYMBOLS,
  STEEPCategory,
  Sentiment,
  Probability,
  Importance,
  TimeFrame,
} from '../types';
import {
  Lightbulb, Wrench, Pencil, Plus, Sparkles, Trash2, Loader2,
  Check, X, Cable,
} from 'lucide-react';
import { SteepIcon, getSteepMutedBg, getSteepTextColor } from './SteepIcon';
import { useColorMode } from '../theme/ColorModeProvider';

// ─── Shared NodeHandles ───────────────────────────────────────────
function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="source" position={Position.Right} id="right-source" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
    </>
  );
}

// (Action button colors removed — toolbar now uses text-style buttons with no colored backgrounds)

// ─── CountSelectorPopover ─────────────────────────────────────────
function CountSelectorPopover({
  onSelect,
  onClose,
}: {
  onSelect: (count: number) => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 12,
        backgroundColor: 'var(--chakra-colors-bg-canvas, #FFFFFF)',
        border: '1px solid var(--chakra-colors-border-muted, #e0e0e0)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 60,
        animation: 'countPopoverFadeIn 0.15s ease',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onSelect(n); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--chakra-colors-fg, #1B1B1D)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            transition: 'background 0.12s',
            fontFamily: "'TT Norms Pro Normal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--chakra-colors-bg-hover, #f5f5f5)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
        >
          {n}
        </div>
      ))}
      <style>{`@keyframes countPopoverFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

// ─── ActionToolbar ────────────────────────────────────────────────
// Below the node, split into two columns:
//   Left column (aligned left): Edit, Delete — actions on THIS node
//   Right column (aligned right): Add Child, AI Expand, Solve — create children
function ActionToolbar({
  onEdit,
  onAddChild,
  onConnect,
  onGenerateChildren,
  onGenerateIdeas,
  onDelete,
  isGeneratingChildren,
  isGeneratingIdeas,
}: {
  onEdit: () => void;
  onAddChild: () => void;
  onConnect: () => void;
  onGenerateChildren: (count?: number) => void;
  onGenerateIdeas: (count?: number) => void;
  onDelete: () => void;
  isGeneratingChildren?: boolean;
  isGeneratingIdeas?: boolean;
}) {
  const [openPopover, setOpenPopover] = useState<'expand' | 'ideas' | null>(null);

  return (
    <div
      className="node-action-toolbar"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        minWidth: '280px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        zIndex: 50,
        pointerEvents: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Left column: This node */}
      <Flex direction="column" align="flex-start" gap={0.5} style={{ pointerEvents: 'auto' }}>
        <ActionBtn icon={<Pencil style={{ width: 14, height: 14 }} />} label="Edit" onClick={onEdit} delay={0} />
        <ActionBtn icon={<Cable style={{ width: 14, height: 14 }} />} label="Connect" onClick={onConnect} delay={1} />
        <ActionBtn icon={<Trash2 style={{ width: 14, height: 14 }} />} label="Delete" onClick={onDelete} variant="danger" delay={2} />
      </Flex>

      {/* Right column: Create children */}
      <Flex direction="column" align="flex-end" gap={0.5} style={{ pointerEvents: 'auto' }}>
        <ActionBtn icon={<Plus style={{ width: 14, height: 14 }} />} label="Add Child" onClick={onAddChild} delay={3} />
        <Box position="relative">
          <ActionBtn
            icon={isGeneratingChildren ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Sparkles style={{ width: 14, height: 14 }} />}
            label={isGeneratingChildren ? 'Expanding...' : 'AI Expand'}
            onClick={() => setOpenPopover(openPopover === 'expand' ? null : 'expand')}
            disabled={isGeneratingChildren}
            delay={4}
          />
          {openPopover === 'expand' && (
            <CountSelectorPopover
              onSelect={(count) => { setOpenPopover(null); onGenerateChildren(count); }}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </Box>
        <Box position="relative">
          <ActionBtn
            icon={isGeneratingIdeas ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Lightbulb style={{ width: 14, height: 14 }} />}
            label={isGeneratingIdeas ? 'Generating...' : 'Solve'}
            onClick={() => setOpenPopover(openPopover === 'ideas' ? null : 'ideas')}
            disabled={isGeneratingIdeas}
            delay={5}
          />
          {openPopover === 'ideas' && (
            <CountSelectorPopover
              onSelect={(count) => { setOpenPopover(null); onGenerateIdeas(count); }}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </Box>
      </Flex>
    </div>
  );
}

// ─── ActionBtn — individual pill-style text+icon button ──────────
function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
  variant,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
  delay: number;
}) {
  const isDanger = variant === 'danger';
  return (
    <Box
      as="button"
      className="node-action-btn"
      display="flex"
      alignItems="center"
      gap="6px"
      px={2.5}
      py={1.5}
      rounded="lg"
      fontSize="xs"
      fontWeight="medium"
      bg="bg.canvas"
      color={isDanger ? 'red.500' : 'fg.secondary'}
      shadow="sm"
      borderWidth="1px"
      borderColor="border.muted"
      transition="all 0.12s"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.4 : 1}
      whiteSpace="nowrap"
      _hover={!disabled ? {
        bg: isDanger ? 'red.50' : 'bg.hover',
        color: isDanger ? 'red.600' : 'fg',
        shadow: 'md',
        borderColor: isDanger ? 'red.200' : 'border.emphasized',
      } : {}}
      style={{ animationDelay: `${delay * 30}ms` }}
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (!disabled) onClick(); }}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
    >
      {icon}
      {label}
    </Box>
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
  const [title, setTitle] = useState(consequence.title || '');
  const [sentiment, setSentiment] = useState<Sentiment>(consequence.sentiment);
  const [category, setCategory] = useState<STEEPCategory>(consequence.category);
  const [probability, setProbability] = useState<Probability>(consequence.probability || 'plausible');
  const [importance, setImportance] = useState<Importance>(consequence.importance || 'medium');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(consequence.timeFrame || 'short-term');
  const [nodeType, setNodeType] = useState<'consequence' | 'idea' | 'solution'>(consequence.nodeType || 'consequence');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSolutionOrIdea = nodeType === 'solution' || nodeType === 'idea';

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleSave = () => {
    const updates: Partial<Consequence> = { text, sentiment, category, probability, importance, timeFrame, nodeType: isSolutionOrIdea ? nodeType : undefined };
    if (isSolutionOrIdea) updates.title = title;
    onSave(updates);
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

  const sentimentOptions: { value: Sentiment; label: string; symbol: string; color: string }[] = [
    { value: 'positive', label: 'Positive', symbol: '↑', color: '#22c55e' },
    { value: 'negative', label: 'Negative', symbol: '↓', color: '#ef4444' },
    { value: 'neutral', label: 'Neutral', symbol: '—', color: '#94a3b8' },
  ];

  const steepOptions: STEEPCategory[] = ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'];
  const probabilityOptions: Probability[] = ['probable', 'plausible', 'possible', 'wildcard'];
  const importanceOptions: Importance[] = ['critical', 'high', 'medium', 'low'];
  const timeFrameOptions: { value: TimeFrame; label: string }[] = [
    { value: 'immediate', label: '0–1 yr' },
    { value: 'short-term', label: '1–3 yrs' },
    { value: 'long-term', label: '3–10+' },
  ];

  // Theme-following: regular nodes use bg.canvas/fg, ideas keep brand blue
  const panelBg = isSolutionOrIdea ? '#0005e9' : 'var(--chakra-colors-bg-canvas, #FFFFFF)';
  const panelText = isSolutionOrIdea ? '#fff' : 'var(--chakra-colors-fg, #1B1B1D)';
  const panelTextMuted = isSolutionOrIdea ? 'rgba(255,255,255,0.6)' : 'var(--chakra-colors-fg-muted, #94a3b8)';
  const panelBorder = isSolutionOrIdea ? 'rgba(255,255,255,0.12)' : 'var(--chakra-colors-border-muted, #e0e0e0)';
  const panelInputBg = isSolutionOrIdea ? 'rgba(255,255,255,0.12)' : 'var(--chakra-colors-bg-hover, #f5f5f5)';
  const panelInputBorder = isSolutionOrIdea ? 'rgba(255,255,255,0.25)' : 'var(--chakra-colors-border-muted, #e0e0e0)';
  const panelBtnBg = isSolutionOrIdea ? 'rgba(255,255,255,0.15)' : 'var(--chakra-colors-bg-hover, #f5f5f5)';
  const panelBtnActiveBg = isSolutionOrIdea ? 'rgba(255,255,255,0.9)' : 'var(--chakra-colors-fg, #1B1B1D)';
  const panelBtnActiveText = isSolutionOrIdea ? '#0005e9' : 'var(--chakra-colors-bg-canvas, #FFFFFF)';

  // Sentiment border color for the panel
  const sentimentBorderColor = isSolutionOrIdea ? panelBorder : (sentimentOptions.find(s => s.value === sentiment)?.color || '#94a3b8');

  // Importance indicator colors
  const impBarBg: Record<string, string> = isSolutionOrIdea
    ? { critical: '#fbbf24', high: 'rgba(255,255,255,0.3)', medium: 'rgba(255,255,255,0.15)', low: 'transparent' }
    : { critical: '#fbbf24', high: 'var(--chakra-colors-fg-muted, #94a3b8)', medium: 'var(--chakra-colors-border-muted, #e0e0e0)', low: 'transparent' };
  const impBarTextColor: Record<string, string> = isSolutionOrIdea
    ? { critical: '#1B1B1D', high: '#fff', medium: 'rgba(255,255,255,0.8)', low: 'transparent' }
    : { critical: '#1B1B1D', high: 'var(--chakra-colors-bg-canvas, #fff)', medium: 'var(--chakra-colors-fg-muted, #666)', low: 'transparent' };
  const importanceLabels: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: '' };

  // Shared mini-button style helper
  const miniBtn = (active: boolean) => ({
    backgroundColor: active ? panelBtnActiveBg : panelBtnBg,
    color: active ? panelBtnActiveText : panelTextMuted,
  });

  return (
    <div
      className="consequence-node"
      style={{
        width: '340px',
        position: 'relative',
        padding: '14px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        border: `6px solid ${sentimentBorderColor}`,
        backgroundColor: panelBg,
        color: panelText,
        fontFamily: 'var(--chakra-fonts-body)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <NodeHandles />

      {/* Sentiment pill + STEEP pill — top-left, live-updates when toggling */}
      {!isSolutionOrIdea && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: -10,
              minWidth: 32,
              height: 32,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 'bold',
              color: '#fff',
              backgroundColor: sentimentOptions.find(s => s.value === sentiment)?.color || '#94a3b8',
              zIndex: 10,
              padding: '0 6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {SENTIMENT_SYMBOLS[sentiment]}
          </div>
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: 26,
              minWidth: 32,
              height: 32,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backgroundColor: STEEP_COLORS[category] || '#94a3b8',
              zIndex: 10,
              padding: '0 6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            <SteepIcon category={category} size={16} />
          </div>
        </>
      )}

      {/* Node type toggle: Consequence / Idea */}
      <Flex gap={1} mb={2}>
        {(['consequence', 'idea'] as const).map((t) => (
          <Box
            as="button"
            key={t}
            display="flex"
            alignItems="center"
            gap={1}
            px={2}
            py={1}
            fontSize="xs"
            fontWeight="semibold"
            rounded="md"
            cursor="pointer"
            transition="all 0.15s"
            style={miniBtn(nodeType === t || (t === 'idea' && nodeType === 'solution'))}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setNodeType(t === 'idea' ? 'idea' : 'consequence'); }}
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            {t === 'idea' ? <><Lightbulb style={{ width: 11, height: 11 }} /> Idea</> : 'Consequence'}
          </Box>
        ))}
      </Flex>

      {/* Sentiment selector — only for consequences */}
      {!isSolutionOrIdea && (
        <>
          <Text fontSize="2xs" fontWeight="semibold" mb={1} style={{ color: panelTextMuted }}>Sentiment</Text>
          <Flex gap={1} mb={2}>
            {sentimentOptions.map((opt) => (
              <Box
                as="button"
                key={opt.value}
                display="flex"
                alignItems="center"
                gap={1}
                px={2}
                py={1}
                fontSize="xs"
                rounded="md"
                transition="all 0.15s"
                cursor="pointer"
                style={miniBtn(sentiment === opt.value)}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSentiment(opt.value); }}
                onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              >
                {opt.symbol} {opt.label}
              </Box>
            ))}
          </Flex>
        </>
      )}

      {/* Title input — only for ideas/solutions */}
      {isSolutionOrIdea && (
        <Box
          as="input"
          type="text"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          w="full"
          fontSize="sm"
          fontWeight="bold"
          rounded="lg"
          px={2}
          py={1.5}
          mb={2}
          outline="none"
          placeholder="Title..."
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          style={{
            backgroundColor: panelInputBg,
            color: panelText,
            border: `1px solid ${panelInputBorder}`,
            fontFamily: "'TT Norms Pro Normal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          }}
          _focus={{ borderColor: isSolutionOrIdea ? 'rgba(255,255,255,0.5)' : 'var(--chakra-colors-border-focus, #3b82f6)' }}
          _placeholder={{ color: panelTextMuted }}
        />
      )}

      {/* Text input */}
      <Box
        as="textarea"
        ref={textareaRef}
        value={text}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        w="full"
        fontSize="sm"
        rounded="lg"
        px={2}
        py={1.5}
        resize="none"
        outline="none"
        rows={6}
        placeholder={isSolutionOrIdea ? 'Describe the idea or solution...' : 'Describe the consequence...'}
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        fontFamily="body"
        style={{
          backgroundColor: panelInputBg,
          color: panelText,
          border: `1px solid ${panelInputBorder}`,
        }}
        _focus={{ borderColor: isSolutionOrIdea ? 'rgba(255,255,255,0.5)' : 'var(--chakra-colors-border-focus, #3b82f6)' }}
        _placeholder={{ color: panelTextMuted }}
      />

      {/* Importance — full-width button style, matches the node display */}
      <Text fontSize="2xs" fontWeight="semibold" mt={2} mb={1} style={{ color: panelTextMuted }}>Importance</Text>
      <Flex gap={1} mb={2}>
        {importanceOptions.map((imp) => (
          <Box
            as="button"
            key={imp}
            flex={1}
            display="flex"
            alignItems="center"
            justifyContent="center"
            py={1}
            fontSize="xs"
            rounded="md"
            transition="all 0.15s"
            fontWeight={importance === imp ? 'semibold' : 'normal'}
            cursor="pointer"
            textTransform="capitalize"
            style={miniBtn(importance === imp)}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setImportance(imp); }}
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          >
            {imp}
          </Box>
        ))}
      </Flex>

      {/* STEEP, Probability, Time Scale — three columns */}
      <Flex gap={3} mt={1}>
        <Box flex={1}>
          <Text fontSize="2xs" fontWeight="semibold" mb={1} style={{ color: panelTextMuted }}>STEEP</Text>
          <Flex gap={1} flexWrap="wrap">
            {steepOptions.map((cat) => (
              <Box
                as="button"
                key={cat}
                px={1.5}
                py={0.5}
                fontSize="2xs"
                rounded="md"
                transition="all 0.15s"
                cursor="pointer"
                style={miniBtn(category === cat)}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setCategory(cat); }}
                onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              >
                <SteepIcon category={cat} size={10} /> {STEEP_LABELS[cat].slice(0, 4)}
              </Box>
            ))}
          </Flex>
        </Box>
        <Box flex={1}>
          <Text fontSize="2xs" fontWeight="semibold" mb={1} style={{ color: panelTextMuted }}>Probability</Text>
          <Flex gap={1} flexWrap="wrap">
            {probabilityOptions.map((p) => (
              <Box
                as="button"
                key={p}
                px={1.5}
                py={0.5}
                fontSize="2xs"
                rounded="md"
                transition="all 0.15s"
                cursor="pointer"
                textTransform="capitalize"
                style={miniBtn(probability === p)}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setProbability(p); }}
                onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              >
                {PROBABILITY_SYMBOLS[p]} {p.slice(0, 5)}
              </Box>
            ))}
          </Flex>
        </Box>
        <Box flex={1}>
          <Text fontSize="2xs" fontWeight="semibold" mb={1} style={{ color: panelTextMuted }}>Time Scale</Text>
          <Flex gap={1} flexWrap="wrap">
            {timeFrameOptions.map((tf) => (
              <Box
                as="button"
                key={tf.value}
                px={1.5}
                py={0.5}
                fontSize="2xs"
                rounded="md"
                transition="all 0.15s"
                cursor="pointer"
                style={miniBtn(timeFrame === tf.value)}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setTimeFrame(tf.value); }}
                onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
              >
                {tf.label}
              </Box>
            ))}
          </Flex>
        </Box>
      </Flex>

      {/* Save / Cancel */}
      <Flex gap={2} mt={3}>
        <Box
          as="button"
          flex={1}
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={1}
          px={3}
          py={1.5}
          fontSize="xs"
          fontWeight="semibold"
          rounded="lg"
          _hover={{ opacity: 0.9 }}
          cursor="pointer"
          style={isSolutionOrIdea
            ? { backgroundColor: '#fff', color: '#0005e9' }
            : { backgroundColor: '#0005e9', color: '#fff' }
          }
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSave(); }}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        >
          <Check style={{ width: 12, height: 12 }} /> Save
        </Box>
        <Box
          as="button"
          flex={1}
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={1}
          px={3}
          py={1.5}
          fontSize="xs"
          fontWeight="semibold"
          rounded="lg"
          _hover={{ opacity: 0.8 }}
          cursor="pointer"
          style={{ backgroundColor: panelBtnBg, color: panelText }}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onCancel(); }}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
        >
          <X style={{ width: 12, height: 12 }} /> Cancel
        </Box>
      </Flex>
      <Text fontSize="2xs" mt={1} textAlign="center" style={{ color: panelTextMuted }}>
        Cmd+Enter to save · Esc to cancel
      </Text>
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
  incomingHandle?: string;
  // Connect-mode visual state
  isConnectSource?: boolean;    // This node is the source of the connection
  isConnectValidTarget?: boolean; // Valid target — show glow
  isConnectInvalid?: boolean;   // Invalid target (self, cycle) — no glow
  isConnectMode?: boolean;      // Connect mode is active globally
  // Callbacks
  onClick?: (id: string) => void;
  onStartEdit?: (id: string) => void;
  onSaveEdit?: (id: string, updates: Partial<Consequence>) => void;
  onCancelEdit?: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onConnect?: (sourceId: string) => void;
  onGenerateChildren?: (parentId: string, count?: number) => void;
  onGenerateIdeas?: (id: string, count?: number) => void;
  onDelete?: (id: string) => void;
}

// ─── ConsequenceNode ──────────────────────────────────────────────
// Custom equality check: compare rendering-relevant data fields, ignore function references
function consequenceNodeAreEqual(
  prev: NodeProps<ConsequenceNodeData>,
  next: NodeProps<ConsequenceNodeData>,
): boolean {
  const p = prev.data;
  const n = next.data;
  return (
    p.consequence === n.consequence &&
    p.isSelected === n.isSelected &&
    p.isEditing === n.isEditing &&
    p.isDimmed === n.isDimmed &&
    p.isFocusDimmed === n.isFocusDimmed &&
    p.isGenerating === n.isGenerating &&
    p.isGeneratingChildren === n.isGeneratingChildren &&
    p.isGeneratingIdeas === n.isGeneratingIdeas &&
    p.isNewlyExpanded === n.isNewlyExpanded &&
    p.isPlaceholder === n.isPlaceholder &&
    p.isGenerationInProgress === n.isGenerationInProgress &&
    p.incomingHandle === n.incomingHandle &&
    p.isConnectSource === n.isConnectSource &&
    p.isConnectValidTarget === n.isConnectValidTarget &&
    p.isConnectInvalid === n.isConnectInvalid &&
    p.isConnectMode === n.isConnectMode &&
    prev.draggable === next.draggable
  );
}

export const ConsequenceNode = memo(({ data, draggable }: NodeProps<ConsequenceNodeData>) => {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
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
    incomingHandle,
    isConnectSource,
    isConnectValidTarget,
    isConnectInvalid,
    isConnectMode,
    onClick,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onAddChild,
    onConnect,
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
        className="consequence-node generating-pulse"
        style={{
          width: '220px',
          position: 'relative',
          padding: '8px 12px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          border: '2px dashed #a78bfa',
          backgroundColor: 'var(--chakra-colors-bg-canvas, #FFFFFF)',
        }}
      >
        <NodeHandles />
        <Flex align="center" gap={2} mb={2}>
          <Loader2 style={{ width: 16, height: 16, color: '#a855f7' }} className="animate-spin" />
          <Text fontSize="xs" fontWeight="semibold" style={{ color: 'var(--chakra-colors-fg, #1B1B1D)' }}>AI Generating...</Text>
        </Flex>
        <Flex direction="column" gap={1.5}>
          <Box h={3} rounded="sm" className="animate-pulse" style={{ backgroundColor: 'var(--chakra-colors-border-muted, #d1d5db)' }} />
          <Box h={3} rounded="sm" w="80%" className="animate-pulse" style={{ backgroundColor: 'var(--chakra-colors-border-muted, #d1d5db)', opacity: 0.7 }} />
          <Box h={3} rounded="sm" w="60%" className="animate-pulse" style={{ backgroundColor: 'var(--chakra-colors-border-muted, #d1d5db)', opacity: 0.5 }} />
        </Flex>
        <Flex gap={1} mt={2}>
          <Box h={4} w={12} rounded="sm" className="animate-pulse" style={{ backgroundColor: 'var(--chakra-colors-border-muted, #d1d5db)', opacity: 0.6 }} />
          <Box h={4} w={8} rounded="sm" className="animate-pulse" style={{ backgroundColor: 'var(--chakra-colors-border-muted, #d1d5db)', opacity: 0.4 }} />
        </Flex>
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
  const importance = consequence.importance || 'medium';

  // Normalized width — wide enough for 3 badges side-by-side
  const nodeWidth = 280;

  // Theme-following styling: bg.canvas background, fg text — ideas keep brand blue
  const IDEA_BRAND = '#0005e9';
  const textColor = isSolutionOrIdea ? '#fff' : 'var(--chakra-colors-fg, #1B1B1D)';
  const nodeBg = isSolutionOrIdea ? IDEA_BRAND : 'var(--chakra-colors-bg-canvas, #FFFFFF)';

  const isCritical = importance === 'critical';
  const isHighImportance = importance === 'high';
  const isMediumImportance = importance === 'medium';
  const borderWidth = 6; // Uniform thick border for all nodes

  // Sentiment pill colors
  const sentimentColors: Record<string, string> = { positive: '#22c55e', negative: '#ef4444', neutral: '#94a3b8' };

  // Importance indicator config
  const importanceBarBg: Record<string, string> = isSolutionOrIdea
    ? { critical: '#fbbf24', high: 'rgba(255,255,255,0.3)', medium: 'rgba(255,255,255,0.15)', low: 'transparent' }
    : { critical: '#fbbf24', high: 'var(--chakra-colors-fg-muted, #94a3b8)', medium: 'var(--chakra-colors-border-muted, #e0e0e0)', low: 'transparent' };
  const importanceTextColor: Record<string, string> = isSolutionOrIdea
    ? { critical: '#1B1B1D', high: '#fff', medium: 'rgba(255,255,255,0.8)', low: 'transparent' }
    : { critical: '#1B1B1D', high: 'var(--chakra-colors-bg-canvas, #fff)', medium: 'var(--chakra-colors-fg-muted, #666)', low: 'transparent' };
  const importanceLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: '',
  };

  // Timeframe year-range labels
  const timeFrameYearLabels: Record<string, string> = {
    immediate: '0–1 yr',
    'short-term': '1–3 yrs',
    'long-term': '3–10+ yrs',
  };

  // Shadow/glow
  const nodeShadow = isConnectValidTarget
    ? '0 0 0 3px #22d3ee, 0 0 16px rgba(34,211,238,0.5)'
    : isConnectSource
      ? '0 0 0 3px #f59e0b, 0 0 16px rgba(245,158,11,0.4)'
      : isSelected
        ? '0 0 0 2px var(--chakra-colors-bg-canvas, #fff), 0 0 0 4px #3b82f6, 0 4px 6px -1px rgba(0,0,0,0.1)'
        : isSolutionOrIdea
          ? '0 2px 16px rgba(0,5,233,0.35)'
          : isCritical && !isDimmed
            ? '0 2px 8px rgba(0,0,0,0.1), 0 0 8px rgba(251,191,36,0.3)'
            : '0 2px 8px rgba(0,0,0,0.1)';

  return (
    <div
      onClick={() => onClick?.(consequence.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`consequence-node ${isGenerating ? 'generating-pulse' : ''} ${isNewlyExpanded ? 'newly-expanded-glow' : ''} ${isFocusDimmed ? 'focus-dimmed' : ''}`}
      style={{
        backgroundColor: nodeBg,
        borderColor: isNewlyExpanded ? '#d69e2e' : isSolutionOrIdea ? 'rgba(255,255,255,0.12)' : sentimentColors[consequence.sentiment] || 'var(--chakra-colors-border-muted, #e0e0e0)',
        borderWidth: `${borderWidth}px`,
        width: `${nodeWidth}px`,
        borderStyle: 'solid',
        opacity: isDimmed ? 0.35 : (isConnectMode && isConnectInvalid ? 0.4 : 1),
        filter: isDimmed ? 'grayscale(50%)' : (isConnectMode && isConnectInvalid ? 'grayscale(30%)' : 'none'),
        transition: 'opacity 0.3s, filter 0.3s, box-shadow 0.2s ease',
        position: 'relative',
        padding: '14px 16px',
        borderRadius: '12px',
        boxShadow: nodeShadow,
        cursor: isConnectMode ? (isConnectValidTarget ? 'pointer' : (isConnectSource ? 'grab' : 'not-allowed')) : 'pointer',
        overflow: 'visible',
      }}
    >
      <NodeHandles />

      {/* Action Toolbar */}
      {isSelected && !isDimmed && !isGenerationInProgress && onStartEdit && onAddChild && onConnect && onGenerateChildren && onGenerateIdeas && onDelete && (
        <ActionToolbar
          onEdit={() => onStartEdit(consequence.id)}
          onAddChild={() => onAddChild(consequence.id)}
          onConnect={() => onConnect(consequence.id)}
          onGenerateChildren={(count) => onGenerateChildren(consequence.id, count)}
          onGenerateIdeas={(count) => onGenerateIdeas(consequence.id, count)}
          onDelete={() => onDelete(consequence.id)}
          isGeneratingChildren={isGeneratingChildren}
          isGeneratingIdeas={isGeneratingIdeas}
        />
      )}

      {/* Sentiment pill + STEEP category pill — top-left corner */}
      {!isSolutionOrIdea && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: -10,
              minWidth: 32,
              height: 32,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              fontWeight: 'bold',
              color: '#fff',
              backgroundColor: sentimentColors[consequence.sentiment] || sentimentColors.neutral,
              zIndex: 10,
              padding: '0 6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {SENTIMENT_SYMBOLS[consequence.sentiment]}
          </div>
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: 26,
              minWidth: 32,
              height: 32,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backgroundColor: STEEP_COLORS[consequence.category] || '#94a3b8',
              zIndex: 10,
              padding: '0 6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            <SteepIcon category={consequence.category} size={16} />
          </div>
        </>
      )}

      {/* (Importance indicator is below the text content) */}

      {/* Idea/solution type badge */}
      {isSolutionOrIdea && (
        <Flex align="center" gap={1} mb={1.5}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600,
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {consequence.nodeType === 'idea'
              ? <Lightbulb style={{ width: 11, height: 11 }} />
              : <Wrench style={{ width: 11, height: 11 }} />
            }
            {consequence.nodeType === 'idea' ? 'Idea' : 'Solution'}
          </span>
        </Flex>
      )}

      {/* Main text — idea titles use TT Norms Pro */}
      <Box>
        {isSolutionOrIdea && consequence.title ? (
          <>
            <Flex align="center" gap={1}>
              {consequence.nodeType === 'idea'
                ? <Lightbulb style={{ width: 14, height: 14, color: '#fff', flexShrink: 0 }} />
                : <Wrench style={{ width: 14, height: 14, color: '#fff', flexShrink: 0 }} />
              }
              <Text fontWeight="bold" lineHeight="snug" style={{ color: textColor, fontSize: 14, fontFamily: "'TT Norms Pro Normal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
                {consequence.title}
              </Text>
            </Flex>
            <Text lineHeight="snug" mt={0.5} style={{ color: textColor, fontSize: 11, opacity: 1 }}>
              {consequence.text}
            </Text>
          </>
        ) : (
          <Text fontWeight="medium" lineHeight="snug" style={{ color: textColor, fontSize: 11 }}>
            {consequence.text}
          </Text>
        )}
      </Box>

      {/* Importance indicator — full content width, button-style, between text and badges */}
      {importance !== 'low' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            marginTop: 8,
            padding: '4px 0',
            borderRadius: 6,
            fontFamily: "'TT Norms Pro Normal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.03em',
            backgroundColor: importanceBarBg[importance],
            color: importanceTextColor[importance],
            border: isSolutionOrIdea
              ? '1px solid rgba(255,255,255,0.25)'
              : `1px solid ${importance === 'critical' ? 'rgba(251,191,36,0.4)' : 'var(--chakra-colors-border-muted, #e0e0e0)'}`,
          }}
        >
          {importanceLabels[importance]}
        </div>
      )}

      {/* Bottom badge row: STEEP + probability + timeframe */}
      <Flex gap={1} mt={2} flexWrap="nowrap" style={{ whiteSpace: 'nowrap' }}>
        {!isSolutionOrIdea && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontWeight: 600,
              backgroundColor: getSteepMutedBg(consequence.category, isDark),
              color: getSteepTextColor(consequence.category, isDark),
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            <SteepIcon category={consequence.category} size={10} /> {STEEP_LABELS[consequence.category]}
          </span>
        )}

        {consequence.probability && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontWeight: 600,
              backgroundColor: isSolutionOrIdea ? 'rgba(255,255,255,0.15)' : 'var(--chakra-colors-bg-hover, #f5f5f5)',
              color: textColor,
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {PROBABILITY_SYMBOLS[consequence.probability]} {consequence.probability}
          </span>
        )}

        {consequence.timeFrame && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontWeight: 600,
              backgroundColor: isSolutionOrIdea ? 'rgba(255,255,255,0.15)' : 'var(--chakra-colors-bg-hover, #f5f5f5)',
              color: textColor,
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {timeFrameYearLabels[consequence.timeFrame] || consequence.timeFrame}
          </span>
        )}
      </Flex>
    </div>
  );
}, consequenceNodeAreEqual);

ConsequenceNode.displayName = 'ConsequenceNode';

// ─── SeedNodeData Interface ───────────────────────────────────────
export interface SeedNodeData {
  title: string;
  description: string;
  isSelected?: boolean;
  isGeneratingChildren?: boolean;
  isGenerationInProgress?: boolean;
  isConnectValidTarget?: boolean;
  isConnectMode?: boolean;
  onClick?: () => void;
  onAddChild?: () => void;
  onGenerateChildren?: (count?: number) => void;
}

// ─── SeedActionToolbar ───────────────────────────────────────────
function SeedActionToolbar({
  onAddChild,
  onGenerateChildren,
  isGeneratingChildren,
}: {
  onAddChild: () => void;
  onGenerateChildren: (count?: number) => void;
  isGeneratingChildren?: boolean;
}) {
  return (
    <Flex
      className="node-action-toolbar"
      position="absolute"
      align="center"
      gap={3}
      zIndex={50}
      style={{ top: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)' }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Flex align="center" bg="bg.muted" backdropFilter="blur(8px)" rounded="xl" shadow="lg" borderWidth="1px" borderColor="border.muted" p={1.5} gap={1.5}>
        <ActionBtn icon={<Plus style={{ width: 24, height: 24 }} />} label="Add Child" onClick={onAddChild} color="add" delay={0} />
        <ActionBtn
          icon={isGeneratingChildren ? <Loader2 style={{ width: 24, height: 24 }} className="animate-spin" /> : <Sparkles style={{ width: 24, height: 24 }} />}
          label={isGeneratingChildren ? 'Generating...' : 'Generate STEEPE (6)'}
          onClick={() => { if (!isGeneratingChildren) onGenerateChildren(6); }}
          disabled={isGeneratingChildren}
          color="expand"
          delay={1}
        />
      </Flex>
    </Flex>
  );
}

// ─── SeedNode ─────────────────────────────────────────────────────
const SEED_BRAND = '#0005e9';
const SEED_BRAND_GLOW = 'rgba(0,5,233,0.35)';

export const SeedNode = memo(({ data }: NodeProps<SeedNodeData>) => {
  const { title, description, isSelected, isGeneratingChildren, isGenerationInProgress, isConnectValidTarget, isConnectMode, onClick, onAddChild, onGenerateChildren } = data;

  const seedShadow = isConnectValidTarget
    ? '0 0 0 3px #22d3ee, 0 0 16px rgba(34,211,238,0.5)'
    : isSelected
      ? `0 0 0 2px #fff, 0 0 0 4px ${SEED_BRAND}, 0 0 28px ${SEED_BRAND_GLOW}`
      : `0 2px 12px rgba(0,5,233,0.25)`;

  return (
    <div
      className="consequence-node"
      onClick={() => onClick?.()}
      style={{
        background: SEED_BRAND,
        color: '#fff',
        border: isSelected ? '2px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        padding: '20px 24px',
        maxWidth: '300px',
        cursor: isConnectMode ? (isConnectValidTarget ? 'pointer' : 'not-allowed') : 'pointer',
        position: 'relative',
        boxShadow: seedShadow,
        fontFamily: 'var(--chakra-fonts-body)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <Handle type="source" position={Position.Right} id="right-source" className="seed-handle" />
      <Handle type="source" position={Position.Top} id="top-source" className="seed-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="seed-handle" />
      <Handle type="source" position={Position.Left} id="left-source" className="seed-handle" />

      {/* Seed Action Toolbar */}
      {isSelected && !isGenerationInProgress && onAddChild && onGenerateChildren && (
        <SeedActionToolbar
          onAddChild={onAddChild}
          onGenerateChildren={onGenerateChildren}
          isGeneratingChildren={isGeneratingChildren}
        />
      )}

      <Flex align="center" gap={2.5} mb={2}>
        <Flex
          w={8} h={8} rounded="lg" align="center" justify="center"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <Text fontSize="lg" style={{ color: '#fff' }}>🌱</Text>
        </Flex>
        <Box>
          <Text fontFamily="heading" fontWeight={700} fontSize="14px" lineHeight="1.2" style={{ color: '#fff' }}>
            Seed
          </Text>
          <Text fontSize="10px" lineHeight="1.3" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Starting point
          </Text>
        </Box>
      </Flex>

      <Text fontWeight="bold" fontSize="md" mb={1} style={{ color: '#fff', fontFamily: "'TT Norms Pro Normal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>{title}</Text>
      <Text fontSize="xs" lineHeight="1.4" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {description}
      </Text>
    </div>
  );
});

SeedNode.displayName = 'SeedNode';
