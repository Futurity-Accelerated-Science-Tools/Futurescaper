import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
  getSentimentColors,
  STEEP_COLORS,
  STEEP_LABELS,
  PROBABILITY_COLORS,
  ORDER_LABELS,
  SOLUTION_COLORS,
} from '../types';
import { generateComprehensiveFuturescape, hasApiKey, GenerationPhase } from '../api/claude';
import { generateConsequences } from '../mockData';
import { ConsequenceNode, SeedNode, ConsequenceNodeData } from './ConsequenceNode';
import { ExportPanel } from './ExportPanel';
import { ArrowLeft, AlertCircle, Lightbulb, FileText, Star, Target, Layers, TrendingUp, TrendingDown, Minus, Loader2, X, Send, Sparkles, Zap, Hammer, LayoutGrid, Filter, ChevronRight, ChevronLeft } from 'lucide-react';
import { expandNodeConsequences, freePromptExpand, generateSolutionIdeas, generateConsequencesWithAI, generateChildConsequencesWithAI } from '../api/claude';
import { findRelevantSubjects, RelevantSubject } from '../api/subjects';
import { RelatedSubjects } from './RelatedSubjects';
import { computeRadialLayout, resolveCollisions, getOptimalHandles, computeFocusPositions, Position } from '../layout';

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
}

type ExtendedPhase = 'idle' | 'first-order' | 'second-order' | 'third-order' | 'solutions' | 'complete';

