/**
 * ReportKnowledgeGraph — Cosmograph-powered knowledge graph for the report.
 *
 * Visualizes the relationships between:
 *   - The seed scenario (central node)
 *   - Consequences (colored by sentiment, sized by importance)
 *   - Ideas & solutions (brand blue)
 *   - Subjects from the FAST knowledge base (direct / tangential)
 *
 * Closely mirrors the NetworkGraphModular component from the Subject page,
 * adapted for static report data (no fetching, no navigation).
 *
 * Uses @cosmograph/react v2 with index-based point/link architecture.
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { CosmographProvider, Cosmograph, type CosmographRef } from '@cosmograph/react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useColorMode } from '../theme/ColorModeProvider';
import {
  Consequence,
  STEEP_LABELS,
} from '../types';
import type { RelevantSubject } from '../api/subjects';

// ── Types (matching v2 index-based architecture) ─────────────────

interface KGNode {
  id: string;
  _index: number;
  label: string;
  type: string;
  size: number;
  color?: string;
  category?: string;
  sentiment?: string;
}

interface KGLink {
  source: string;
  target: string;
  sourceIndex: number;
  targetIndex: number;
  value: number;
  color?: string;
}

// ── Node type color mapping (like NODE_TYPE_COLORS in NetworkGraphModular) ──

const NODE_TYPE_COLORS: Record<string, string> = {
  Seed: '#ff9f1c',
  'Consequence-positive': '#3DB462',
  'Consequence-negative': '#FF4D53',
  'Consequence-neutral': '#8891a0',
  Idea: '#0005e9',
  Solution: '#0005e9',
  'Subject-direct': '#7c5cfc',
  'Subject-tangential': '#0d9488',
  default: '#8891a0',
};

const getNodeColor = (type: string): string =>
  NODE_TYPE_COLORS[type] || NODE_TYPE_COLORS.default;

// ── Data transformation ──────────────────────────────────────────

function buildGraphData(
  consequences: Consequence[],
  subjects: RelevantSubject[] | undefined,
  seedTitle: string,
): { nodes: KGNode[]; links: KGLink[] } {
  const nodes: KGNode[] = [];
  const idToIndex = new Map<string, number>();
  let idx = 0;

  // 1. Seed node (large, central)
  const seedId = '__seed__';
  idToIndex.set(seedId, idx);
  nodes.push({
    id: seedId,
    _index: idx++,
    label: seedTitle.length > 60 ? seedTitle.slice(0, 57) + '…' : seedTitle,
    type: 'Seed',
    size: 10,
  });

  // 2. Consequence / Idea / Solution nodes
  for (const c of consequences) {
    const isSolOrIdea = c.nodeType === 'solution' || c.nodeType === 'idea';
    const type = isSolOrIdea
      ? (c.nodeType === 'idea' ? 'Idea' : 'Solution')
      : `Consequence-${c.sentiment || 'neutral'}`;

    idToIndex.set(c.id, idx);
    nodes.push({
      id: c.id,
      _index: idx++,
      label: c.title || (c.text.length > 60 ? c.text.slice(0, 57) + '…' : c.text),
      type,
      size: isSolOrIdea
        ? 3
        : (c.importance === 'critical' ? 6 : c.importance === 'high' ? 4.5 : c.importance === 'low' ? 2 : 3),
      category: c.category,
      sentiment: c.sentiment,
    });
  }

  // 3. Subject nodes
  if (subjects) {
    for (const s of subjects) {
      const sId = `__subj__${s.name}`;
      idToIndex.set(sId, idx);
      nodes.push({
        id: sId,
        _index: idx++,
        label: s.name,
        type: s.relevance === 'direct' ? 'Subject-direct' : 'Subject-tangential',
        size: s.relevance === 'direct' ? 5 : 3.5,
      });
    }
  }

  // 4. Links — consequence tree edges
  const links: KGLink[] = [];

  for (const c of consequences) {
    if (c.parentIds.length === 0 || (c.parentIds.length === 1 && c.parentIds[0] === 'seed')) {
      // Root consequence → seed
      const srcIdx = idToIndex.get(seedId);
      const tgtIdx = idToIndex.get(c.id);
      if (srcIdx !== undefined && tgtIdx !== undefined) {
        links.push({ source: seedId, target: c.id, sourceIndex: srcIdx, targetIndex: tgtIdx, value: 1 });
      }
    } else {
      for (const pid of c.parentIds) {
        const srcId = pid === 'seed' ? seedId : pid;
        const srcIdx = idToIndex.get(srcId);
        const tgtIdx = idToIndex.get(c.id);
        if (srcIdx !== undefined && tgtIdx !== undefined) {
          links.push({ source: srcId, target: c.id, sourceIndex: srcIdx, targetIndex: tgtIdx, value: 1 });
        }
      }
    }
  }

  // 5. Subject → consequence links
  if (subjects) {
    for (const s of subjects) {
      const sId = `__subj__${s.name}`;
      const srcIdx = idToIndex.get(sId);
      if (srcIdx === undefined) continue;
      for (const cId of s.relatedConsequenceIds) {
        const tgtIdx = idToIndex.get(cId);
        if (tgtIdx !== undefined) {
          links.push({ source: sId, target: cId, sourceIndex: srcIdx, targetIndex: tgtIdx, value: 1 });
        }
      }
    }
  }

  // Color links by target node type (matching NetworkGraphModular pattern)
  const idToType = new Map(nodes.map(n => [n.id, n.type]));
  for (const link of links) {
    const targetType = idToType.get(link.target) || 'default';
    link.color = getNodeColor(targetType);
  }

  return { nodes, links };
}

// ── CSS injection (matching NetworkGraphModular label styles) ────

function injectLabelStyles(isDark: boolean) {
  const styleId = 'report-kg-label-styles';
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .rkg-label-dark {
      font-size: 11px !important;
      font-weight: 500 !important;
      text-shadow: 0 0 4px rgba(0, 0, 0, 0.8), 0 0 2px rgba(0, 0, 0, 0.9) !important;
      color: #ffffff !important;
      opacity: 0.95 !important;
      background: rgba(0, 0, 0, 0.7) !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
    }
    .rkg-label-light {
      font-size: 11px !important;
      font-weight: 500 !important;
      text-shadow: none !important;
      color: #000000 !important;
      opacity: 0.95 !important;
      background: rgba(255, 255, 255, 0.85) !important;
      padding: 2px 6px !important;
      border-radius: 3px !important;
    }
    .rkg-label-hover-dark {
      font-size: 13px !important;
      font-weight: 700 !important;
      text-shadow: 0 0 6px rgba(0, 0, 0, 0.9), 0 0 3px rgba(0, 0, 0, 1) !important;
      color: #ffffff !important;
      opacity: 1 !important;
      background: rgba(0, 0, 0, 0.85) !important;
      padding: 3px 8px !important;
      border-radius: 4px !important;
    }
    .rkg-label-hover-light {
      font-size: 13px !important;
      font-weight: 700 !important;
      text-shadow: none !important;
      color: #000000 !important;
      opacity: 1 !important;
      background: rgba(255, 255, 255, 0.95) !important;
      padding: 3px 8px !important;
      border-radius: 4px !important;
    }
  `;
  document.head.appendChild(style);
}

// ── Component ────────────────────────────────────────────────────

interface ReportKnowledgeGraphProps {
  consequences: Consequence[];
  subjects?: RelevantSubject[];
  seedTitle: string;
  height?: string;
}

export function ReportKnowledgeGraph({ consequences, subjects, seedTitle, height = '480px' }: ReportKnowledgeGraphProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const cosmographRef = useRef<CosmographRef>(undefined);
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);

  // Inject / update label styles when theme changes
  useEffect(() => {
    injectLabelStyles(isDark);
    return () => {
      const el = document.getElementById('report-kg-label-styles');
      if (el) el.remove();
    };
  }, [isDark]);

  const { nodes, links } = useMemo(
    () => buildGraphData(consequences, subjects, seedTitle),
    [consequences, subjects, seedTitle],
  );

  // v2 onClick: (pointIndex, pointPosition, event)
  const handleNodeClick = useMemo(() => {
    return (
      pointIndex: number | undefined,
      _pointPosition: [number, number] | undefined,
      _event: MouseEvent,
    ) => {
      if (pointIndex !== undefined && pointIndex < nodes.length) {
        setSelectedNode(nodes[pointIndex]);
        cosmographRef.current?.zoomToPoint(pointIndex, 1000);
      } else {
        setSelectedNode(null);
      }
    };
  }, [nodes]);

  // v2 onLabelClick: (pointIndex, id, event)
  const handleLabelClick = useMemo(() => {
    return (pointIndex: number, _id: string, event: MouseEvent) => {
      if (pointIndex < nodes.length) {
        setSelectedNode(nodes[pointIndex]);
        cosmographRef.current?.zoomToPoint(pointIndex, 1000);
        event.stopPropagation();
      }
    };
  }, [nodes]);

  const handleFitView = useCallback(() => cosmographRef.current?.fitView(), []);
  const handleZoomIn = useCallback(() => {
    const z = cosmographRef.current?.getZoomLevel() ?? 1;
    cosmographRef.current?.setZoomLevel(z * 2, 500);
  }, []);
  const handleZoomOut = useCallback(() => {
    const z = cosmographRef.current?.getZoomLevel() ?? 1;
    cosmographRef.current?.setZoomLevel(z * 0.5, 500);
  }, []);
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!cosmographRef.current) return;
    const z = cosmographRef.current.getZoomLevel() ?? 1;
    cosmographRef.current.setZoomLevel(z * 4, 600);
  }, []);

  const bgColor = isDark ? '#111111' : '#FAFAFA';

  // Legend (human-friendly labels)
  const legendItems = [
    { label: 'Scenario', color: NODE_TYPE_COLORS.Seed },
    { label: 'Positive', color: NODE_TYPE_COLORS['Consequence-positive'] },
    { label: 'Negative', color: NODE_TYPE_COLORS['Consequence-negative'] },
    { label: 'Neutral', color: NODE_TYPE_COLORS['Consequence-neutral'] },
    { label: 'Idea / Solution', color: NODE_TYPE_COLORS.Idea },
    ...(subjects && subjects.length > 0 ? [
      { label: 'Direct Subject', color: NODE_TYPE_COLORS['Subject-direct'] },
      { label: 'Tangential Subject', color: NODE_TYPE_COLORS['Subject-tangential'] },
    ] : []),
  ];

  return (
    <Box>
      <Box
        position="relative"
        h={height}
        rounded="xl"
        overflow="hidden"
        border="1px solid"
        borderColor="border.emphasized"
        bg={bgColor}
        onDoubleClick={handleDoubleClick}
      >
        <CosmographProvider>
          <Cosmograph
            ref={cosmographRef}
            // === Data (v2: pass on Cosmograph, NOT CosmographProvider) ===
            points={nodes}
            links={links}
            pointIdBy="id"
            pointIndexBy="_index"
            linkSourceBy="source"
            linkSourceIndexBy="sourceIndex"
            linkTargetBy="target"
            linkTargetIndexBy="targetIndex"
            // Include extra columns so callbacks can access them
            pointIncludeColumns={['label', 'type', 'category', 'sentiment']}
            linkIncludeColumns={['color']}
            // === Colors (v2: type-based map strategy — matching NetworkGraphModular) ===
            backgroundColor={bgColor}
            pointColorBy="type"
            pointColorStrategy="map"
            pointColorByMap={NODE_TYPE_COLORS}
            // === Selection greyout ===
            pointGreyoutOpacity={0.15}
            linkGreyoutOpacity={0.05}
            // === Sizes (v2: column-based + accessor function) ===
            pointSizeBy="size"
            pointSizeByFn={(sizeValue: number) => (sizeValue || 1) * 4}
            pointDefaultSize={4}
            scalePointsOnZoom={true}
            // === Links (v2: column-based styling) ===
            linkColorBy="color"
            linkColorStrategy="direct"
            linkDefaultWidth={0.1}
            linkDefaultArrows={true}
            linkArrowsSizeScale={2}
            linkOpacity={isDark ? 1.0 : 0.5}
            scaleLinksOnZoom={false}
            // === Labels (v2: column-based) ===
            showLabels={false}
            showHoveredPointLabel={true}
            showDynamicLabels={true}
            pointLabelBy="label"
            pointLabelColor={isDark ? '#ffffff' : '#000000'}
            pointLabelClassName={isDark ? 'rkg-label-dark' : 'rkg-label-light'}
            hoveredPointLabelClassName={isDark ? 'rkg-label-hover-dark' : 'rkg-label-hover-light'}
            // === Rendering ===
            pixelRatio={window.devicePixelRatio || 2}
            // === Events (v2: index-based signatures) ===
            onClick={handleNodeClick}
            onLabelClick={handleLabelClick}
            // === View & Layout (matching NetworkGraphModular) ===
            fitViewOnInit={true}
            fitViewDelay={500}
            fitViewPadding={-0.8}
            fitViewDuration={2000}
            spaceSize={4096}
            enableSimulationDuringZoom={true}
            // === Simulation (matching NetworkGraphModular physics) ===
            simulationFriction={0.2}
            simulationGravity={0.02}
            simulationRepulsion={1.0}
            simulationLinkDistance={60}
            simulationLinkSpring={0.1}
            simulationCenter={0.001}
            enableSimulation={true}
            // === Hover effects (v2: renamed props) ===
            renderHoveredPointRing={true}
            hoveredPointRingColor={isDark ? '#ffffff' : '#000000'}
          />
        </CosmographProvider>

        {/* Zoom controls — top right, matching NetworkGraphModular position */}
        <Flex
          position="absolute"
          top={3}
          right={3}
          direction="column"
          gap={1}
          zIndex={10}
        >
          {[
            { icon: <ZoomIn size={14} />, fn: handleZoomIn, label: 'Zoom in' },
            { icon: <ZoomOut size={14} />, fn: handleZoomOut, label: 'Zoom out' },
            { icon: <Maximize2 size={14} />, fn: handleFitView, label: 'Fit to view' },
          ].map(btn => (
            <Box
              key={btn.label}
              as="button"
              onClick={btn.fn}
              p={1.5}
              rounded="md"
              cursor="pointer"
              bg="rgba(0, 0, 0, 0.7)"
              color="white"
              _hover={{ bg: 'rgba(0, 0, 0, 0.9)' }}
              transition="background 0.15s"
              title={btn.label}
            >
              {btn.icon}
            </Box>
          ))}
        </Flex>

        {/* Selected node detail — bottom left, matching NetworkGraphModular */}
        {selectedNode && (
          <Box
            position="absolute"
            bottom={3}
            left={3}
            bg="rgba(0, 0, 0, 0.8)"
            rounded="md"
            p={3}
            maxW="250px"
            zIndex={10}
            color="white"
          >
            <Flex align="center" gap={2} mb={1.5}>
              <Box
                w="10px" h="10px"
                rounded="full"
                bg={getNodeColor(selectedNode.type)}
                flexShrink={0}
              />
              <Text fontSize="xs" fontWeight="bold" color="gray.400">
                {selectedNode.type.replace('Consequence-', '').replace('Subject-', '')}
              </Text>
            </Flex>
            <Text fontSize="sm" fontWeight="medium" lineHeight="1.4">
              {selectedNode.label}
            </Text>
            {selectedNode.category && (
              <Text fontSize="xs" color="gray.400" mt={1}>
                {STEEP_LABELS[selectedNode.category as keyof typeof STEEP_LABELS]} · {selectedNode.sentiment}
              </Text>
            )}
            <Text fontSize="xs" color="gray.500" fontStyle="italic" mt={1.5}>
              Click elsewhere to deselect
            </Text>
          </Box>
        )}
      </Box>

      {/* Legend */}
      <Flex gap={3} mt={3} flexWrap="wrap" justify="center">
        {legendItems.map(item => (
          <Flex key={item.label} align="center" gap={1.5} fontSize="xs" color="fg.muted">
            <Box w="8px" h="8px" rounded="full" bg={item.color} flexShrink={0} />
            <Text>{item.label}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
