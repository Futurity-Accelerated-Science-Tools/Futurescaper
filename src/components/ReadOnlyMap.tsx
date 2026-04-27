import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ConsequenceNode, SeedNode } from './ConsequenceNode';
import { useColorMode } from '../theme/ColorModeProvider';

const nodeTypes = {
  seed: SeedNode,
  consequence: ConsequenceNode,
};

interface ReadOnlyMapProps {
  nodes: Node[];
  edges: Edge[];
  height?: string;
  /** When true, reset viewport to fit all nodes (used before export snapshot) */
  resetView?: boolean;
}

// ── Ancestor chain BFS ─────────────────────────────────────────────
// Walks parentIds up to the seed, returning the full chain as a Set.

function getAncestorChain(nodeId: string, nodes: Node[]): Set<string> {
  const chain = new Set<string>();
  const queue: string[] = [nodeId];
  // Build a quick lookup: id → node.data.consequence
  const lookup = new Map<string, { parentIds: string[] }>();
  for (const n of nodes) {
    if (n.data?.consequence) {
      lookup.set(n.id, n.data.consequence);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (chain.has(current)) continue;
    chain.add(current);
    if (current === 'seed') continue;
    const c = lookup.get(current);
    if (c) {
      for (const pid of c.parentIds) {
        if (!chain.has(pid)) queue.push(pid);
      }
    }
  }
  chain.add('seed');
  return chain;
}

// ── Prepare nodes for display ──────────────────────────────────────
// Strips all editing/action callbacks (prevents ActionToolbar radial menu),
// applies focus-dimming if a node is selected, and elevates the ancestor chain.

function prepareNodes(
  nodes: Node[],
  activeNodeId: string | null,
): Node[] {
  const chain = activeNodeId ? getAncestorChain(activeNodeId, nodes) : null;

  return nodes.map(node => ({
    ...node,
    // Allow dragging for spatial exploration (positions aren't persisted)
    draggable: true,
    // Elevate ancestor chain above other nodes
    zIndex: chain
      ? (node.id === activeNodeId ? 1001 : chain.has(node.id) ? 1000 : undefined)
      : undefined,
    data: {
      ...node.data,
      // Visual state
      isDimmed: false,
      isFocusDimmed: chain ? !chain.has(node.id) : false,
      isSelected: node.id === activeNodeId,
      isConnectMode: false,
      isConnectSource: false,
      isConnectValidTarget: false,
      isConnectInvalid: false,
      isGeneratingChildren: false,
      isGeneratingIdeas: false,
      isGenerationInProgress: false,
      // Strip ALL editing/action callbacks → ActionToolbar won't render
      onClick: undefined,
      onStartEdit: undefined,
      onSaveEdit: undefined,
      onCancelEdit: undefined,
      onAddChild: undefined,
      onConnect: undefined,
      onGenerateChildren: undefined,
      onGenerateIdeas: undefined,
      onDelete: undefined,
    },
  }));
}

// ── Inner component (needs ReactFlowProvider above it) ─────────────

// Dark-mode edge colors that the main map would use.
// Edges are built with hardcoded colors in the main map's colorMode,
// so we need to fix them when the report's colorMode differs.
const DARK_IDEA_EDGE = '#e0e0e0';
const LIGHT_IDEA_EDGE = '#1B1B1D';

function fixEdgeColors(edges: Edge[], isDark: boolean): Edge[] {
  // Idea/solution edges from the main map use either #1B1B1D (light) or #e0e0e0 (dark).
  // If the report is in dark mode but the edge was built in light mode (or vice-versa), swap.
  const wrongColor = isDark ? LIGHT_IDEA_EDGE : DARK_IDEA_EDGE;
  const rightColor = isDark ? DARK_IDEA_EDGE : LIGHT_IDEA_EDGE;

  return edges.map(edge => {
    const stroke = edge.style?.stroke;
    if (stroke === wrongColor) {
      return {
        ...edge,
        style: { ...edge.style, stroke: rightColor },
        markerEnd: edge.markerEnd && typeof edge.markerEnd === 'object'
          ? { ...edge.markerEnd, color: rightColor }
          : edge.markerEnd,
      };
    }
    return edge;
  });
}

function ReadOnlyMapInner({ nodes, edges, height = '500px', resetView }: ReadOnlyMapProps) {
  const { setCenter, getNode, fitView } = useReactFlow();
  const { colorMode } = useColorMode();
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset viewport to fit all nodes when resetView becomes true (export preparation)
  useEffect(() => {
    if (resetView) {
      setActiveNodeId(null);
      // Small delay to let React clear focus-dimming before fitting
      setTimeout(() => fitView({ padding: 0.15, duration: 0 }), 50);
    }
  }, [resetView, fitView]);

  // Center viewport on clicked node, biased toward ancestor centroid (60/40 blend)
  const centerOnNode = useCallback((nodeId: string) => {
    const z = 0.8;
    const node = getNode(nodeId);
    if (!node) return;

    const nw = node.width ?? 200;
    const nh = node.height ?? 80;
    const selectedCenterX = node.position.x + nw / 2;
    const selectedCenterY = node.position.y + nh / 2;

    // Walk ancestor chain for centroid
    const chain = getAncestorChain(nodeId, nodes);
    let sumX = 0, sumY = 0, count = 0;
    chain.forEach(id => {
      const n = getNode(id);
      if (n) {
        sumX += n.position.x + (n.width ?? 200) / 2;
        sumY += n.position.y + (n.height ?? 80) / 2;
        count++;
      }
    });

    let targetX = selectedCenterX;
    let targetY = selectedCenterY;
    if (count > 1) {
      const chainCenterX = sumX / count;
      const chainCenterY = sumY / count;
      targetX = selectedCenterX * 0.6 + chainCenterX * 0.4;
      targetY = selectedCenterY * 0.6 + chainCenterY * 0.4;
    }

    // Clamp so the selected node stays in view
    const container = containerRef.current;
    if (container) {
      const vpHalfW = container.clientWidth / z / 2;
      const vpHalfH = container.clientHeight / z / 2;
      const margin = 80;
      const nodeLeft = node.position.x - margin;
      const nodeRight = node.position.x + nw + margin;
      const nodeTop = node.position.y - margin;
      const nodeBottom = node.position.y + nh + margin;
      targetX = Math.min(targetX, nodeLeft + vpHalfW);
      targetX = Math.max(targetX, nodeRight - vpHalfW);
      targetY = Math.min(targetY, nodeTop + vpHalfH);
      targetY = Math.max(targetY, nodeBottom - vpHalfH);
    }

    setCenter(targetX, targetY, { zoom: z, duration: 500 });
  }, [nodes, getNode, setCenter]);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const newId = activeNodeId === node.id ? null : node.id;
    setActiveNodeId(newId);
    if (newId && newId !== 'seed') {
      // Small delay so React can re-render with new focus state before panning
      setTimeout(() => centerOnNode(newId), 30);
    }
  }, [activeNodeId, centerOnNode]);

  const handlePaneClick = useCallback(() => {
    setActiveNodeId(null);
  }, []);

  const displayNodes = useMemo(
    () => prepareNodes(nodes, activeNodeId),
    [nodes, activeNodeId],
  );

  const displayEdges = useMemo(
    () => fixEdgeColors(edges, colorMode === 'dark'),
    [edges, colorMode],
  );

  return (
    <Box
      ref={containerRef}
      h={height}
      w="100%"
      rounded="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="border.emphasized"
      bg="bg"
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        nodesDraggable={true}
        elementsSelectable={false}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--chakra-colors-border-muted)" />
        <Controls
          showInteractive={false}
          position="bottom-right"
          style={{ display: 'flex', flexDirection: 'row', gap: 2 }}
        />
      </ReactFlow>
    </Box>
  );
}

export function ReadOnlyMap(props: ReadOnlyMapProps) {
  return (
    <ReactFlowProvider>
      <ReadOnlyMapInner {...props} />
    </ReactFlowProvider>
  );
}
