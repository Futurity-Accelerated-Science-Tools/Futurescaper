/**
 * FuturescapeViewer — Read-only viewer for saved futurescapes.
 *
 * Loads a futurescape by slug from the public API, then renders:
 *  - The interactive (but non-editable) consequence map via ReadOnlyMap
 *  - The full report via ReportPanel in exportMode (no editing controls)
 *
 * Used for:
 *  - Public demo page links (/#/view/{slug})
 *  - Embedding in the FAST app for lab-scoped futurescape previews
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Flex, Text, Button, Spinner } from '@chakra-ui/react';
import { ArrowLeft, FileText, Map as MapIcon } from 'lucide-react';
import { Node, Edge, MarkerType } from 'reactflow';
import { ReadOnlyMap } from './ReadOnlyMap';
import { ReportPanel } from './ReportPanel';
import { loadFuturescapeData, type FuturescapeDataPayload } from '../api/persistence';
import type { Consequence, FutureInput } from '../types';
import { getOptimalHandles, computeRadialLayout, resolveCollisions, type Position } from '../layout';

// ── Build ReactFlow nodes from saved data ──────────────────────────

function buildSeedNode(input: FutureInput, position: { x: number; y: number }): Node {
  return {
    id: 'seed',
    type: 'seed',
    position,
    data: {
      title: input.title,
      description: input.description,
      horizon: input.horizon,
    },
    draggable: true,
  };
}

function buildConsequenceNodes(
  consequences: Consequence[],
  positionMap: Map<string, { x: number; y: number }>,
): Node[] {
  return consequences.map(c => ({
    id: c.id,
    type: 'consequence',
    position: positionMap.get(c.id) || { x: 0, y: 0 },
    data: {
      consequence: c,
      isDimmed: false,
      isSelected: false,
      isEditing: false,
      isPlaceholder: false,
      isGenerating: false,
      isNewlyExpanded: false,
      isGeneratingChildren: false,
      isGeneratingIdeas: false,
      isGenerationInProgress: false,
      isUnattached: false,
      isConnectMode: false,
      isConnectSource: false,
      isConnectValidTarget: false,
      isConnectInvalid: false,
    },
    draggable: true,
  }));
}

function buildEdgesFromConsequences(
  consequences: Consequence[],
  positionMap: Map<string, { x: number; y: number }>,
): Edge[] {
  const edges: Edge[] = [];
  const sentimentColors: Record<string, string> = {
    positive: '#22c55e',
    negative: '#ef4444',
    neutral: '#94a3b8',
  };

  for (const c of consequences) {
    if (c.parentIds.length === 0) continue;
    const childPos = positionMap.get(c.id);
    if (!childPos) continue;

    const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
    const edgeColor = isSolOrIdea ? '#1B1B1D' : (sentimentColors[c.sentiment] || '#94a3b8');

    for (const parentId of c.parentIds) {
      const parentPos = positionMap.get(parentId);
      if (!parentPos) continue;

      const { sourceHandle, targetHandle } = getOptimalHandles(parentPos, childPos);

      edges.push({
        id: `edge-${parentId}-${c.id}`,
        source: parentId,
        target: c.id,
        sourceHandle,
        targetHandle,
        type: 'straightApproach',
        style: {
          stroke: edgeColor,
          strokeWidth: 1.5,
          opacity: c.order === 1 ? 0.5 : 0.4,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
      });
    }
  }

  return edges;
}

// ── Viewer Component ───────────────────────────────────────────────

interface FuturescapeViewerProps {
  slug: string;
  onBack?: () => void;
}

export function FuturescapeViewer({ slug, onBack }: FuturescapeViewerProps) {
  const [data, setData] = useState<FuturescapeDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = await loadFuturescapeData(slug);
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load futurescape');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Build nodes and edges from loaded data
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };

    const consequences = data.consequences || [];
    const savedPositions = data.mapLayout?.nodes || [];
    const savedViewport = data.mapLayout?.viewport;

    // Build position map from saved positions
    const positionMap = new Map<string, Position>();

    // Add seed position
    const seedSaved = savedPositions.find(n => n.id === 'seed');
    positionMap.set('seed', seedSaved?.position || { x: 400, y: 50 });

    // Add consequence positions — use saved if available, fall back to radial layout
    const hasSavedPositions = savedPositions.length > 1;
    if (hasSavedPositions) {
      for (const sp of savedPositions) {
        positionMap.set(sp.id, sp.position);
      }
    }

    // For any consequences without saved positions, compute layout
    const missingPositionIds = consequences.filter(c => !positionMap.has(c.id));
    if (missingPositionIds.length > 0) {
      const layoutPositions = computeRadialLayout(consequences, positionMap, false, 'detailed');
      resolveCollisions(layoutPositions, consequences);
      for (const [id, pos] of layoutPositions) {
        if (!positionMap.has(id)) {
          positionMap.set(id, pos);
        }
      }
    }

    // Build nodes
    const seedNode = buildSeedNode(data.input, positionMap.get('seed')!);
    const consequenceNodes = buildConsequenceNodes(consequences, positionMap);
    const allNodes = [seedNode, ...consequenceNodes];

    // Build edges
    const allEdges = buildEdgesFromConsequences(consequences, positionMap);

    return { nodes: allNodes, edges: allEdges };
  }, [data]);

  // ── Loading state ──
  if (loading) {
    return (
      <Flex h="100vh" align="center" justify="center" bg="bg" direction="column" gap={3}>
        <Spinner size="lg" color="fg.muted" />
        <Text color="fg.muted" fontSize="sm">Loading futurescape...</Text>
      </Flex>
    );
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <Flex h="100vh" align="center" justify="center" bg="bg" direction="column" gap={3}>
        <Text color="red.400" fontSize="lg" fontWeight="semibold">
          {error || 'Futurescape not found'}
        </Text>
        {onBack && (
          <Button onClick={onBack} size="sm" variant="ghost">
            <ArrowLeft size={16} />
            <Text ml={2}>Go back</Text>
          </Button>
        )}
      </Flex>
    );
  }

  return (
    <Flex h="100vh" direction="column" bg="bg">
      {/* Header bar */}
      <Flex
        px={4}
        py={2}
        align="center"
        justify="space-between"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg.subtle"
        flexShrink={0}
      >
        <Flex align="center" gap={3}>
          {onBack && (
            <Button onClick={onBack} size="xs" variant="ghost">
              <ArrowLeft size={14} />
            </Button>
          )}
          <Box>
            <Text fontSize="sm" fontWeight="bold" color="fg" lineClamp={1}>
              {data.input.title}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {data.consequences.length} consequences · {data.input.horizon} horizon
            </Text>
          </Box>
        </Flex>

        <Flex gap={2}>
          {data.report && (
            <Button
              onClick={() => setShowReport(true)}
              size="sm"
              bg="bg.hover"
              color="fg"
              rounded="lg"
              fontWeight="medium"
              borderWidth="1px"
              borderColor="border"
              _hover={{ bg: 'bg.emphasized' }}
            >
              <FileText size={14} />
              <Text ml={2} fontSize="sm">View Report</Text>
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Map */}
      <Box flex={1}>
        <ReadOnlyMap nodes={nodes} edges={edges} height="100%" />
      </Box>

      {/* Report overlay */}
      {data.report && (
        <ReportPanel
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          report={data.report}
          mapNodes={nodes}
          mapEdges={edges}
        />
      )}
    </Flex>
  );
}
