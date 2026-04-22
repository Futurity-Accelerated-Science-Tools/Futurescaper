import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  ReactFlowInstance,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  FutureInput,
  Consequence,
  Solution,
  STEEPCategory,
  Sentiment,
  ConsequenceOrder,
  Probability,
  TimeFrame,
  Importance,
  STEEP_LABELS,
  SENTIMENT_SYMBOLS,
  ORDER_LABELS,
  SOLUTION_COLORS,
  GenerationConfig,
  DEFAULT_GENERATION_CONFIG,
} from '../types';
import { generateComprehensiveFuturescape, hasApiKey, GenerationPhase } from '../api/claude';
import { generateConsequences } from '../mockData';
import { ConsequenceNode, SeedNode, ConsequenceNodeData } from './ConsequenceNode';
import { SteepIcon, getSteepMutedBg, getSteepTextColor } from './SteepIcon';
import { ExportPanel } from './ExportPanel';
import { ArrowLeft, AlertCircle, Lightbulb, FileText, Star, Target, Layers, TrendingUp, TrendingDown, Minus, Loader2, X, Send, Sparkles, Zap, Hammer, LayoutGrid, Filter, ChevronRight, ChevronLeft, Sun, Moon } from 'lucide-react';
import { expandNodeConsequences, freePromptExpand, generateSolutionIdeas, generateConsequencesWithAI, generateChildConsequencesWithAI } from '../api/claude';
import { findRelevantSubjects, RelevantSubject } from '../api/subjects';
import { RelatedSubjects } from './RelatedSubjects';
import { computeRadialLayout, resolveCollisions, getOptimalHandles, computeFocusPositions, Position } from '../layout';
import { useColorMode } from '../theme/ColorModeProvider';

const nodeTypes = {
  seed: SeedNode,
  consequence: ConsequenceNode,
};

// Type for imported data
interface ImportedData {
  input: FutureInput;
  consequences: Consequence[];
  solutions: Solution[];
}

interface FuturescapeMapProps {
  input: FutureInput;
  onBack: () => void;
  onApiError?: () => void;
  importedData?: ImportedData | null;
  manualMode?: boolean;
  generationConfig?: GenerationConfig;
}

type ExtendedPhase = 'idle' | 'first-order' | 'second-order' | 'third-order' | 'fourth-order' | 'fifth-order' | 'solutions' | 'complete';

