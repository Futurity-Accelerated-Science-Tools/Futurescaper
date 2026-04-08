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
import { ConsequenceNode, SeedNode } from './ConsequenceNode';
import { DetailPanel } from './DetailPanel';
import { ExportPanel } from './ExportPanel';
import { ArrowLeft, AlertCircle, Lightbulb, FileText, Star, Target, Layers, TrendingUp, TrendingDown, Minus, Plus, Loader2, Expand, X, Send, Sparkles, Zap } from 'lucide-react';
import { expandNodeConsequences, freePromptExpand, generateSolutionIdeas } from '../api/claude';
import { findRelevantSubjects, RelevantSubject } from '../api/subjects';
import { RelatedSubjects } from './RelatedSubjects';

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
}

type ExtendedPhase = 'idle' | 'first-order' | 'second-order' | 'third-order' | 'solutions' | 'complete';

export function FuturescapeMap({ input, onBack, onApiError, importedData }: FuturescapeMapProps) {
  const [consequences, setConsequences] = useState<Consequence[]>(importedData?.consequences || []);
  const [generationPhase, setGenerationPhase] = useState<ExtendedPhase>(importedData ? 'complete' : 'idle');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);
  const [showTLDR, setShowTLDR] = useState(true);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [isExpandingNode, setIsExpandingNode] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isPrompting, setIsPrompting] = useState(false);
  const [promptProgress, setPromptProgress] = useState('');
  const [showNewHighlight, setShowNewHighlight] = useState(false);
  const [lastExpansionTime, setLastExpansionTime] = useState<number | null>(null);
  const [showHighImpact, setShowHighImpact] = useState(false);
  const [relatedSubjects, setRelatedSubjects] = useState<RelevantSubject[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const subjectsRequested = useRef(false);
  const generationStarted = useRef(importedData ? true : false);

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

  // All consequences are shown, but some may be dimmed
  const filteredConsequences = useMemo(() => {
    return consequences; // Show all, dimming handled in node rendering
  }, [consequences]);

  // Stats
  const stats = useMemo(() => {
    const bySentiment = {
      positive: consequences.filter(c => c.sentiment === 'positive').length,
      negative: consequences.filter(c => c.sentiment === 'negative').length,
      neutral: consequences.filter(c => c.sentiment === 'neutral').length,
    };
    const byOrder = {
      1: consequences.filter(c => c.order === 1).length,
      2: consequences.filter(c => c.order === 2).length,
      3: consequences.filter(c => c.order === 3).length,
      4: consequences.filter(c => c.order === 4).length,
      5: consequences.filter(c => c.order === 5).length,
    };
    const byCategory = {
      social: consequences.filter(c => c.category === 'social').length,
      technological: consequences.filter(c => c.category === 'technological').length,
      economic: consequences.filter(c => c.category === 'economic').length,
      environmental: consequences.filter(c => c.category === 'environmental').length,
      political: consequences.filter(c => c.category === 'political').length,
    };
    const criticalCount = consequences.filter(c => c.importance === 'critical').length;
    const highCount = consequences.filter(c => c.importance === 'high').length;
    return { bySentiment, byOrder, byCategory, criticalCount, highCount, total: consequences.length };
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

  // Helper function to determine optimal handle positions based on relative positions
  const getOptimalHandles = (
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number }
  ): { sourceHandle: string; targetHandle: string } => {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180

    // Determine the best exit point from source and entry point to target
    // based on the angle between them
    let sourceHandle: string;
    let targetHandle: string;

    if (angle >= -45 && angle < 45) {
      // Target is to the right
      sourceHandle = 'right-source';
      targetHandle = 'left';
    } else if (angle >= 45 && angle < 135) {
      // Target is below
      sourceHandle = 'bottom-source';
      targetHandle = 'top';
    } else if (angle >= -135 && angle < -45) {
      // Target is above
      sourceHandle = 'top-source';
      targetHandle = 'bottom';
    } else {
      // Target is to the left
      sourceHandle = 'left-source';
      targetHandle = 'right';
    }

    return { sourceHandle, targetHandle };
  };

  // Generate nodes and edges from consequences with improved spacing
  const generateNodesAndEdges = useCallback(
    (allConsequences: Consequence[], filtered: Consequence[]) => {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      // Add seed node at center
      newNodes.push({
        id: 'seed',
        type: 'seed',
        position: { x: 0, y: 0 },
        data: { title: input.title, description: input.description },
      });

      // IMPROVED: Much larger radii for better spacing
      // Calculate radii based on number of nodes per order (now only 3 orders)
      const consequencesByOrder: Record<number, Consequence[]> = {
        1: filtered.filter((c) => c.order === 1),
        2: filtered.filter((c) => c.order === 2),
        3: filtered.filter((c) => c.order === 3),
        4: filtered.filter((c) => c.order === 4),
        5: filtered.filter((c) => c.order === 5),
      };

      // Calculate dynamic radii based on node count (more nodes = larger radius)
      const NODE_WIDTH = 250; // approximate node width
      const MIN_ARC_SPACING = 30; // minimum pixels between nodes on arc

      const calculateRadius = (nodeCount: number, minRadius: number): number => {
        if (nodeCount === 0) return minRadius;
        const circumferenceNeeded = nodeCount * (NODE_WIDTH + MIN_ARC_SPACING);
        const radiusFromCircumference = circumferenceNeeded / (2 * Math.PI);
        return Math.max(minRadius, radiusFromCircumference);
      };

      const orderRadii: Record<number, number> = {
        1: calculateRadius(consequencesByOrder[1].length, 500),
        2: calculateRadius(consequencesByOrder[2].length, 900),
        3: calculateRadius(consequencesByOrder[3].length, 1400),
        4: calculateRadius(consequencesByOrder[4].length, 1900),
        5: calculateRadius(consequencesByOrder[5].length, 2400),
      };

      // Track positions for connecting edges
      const nodePositions: Record<string, { x: number; y: number }> = {
        seed: { x: 0, y: 0 },
      };

      // Place first-order consequences in a circle around the seed
      consequencesByOrder[1].forEach((c, idx) => {
        const angle = (idx / consequencesByOrder[1].length) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * orderRadii[1];
        const y = Math.sin(angle) * orderRadii[1];

        nodePositions[c.id] = { x, y };
        const isDimmed = !isHighlighted(c);

        newNodes.push({
          id: c.id,
          type: 'consequence',
          position: { x, y },
          data: {
            consequence: c,
            isGenerating: generationPhase === 'first-order',
            isDimmed,
            isNewlyExpanded: showNewHighlight && !!c.expandedAt && c.expandedAt === lastExpansionTime,
            onClick: setSelectedNodeId,
          },
        });

        // Calculate optimal handle positions based on node positions
        const { sourceHandle, targetHandle } = getOptimalHandles(
          nodePositions['seed'],
          { x, y }
        );

        newEdges.push({
          id: `edge-seed-${c.id}`,
          source: 'seed',
          target: c.id,
          sourceHandle,
          targetHandle,
          type: 'default',
          style: {
            stroke: getSentimentColors(c.sentiment).border,
            strokeWidth: isDimmed ? 1 : 2,
            opacity: isDimmed ? 0.2 : 0.7,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: getSentimentColors(c.sentiment).border,
            width: 15,
            height: 15,
          },
          animated: generationPhase === 'first-order',
        });
      });

      // Group higher-order consequences by their parents for better distribution
      [2, 3, 4, 5].forEach(order => {
        const orderConsequences = consequencesByOrder[order];
        if (orderConsequences.length === 0) return;

        // Group by parent
        const byParent: Record<string, Consequence[]> = {};
        orderConsequences.forEach(c => {
          const parentId = c.parentId || 'seed';
          if (!byParent[parentId]) byParent[parentId] = [];
          byParent[parentId].push(c);
        });

        // Distribute each group around their parent
        Object.entries(byParent).forEach(([parentId, children]) => {
          const parentPos = nodePositions[parentId] || { x: 0, y: 0 };
          const parentAngleFromCenter = Math.atan2(parentPos.y, parentPos.x);

          // Calculate spread angle based on number of children
          // More children = wider spread
          const maxSpread = Math.PI / 2; // 90 degrees max
          const spreadPerChild = Math.min(Math.PI / 6, maxSpread / Math.max(children.length, 1));

          children.forEach((c, idx) => {
            // Distribute children in an arc emanating outward from parent
            const centerIdx = (children.length - 1) / 2;
            const offsetFromCenter = idx - centerIdx;
            const angle = parentAngleFromCenter + offsetFromCenter * spreadPerChild;

            // Distance from parent based on order
            const baseDistance = 350 + (order - 2) * 100;
            // Add some randomness to prevent perfect alignment
            const jitter = (Math.sin(idx * 7.3) * 30); // deterministic "random"
            const distance = baseDistance + jitter;

            const x = parentPos.x + Math.cos(angle) * distance;
            const y = parentPos.y + Math.sin(angle) * distance;

            nodePositions[c.id] = { x, y };
            const isDimmed = !isHighlighted(c);

            const phaseMap: Record<number, ExtendedPhase> = {
              2: 'second-order',
              3: 'third-order',
              4: 'complete',
              5: 'complete',
            };

            newNodes.push({
              id: c.id,
              type: 'consequence',
              position: { x, y },
              data: {
                consequence: c,
                isGenerating: generationPhase === phaseMap[order],
                isDimmed,
                isNewlyExpanded: showNewHighlight && !!c.expandedAt && c.expandedAt === lastExpansionTime,
                onClick: setSelectedNodeId,
              },
            });

            if (nodePositions[parentId]) {
              const isWildcard = c.probability === 'wildcard';
              const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
              const edgeColor = isSolOrIdea ? SOLUTION_COLORS.border : isWildcard ? '#8b5cf6' : getSentimentColors(c.sentiment).border;

              // Calculate optimal handle positions
              const { sourceHandle, targetHandle } = getOptimalHandles(
                parentPos,
                { x, y }
              );

              newEdges.push({
                id: `edge-${parentId}-${c.id}`,
                source: parentId,
                target: c.id,
                sourceHandle,
                targetHandle,
                type: 'default',
                style: {
                  stroke: edgeColor,
                  strokeWidth: isDimmed ? 1 : 2,
                  strokeDasharray: isSolOrIdea ? '8,4' : isWildcard ? '5,5' : undefined,
                  opacity: isDimmed ? 0.2 : 0.6,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: edgeColor,
                  width: 12,
                  height: 12,
                },
                animated: generationPhase === phaseMap[order],
              });
            }
          });
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [input, generationPhase, setNodes, setEdges, isHighlighted, showNewHighlight, lastExpansionTime]
  );

  // Update visualization when consequences or highlight filters change
  useEffect(() => {
    generateNodesAndEdges(consequences, filteredConsequences);
  }, [consequences, filteredConsequences, generateNodesAndEdges, highlightFilters]);

  // Generation flow - using real Claude API or mock data
  useEffect(() => {
    // Skip if already started, paused, or we have imported data
    if (generationStarted.current || isPaused || importedData) return;
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
  }, [input, isPaused, useMockData, importedData]);

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
    setSelectedNodeId(null);
  };

  // Expand node - generate 2-4 more consequences from a selected node
  const handleExpandNode = async (nodeId: string) => {
    const nodeToExpand = consequences.find(c => c.id === nodeId);
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
    const targetNode = consequences.find(c => c.id === nodeId);
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

  // Add manual node
  const handleAddManualNode = (nodeData: {
    text: string;
    category: STEEPCategory;
    sentiment: Sentiment;
    parentId?: string;
  }) => {
    const parentNode = nodeData.parentId ? consequences.find(c => c.id === nodeData.parentId) : null;
    const newOrder: ConsequenceOrder = parentNode ? (Math.min(parentNode.order + 1, 5) as ConsequenceOrder) : 1;

    const newConsequence: Consequence = {
      id: `manual-${Date.now()}`,
      text: nodeData.text,
      category: nodeData.category,
      sentiment: nodeData.sentiment,
      order: newOrder,
      parentId: nodeData.parentId || 'seed',
      probability: 'plausible',
      importance: 'medium',
      isManual: true,
    };

    setConsequences(prev => [...prev, newConsequence]);
    setShowAddNodeModal(false);
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

  const selectedConsequence = consequences.find((c) => c.id === selectedNodeId);

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

          {/* Add Manual Node Button */}
          {generationPhase === 'complete' && (
            <button
              onClick={() => setShowAddNodeModal(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-seed border border-seed rounded-lg hover:bg-seed hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Manual Node
            </button>
          )}
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
                        <li key={c.id} className="text-xs text-slate-600 pl-3 border-l-2 border-red-200 leading-relaxed">
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
                        <li key={c.id} className="text-xs text-slate-600 pl-3 border-l-2 border-green-200 leading-relaxed">
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

        {/* Highlight Filters - dims non-matching nodes */}
        {consequences.length > 0 && (
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700">Highlight Filters</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleHighImpact}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                    showHighImpact
                      ? 'bg-orange-100 text-orange-600 border border-orange-300'
                      : 'bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200'
                  }`}
                  title={showHighImpact ? 'Show all nodes' : 'Show only probable/plausible + critical/high'}
                >
                  <Zap className="w-3 h-3" />
                  {showHighImpact ? 'Key Only' : 'Key Only'}
                </button>
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Importance */}
            <div className="mb-3">
              <span className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                <Star className="w-3 h-3" /> Importance
              </span>
              <div className="flex flex-wrap gap-1">
                {(['critical', 'high', 'medium', 'low'] as Importance[]).map((imp) => (
                  <button
                    key={imp}
                    onClick={() => toggleHighlightImportance(imp)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      highlightFilters.importance.includes(imp)
                        ? imp === 'critical' ? 'bg-amber-100 text-amber-700 border border-amber-300'
                          : imp === 'high' ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {imp}
                  </button>
                ))}
              </div>
            </div>

            {/* Probability */}
            <div className="mb-3">
              <span className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                <Target className="w-3 h-3" /> Probability
              </span>
              <div className="flex flex-wrap gap-1">
                {(['probable', 'plausible', 'possible', 'wildcard'] as Probability[]).map((prob) => (
                  <button
                    key={prob}
                    onClick={() => toggleHighlightProbability(prob)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      highlightFilters.probabilities.includes(prob)
                        ? 'bg-slate-200 text-slate-700 border border-slate-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                    style={highlightFilters.probabilities.includes(prob) ? {
                      backgroundColor: `${PROBABILITY_COLORS[prob]}20`,
                      borderColor: PROBABILITY_COLORS[prob],
                      color: PROBABILITY_COLORS[prob],
                    } : {}}
                  >
                    {prob}
                  </button>
                ))}
              </div>
            </div>

            {/* STEEP Category */}
            <div className="mb-3">
              <span className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                <Layers className="w-3 h-3" /> Category
              </span>
              <div className="flex flex-wrap gap-1">
                {(['social', 'technological', 'economic', 'environmental', 'political', 'ethical'] as STEEPCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleHighlightCategory(cat)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      highlightFilters.categories.includes(cat)
                        ? 'border'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                    style={highlightFilters.categories.includes(cat) ? {
                      backgroundColor: `${STEEP_COLORS[cat]}20`,
                      borderColor: STEEP_COLORS[cat],
                      color: STEEP_COLORS[cat],
                    } : {}}
                  >
                    {STEEP_LABELS[cat].slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sentiment & Ideas */}
            <div className="mb-3">
              <span className="text-xs text-slate-500 mb-1.5 block">Sentiment</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => toggleHighlightSentiment('positive')}
                  className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors border ${
                    highlightFilters.sentiments.includes('positive')
                      ? ''
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  style={highlightFilters.sentiments.includes('positive') ? {
                    backgroundColor: '#e6fff5',
                    borderColor: '#00d4aa',
                    color: '#0a6847',
                  } : {}}
                >
                  <TrendingUp className="w-3 h-3" /> +
                </button>
                <button
                  onClick={() => toggleHighlightSentiment('negative')}
                  className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors border ${
                    highlightFilters.sentiments.includes('negative')
                      ? ''
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  style={highlightFilters.sentiments.includes('negative') ? {
                    backgroundColor: '#fff0f3',
                    borderColor: '#ff4d6d',
                    color: '#a4133c',
                  } : {}}
                >
                  <TrendingDown className="w-3 h-3" /> −
                </button>
                <button
                  onClick={() => toggleHighlightSentiment('neutral')}
                  className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${
                    highlightFilters.sentiments.includes('neutral')
                      ? 'bg-slate-200 text-slate-700 border border-slate-400'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  <Minus className="w-3 h-3" /> ○
                </button>
                <button
                  onClick={toggleShowIdeas}
                  className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors border ${
                    highlightFilters.showIdeas
                      ? ''
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                  style={highlightFilters.showIdeas ? {
                    backgroundColor: '#fff7e6',
                    borderColor: '#ff9f1c',
                    color: '#7a4100',
                  } : {}}
                >
                  <Lightbulb className="w-3 h-3" /> Ideas
                </button>
              </div>
            </div>

            {/* Order */}
            <div>
              <span className="text-xs text-slate-500 mb-1.5 block">Order</span>
              <div className="flex flex-wrap gap-1">
                {([1, 2, 3, 4, 5].filter(o => consequences.some(c => c.order === o)) as ConsequenceOrder[]).map((ord) => (
                  <button
                    key={ord}
                    onClick={() => toggleHighlightOrder(ord)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      highlightFilters.orders.includes(ord)
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {ord}°
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Related Subjects Panel */}
        <RelatedSubjects
          subjects={relatedSubjects}
          isLoading={isLoadingSubjects}
          onRetry={handleRetrySubjects}
        />

        {selectedConsequence && (
          <DetailPanel
            consequence={selectedConsequence}
            allConsequences={consequences}
            onClose={() => setSelectedNodeId(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onExpand={handleExpandNode}
            onGenerateIdeas={handleGenerateIdeas}
            isExpanding={isExpandingNode}
            isGeneratingIdeas={isGeneratingIdeas}
          />
        )}

        <ExportPanel consequences={consequences} input={input} solutions={[]} />
      </div>

      {/* Main map area */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
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

      {/* Add Manual Node Modal */}
      {showAddNodeModal && (
        <AddNodeModal
          onClose={() => setShowAddNodeModal(false)}
          onAdd={handleAddManualNode}
          consequences={consequences}
        />
      )}
    </div>
  );
}

// Add Node Modal Component
function AddNodeModal({
  onClose,
  onAdd,
  consequences,
}: {
  onClose: () => void;
  onAdd: (data: { text: string; category: STEEPCategory; sentiment: Sentiment; parentId?: string }) => void;
  consequences: Consequence[];
}) {
  const [text, setText] = React.useState('');
  const [category, setCategory] = React.useState<STEEPCategory>('social');
  const [sentiment, setSentiment] = React.useState<Sentiment>('neutral');
  const [parentId, setParentId] = React.useState<string>('seed');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd({
        text: text.trim(),
        category,
        sentiment,
        parentId: parentId === 'seed' ? undefined : parentId,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Add Manual Node</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Consequence Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Consequence Description
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-seed focus:border-seed"
              rows={3}
              placeholder="Describe the consequence..."
              required
            />
          </div>

          {/* Parent Node */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Flows From (Parent)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-seed focus:border-seed"
            >
              <option value="seed">🌱 Seed (Main Scenario)</option>
              {consequences.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.order}° - {c.text.slice(0, 50)}...
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              STEEP Category
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['social', 'technological', 'economic', 'environmental', 'political', 'ethical'] as STEEPCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    category === cat
                      ? 'border-seed bg-seed text-white'
                      : 'border-slate-300 hover:border-seed hover:text-seed'
                  }`}
                >
                  {cat.slice(0, 4).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sentiment
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSentiment('positive')}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                  sentiment === 'positive'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-300 hover:border-green-500'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Positive
              </button>
              <button
                type="button"
                onClick={() => setSentiment('neutral')}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                  sentiment === 'neutral'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-300 hover:border-amber-500'
                }`}
              >
                <Minus className="w-4 h-4" /> Neutral
              </button>
              <button
                type="button"
                onClick={() => setSentiment('negative')}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                  sentiment === 'negative'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-300 hover:border-red-500'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Negative
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-sm font-medium text-white bg-seed rounded-lg hover:bg-seed-dark"
            >
              Add Node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