export function FuturescapeMap({ input, onBack, onApiError, importedData, manualMode = false }: FuturescapeMapProps) {
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

  // Computed: is comprehensive generation currently running?
  const isGenerationRunning = generationPhase !== 'complete' && generationPhase !== 'idle';

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

  const handleSeedGenerateChildren = useCallback(async () => {
    setIsGeneratingChildrenFor('seed');
    setActiveNodeId(null);

    // Create 20 placeholder nodes
    const placeholderIds: string[] = [];
    const placeholders: Consequence[] = [];
    for (let i = 0; i < 20; i++) {
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
      const realConsequences = await generateConsequencesWithAI(input, 1, []);
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
  }, [input]);

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

  const handleGenerateChildren = useCallback(async (parentId: string) => {
    const parent = consequenceMap.get(parentId);
    if (!parent) return;

    setIsGeneratingChildrenFor(parentId);
    setActiveNodeId(null);

    // Create 3 placeholder nodes
    const newOrder = Math.min(parent.order + 1, 5) as ConsequenceOrder;
    const placeholderIds: string[] = [];
    const placeholders: Consequence[] = [];
    for (let i = 0; i < 3; i++) {
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
      const realConsequences = await generateChildConsequencesWithAI(input, parent);
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
  }, [consequences, input]);

  const handleRadialGenerateIdeas = useCallback(async (nodeId: string) => {
    const targetNode = consequenceMap.get(nodeId);
    if (!targetNode) return;

    setIsGeneratingIdeasFor(nodeId);
    setActiveNodeId(null);

    // Create 2 placeholder nodes for ideas
    const newOrder = Math.min(targetNode.order + 1, 5) as ConsequenceOrder;
    const placeholderIds: string[] = [];
    const placeholders: Consequence[] = [];
    for (let i = 0; i < 2; i++) {
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
      const newIdeas = await generateSolutionIdeas(input, targetNode, consequences);
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
  }, [consequences, input]);

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
    const phaseMap: Record<number, ExtendedPhase> = {
      1: 'first-order', 2: 'second-order', 3: 'third-order', 4: 'complete', 5: 'complete',
    };

    // Compute ancestor chain for z-index elevation
    const elevatedNodes = getAncestorChain(activeNodeId);
    const hasElevation = elevatedNodes.size > 0;

    for (const c of allConsequences) {
      const parentId = c.parentId || 'seed';
      const parentPos = positionMap.get(parentId);
      const childPos = positionMap.get(c.id);
      if (!parentPos || !childPos) continue;

      const isDimmed = !isHighlighted(c);
      const isWildcard = c.probability === 'wildcard';
      const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
      const edgeColor = isSolOrIdea ? SOLUTION_COLORS.border : isWildcard ? '#8b5cf6' : getSentimentColors(c.sentiment).border;
      const { sourceHandle, targetHandle } = getOptimalHandles(parentPos, childPos);
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
          strokeWidth: isDimmed ? 1 : (isElevated ? 4 : 2),
          strokeDasharray: isSolOrIdea ? '8,4' : isWildcard ? '5,5' : undefined,
          opacity: isDimmed ? 0.15 : (isElevated ? 1 : (c.order === 1 ? 0.7 : 0.6)),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: isElevated ? 18 : (c.order === 1 ? 15 : 12),
          height: isElevated ? 18 : (c.order === 1 ? 15 : 12),
        },
        animated: generationPhase === phaseMap[c.order],
      });
    }
    return newEdges;
  }, [isHighlighted, generationPhase, getAncestorChain, activeNodeId]);

  // ─── Build data object for a single consequence node ───────────
  const buildConsequenceData = useCallback((c: Consequence): ConsequenceNodeData => {
    const isPlaceholderNode = c.id.startsWith('placeholder-');
    const phaseMap: Record<number, ExtendedPhase> = {
      1: 'first-order', 2: 'second-order', 3: 'third-order', 4: 'complete', 5: 'complete',
    };
    return {
      consequence: c,
      isGenerating: generationPhase === phaseMap[c.order],
      isDimmed: !isHighlighted(c),
      isNewlyExpanded: showNewHighlight && !!c.expandedAt && c.expandedAt === lastExpansionTime,
      isSelected: activeNodeId === c.id,
      isEditing: editingNodeId === c.id,
      isGeneratingChildren: isGeneratingChildrenFor === c.id,
      isGeneratingIdeas: isGeneratingIdeasFor === c.id,
      isPlaceholder: isPlaceholderNode,
      isGenerationInProgress: isGenerationRunning,
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
    const layoutPositions = computeRadialLayout(consequences, existingPositions);
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
        updated.push({
          id: c.id,
          type: 'consequence',
          position: pos,
          draggable: !c.id.startsWith('placeholder-') && editingNodeId !== c.id,
          zIndex: hasElevation && elevatedNodes.has(c.id) ? (activeNodeId === c.id ? 1001 : 1000) : undefined,
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

    setEdges(buildEdges(consequences, allPositions));
    prevConsequenceIdsRef.current = currentIds;

    // If new nodes were added, zoom to fit all nodes after a short delay
    if (addedIds.size > 0) {
      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 400 });
      }, 100);
    }
  }, [consequences, consequenceMap, input, activeNodeId, editingNodeId,
      isGeneratingChildrenFor, isGenerationRunning, getAncestorChain,
      handleSeedClick, handleSeedAddChild, handleSeedGenerateChildren,
      buildConsequenceData, buildEdges, setNodes, setEdges]);

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
      return {
        ...n,
        zIndex: hasElevation && elevatedNodes.has(n.id) ? (activeNodeId === n.id ? 1001 : 1000) : undefined,
        draggable: !c.id.startsWith('placeholder-') && editingNodeId !== c.id,
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
        const edgeColor = isSolOrIdea ? SOLUTION_COLORS.border : isWildcard ? '#8b5cf6' : getSentimentColors(c.sentiment).border;
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
    const freshPositions = computeRadialLayout(consequences);
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
          const result = await generateComprehensiveFuturescape(input, {
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
          });
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

    findRelevantSubjects(input, consequences)
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
    findRelevantSubjects(input, consequences)
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
      const newIdeas = await generateSolutionIdeas(input, targetNode, consequences);
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
        input,
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
    <div className="h-screen flex">
      {/* Left sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="font-bold text-slate-900 mb-1">{input.title}</h2>
          <p className="text-sm text-slate-600 max-h-32 overflow-y-auto">{input.description}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Generation Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="flex gap-2 mt-3">
                  {(error.toLowerCase().includes('api key') ||
                    error.toLowerCase().includes('authentication') ||
                    error.toLowerCase().includes('invalid') ||
                    error.toLowerCase().includes('401') ||
                    error.toLowerCase().includes('unauthorized')) && onApiError && (
                    <button
                      onClick={onApiError}
                      className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Change API Key
                    </button>
                  )}
                  <button
                    onClick={handleRetryWithMock}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Use Demo Mode
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generation Progress */}
        <div className="p-4 border-b border-slate-200">
          {manualMode ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Hammer className="w-4 h-4 text-slate-500" />
              <div>
                <span className="font-semibold text-slate-700">Manual Mode</span>
                <p className="text-xs text-slate-500 mt-1">Click the seed node to add children or AI-generate consequences. Click any node for more actions.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Generation Progress</span>
                <span className="text-xs text-slate-500">
                  {generationPhase === 'complete' ? `${totalPhases}/${totalPhases}` : `${getPhaseNumber(generationPhase)}/${totalPhases}`}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className="bg-seed h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((getPhaseNumber(generationPhase) / totalPhases) * 100, 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-500">
                {generationPhase === 'complete' ? (
                  <span className="text-green-600 font-medium">✓ Analysis complete ({stats.total} consequences)</span>
                ) : (
                  progressMessage || `Analyzing ${generationPhase}...`
                )}
              </div>
            </>
          )}
        </div>

        {/* TLDR Summary */}
        {tldrSummary && generationPhase === 'complete' && (
          <div className="p-4 border-b border-slate-200">
            <button
              onClick={() => setShowTLDR(!showTLDR)}
              className="flex items-center gap-2 w-full text-left mb-2"
            >
              <FileText className="w-4 h-4 text-seed" />
              <span className="text-sm font-semibold text-slate-700">TL;DR Summary</span>
              <span className="ml-auto text-xs text-slate-400">{showTLDR ? '▼' : '▶'}</span>
            </button>
            {showTLDR && (
              <div className="space-y-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-700 mb-2">
                    <strong>{tldrSummary.totalConsequences}</strong> consequences identified:
                    {' '}<span className="text-red-600">{tldrSummary.negativePercent}% concerning</span>,
                    {' '}<span className="text-green-600">{tldrSummary.positivePercent}% positive</span>
                    {tldrSummary.criticalCount > 0 && (
                      <span className="text-amber-600"> ({tldrSummary.criticalCount} critical)</span>
                    )}
                  </p>
                  {tldrSummary.dominantCategory && (
                    <p className="text-slate-600 text-xs">
                      Primary impact area: <span className="font-medium">{STEEP_LABELS[tldrSummary.dominantCategory]}</span>
                    </p>
                  )}
                </div>

                {tldrSummary.topConcerns.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Top Concerns
                    </h4>
                    <ul className="space-y-2">
                      {tldrSummary.topConcerns.map((c) => (
                        <li
                          key={c.id}
                          onClick={() => setActiveNodeId(c.id)}
                          className="text-xs text-slate-600 pl-3 border-l-2 border-red-200 leading-relaxed cursor-pointer hover:text-slate-900 hover:border-red-400 transition-colors"
                        >
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tldrSummary.topOpportunities.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Top Opportunities
                    </h4>
                    <ul className="space-y-2">
                      {tldrSummary.topOpportunities.map((c) => (
                        <li
                          key={c.id}
                          onClick={() => setActiveNodeId(c.id)}
                          className="text-xs text-slate-600 pl-3 border-l-2 border-green-200 leading-relaxed cursor-pointer hover:text-slate-900 hover:border-green-400 transition-colors"
                        >
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Related Subjects Panel */}
        <RelatedSubjects
          subjects={relatedSubjects}
          isLoading={isLoadingSubjects}
          onRetry={handleRetrySubjects}
        />

        <ExportPanel consequences={consequences} input={input} solutions={[]} />
      </div>

      {/* Main map area */}
      <div ref={mapContainerRef} className={`flex-1 relative ${focusAnimClass} ${activeNodeId && activeNodeId !== 'seed' ? 'has-focus-path' : ''}`}>
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
          <Background color="#e8e8f0" gap={20} />
          <Controls />

          {/* Tidy Layout button */}
          {generationPhase === 'complete' && consequences.length > 0 && (
            <div className={`absolute top-4 z-10 ${filterPanelCollapsed ? 'right-16' : 'right-[236px]'}`} style={{ transition: 'right 0.2s ease' }}>
              <button
                onClick={handleTidyLayout}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                title="Reset layout to clean radial arrangement"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Tidy Layout
              </button>
            </div>
          )}

          {/* ─── Filter Panel (right side of map) ─── */}
          {consequences.length > 0 && (
            <div
              className="absolute top-0 right-0 bottom-0 z-10 flex"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="h-full bg-white shadow-lg border-l border-slate-200 overflow-y-auto"
                style={{
                  width: filterPanelCollapsed ? '44px' : '240px',
                  transition: 'width 0.2s ease',
                  pointerEvents: 'auto',
                }}
              >
                {/* Collapse toggle */}
                <div className="sticky top-0 bg-white z-10 border-b border-slate-100">
                  <button
                    onClick={() => setFilterPanelCollapsed(prev => !prev)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    title={filterPanelCollapsed ? 'Expand filters' : 'Collapse filters'}
                  >
                    <Filter className="w-3.5 h-3.5 flex-shrink-0" />
                    {!filterPanelCollapsed && (
                      <>
                        <span className="flex-1 text-left">Filters</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {filterPanelCollapsed ? (
                  /* ── Collapsed: icon strip ── */
                  <div className="flex flex-col items-center gap-1 py-2">
                    <button onClick={() => setFilterPanelCollapsed(false)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Category"><Layers className="w-4 h-4" /></button>
                    <button onClick={() => setFilterPanelCollapsed(false)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Sentiment"><TrendingUp className="w-4 h-4" /></button>
                    <button onClick={() => setFilterPanelCollapsed(false)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Probability"><Target className="w-4 h-4" /></button>
                    <button onClick={() => setFilterPanelCollapsed(false)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" title="Importance"><Star className="w-4 h-4" /></button>
                    <div className="w-6 border-t border-slate-200 my-1" />
                    <button onClick={resetFilters} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400" title="Reset filters"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  /* ── Expanded: full filters ── */
                  <div className="px-3 py-2 space-y-3">
                    {/* Quick actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleHighImpact}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors flex-1 justify-center ${
                          showHighImpact
                            ? 'bg-orange-100 text-orange-600 border border-orange-300'
                            : 'bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Zap className="w-3 h-3" /> Key Only
                      </button>
                      <button
                        onClick={resetFilters}
                        className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 rounded-md"
                      >
                        Reset
                      </button>
                    </div>

                    {/* STEEP Category */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Category
                      </span>
                      <div className="flex flex-col gap-1">
                        {(['social', 'technological', 'economic', 'environmental', 'political', 'ethical'] as STEEPCategory[]).map((cat) => (
                          <button
                            key={cat}
                            onClick={() => toggleHighlightCategory(cat)}
                            className={`w-full px-2 py-1 text-[10px] rounded transition-colors text-left flex items-center justify-between ${
                              highlightFilters.categories.includes(cat) ? 'border' : 'bg-slate-50 text-slate-400 border border-slate-200'
                            }`}
                            style={highlightFilters.categories.includes(cat) ? {
                              backgroundColor: `${STEEP_COLORS[cat]}20`,
                              borderColor: STEEP_COLORS[cat],
                              color: STEEP_COLORS[cat],
                            } : {}}
                          >
                            {STEEP_LABELS[cat]} <span className="opacity-60">({stats.byCategory[cat] || 0})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sentiment */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                        Sentiment
                      </span>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleHighlightSentiment('positive')}
                          className={`w-full px-2 py-1 text-[10px] rounded flex items-center gap-1.5 transition-colors border text-left ${
                            highlightFilters.sentiments.includes('positive') ? '' : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                          style={highlightFilters.sentiments.includes('positive') ? { backgroundColor: '#e6fff5', borderColor: '#00d4aa', color: '#0a6847' } : {}}
                        >
                          <TrendingUp className="w-2.5 h-2.5 flex-shrink-0" /> <span className="flex-1">Positive</span> <span className="opacity-60">({stats.bySentiment.positive})</span>
                        </button>
                        <button
                          onClick={() => toggleHighlightSentiment('negative')}
                          className={`w-full px-2 py-1 text-[10px] rounded flex items-center gap-1.5 transition-colors border text-left ${
                            highlightFilters.sentiments.includes('negative') ? '' : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                          style={highlightFilters.sentiments.includes('negative') ? { backgroundColor: '#fff0f3', borderColor: '#ff4d6d', color: '#a4133c' } : {}}
                        >
                          <TrendingDown className="w-2.5 h-2.5 flex-shrink-0" /> <span className="flex-1">Negative</span> <span className="opacity-60">({stats.bySentiment.negative})</span>
                        </button>
                        <button
                          onClick={() => toggleHighlightSentiment('neutral')}
                          className={`w-full px-2 py-1 text-[10px] rounded flex items-center gap-1.5 transition-colors text-left ${
                            highlightFilters.sentiments.includes('neutral')
                              ? 'bg-slate-200 text-slate-700 border border-slate-400'
                              : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}
                        >
                          <Minus className="w-2.5 h-2.5 flex-shrink-0" /> <span className="flex-1">Neutral</span> <span className="opacity-60">({stats.bySentiment.neutral})</span>
                        </button>
                      </div>
                    </div>

                    {/* Probability */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Probability
                      </span>
                      <div className="flex flex-col gap-1">
                        {(['probable', 'plausible', 'possible', 'wildcard'] as Probability[]).map((prob) => (
                          <button
                            key={prob}
                            onClick={() => toggleHighlightProbability(prob)}
                            className={`w-full px-2 py-1 text-[10px] rounded transition-colors text-left flex items-center justify-between ${
                              highlightFilters.probabilities.includes(prob) ? 'border' : 'bg-slate-50 text-slate-400 border border-slate-200'
                            }`}
                            style={highlightFilters.probabilities.includes(prob) ? {
                              backgroundColor: `${PROBABILITY_COLORS[prob]}20`,
                              borderColor: PROBABILITY_COLORS[prob],
                              color: PROBABILITY_COLORS[prob],
                            } : {}}
                          >
                            <span className="capitalize">{prob}</span> <span className="opacity-60">({stats.byProbability[prob] || 0})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Importance */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                        <Star className="w-3 h-3" /> Importance
                      </span>
                      <div className="flex flex-col gap-1">
                        {(['critical', 'high', 'medium', 'low'] as Importance[]).map((imp) => (
                          <button
                            key={imp}
                            onClick={() => toggleHighlightImportance(imp)}
                            className={`w-full px-2 py-1 text-[10px] rounded transition-colors text-left flex items-center justify-between ${
                              highlightFilters.importance.includes(imp)
                                ? imp === 'critical' ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                  : imp === 'high' ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : 'bg-slate-200 text-slate-700 border border-slate-300'
                                : 'bg-slate-50 text-slate-400 border border-slate-200'
                            }`}
                          >
                            <span className="capitalize">{imp}</span> <span className="opacity-60">({stats.byImportance[imp] || 0})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Order */}
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
                        Order
                      </span>
                      <div className="flex flex-col gap-1">
                        {([1, 2, 3, 4, 5].filter(o => consequences.some(c => c.order === o)) as ConsequenceOrder[]).map((ord) => (
                          <button
                            key={ord}
                            onClick={() => toggleHighlightOrder(ord)}
                            className={`w-full px-2 py-1 text-[10px] rounded transition-colors text-left flex items-center justify-between ${
                              highlightFilters.orders.includes(ord)
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                : 'bg-slate-50 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {ord === 1 ? '1st Order' : ord === 2 ? '2nd Order' : ord === 3 ? '3rd Order' : `${ord}th Order`} <span className="opacity-60">({stats.byOrder[ord] || 0})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ideas toggle */}
                    <div>
                      <button
                        onClick={toggleShowIdeas}
                        className={`w-full px-1.5 py-1 text-[10px] rounded flex items-center gap-1 justify-center transition-colors border ${
                          highlightFilters.showIdeas ? '' : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}
                        style={highlightFilters.showIdeas ? { backgroundColor: '#fff7e6', borderColor: '#ff9f1c', color: '#7a4100' } : {}}
                      >
                        <Lightbulb className="w-3 h-3" /> Ideas & Solutions <span className="opacity-60">({stats.ideasCount})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'seed') return '#2b6cb0';
              const consequence = node.data?.consequence as Consequence;
              if (consequence) {
                return getSentimentColors(consequence.sentiment).border;
              }
              return '#94a3b8';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>

        {/* Center screen progress overlay */}
        {generationPhase !== 'complete' && generationPhase !== 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 px-8 py-6 max-w-md text-center pointer-events-auto">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Loader2 className="w-10 h-10 text-seed animate-spin" />
                  <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">
                {generationPhase === 'first-order' ? 'Mapping Direct Consequences' :
                 generationPhase === 'second-order' ? 'Tracing Ripple Effects' :
                 generationPhase === 'third-order' ? 'Discovering Cascade Impacts' :
                 generationPhase === 'solutions' ? 'Generating Solutions & Ideas' :
                 'Analyzing...'}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {progressMessage || `Phase ${getPhaseNumber(generationPhase)} of ${totalPhases}`}
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-seed h-2.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min((getPhaseNumber(generationPhase) / totalPhases) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {consequences.length > 0 ? `${consequences.length} consequences mapped so far` : 'Starting analysis...'}
              </p>
            </div>
          </div>
        )}

        {/* Floating prompt bar */}
        {generationPhase === 'complete' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-10">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 p-3">
              {promptProgress && (
                <div className="text-xs text-slate-500 mb-2 px-2 flex items-center gap-2">
                  {isPrompting && <Loader2 className="w-3 h-3 animate-spin" />}
                  {promptProgress}
                </div>
              )}
              <form
                onSubmit={(e) => { e.preventDefault(); handlePromptSubmit(); }}
                className="flex items-center gap-2"
              >
                {lastExpansionTime && (
                  <button
                    type="button"
                    onClick={() => setShowNewHighlight(!showNewHighlight)}
                    className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                      showNewHighlight
                        ? 'bg-amber-100 text-amber-600'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                    title={showNewHighlight ? 'Hide new highlights' : 'Show new highlights'}
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                )}
                {!lastExpansionTime && <Sparkles className="w-4 h-4 text-seed flex-shrink-0 ml-1" />}
                <input
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Push deeper, add wildcards, explore economic impacts..."
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
                  disabled={isPrompting}
                />
                <button
                  type="submit"
                  disabled={!promptText.trim() || isPrompting}
                  className="p-2 rounded-xl bg-seed text-white hover:bg-seed-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {isPrompting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