export function FuturescapeMap({ input, onBack, onApiError, importedData, manualMode = false, generationConfig = DEFAULT_GENERATION_CONFIG }: FuturescapeMapProps) {
  const { colorMode, toggleColorMode } = useColorMode();
  const [consequences, setConsequences] = useState<Consequence[]>(importedData?.consequences || []);
  const [generationPhase, setGenerationPhase] = useState<ExtendedPhase>(importedData ? 'complete' : (manualMode ? 'complete' : 'idle'));
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const [showTLDR, setShowTLDR] = useState(true);
  const [isExpandingNode, setIsExpandingNode] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isPrompting, setIsPrompting] = useState(false);
  const [promptProgress, setPromptProgress] = useState('');
  const incomingHandleMapRef = useRef<Map<string, string>>(new Map());
  const [showNewHighlight, setShowNewHighlight] = useState(false);
  const [lastExpansionTime, setLastExpansionTime] = useState<number | null>(null);
  const [showHighImpact, setShowHighImpact] = useState(false);
  const [filterPanelCollapsed, setFilterPanelCollapsed] = useState(false);
  const [relatedSubjects, setRelatedSubjects] = useState<RelevantSubject[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const subjectsRequested = useRef(false);
  const generationStarted = useRef(importedData ? true : (manualMode ? true : false));

  // ── Interactive node state (radial menu / inline editing) ──
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isGeneratingChildrenFor, setIsGeneratingChildrenFor] = useState<string | null>(null);

  const [isGeneratingIdeasFor, setIsGeneratingIdeasFor] = useState<string | null>(null);

  // Verbosity setting — controls AI text length per node
  const [verbosity, setVerbosity] = useState<'concise' | 'normal' | 'detailed'>(input.verbosity || 'normal');

  // Merge local verbosity into input for API calls
  const effectiveInput = useMemo<FutureInput>(
    () => ({ ...input, verbosity }),
    [input, verbosity]
  );

  // Computed: is comprehensive generation currently running?
  const isGenerationRunning = generationPhase !== 'complete' && generationPhase !== 'idle';

  // Auto-clear "newly expanded" highlight after 5 seconds
  useEffect(() => {
    if (!showNewHighlight) return;
    const timer = setTimeout(() => setShowNewHighlight(false), 5000);
    return () => clearTimeout(timer);
  }, [showNewHighlight, lastExpansionTime]);

  // Highlight filters - nodes NOT in these filters get dimmed (not hidden)
  const [highlightFilters, setHighlightFilters] = useState({
    categories: ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'] as STEEPCategory[],
    sentiments: ['positive', 'negative', 'neutral'] as Sentiment[],
    orders: [1, 2, 3, 4, 5] as ConsequenceOrder[],
    probabilities: ['probable', 'plausible', 'possible', 'wildcard'] as Probability[],
    importance: ['critical', 'high', 'medium', 'low'] as Importance[],
    showIdeas: true,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── Stable ref for current nodes (avoids closing over `nodes` in callbacks) ──
  const nodesRef = useRef<Node[]>([]);
  nodesRef.current = nodes;

  // ── Focus-path animation state ──
  const preFocusPositionsRef = useRef<Map<string, Position> | null>(null);
  const [focusAnimClass, setFocusAnimClass] = useState<string>('');
  const focusAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveNodeIdRef = useRef<string | null>(null);

  // ── ReactFlow instance + container for programmatic viewport control ──
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Check if a consequence should be highlighted (not dimmed)
  const isHighlighted = useCallback((c: Consequence): boolean => {
    const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
    if (isSolOrIdea && !highlightFilters.showIdeas) return false;
    return (
      highlightFilters.categories.includes(c.category) &&
      highlightFilters.sentiments.includes(c.sentiment) &&
      highlightFilters.orders.includes(c.order) &&
      (!c.probability || highlightFilters.probabilities.includes(c.probability)) &&
      (!c.importance || highlightFilters.importance.includes(c.importance))
    );
  }, [highlightFilters]);

  // ── O(1) lookup maps, rebuilt only when consequences change ──
  const consequenceMap = useMemo(() => {
    const m = new Map<string, Consequence>();
    for (const c of consequences) m.set(c.id, c);
    return m;
  }, [consequences]);

  const parentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of consequences) {
      if (c.parentId) m.set(c.id, c.parentId);
    }
    return m;
  }, [consequences]);

  // All consequences are shown, but some may be dimmed
  const filteredConsequences = useMemo(() => {
    return consequences; // Show all, dimming handled in node rendering
  }, [consequences]);

  // Stats — single-pass reduce over consequences
  const stats = useMemo(() => {
    const bySentiment = { positive: 0, negative: 0, neutral: 0 };
    const byOrder: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const byCategory: Record<string, number> = { social: 0, technological: 0, economic: 0, environmental: 0, political: 0, ethical: 0 };
    const byProbability: Record<string, number> = { probable: 0, plausible: 0, possible: 0, wildcard: 0 };
    const byImportance: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    let ideasCount = 0;

    for (const c of consequences) {
      if (c.sentiment in bySentiment) (bySentiment as any)[c.sentiment]++;
      if (c.order in byOrder) byOrder[c.order]++;
      if (c.category in byCategory) byCategory[c.category]++;
      if (c.probability && c.probability in byProbability) byProbability[c.probability]++;
      if (c.importance && c.importance in byImportance) byImportance[c.importance]++;
      if (c.nodeType === 'solution' || c.nodeType === 'idea') ideasCount++;
    }

    return { bySentiment, byOrder, byCategory, byProbability, byImportance, ideasCount, criticalCount: byImportance.critical, highCount: byImportance.high, total: consequences.length };
  }, [consequences]);

  // Generate TLDR summary
  const tldrSummary = useMemo(() => {
    if (consequences.length === 0) return null;

    const critical = consequences.filter(c => c.importance === 'critical');
    const negatives = consequences.filter(c => c.sentiment === 'negative');
    const positives = consequences.filter(c => c.sentiment === 'positive');

    // Get top concerns (critical negatives first, then high importance negatives)
    const topConcerns = negatives
      .sort((a, b) => {
        const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (importanceOrder[a.importance || 'medium'] || 2) - (importanceOrder[b.importance || 'medium'] || 2);
      })
      .slice(0, 3);

    // Get top opportunities (critical positives first)
    const topOpportunities = positives
      .sort((a, b) => {
        const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (importanceOrder[a.importance || 'medium'] || 2) - (importanceOrder[b.importance || 'medium'] || 2);
      })
      .slice(0, 3);

    // Dominant category
    const categoryCount = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
    const dominantCategory = categoryCount[0]?.[0] as STEEPCategory | undefined;

    return {
      totalConsequences: consequences.length,
      negativePercent: Math.round((negatives.length / consequences.length) * 100),
      positivePercent: Math.round((positives.length / consequences.length) * 100),
      criticalCount: critical.length,
      topConcerns,
      topOpportunities,
      dominantCategory,
    };
  }, [consequences, stats.byCategory]);

  // ── Interactive handlers (must be before generateNodesAndEdges) ──

  const handleSeedClick = useCallback(() => {
    setActiveNodeId(prev => prev === 'seed' ? null : 'seed');
    setEditingNodeId(null);
  }, []);

  const handleNodeClick = useCallback((id: string) => {
    setActiveNodeId(prev => prev === id ? null : id);
    setEditingNodeId(null);
  }, []);

  const handleStartEdit = useCallback((id: string) => {
    setEditingNodeId(id);
    setActiveNodeId(null);
  }, []);

  const handleSaveEdit = useCallback((id: string, updates: Partial<Consequence>) => {
    setConsequences(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates } : c)
    );
    setEditingNodeId(null);
    // If text is empty after save on a new blank node, remove it
    if (updates.text !== undefined && !updates.text.trim()) {
      setConsequences(prev => prev.filter(c => c.id !== id));
    }
  }, []);

  const handleCancelEdit = useCallback((id: string) => {
    // If this was a new blank node with no text, remove it
    const node = consequenceMap.get(id);
    if (node && !node.text.trim()) {
      setConsequences(prev => prev.filter(c => c.id !== id));
    }
    setEditingNodeId(null);
  }, [consequences]);

  const handleSeedAddChild = useCallback(() => {
    const newId = `manual-${Date.now()}`;
    const newConsequence: Consequence = {
      id: newId,
      text: '',
      sentiment: 'neutral',
      category: 'social',
      order: 1,
      parentId: 'seed',
      probability: 'plausible',
      importance: 'medium',
      isManual: true,
    };
    setConsequences(prev => [...prev, newConsequence]);
    setEditingNodeId(newId);
    setActiveNodeId(null);
  }, []);

  const handleSeedGenerateChildren = useCallback(async (count?: number) => {
    setIsGeneratingChildrenFor('seed');
    setActiveNodeId(null);

    const effectiveCount = count ?? 6;
    // Create placeholder nodes
    const placeholderIds: string[] = [];
    const placeholders: Consequence[] = [];
    for (let i = 0; i < effectiveCount; i++) {
      const id = `placeholder-${Date.now()}-${i}`;
      placeholderIds.push(id);
      placeholders.push({
        id,
        text: '',
        sentiment: 'neutral',
        category: 'social',
        order: 1,
        parentId: 'seed',
      });
    }
    setConsequences(prev => [...prev, ...placeholders]);

    try {
      // Pass existing first-order children so the AI avoids duplicates
      const existingFirstOrder = consequences.filter(c => c.order === 1 && c.parentId === 'seed' && c.text);
      const realConsequences = await generateConsequencesWithAI(effectiveInput, 1, existingFirstOrder, effectiveCount);
      setConsequences(prev => [
        ...prev.filter(c => !placeholderIds.includes(c.id)),
        ...realConsequences,
      ]);
    } catch (err) {
      console.error('Error generating seed children:', err);
      setConsequences(prev => prev.filter(c => !placeholderIds.includes(c.id)));
      setError((err as Error).message);
    }
    setIsGeneratingChildrenFor(null);
  }, [effectiveInput, consequences]);

  const handleAddChild = useCallback((parentId: string) => {
    const parent = consequenceMap.get(parentId);
    const newOrder = parent ? (Math.min(parent.order + 1, 5) as ConsequenceOrder) : 1;
    const newId = `manual-${Date.now()}`;
    const newConsequence: Consequence = {
      id: newId,
      text: '',
      sentiment: 'neutral',
      category: parent?.category || 'social',
      order: newOrder,
      parentId,
      probability: 'plausible',
      importance: 'medium',
      isManual: true,
    };
    setConsequences(prev => [...prev, newConsequence]);
    setEditingNodeId(newId);
    setActiveNodeId(null);
  }, [consequences]);

  const handleGenerateChildren = useCallback(async (parentId: string, count?: number) => {
    const parent = consequenceMap.get(parentId);
    if (!parent) return;

    setIsGeneratingChildrenFor(parentId);
    setActiveNodeId(null);

    // Create placeholder nodes matching requested count
    const effectiveCount = count ?? 3;
    const newOrder = Math.min(parent.order + 1, 5) as ConsequenceOrder;
    const placeholderIds: string[] = [];
    const placeholders: Consequence[] = [];
    for (let i = 0; i < effectiveCount; i++) {
      const id = `placeholder-${Date.now()}-${i}`;
      placeholderIds.push(id);
      placeholders.push({
        id,
        text: '',
        sentiment: 'neutral',
        category: 'social',
        order: newOrder,
        parentId,
      });
    }
    setConsequences(prev => [...prev, ...placeholders]);

    try {
      // Pass existing children of this parent so the AI avoids duplicates
      const existingSiblings = consequences.filter(c => c.parentId === parentId && c.text);
      const realConsequences = await generateChildConsequencesWithAI(effectiveInput, parent, effectiveCount, existingSiblings);
      setConsequences(prev => [
        ...prev.filter(c => !placeholderIds.includes(c.id)),
        ...realConsequences,
      ]);
    } catch (err) {
      console.error('Error generating children:', err);
      setConsequences(prev => prev.filter(c => !placeholderIds.includes(c.id)));
      setError((err as Error).message);
    }
    setIsGeneratingChildrenFor(null);
  }, [consequences, effectiveInput]);

  const handleRadialGenerateIdeas = useCallback(async (nodeId: string, count?: number) => {
    const targetNode = consequenceMap.get(nodeId);
    if (!targetNode) return;

    setIsGeneratingIdeasFor(nodeId);
    setActiveNodeId(null);

    // Create placeholder nodes for ideas matching requested count
    const effectiveCount = count ?? 2;
    const newOrder = Math.min(targetNode.order + 1, 5) as ConsequenceOrder;
    const placeholderIds: string[] = [];
    const placeholders: Consequence[] = [];
    for (let i = 0; i < effectiveCount; i++) {
      const id = `placeholder-${Date.now()}-${i}`;
      placeholderIds.push(id);
      placeholders.push({
        id,
        text: '',
        sentiment: 'positive',
        category: targetNode.category,
        order: newOrder,
        parentId: nodeId,
      });
    }
    setConsequences(prev => [...prev, ...placeholders]);

    try {
      const expandTime = Date.now();
      const newIdeas = await generateSolutionIdeas(effectiveInput, targetNode, consequences, effectiveCount);
      const stamped = newIdeas.map(c => ({ ...c, expandedAt: expandTime }));
      setConsequences(prev => [
        ...prev.filter(c => !placeholderIds.includes(c.id)),
        ...stamped,
      ]);
      setLastExpansionTime(expandTime);
      setShowNewHighlight(true);
    } catch (err) {
      console.error('Error generating ideas:', err);
      setConsequences(prev => prev.filter(c => !placeholderIds.includes(c.id)));
      setError((err as Error).message);
    }
    setIsGeneratingIdeasFor(null);
  }, [consequences, effectiveInput]);

  const handleRadialDelete = useCallback((id: string) => {
    // Recursively find all descendants
    const findDescendants = (parentId: string, all: Consequence[]): string[] => {
      const children = all.filter(c => c.parentId === parentId);
      const childIds = children.map(c => c.id);
      const grandchildIds = children.flatMap(c => findDescendants(c.id, all));
      return [...childIds, ...grandchildIds];
    };

    const descendantIds = findDescendants(id, consequences);
    const totalToDelete = descendantIds.length + 1; // +1 for the node itself

    let message: string;
    if (descendantIds.length === 0) {
      message = 'Delete this node?';
    } else {
      message = `Delete this node and its entire branch?\n\nThis will remove ${totalToDelete} node${totalToDelete > 1 ? 's' : ''} total (this node + ${descendantIds.length} descendant${descendantIds.length > 1 ? 's' : ''}).`;
    }

    if (!confirm(message)) return;

    const idsToRemove = new Set([id, ...descendantIds]);
    setConsequences(prev => prev.filter(c => !idsToRemove.has(c.id)));
    setActiveNodeId(null);
  }, [consequences]);

  const handlePaneClick = useCallback(() => {
    setActiveNodeId(null);
    setEditingNodeId(null);
  }, []);

  // Find the full ancestor chain for a node (including the node itself)
  const getAncestorChain = useCallback((nodeId: string | null): Set<string> => {
    if (!nodeId) return new Set();
    const chain = new Set<string>();
    chain.add(nodeId);
    let currentId: string | undefined = nodeId;
    while (currentId && currentId !== 'seed') {
      const pid = parentMap.get(currentId);
      if (!pid) break;
      chain.add(pid);
      currentId = pid;
    }
    chain.add('seed');
    return chain;
  }, [parentMap]);

  // ── Center viewport on a node, biased toward its ancestor chain ──
  // Guarantees the selected node is fully visible with margin.
  // `positionOverrides` lets callers pass known-good positions (e.g. just-computed
  // focus positions) instead of relying on ReactFlow state which may be stale.
  const centerOnNode = useCallback((
    nodeId: string,
    zoom?: number,
    positionOverrides?: Map<string, Position>,
  ) => {
    const rf = reactFlowInstanceRef.current;
    if (!rf) return;

    const z = zoom ?? 0.8;

    // Resolve position: prefer overrides, fall back to RF state
    const resolvePos = (id: string) => {
      if (positionOverrides?.has(id)) return positionOverrides.get(id)!;
      const n = rf.getNode(id);
      return n ? n.position : null;
    };
    const resolveSize = (id: string) => {
      const n = rf.getNode(id);
      return { w: n?.width ?? 200, h: n?.height ?? 80 };
    };

    const nodePos = resolvePos(nodeId);
    if (!nodePos) return;
    const { w: nw, h: nh } = resolveSize(nodeId);
    const selectedCenterX = nodePos.x + nw / 2;
    const selectedCenterY = nodePos.y + nh / 2;

    // Walk the ancestor chain and compute the centroid of chain node centers
    const chain = getAncestorChain(nodeId);
    let sumX = 0, sumY = 0, count = 0;
    chain.forEach(id => {
      const pos = resolvePos(id);
      if (pos) {
        const { w, h } = resolveSize(id);
        sumX += pos.x + w / 2;
        sumY += pos.y + h / 2;
        count++;
      }
    });

    // Blend: 60% selected node, 40% chain centroid — biases toward parents
    let targetX = selectedCenterX;
    let targetY = selectedCenterY;
    if (count > 1) {
      const chainCenterX = sumX / count;
      const chainCenterY = sumY / count;
      targetX = selectedCenterX * 0.6 + chainCenterX * 0.4;
      targetY = selectedCenterY * 0.6 + chainCenterY * 0.4;
    }

    // Clamp: ensure the selected node is fully inside the viewport with margin.
    // At zoom z, the viewport shows (containerWidth/z) x (containerHeight/z) world units.
    // Try multiple ways to find the container element
    const container = mapContainerRef.current
      ?? ((rf as any).domNode as HTMLDivElement | null);
    if (container) {
      const vpHalfW = container.clientWidth / z / 2;
      const vpHalfH = container.clientHeight / z / 2;
      const margin = 80; // world-space pixels of padding around node edge

      // Node edges in world space
      const nodeLeft = nodePos.x - margin;
      const nodeRight = nodePos.x + nw + margin;
      const nodeTop = nodePos.y - margin;
      const nodeBottom = nodePos.y + nh + margin;

      // Viewport shows [targetX - vpHalfW, targetX + vpHalfW]
      // Ensure nodeLeft >= targetX - vpHalfW  →  targetX <= nodeLeft + vpHalfW
      // Ensure nodeRight <= targetX + vpHalfW →  targetX >= nodeRight - vpHalfW
      targetX = Math.min(targetX, nodeLeft + vpHalfW);
      targetX = Math.max(targetX, nodeRight - vpHalfW);
      targetY = Math.min(targetY, nodeTop + vpHalfH);
      targetY = Math.max(targetY, nodeBottom - vpHalfH);
    }

    rf.setCenter(targetX, targetY, { zoom: z, duration: 500 });
  }, [getAncestorChain]);

  // ─── Build edges from current node positions ────────────────────
  const buildEdges = useCallback((
    allConsequences: Consequence[],
    positionMap: Map<string, Position>,
  ): Edge[] => {
    const newEdges: Edge[] = [];
    const handleMap = new Map<string, string>();
    const phaseMap: Record<number, ExtendedPhase> = {
      1: 'first-order', 2: 'second-order', 3: 'third-order', 4: 'solutions', 5: 'solutions',
    };

    // Compute ancestor chain for z-index elevation
    const elevatedNodes = getAncestorChain(activeNodeId);
    const hasElevation = elevatedNodes.size > 0;

    const sentimentEdgeColors: Record<string, string> = { positive: '#22c55e', negative: '#ef4444', neutral: '#94a3b8' };
    // Idea/solution edges: opposite of bg — concrete color for SVG compatibility
    const ideaEdgeColor = colorMode === 'dark' ? '#e0e0e0' : '#1B1B1D';

    for (const c of allConsequences) {
      const parentId = c.parentId || 'seed';
      const parentPos = positionMap.get(parentId);
      const childPos = positionMap.get(c.id);
      if (!parentPos || !childPos) continue;

      const isDimmed = !isHighlighted(c);
      const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
      // Idea edges: opposite of bg (fg color). All others: target sentiment color.
      const edgeColor = isSolOrIdea ? ideaEdgeColor : sentimentEdgeColors[c.sentiment] || '#94a3b8';
      const { sourceHandle, targetHandle } = getOptimalHandles(parentPos, childPos);
      handleMap.set(c.id, targetHandle);
      const isElevated = hasElevation && elevatedNodes.has(parentId) && elevatedNodes.has(c.id);

      newEdges.push({
        id: `edge-${parentId}-${c.id}`,
        source: parentId,
        target: c.id,
        sourceHandle,
        targetHandle,
        type: 'default',
        zIndex: isElevated ? 999 : undefined,
        style: {
          stroke: edgeColor,
          strokeWidth: isDimmed ? 1.5 : (isElevated ? 5 : 3),
          // All edges solid — no dashing for wildcards or ideas
          opacity: isDimmed ? 0.15 : (isElevated ? 1 : (c.order === 1 ? 0.7 : 0.6)),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: isElevated ? 24 : (c.order === 1 ? 20 : 16),
          height: isElevated ? 24 : (c.order === 1 ? 20 : 16),
        },
        animated: c.id.startsWith('placeholder-') || (generationPhase !== 'complete' && generationPhase !== 'idle' && generationPhase === phaseMap[c.order]),
      });
    }
    incomingHandleMapRef.current = handleMap;
    return newEdges;
  }, [isHighlighted, generationPhase, getAncestorChain, activeNodeId, colorMode]);

  // ─── Build data object for a single consequence node ───────────
  const buildConsequenceData = useCallback((c: Consequence): ConsequenceNodeData => {
    const isPlaceholderNode = c.id.startsWith('placeholder-');
    const phaseMap: Record<number, ExtendedPhase> = {
      1: 'first-order', 2: 'second-order', 3: 'third-order', 4: 'solutions', 5: 'solutions',
    };
    return {
      consequence: c,
      // Only pulse during active generation phases, never during 'complete'
      isGenerating: generationPhase !== 'complete' && generationPhase !== 'idle' && generationPhase === phaseMap[c.order],
      isDimmed: !isHighlighted(c),
      isNewlyExpanded: showNewHighlight && !!c.expandedAt && c.expandedAt === lastExpansionTime,
      isSelected: activeNodeId === c.id,
      isEditing: editingNodeId === c.id,
      isGeneratingChildren: isGeneratingChildrenFor === c.id,
      isGeneratingIdeas: isGeneratingIdeasFor === c.id,
      isPlaceholder: isPlaceholderNode,
      isGenerationInProgress: isGenerationRunning,
      incomingHandle: incomingHandleMapRef.current.get(c.id),
      onClick: handleNodeClick,
      onStartEdit: handleStartEdit,
      onSaveEdit: handleSaveEdit,
      onCancelEdit: handleCancelEdit,
      onAddChild: handleAddChild,
      onGenerateChildren: handleGenerateChildren,
      onGenerateIdeas: handleRadialGenerateIdeas,
      onDelete: handleRadialDelete,
    };
  }, [generationPhase, isHighlighted, showNewHighlight, lastExpansionTime,
      activeNodeId, editingNodeId, isGeneratingChildrenFor, isGeneratingIdeasFor, isGenerationRunning,
      handleNodeClick, handleStartEdit, handleSaveEdit, handleCancelEdit,
      handleAddChild, handleGenerateChildren, handleRadialGenerateIdeas, handleRadialDelete]);

  // ─── STRUCTURAL SYNC — runs when consequences change ───────────
  // Computes positions for new nodes, removes deleted nodes, rebuilds edges.
  const prevConsequenceIdsRef = useRef<Set<string>>(new Set());

  const syncGraphStructure = useCallback(() => {
    const currentIds = new Set(consequences.map(c => c.id));
    const prevIds = prevConsequenceIdsRef.current;

    // Read current positions from ReactFlow's node state (via ref to avoid dep on nodes)
    const existingPositions = new Map<string, Position>();
    for (const n of nodesRef.current) {
      existingPositions.set(n.id, n.position);
    }

    // Compute layout: new nodes get positions, existing ones keep theirs
    const layoutPositions = computeRadialLayout(consequences, existingPositions, false, verbosity);
    resolveCollisions(layoutPositions, consequences);

    // Determine which nodes are new vs. existing vs. removed
    const addedIds = new Set<string>();
    currentIds.forEach(id => { if (!prevIds.has(id)) addedIds.add(id); });
    const removedIds = new Set<string>();
    prevIds.forEach(id => { if (!currentIds.has(id)) removedIds.add(id); });

    // Build the elevated set for z-index
    const elevatedNodes = getAncestorChain(activeNodeId);
    const hasElevation = elevatedNodes.size > 0;

    setNodes(prev => {
      // Remove deleted nodes
      let updated = prev.filter(n => n.id === 'seed' || currentIds.has(n.id));

      // Update existing nodes' data (not positions)
      updated = updated.map(n => {
        if (n.id === 'seed') {
          return {
            ...n,
            zIndex: hasElevation && elevatedNodes.has('seed') ? (activeNodeId === 'seed' ? 1001 : 1000) : undefined,
            data: {
              title: input.title,
              description: input.description,
              isSelected: activeNodeId === 'seed',
              isGeneratingChildren: isGeneratingChildrenFor === 'seed',
              isGenerationInProgress: isGenerationRunning,
              onClick: handleSeedClick,
              onAddChild: handleSeedAddChild,
              onGenerateChildren: handleSeedGenerateChildren,
            },
          };
        }
        const c = consequenceMap.get(n.id);
        if (!c) return n;
        return {
          ...n,
          zIndex: hasElevation && elevatedNodes.has(n.id) ? (activeNodeId === n.id ? 1001 : 1000) : undefined,
          draggable: !c.id.startsWith('placeholder-') && editingNodeId !== c.id,
          data: buildConsequenceData(c),
        };
      });

      // Add seed if not present
      if (!updated.find(n => n.id === 'seed')) {
        updated.unshift({
          id: 'seed',
          type: 'seed',
          position: { x: 0, y: 0 },
          zIndex: hasElevation && elevatedNodes.has('seed') ? (activeNodeId === 'seed' ? 1001 : 1000) : undefined,
          data: {
            title: input.title,
            description: input.description,
            isSelected: activeNodeId === 'seed',
            isGeneratingChildren: isGeneratingChildrenFor === 'seed',
            isGenerationInProgress: isGenerationRunning,
            onClick: handleSeedClick,
            onAddChild: handleSeedAddChild,
            onGenerateChildren: handleSeedGenerateChildren,
          },
        });
      }

      // Add new consequence nodes
      for (const c of consequences) {
        if (!addedIds.has(c.id)) continue;
        const pos = layoutPositions.get(c.id) || { x: 0, y: 0 };
        // Newly added nodes get elevated z-index so they appear in front of parents
        const isEditing = editingNodeId === c.id;
        const elevatedZ = hasElevation && elevatedNodes.has(c.id) ? (activeNodeId === c.id ? 1001 : 1000) : undefined;
        const newNodeZ = isEditing ? 1002 : 900; // editing nodes on top, new nodes above default
        updated.push({
          id: c.id,
          type: 'consequence',
          position: pos,
          draggable: !c.id.startsWith('placeholder-') && !isEditing,
          zIndex: elevatedZ ?? newNodeZ,
          data: buildConsequenceData(c),
        });
      }

      return updated;
    });

    // Rebuild edges using current positions (mix of existing + newly computed)
    const allPositions = new Map<string, Position>();
    // Start with layout positions for newly added nodes
    layoutPositions.forEach((pos, id) => allPositions.set(id, pos));
    // Override with actual ReactFlow positions for existing nodes (preserves drags)
    existingPositions.forEach((pos, id) => {
      if (!addedIds.has(id)) allPositions.set(id, pos);
    });

    const builtEdges = buildEdges(consequences, allPositions);
    setEdges(builtEdges);
    prevConsequenceIdsRef.current = currentIds;

    // If new nodes were added, re-set edges after a tick so ReactFlow
    // can measure the new DOM nodes and render the edge paths correctly.
    if (addedIds.size > 0) {
      requestAnimationFrame(() => setEdges(buildEdges(consequences, allPositions)));
      setTimeout(() => {
        const addedNodeIds = Array.from(addedIds);
        reactFlowInstanceRef.current?.fitView({
          padding: 0.3,
          duration: 400,
          nodes: addedNodeIds.map(id => ({ id })) as any,
        });
      }, 100);
    }
  }, [consequences, consequenceMap, input, activeNodeId, editingNodeId,
      isGeneratingChildrenFor, isGenerationRunning, getAncestorChain,
      handleSeedClick, handleSeedAddChild, handleSeedGenerateChildren,
      buildConsequenceData, buildEdges, setNodes, setEdges, verbosity]);

  // ─── DATA-ONLY UPDATE — runs on UI state changes ───────────────
  // Updates node data (selection, dimming, z-index) without touching positions.
  const updateNodeDataOnly = useCallback(() => {
    const elevatedNodes = getAncestorChain(activeNodeId);
    const hasElevation = elevatedNodes.size > 0;

    setNodes(prev => prev.map(n => {
      if (n.id === 'seed') {
        return {
          ...n,
          zIndex: hasElevation && elevatedNodes.has('seed') ? (activeNodeId === 'seed' ? 1001 : 1000) : undefined,
          data: {
            title: input.title,
            description: input.description,
            isSelected: activeNodeId === 'seed',
            isGeneratingChildren: isGeneratingChildrenFor === 'seed',
            isGenerationInProgress: isGenerationRunning,
            onClick: handleSeedClick,
            onAddChild: handleSeedAddChild,
            onGenerateChildren: handleSeedGenerateChildren,
          },
        };
      }
      const c = consequenceMap.get(n.id);
      if (!c) return n;
      const isEditingThis = editingNodeId === c.id;
      const chainZ = hasElevation && elevatedNodes.has(n.id) ? (activeNodeId === n.id ? 1001 : 1000) : undefined;
      return {
        ...n,
        zIndex: isEditingThis ? 1002 : chainZ,
        draggable: !c.id.startsWith('placeholder-') && !isEditingThis,
        data: buildConsequenceData(c),
      };
    }));

    // Also update edge styling (dimming, animation, z-index)
    // Build a quick edge-id → consequence lookup to avoid O(N) find per edge
    const edgeToConsequence = new Map<string, Consequence>();
    for (const c of consequences) {
      edgeToConsequence.set(`edge-${c.parentId || 'seed'}-${c.id}`, c);
    }
    const phaseMap: Record<number, ExtendedPhase> = {
      1: 'first-order', 2: 'second-order', 3: 'third-order', 4: 'complete', 5: 'complete',
    };

    setEdges(prev => {
      return prev.map(edge => {
        const c = edgeToConsequence.get(edge.id);
        if (!c) return edge;
        const isDimmed = !isHighlighted(c);
        const isWildcard = c.probability === 'wildcard';
        const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
        const edgeColor = isSolOrIdea ? '#0005e9' : isWildcard ? '#8b5cf6' : 'var(--chakra-colors-fg-muted, #94a3b8)';
        // Elevate edges whose both endpoints are in the ancestor chain
        const parentId = c.parentId || 'seed';
        const isElevated = hasElevation && elevatedNodes.has(parentId) && elevatedNodes.has(c.id);
        const newZIndex = isElevated ? 999 : undefined;
        const newStrokeWidth = isDimmed ? 1 : (isElevated ? 3 : 2);
        const newOpacity = isDimmed ? 0.2 : (c.order === 1 ? 0.7 : 0.6);
        const newAnimated = generationPhase === phaseMap[c.order];
        const newDash = isSolOrIdea ? '8,4' : isWildcard ? '5,5' : undefined;

        // Skip update if nothing changed (preserve reference identity)
        if (
          edge.zIndex === newZIndex &&
          edge.animated === newAnimated &&
          edge.style?.stroke === edgeColor &&
          edge.style?.strokeWidth === newStrokeWidth &&
          edge.style?.opacity === newOpacity &&
          edge.style?.strokeDasharray === newDash
        ) {
          return edge;
        }

        return {
          ...edge,
          zIndex: newZIndex,
          style: {
            stroke: edgeColor,
            strokeWidth: newStrokeWidth,
            strokeDasharray: newDash,
            opacity: newOpacity,
          },
          animated: newAnimated,
        };
      });
    });
  }, [consequences, input, activeNodeId, editingNodeId,
      isGeneratingChildrenFor, isGeneratingIdeasFor, isGenerationRunning,
      generationPhase, getAncestorChain, isHighlighted,
      showNewHighlight, lastExpansionTime,
      handleSeedClick, handleSeedAddChild, handleSeedGenerateChildren,
      buildConsequenceData, setNodes, setEdges]);

  // ─── Edge rebuild on drag stop ──────────────────────────────────
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
    // Update the pre-focus snapshot so unfocus restores to the post-drag position
    if (preFocusPositionsRef.current) {
      preFocusPositionsRef.current.set(draggedNode.id, { ...draggedNode.position });
    }

    // Recalculate edges connected to the dragged node using its new position
    setEdges(prev => prev.map(edge => {
      if (edge.source !== draggedNode.id && edge.target !== draggedNode.id) return edge;

      // Find the positions of both ends
      const sourcePos = edge.source === draggedNode.id
        ? draggedNode.position
        : (nodesRef.current.find(n => n.id === edge.source)?.position || { x: 0, y: 0 });
      const targetPos = edge.target === draggedNode.id
        ? draggedNode.position
        : (nodesRef.current.find(n => n.id === edge.target)?.position || { x: 0, y: 0 });

      const { sourceHandle, targetHandle } = getOptimalHandles(sourcePos, targetPos);
      return { ...edge, sourceHandle, targetHandle };
    }));
  }, [setEdges]);

  // ─── Tidy Layout handler ───────────────────────────────────────
  const handleTidyLayout = useCallback(() => {
    const freshPositions = computeRadialLayout(consequences, undefined, true, verbosity);
    resolveCollisions(freshPositions, consequences);

    setNodes(prev => prev.map(n => {
      const pos = freshPositions.get(n.id);
      if (!pos) return n;
      return { ...n, position: pos };
    }));

    // Rebuild edges with fresh positions
    setEdges(buildEdges(consequences, freshPositions));

    // Clear focus state since we've reset all positions
    preFocusPositionsRef.current = null;
  }, [consequences, buildEdges, setNodes, setEdges]);

  // ─── Effect: structural sync (when consequences change) ────────
  const prevConsequenceLengthRef = useRef(consequences.length);
  const prevConsequenceJsonRef = useRef('__uninitialized__');

  useEffect(() => {
    // Build a lightweight fingerprint of consequences to detect structural changes
    const fingerprint = consequences.map(c => c.id).sort().join(',');
    if (fingerprint !== prevConsequenceJsonRef.current) {
      prevConsequenceJsonRef.current = fingerprint;
      syncGraphStructure();
    }
  }, [consequences, syncGraphStructure]);

  // ─── Effect: data-only update (when UI state changes) ──────────
  // Skip when activeNodeId just changed (non-seed, non-generation) because
  // the focus-path effect below will handle setNodes/setEdges for that case,
  // avoiding a redundant double-update.
  const prevActiveForDataRef = useRef<string | null>(null);
  useEffect(() => {
    const activeChanged = activeNodeId !== prevActiveForDataRef.current;
    const prevWasFocused = prevActiveForDataRef.current && prevActiveForDataRef.current !== 'seed';
    prevActiveForDataRef.current = activeNodeId;
    // When focusing a non-seed node, the focus-path effect handles setNodes/setEdges.
    // When unfocusing (from a focused node), the focus-path effect also handles it.
    // Skip here to avoid a redundant double-update.
    if (activeChanged && !isGenerationRunning && (
      (activeNodeId && activeNodeId !== 'seed') || prevWasFocused
    )) {
      return;
    }
    updateNodeDataOnly();
  }, [activeNodeId, editingNodeId, isGeneratingChildrenFor, isGeneratingIdeasFor,
      isGenerationRunning, generationPhase, highlightFilters,
      showNewHighlight, lastExpansionTime, updateNodeDataOnly]);

  // ─── Effect: center viewport when editing starts ────
  const prevEditingRef = useRef<string | null>(null);
  useEffect(() => {
    const editChanged = editingNodeId !== prevEditingRef.current;
    prevEditingRef.current = editingNodeId;
    if (editChanged && editingNodeId) {
      // Small delay so the enlarged edit form has rendered and RF has measured it
      setTimeout(() => centerOnNode(editingNodeId, 0.7), 80);
    }
  }, [editingNodeId, centerOnNode]);

  // ─── Effect: focus-path animation (when active node changes) ────
  useEffect(() => {
    // Only run when activeNodeId actually changes
    if (activeNodeId === prevActiveNodeIdRef.current) return;
    const prevActiveId = prevActiveNodeIdRef.current;
    prevActiveNodeIdRef.current = activeNodeId;

    // Clear any pending animation timer
    if (focusAnimTimerRef.current) {
      clearTimeout(focusAnimTimerRef.current);
      focusAnimTimerRef.current = null;
    }

    // Skip during generation — too many nodes changing
    if (isGenerationRunning) return;

    if (activeNodeId && activeNodeId !== 'seed') {
      // ── FOCUS: node selected → compute focus positions and animate ──
      // Save current positions before focus (only if not already saved)
      if (!preFocusPositionsRef.current) {
        const savedPositions = new Map<string, Position>();
        for (const n of nodesRef.current) {
          savedPositions.set(n.id, { ...n.position });
        }
        preFocusPositionsRef.current = savedPositions;
      }

      const ancestorChain = getAncestorChain(activeNodeId);
      // Use pre-focus (original) positions as the base for computing focus layout,
      // so switching between focused nodes uses stable original positions
      const basePositions = preFocusPositionsRef.current || new Map<string, Position>();
      // Fall back to current positions for any nodes not in the saved set (e.g. newly added)
      for (const n of nodesRef.current) {
        if (!basePositions.has(n.id)) {
          basePositions.set(n.id, { ...n.position });
        }
      }

      const focusPos = computeFocusPositions(activeNodeId, ancestorChain, consequences, basePositions);

      // Enable CSS transition, then apply positions + focus dimming + data update
      // (We also apply the full data update here to avoid a redundant updateNodeDataOnly call)
      setFocusAnimClass('focus-animating');
      requestAnimationFrame(() => {
        setNodes(prev => prev.map(n => {
          const pos = focusPos.get(n.id);
          const isInChain = ancestorChain.has(n.id);
          const updatedNode = pos ? { ...n, position: pos } : { ...n };
          // Apply z-index for chain elevation
          updatedNode.zIndex = ancestorChain.has(n.id)
            ? (activeNodeId === n.id ? 1001 : 1000) : undefined;
          // Update consequence node data (selection state, dimming, callbacks)
          if (n.type === 'consequence') {
            const c = consequenceMap.get(n.id);
            if (c) {
              updatedNode.draggable = !c.id.startsWith('placeholder-') && editingNodeId !== c.id;
              updatedNode.data = { ...buildConsequenceData(c), isFocusDimmed: !isInChain };
            }
          } else if (n.id === 'seed') {
            updatedNode.data = {
              title: input.title,
              description: input.description,
              isSelected: activeNodeId === 'seed',
              isGeneratingChildren: isGeneratingChildrenFor === 'seed',
              isGenerationInProgress: isGenerationRunning,
              onClick: handleSeedClick,
              onAddChild: handleSeedAddChild,
              onGenerateChildren: handleSeedGenerateChildren,
            };
          }
          return updatedNode;
        }));
        // Rebuild edges for new positions
        setEdges(buildEdges(consequences, focusPos));
      });

      // Center viewport on selected node using the just-computed positions
      // (RF state may not have updated yet, so pass focusPos directly)
      setTimeout(() => centerOnNode(activeNodeId, 0.8, focusPos), 50);

      // Remove transition class after animation completes
      focusAnimTimerRef.current = setTimeout(() => {
        setFocusAnimClass('');
        focusAnimTimerRef.current = null;
      }, 420);

    } else if (prevActiveId && prevActiveId !== 'seed' && preFocusPositionsRef.current) {
      // ── UNFOCUS: deselected → restore pre-focus positions ──
      const savedPositions = preFocusPositionsRef.current;

      // Enable unfocus transition, then restore positions + clear dimming + update data
      setFocusAnimClass('unfocus-animating');
      requestAnimationFrame(() => {
        setNodes(prev => prev.map(n => {
          const pos = savedPositions.get(n.id);
          const updatedNode = pos ? { ...n, position: pos } : { ...n };
          updatedNode.zIndex = undefined; // Clear elevation
          if (n.type === 'consequence') {
            const c = consequenceMap.get(n.id);
            if (c) {
              updatedNode.draggable = !c.id.startsWith('placeholder-') && editingNodeId !== c.id;
              updatedNode.data = { ...buildConsequenceData(c), isFocusDimmed: false };
            }
          } else if (n.id === 'seed') {
            updatedNode.data = {
              title: input.title,
              description: input.description,
              isSelected: activeNodeId === 'seed',
              isGeneratingChildren: isGeneratingChildrenFor === 'seed',
              isGenerationInProgress: isGenerationRunning,
              onClick: handleSeedClick,
              onAddChild: handleSeedAddChild,
              onGenerateChildren: handleSeedGenerateChildren,
            };
          }
          return updatedNode;
        }));
        // Rebuild edges for restored positions
        setEdges(buildEdges(consequences, savedPositions));
      });

      // Clear saved positions and transition class after animation
      focusAnimTimerRef.current = setTimeout(() => {
        setFocusAnimClass('');
        preFocusPositionsRef.current = null;
        focusAnimTimerRef.current = null;
      }, 320);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId]);

  // Generation flow - using real Claude API or mock data
  useEffect(() => {
    // Skip if already started, paused, manual mode, or we have imported data
    if (generationStarted.current || isPaused || importedData || manualMode) return;
    generationStarted.current = true;

    const runGeneration = async () => {
      if (hasApiKey() && !useMockData) {
        try {
          const result = await generateComprehensiveFuturescape(effectiveInput, {
            onPhaseStart: (phase: GenerationPhase) => {
              setGenerationPhase(phase as ExtendedPhase);
            },
            onPhaseComplete: (phase: GenerationPhase, newConsequences: Consequence[], _newSolutions?: Solution[]) => {
              if (newConsequences.length > 0) {
                setConsequences(prev => [...prev, ...newConsequences]);
              }
            },
            onProgress: (message: string) => {
              setProgressMessage(message);
            },
            onError: (err: Error, phase: string) => {
              console.error(`Error in ${phase}:`, err);
              setError(err.message);
              // Don't navigate away - just show the error
            },
          }, generationConfig);
          // Solutions are now part of consequences array as nodeType: 'solution'|'idea'
          setGenerationPhase('complete');
        } catch (err) {
          console.error('Generation error:', err);
          setError((err as Error).message);
          // Stay on the page even with errors - let user retry
        }
      } else {
        // Use mock data generation (simplified for demo)
        setGenerationPhase('first-order');
        const firstOrder = await generateConsequences(input.title, input.description, 1, []);
        setConsequences(firstOrder);

        setGenerationPhase('second-order');
        const secondOrder = await generateConsequences(input.title, input.description, 2, firstOrder);
        setConsequences(prev => [...prev, ...secondOrder]);

        setGenerationPhase('third-order');
        const thirdOrder = await generateConsequences(input.title, input.description, 3, [...firstOrder, ...secondOrder]);
        setConsequences(prev => [...prev, ...thirdOrder]);

        setGenerationPhase('complete');
      }
    };

    runGeneration();
  }, [input, isPaused, useMockData, importedData, manualMode]);

  // Retry with mock data
  const handleRetryWithMock = () => {
    setError(null);
    setConsequences([]);
    setUseMockData(true);
    generationStarted.current = false;
  };

  // Find related subjects once generation completes
  useEffect(() => {
    if (generationPhase !== 'complete' || subjectsRequested.current || consequences.length === 0) return;
    if (!hasApiKey()) return; // Need API key for subject matching
    subjectsRequested.current = true;
    setIsLoadingSubjects(true);

    findRelevantSubjects(effectiveInput, consequences)
      .then(subjects => {
        setRelatedSubjects(subjects);
      })
      .catch(err => {
        console.error('Failed to find related subjects:', err);
      })
      .finally(() => {
        setIsLoadingSubjects(false);
      });
  }, [generationPhase, consequences, input]);

  const handleRetrySubjects = () => {
    subjectsRequested.current = false;
    setRelatedSubjects([]);
    setIsLoadingSubjects(true);
    findRelevantSubjects(effectiveInput, consequences)
      .then(subjects => setRelatedSubjects(subjects))
      .catch(err => console.error('Failed to find related subjects:', err))
      .finally(() => setIsLoadingSubjects(false));
  };

  // Highlight filter handlers (for dimming)
  const toggleHighlightCategory = (cat: STEEPCategory) => {
    setHighlightFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const toggleHighlightSentiment = (sent: Sentiment) => {
    setHighlightFilters((prev) => ({
      ...prev,
      sentiments: prev.sentiments.includes(sent)
        ? prev.sentiments.filter((s) => s !== sent)
        : [...prev.sentiments, sent],
    }));
  };

  const toggleHighlightOrder = (ord: ConsequenceOrder) => {
    setHighlightFilters((prev) => ({
      ...prev,
      orders: prev.orders.includes(ord)
        ? prev.orders.filter((o) => o !== ord)
        : [...prev.orders, ord],
    }));
  };

  const toggleHighlightProbability = (prob: Probability) => {
    setHighlightFilters((prev) => ({
      ...prev,
      probabilities: prev.probabilities.includes(prob)
        ? prev.probabilities.filter((p) => p !== prob)
        : [...prev.probabilities, prob],
    }));
  };

  const toggleHighlightImportance = (imp: Importance) => {
    setHighlightFilters((prev) => ({
      ...prev,
      importance: prev.importance.includes(imp)
        ? prev.importance.filter((i) => i !== imp)
        : [...prev.importance, imp],
    }));
  };

  const toggleShowIdeas = () => {
    setHighlightFilters((prev) => ({
      ...prev,
      showIdeas: !prev.showIdeas,
    }));
  };

  const resetFilters = () => {
    setHighlightFilters({
      categories: ['social', 'technological', 'economic', 'environmental', 'political', 'ethical'],
      sentiments: ['positive', 'negative', 'neutral'],
      orders: [1, 2, 3, 4, 5],
      probabilities: ['probable', 'plausible', 'possible', 'wildcard'],
      importance: ['critical', 'high', 'medium', 'low'],
      showIdeas: true,
    });
    setShowHighImpact(false);
  };

  // Toggle high-impact filter: only probable/plausible + critical/high
  const toggleHighImpact = () => {
    if (showHighImpact) {
      // Turn off: reset probabilities and importance to all
      setHighlightFilters(prev => ({
        ...prev,
        probabilities: ['probable', 'plausible', 'possible', 'wildcard'],
        importance: ['critical', 'high', 'medium', 'low'],
      }));
      setShowHighImpact(false);
    } else {
      // Turn on: filter to only probable/plausible + critical/high
      setHighlightFilters(prev => ({
        ...prev,
        probabilities: ['probable', 'plausible'],
        importance: ['critical', 'high'],
      }));
      setShowHighImpact(true);
    }
  };

  // Edit/delete handlers
  const handleEdit = (id: string, newText: string) => {
    setConsequences((prev) =>
      prev.map((c) => (c.id === id ? { ...c, text: newText } : c))
    );
  };

  const handleDelete = (id: string) => {
    setConsequences((prev) => prev.filter((c) => c.id !== id));
  };

  // Expand node - generate 2-4 more consequences from a selected node
  const handleExpandNode = async (nodeId: string) => {
    const nodeToExpand = consequenceMap.get(nodeId);
    if (!nodeToExpand) return;

    setIsExpandingNode(true);
    try {
      const expandTime = Date.now();
      const newConsequences = await expandNodeConsequences(
        input,
        nodeToExpand,
        consequences
      );
      const stamped = newConsequences.map(c => ({ ...c, expandedAt: expandTime }));
      setConsequences(prev => [...prev, ...stamped]);
      setLastExpansionTime(expandTime);
      setShowNewHighlight(true);
    } catch (err) {
      console.error('Error expanding node:', err);
      setError((err as Error).message);
    }
    setIsExpandingNode(false);
  };

  // Generate solutions/ideas for a consequence
  const handleGenerateIdeas = async (nodeId: string) => {
    const targetNode = consequenceMap.get(nodeId);
    if (!targetNode) return;

    setIsGeneratingIdeas(true);
    try {
      const expandTime = Date.now();
      const newIdeas = await generateSolutionIdeas(effectiveInput, targetNode, consequences);
      const stamped = newIdeas.map(c => ({ ...c, expandedAt: expandTime }));
      setConsequences(prev => [...prev, ...stamped]);
      setLastExpansionTime(expandTime);
      setShowNewHighlight(true);
    } catch (err) {
      console.error('Error generating ideas:', err);
      setError((err as Error).message);
    }
    setIsGeneratingIdeas(false);
  };

  // Free-prompt expansion handler
  const handlePromptSubmit = async () => {
    if (!promptText.trim() || isPrompting) return;

    setIsPrompting(true);
    setPromptProgress('');
    try {
      const expandTime = Date.now();
      const newConsequences = await freePromptExpand(
        effectiveInput,
        consequences,
        promptText.trim(),
        (msg) => setPromptProgress(msg)
      );
      const stamped = newConsequences.map(c => ({ ...c, expandedAt: expandTime }));
      setConsequences(prev => [...prev, ...stamped]);
      setLastExpansionTime(expandTime);
      setShowNewHighlight(true);
      setPromptText('');
      setPromptProgress(`Added ${newConsequences.length} new consequences`);
      setTimeout(() => setPromptProgress(''), 3000);
    } catch (err) {
      console.error('Prompt expansion error:', err);
      setPromptProgress((err as Error).message);
    }
    setIsPrompting(false);
  };

  // Get phase progress (now only 4 phases: 3 orders + solutions)
  const getPhaseNumber = (phase: ExtendedPhase): number => {
    const phases: ExtendedPhase[] = ['first-order', 'second-order', 'third-order', 'solutions', 'complete'];
    return phases.indexOf(phase) + 1;
  };
  const totalPhases = 4;

  return (
    <Flex direction="column" h="100vh">
      {/* Header bar */}
      <Flex
        h="40px"
        px={4}
        align="center"
        justify="space-between"
        bg="bg.canvas"
        borderBottom="1px solid"
        borderColor="border.muted"
        flexShrink={0}
      >
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" letterSpacing="wider" textTransform="uppercase">
          Futurescaper
        </Text>
        <Box
          as="button"
          onClick={toggleColorMode}
          p={1.5}
          rounded="md"
          color="fg.muted"
          _hover={{ color: 'fg', bg: 'bg.hover' }}
          transition="all 0.15s"
          title={colorMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {colorMode === 'light' ? <Moon style={{ width: 14, height: 14 }} /> : <Sun style={{ width: 14, height: 14 }} />}
        </Box>
      </Flex>

      {/* Existing content */}
      <Flex flex={1} minH={0}>
      {/* Left sidebar */}
      <Flex direction="column" flexShrink={0} p={3} pr={0}>
      <Flex
        w="300px"
        bg="bg.canvas"
        borderWidth="1px"
        borderColor="border.emphasized"
        rounded="xl"
        direction="column"
        overflowY="auto"
        overflowX="hidden"
        h="100%"
      >
        <Box p={4} borderBottom="1px solid" borderColor="border.muted">
          <Flex
            as="button"
            onClick={onBack}
            align="center"
            gap={2}
            color="fg.secondary"
            _hover={{ color: 'fg' }}
            mb={4}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Back
          </Flex>
          <Text fontWeight="bold" color="fg" mb={1}>{input.title}</Text>
          <Text fontSize="sm" color="fg.secondary" maxH="128px" overflowY="auto">{input.description}</Text>
        </Box>

        {/* Verbosity Toggle */}
        <Box p={4} borderBottom="1px solid" borderColor="border.muted">
          <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={2}>AI Verbosity</Text>
          <Flex gap={1}>
            {(['concise', 'normal', 'detailed'] as const).map((v) => (
              <Box
                key={v}
                as="button"
                onClick={() => setVerbosity(v)}
                flex={1}
                py={1}
                px={2}
                rounded="md"
                borderWidth="1px"
                textAlign="center"
                fontSize="xs"
                fontWeight={verbosity === v ? 'semibold' : 'normal'}
                cursor="pointer"
                transition="all 0.15s"
                borderColor={verbosity === v ? 'brand/40' : 'border.muted'}
                bg={verbosity === v ? 'brand/12' : 'transparent'}
                color={verbosity === v ? 'fg' : 'fg.muted'}
                _hover={verbosity !== v ? { bg: 'bg.hover' } : undefined}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Box>
            ))}
          </Flex>
        </Box>

        {error && (
          <Box p={4} bg="error/8" borderBottom="1px solid" borderColor="error/20">
            <Flex align="start" gap={3}>
              <Box as={AlertCircle} w="20px" h="20px" color="fg.error" flexShrink={0} mt="2px" />
              <Box>
                <Text fontWeight="semibold" color="fg.error">Generation Error</Text>
                <Text fontSize="sm" color="fg.error" mt={1}>{error}</Text>
                <Flex gap={2} mt={3}>
                  {(error.toLowerCase().includes('api key') ||
                    error.toLowerCase().includes('authentication') ||
                    error.toLowerCase().includes('invalid') ||
                    error.toLowerCase().includes('401') ||
                    error.toLowerCase().includes('unauthorized')) && onApiError && (
                    <Button
                      onClick={onApiError}
                      size="sm"
                      bg="warning"
                      color="brand.contrast"
                      rounded="lg"
                      _hover={{ opacity: 0.9 }}
                    >
                      Change API Key
                    </Button>
                  )}
                  <Button
                    onClick={handleRetryWithMock}
                    size="sm"
                    bg="fg.error"
                    color="brand.contrast"
                    rounded="lg"
                    _hover={{ opacity: 0.9 }}
                  >
                    Use Demo Mode
                  </Button>
                </Flex>
              </Box>
            </Flex>
          </Box>
        )}

        {/* Generation Progress */}
        <Box p={4} borderBottom="1px solid" borderColor="border.muted">
          {manualMode ? (
            <Flex align="center" gap={2} fontSize="sm" color="fg.secondary">
              <Box as={Hammer} w="16px" h="16px" color="fg.muted" />
              <Box>
                <Text fontWeight="semibold" color="fg.secondary">Manual Mode</Text>
                <Text fontSize="xs" color="fg.muted" mt={1}>Click the seed node to add children or AI-generate consequences. Click any node for more actions.</Text>
              </Box>
            </Flex>
          ) : (
            <>
              <Flex align="center" justify="space-between" mb={2}>
                <Text fontSize="sm" fontWeight="semibold" color="fg.secondary">Generation Progress</Text>
                <Text fontSize="xs" color="fg.muted">
                  {generationPhase === 'complete' ? `${totalPhases}/${totalPhases}` : `${getPhaseNumber(generationPhase)}/${totalPhases}`}
                </Text>
              </Flex>
              <Box w="100%" bg="bg.active" rounded="full" h="8px" mb={2} overflow="hidden">
                <Box
                  bg="brand"
                  h="8px"
                  rounded="full"
                  transition="all 0.5s"
                  style={{ width: `${Math.min((getPhaseNumber(generationPhase) / totalPhases) * 100, 100)}%` }}
                />
              </Box>
              <Box fontSize="xs" color="fg.muted">
                {generationPhase === 'complete' ? (
                  <Text as="span" color="fg.success" fontWeight="medium">✓ Analysis complete ({stats.total} consequences)</Text>
                ) : (
                  progressMessage || `Analyzing ${generationPhase}...`
                )}
              </Box>
            </>
          )}
        </Box>

        {/* TLDR Summary */}
        {tldrSummary && generationPhase === 'complete' && (
          <Box p={4} borderBottom="1px solid" borderColor="border.muted">
            <Flex
              as="button"
              onClick={() => setShowTLDR(!showTLDR)}
              align="center"
              gap={2}
              w="100%"
              textAlign="left"
              mb={2}
            >
              <Box as={FileText} w="16px" h="16px" color="brand" />
              <Text fontSize="sm" fontWeight="semibold" color="fg.secondary">TL;DR Summary</Text>
              <Text ml="auto" fontSize="xs" color="fg.muted">{showTLDR ? '▼' : '▶'}</Text>
            </Flex>
            {showTLDR && (
              <Flex direction="column" gap={3} fontSize="sm">
                <Box bg="bg.hover" rounded="lg" p={3}>
                  <Text color="fg.secondary" mb={2}>
                    <strong>{tldrSummary.totalConsequences}</strong> consequences identified:
                    {' '}<Text as="span" color="fg.error">{tldrSummary.negativePercent}% concerning</Text>,
                    {' '}<Text as="span" color="fg.success">{tldrSummary.positivePercent}% positive</Text>
                    {tldrSummary.criticalCount > 0 && (
                      <Text as="span" color="warning"> ({tldrSummary.criticalCount} critical)</Text>
                    )}
                  </Text>
                  {tldrSummary.dominantCategory && (
                    <Text color="fg.secondary" fontSize="xs">
                      Primary impact area: <Text as="span" fontWeight="medium">{STEEP_LABELS[tldrSummary.dominantCategory]}</Text>
                    </Text>
                  )}
                </Box>

                {tldrSummary.topConcerns.length > 0 && (
                  <Box>
                    <Flex as="h4" fontSize="xs" fontWeight="semibold" color="fg.error" mb="6px" align="center" gap={1}>
                      <TrendingDown style={{ width: 12, height: 12 }} /> Top Concerns
                    </Flex>
                    <Flex direction="column" gap={2}>
                      {tldrSummary.topConcerns.map((c) => (
                        <Box
                          as="li"
                          key={c.id}
                          onClick={() => setActiveNodeId(c.id)}
                          fontSize="xs"
                          color="fg.secondary"
                          pl={3}
                          borderLeft="2px solid"
                          borderColor="error/20"
                          lineHeight="relaxed"
                          cursor="pointer"
                          _hover={{ color: 'fg', borderColor: 'fg.error' }}
                          transition="colors"
                          listStyleType="none"
                        >
                          {c.text}
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                )}

                {tldrSummary.topOpportunities.length > 0 && (
                  <Box>
                    <Flex as="h4" fontSize="xs" fontWeight="semibold" color="fg.success" mb="6px" align="center" gap={1}>
                      <TrendingUp style={{ width: 12, height: 12 }} /> Top Opportunities
                    </Flex>
                    <Flex direction="column" gap={2}>
                      {tldrSummary.topOpportunities.map((c) => (
                        <Box
                          as="li"
                          key={c.id}
                          onClick={() => setActiveNodeId(c.id)}
                          fontSize="xs"
                          color="fg.secondary"
                          pl={3}
                          borderLeft="2px solid"
                          borderColor="fg.success"
                          lineHeight="relaxed"
                          cursor="pointer"
                          _hover={{ color: 'fg', borderColor: 'fg.success' }}
                          transition="colors"
                          listStyleType="none"
                        >
                          {c.text}
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Flex>
            )}
          </Box>
        )}

        {/* Related Subjects Panel */}
        <RelatedSubjects
          subjects={relatedSubjects}
          isLoading={isLoadingSubjects}
          onRetry={handleRetrySubjects}
        />

        <ExportPanel consequences={consequences} input={input} solutions={[]} />
      </Flex>
      </Flex>

      {/* Main map area */}
      <Box ref={mapContainerRef} flex={1} position="relative" bg="bg" className={`${focusAnimClass} ${activeNodeId && activeNodeId !== 'seed' ? 'has-focus-path' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          onInit={(instance) => { reactFlowInstanceRef.current = instance; }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'default',
            style: { strokeLinecap: 'round', strokeLinejoin: 'round' },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--chakra-colors-border-muted, #F0F0F0)" />
          <Controls />

          {/* Tidy Layout button */}
          {generationPhase === 'complete' && consequences.length > 0 && (
            <Box
              position="absolute"
              top={4}
              zIndex={10}
              right={filterPanelCollapsed ? '64px' : '236px'}
              style={{ transition: 'right 0.2s ease' }}
            >
              <Flex
                as="button"
                onClick={handleTidyLayout}
                align="center"
                gap="6px"
                px={3}
                py={2}
                bg="bg.muted"
                backdropFilter="blur(8px)"
                rounded="lg"
                shadow="md"
                border="1px solid"
                borderColor="border.muted"
                fontSize="xs"
                fontWeight="medium"
                color="fg.secondary"
                _hover={{ color: 'fg', borderColor: 'border' }}
                transition="colors"
                title="Reset layout to clean radial arrangement"
              >
                <LayoutGrid style={{ width: 14, height: 14 }} />
                Tidy Layout
              </Flex>
            </Box>
          )}

          {/* ─── Filter Panel (right side of map) ─── */}
          {consequences.length > 0 && (
            <Flex
              position="absolute"
              top={3}
              right={3}
              bottom={3}
              zIndex={10}
              style={{ pointerEvents: 'none' }}
            >
              <Box
                h="100%"
                bg="bg.canvas"
                shadow="lg"
                borderWidth="1px"
                borderColor="border.emphasized"
                rounded="xl"
                overflowY="auto"
                style={{
                  width: filterPanelCollapsed ? '44px' : '240px',
                  transition: 'width 0.2s ease',
                  pointerEvents: 'auto',
                }}
              >
                {/* Collapse toggle */}
                <Box position="sticky" top={0} bg="bg.canvas" zIndex={10} borderBottom="1px solid" borderColor="border.muted" roundedTop="xl">
                  <Flex
                    as="button"
                    onClick={() => setFilterPanelCollapsed(prev => !prev)}
                    w="100%"
                    align="center"
                    gap={2}
                    px={3}
                    py="10px"
                    fontSize="xs"
                    fontWeight="semibold"
                    color="fg.secondary"
                    _hover={{ bg: 'bg.hover' }}
                    transition="colors"
                    title={filterPanelCollapsed ? 'Expand filters' : 'Collapse filters'}
                  >
                    <Filter style={{ width: 14, height: 14, flexShrink: 0 }} />
                    {!filterPanelCollapsed && (
                      <>
                        <Text flex={1} textAlign="left">Filters</Text>
                        <ChevronRight style={{ width: 14, height: 14 }} />
                      </>
                    )}
                  </Flex>
                </Box>

                {filterPanelCollapsed ? (
                  /* ── Collapsed: icon strip ── */
                  <Flex direction="column" align="center" gap={1} py={2}>
                    <Box as="button" onClick={() => setFilterPanelCollapsed(false)} p="6px" rounded="md" _hover={{ bg: 'bg.hover' }} color="fg.muted" title="Category"><Layers style={{ width: 16, height: 16 }} /></Box>
                    <Box as="button" onClick={() => setFilterPanelCollapsed(false)} p="6px" rounded="md" _hover={{ bg: 'bg.hover' }} color="fg.muted" title="Sentiment"><TrendingUp style={{ width: 16, height: 16 }} /></Box>
                    <Box as="button" onClick={() => setFilterPanelCollapsed(false)} p="6px" rounded="md" _hover={{ bg: 'bg.hover' }} color="fg.muted" title="Probability"><Target style={{ width: 16, height: 16 }} /></Box>
                    <Box as="button" onClick={() => setFilterPanelCollapsed(false)} p="6px" rounded="md" _hover={{ bg: 'bg.hover' }} color="fg.muted" title="Importance"><Star style={{ width: 16, height: 16 }} /></Box>
                    <Box w="24px" borderTop="1px solid" borderColor="border.muted" my={1} />
                    <Box as="button" onClick={resetFilters} p="6px" rounded="md" _hover={{ bg: 'bg.hover' }} color="fg.muted" title="Reset filters"><X style={{ width: 16, height: 16 }} /></Box>
                  </Flex>
                ) : (
                  /* ── Expanded: full filters ── */
                  <Flex direction="column" gap={3} px={3} py={2}>
                    {/* Quick actions */}
                    <Flex align="center" gap="6px">
                      <Flex
                        as="button"
                        onClick={toggleHighImpact}
                        align="center"
                        gap={1}
                        px={2}
                        py={1}
                        fontSize="10px"
                        rounded="md"
                        transition="colors"
                        flex={1}
                        justify="center"
                        bg={showHighImpact ? 'brand/12' : 'transparent'}
                        color={showHighImpact ? 'fg' : 'fg.muted'}
                        fontWeight={showHighImpact ? 'semibold' : 'normal'}
                        border="1px solid"
                        borderColor={showHighImpact ? 'brand/40' : 'border.muted'}
                      >
                        <Zap style={{ width: 12, height: 12 }} /> Key Only
                      </Flex>
                      <Box
                        as="button"
                        onClick={resetFilters}
                        px={2}
                        py={1}
                        fontSize="10px"
                        color="fg.muted"
                        _hover={{ color: 'fg.secondary' }}
                        bg="bg.hover"
                        border="1px solid"
                        borderColor="border.muted"
                        rounded="md"
                      >
                        Reset
                      </Box>
                    </Flex>

                    {/* STEEP Category */}
                    <Box>
                      <Flex as="span" fontSize="10px" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" mb="6px" align="center" gap={1}>
                        <Layers style={{ width: 12, height: 12 }} /> Category
                      </Flex>
                      <Flex direction="column" gap={1}>
                        {(['social', 'technological', 'economic', 'environmental', 'political', 'ethical'] as STEEPCategory[]).map((cat) => {
                          const isActive = highlightFilters.categories.includes(cat);
                          const isDark = colorMode === 'dark';
                          return (
                            <Flex
                              as="button"
                              key={cat}
                              onClick={() => toggleHighlightCategory(cat)}
                              w="100%"
                              px={2}
                              py={1}
                              fontSize="10px"
                              rounded="sm"
                              transition="all 0.15s"
                              textAlign="left"
                              align="center"
                              justify="space-between"
                              gap={1}
                              style={isActive ? { backgroundColor: getSteepMutedBg(cat, isDark), color: getSteepTextColor(cat, isDark) } : {}}
                              color={isActive ? undefined : 'fg.muted'}
                              fontWeight={isActive ? 'semibold' : 'normal'}
                              border="1px solid"
                              borderColor={isActive ? 'transparent' : 'border.muted'}
                            >
                              <Flex align="center" gap={1}>
                                <SteepIcon category={cat} size={11} />
                                {STEEP_LABELS[cat]}
                              </Flex>
                              <Text as="span" opacity={0.6}>({stats.byCategory[cat] || 0})</Text>
                            </Flex>
                          );
                        })}
                      </Flex>
                    </Box>

                    {/* Sentiment */}
                    <Box>
                      <Flex as="span" fontSize="10px" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" mb="6px" align="center" gap={1}>
                        Sentiment
                      </Flex>
                      <Flex direction="column" gap={1}>
                        {(['positive', 'negative', 'neutral'] as Sentiment[]).map((sent) => (
                          <Flex
                            as="button"
                            key={sent}
                            onClick={() => toggleHighlightSentiment(sent)}
                            w="100%"
                            px={2}
                            py={1}
                            fontSize="10px"
                            rounded="sm"
                            align="center"
                            gap="6px"
                            transition="colors"
                            border="1px solid"
                            textAlign="left"
                            bg={highlightFilters.sentiments.includes(sent) ? 'brand/12' : 'transparent'}
                            color={highlightFilters.sentiments.includes(sent) ? 'fg' : 'fg.muted'}
                            fontWeight={highlightFilters.sentiments.includes(sent) ? 'semibold' : 'normal'}
                            borderColor={highlightFilters.sentiments.includes(sent) ? 'brand/40' : 'border.muted'}
                          >
                            <Text fontSize="sm">{SENTIMENT_SYMBOLS[sent]}</Text> <Text flex={1} textTransform="capitalize">{sent}</Text> <Text as="span" opacity={0.6}>({stats.bySentiment[sent]})</Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>

                    {/* Probability */}
                    <Box>
                      <Flex as="span" fontSize="10px" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" mb="6px" align="center" gap={1}>
                        <Target style={{ width: 12, height: 12 }} /> Probability
                      </Flex>
                      <Flex direction="column" gap={1}>
                        {(['probable', 'plausible', 'possible', 'wildcard'] as Probability[]).map((prob) => (
                          <Flex
                            as="button"
                            key={prob}
                            onClick={() => toggleHighlightProbability(prob)}
                            w="100%"
                            px={2}
                            py={1}
                            fontSize="10px"
                            rounded="sm"
                            transition="colors"
                            textAlign="left"
                            align="center"
                            justify="space-between"
                            bg={highlightFilters.probabilities.includes(prob) ? 'brand/12' : 'transparent'}
                            color={highlightFilters.probabilities.includes(prob) ? 'fg' : 'fg.muted'}
                            fontWeight={highlightFilters.probabilities.includes(prob) ? 'semibold' : 'normal'}
                            border="1px solid"
                            borderColor={highlightFilters.probabilities.includes(prob) ? 'brand/40' : 'border.muted'}
                          >
                            <Text textTransform="capitalize">{prob}</Text> <Text as="span" opacity={0.6}>({stats.byProbability[prob] || 0})</Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>

                    {/* Importance */}
                    <Box>
                      <Flex as="span" fontSize="10px" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" mb="6px" align="center" gap={1}>
                        <Star style={{ width: 12, height: 12 }} /> Importance
                      </Flex>
                      <Flex direction="column" gap={1}>
                        {(['critical', 'high', 'medium', 'low'] as Importance[]).map((imp) => (
                          <Flex
                            as="button"
                            key={imp}
                            onClick={() => toggleHighlightImportance(imp)}
                            w="100%"
                            px={2}
                            py={1}
                            fontSize="10px"
                            rounded="sm"
                            transition="colors"
                            textAlign="left"
                            align="center"
                            justify="space-between"
                            bg={highlightFilters.importance.includes(imp) ? 'brand/12' : 'transparent'}
                            color={highlightFilters.importance.includes(imp) ? 'fg' : 'fg.muted'}
                            fontWeight={highlightFilters.importance.includes(imp) ? 'semibold' : 'normal'}
                            border="1px solid"
                            borderColor={highlightFilters.importance.includes(imp) ? 'brand/40' : 'border.muted'}
                          >
                            <Text textTransform="capitalize">{imp}</Text> <Text as="span" opacity={0.6}>({stats.byImportance[imp] || 0})</Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>

                    {/* Order */}
                    <Box>
                      <Flex as="span" fontSize="10px" color="fg.muted" textTransform="uppercase" letterSpacing="wider" fontWeight="medium" mb="6px" align="center" gap={1}>
                        Order
                      </Flex>
                      <Flex direction="column" gap={1}>
                        {([1, 2, 3, 4, 5].filter(o => consequences.some(c => c.order === o)) as ConsequenceOrder[]).map((ord) => (
                          <Flex
                            as="button"
                            key={ord}
                            onClick={() => toggleHighlightOrder(ord)}
                            w="100%"
                            px={2}
                            py={1}
                            fontSize="10px"
                            rounded="sm"
                            transition="colors"
                            textAlign="left"
                            align="center"
                            justify="space-between"
                            bg={highlightFilters.orders.includes(ord) ? 'brand/12' : 'transparent'}
                            color={highlightFilters.orders.includes(ord) ? 'fg' : 'fg.muted'}
                            fontWeight={highlightFilters.orders.includes(ord) ? 'semibold' : 'normal'}
                            border="1px solid"
                            borderColor={highlightFilters.orders.includes(ord) ? 'brand/40' : 'border.muted'}
                          >
                            {ord === 1 ? '1st Order' : ord === 2 ? '2nd Order' : ord === 3 ? '3rd Order' : `${ord}th Order`} <Text as="span" opacity={0.6}>({stats.byOrder[ord] || 0})</Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>

                    {/* Ideas toggle */}
                    <Box>
                      <Flex
                        as="button"
                        onClick={toggleShowIdeas}
                        w="100%"
                        px="6px"
                        py={1}
                        fontSize="10px"
                        rounded="sm"
                        align="center"
                        gap={1}
                        justify="center"
                        transition="colors"
                        border="1px solid"
                        bg={highlightFilters.showIdeas ? 'brand/12' : 'transparent'}
                        color={highlightFilters.showIdeas ? 'fg' : 'fg.muted'}
                        fontWeight={highlightFilters.showIdeas ? 'semibold' : 'normal'}
                        borderColor={highlightFilters.showIdeas ? 'brand/40' : 'border.muted'}
                      >
                        <Lightbulb style={{ width: 12, height: 12 }} /> Ideas & Solutions <Text as="span" opacity={0.6}>({stats.ideasCount})</Text>
                      </Flex>
                    </Box>
                  </Flex>
                )}
              </Box>
            </Flex>
          )}

          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'seed') return '#0005e9';
              return 'var(--chakra-colors-fg-muted, #94a3b8)';
            }}
            maskColor="rgba(var(--node-overlay-inv, 0,0,0), 0.08)"
          />
        </ReactFlow>

        {/* Center screen progress overlay */}
        {generationPhase !== 'complete' && generationPhase !== 'idle' && (
          <Flex position="absolute" inset={0} align="center" justify="center" pointerEvents="none" zIndex={20}>
            <Box bg="bg.muted" backdropFilter="blur(12px)" rounded="2xl" shadow="2xl" border="1px solid" borderColor="border.muted" px={8} py={6} maxW="md" textAlign="center" pointerEvents="auto">
              <Flex justify="center" mb={4}>
                <Box position="relative">
                  <Loader2 style={{ width: 40, height: 40, color: 'var(--chakra-colors-brand)' }} className="animate-spin" />
                  <Sparkles style={{ width: 20, height: 20, color: '#f59e0b', position: 'absolute', top: -4, right: -4 }} className="animate-pulse" />
                </Box>
              </Flex>
              <Text fontWeight="bold" color="fg" fontSize="lg" mb={1}>
                {generationPhase === 'first-order' ? 'Mapping Direct Consequences' :
                 generationPhase === 'second-order' ? 'Tracing Ripple Effects' :
                 generationPhase === 'third-order' ? 'Discovering Cascade Impacts' :
                 generationPhase === 'solutions' ? 'Generating Solutions & Ideas' :
                 'Analyzing...'}
              </Text>
              <Text fontSize="sm" color="fg.muted" mb={4}>
                {progressMessage || `Phase ${getPhaseNumber(generationPhase)} of ${totalPhases}`}
              </Text>
              <Box w="100%" bg="bg.active" rounded="full" h="10px" overflow="hidden">
                <Box
                  bg="brand"
                  h="10px"
                  rounded="full"
                  transition="all 0.7s ease-out"
                  style={{ width: `${Math.min((getPhaseNumber(generationPhase) / totalPhases) * 100, 100)}%` }}
                />
              </Box>
              <Text fontSize="xs" color="fg.muted" mt={2}>
                {consequences.length > 0 ? `${consequences.length} consequences mapped so far` : 'Starting analysis...'}
              </Text>
            </Box>
          </Flex>
        )}

        {/* Floating prompt bar */}
        {generationPhase === 'complete' && (
          <Box position="absolute" bottom={6} left="50%" transform="translateX(-50%)" w="100%" maxW="2xl" px={4} zIndex={10}>
            <Box bg="bg.muted" backdropFilter="blur(8px)" rounded="2xl" shadow="lg" border="1px solid" borderColor="border.muted" p={3}>
              {promptProgress && (
                <Flex fontSize="xs" color="fg.muted" mb={2} px={2} align="center" gap={2}>
                  {isPrompting && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
                  {promptProgress}
                </Flex>
              )}
              <Flex
                as="form"
                onSubmit={(e: React.FormEvent) => { e.preventDefault(); handlePromptSubmit(); }}
                align="center"
                gap={2}
              >
                {lastExpansionTime && (
                  <Box
                    as="button"
                    type="button"
                    onClick={() => setShowNewHighlight(!showNewHighlight)}
                    p="6px"
                    rounded="lg"
                    transition="colors"
                    flexShrink={0}
                    bg={showNewHighlight ? 'warning/12' : 'transparent'}
                    color={showNewHighlight ? 'warning' : 'fg.muted'}
                    _hover={{ color: 'fg.secondary', bg: 'bg.hover' }}
                    title={showNewHighlight ? 'Hide new highlights' : 'Show new highlights'}
                  >
                    <Sparkles style={{ width: 16, height: 16 }} />
                  </Box>
                )}
                {!lastExpansionTime && <Box as={Sparkles} w="16px" h="16px" color="brand" flexShrink={0} ml={1} />}
                <input
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Push deeper, add wildcards, explore economic impacts..."
                  style={{ flex: 1, background: 'transparent', fontSize: '14px', outline: 'none' }}
                  disabled={isPrompting}
                />
                <Box
                  as="button"
                  type="submit"
                  disabled={!promptText.trim() || isPrompting}
                  p={2}
                  rounded="xl"
                  bg="brand"
                  color="brand.contrast"
                  _hover={{ opacity: 0.9 }}
                  _disabled={{ opacity: 0.4, cursor: 'not-allowed' }}
                  transition="colors"
                  flexShrink={0}
                >
                  {isPrompting ? (
                    <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                  ) : (
                    <Send style={{ width: 16, height: 16 }} />
                  )}
                </Box>
              </Flex>
            </Box>
          </Box>
        )}
      </Box>

      </Flex>
    </Flex>
  );
}

