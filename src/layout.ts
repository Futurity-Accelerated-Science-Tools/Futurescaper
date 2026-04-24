/**
 * layout.ts — Pure layout functions for the Futurescaper graph.
 *
 * These are stateless functions that compute node positions from consequence data.
 * They have no React dependencies and can be tested independently.
 */

import { Consequence, ConsequenceOrder, IMPORTANCE_SIZES } from './types';

// ─── Types ───────────────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

// Radial band ranges: [minRadius, baseRadius] per order.
// baseRadius is used when node count is low; actual radius expands with node count.
const ORDER_BANDS: Record<number, { min: number; base: number }> = {
  1: { min: 400, base: 500 },
  2: { min: 750, base: 900 },
  3: { min: 1200, base: 1400 },
  4: { min: 1700, base: 1900 },
  5: { min: 2200, base: 2400 },
};

const NODE_WIDTH = 250;
const MIN_ARC_SPACING = 30;

// Spacing multiplier for verbose modes — nodes need more room when text is longer
export type VerbositySpacing = 'concise' | 'detailed';
const SPACING_MULTIPLIERS: Record<VerbositySpacing, number> = {
  concise: 0.9,
  detailed: 1.4,
};

// ─── computeRadialLayout ─────────────────────────────────────────

/**
 * Computes radial positions for consequence nodes.
 *
 * @param consequences - All consequences to lay out
 * @param existingPositions - Positions of already-placed nodes (used for incremental adds)
 * @param forceRelayout - If true, ignores existingPositions and recomputes everything
 * @returns Map of node ID → position (includes 'seed' at origin)
 */
export function computeRadialLayout(
  consequences: Consequence[],
  existingPositions?: Map<string, Position>,
  forceRelayout?: boolean,
  verbosity?: VerbositySpacing,
): Map<string, Position> {
  const spacingMul = SPACING_MULTIPLIERS[verbosity || 'concise'];
  const positions = new Map<string, Position>();
  positions.set('seed', { x: 0, y: 0 });

  // Copy over existing positions (unless forcing relayout)
  if (existingPositions && !forceRelayout) {
    existingPositions.forEach((pos, id) => {
      positions.set(id, pos);
    });
  }

  // Group by order
  const byOrder: Record<number, Consequence[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const c of consequences) {
    if (byOrder[c.order]) byOrder[c.order].push(c);
  }

  // Calculate dynamic radii based on node count per ring, scaled by verbosity
  const calculateRadius = (nodeCount: number, band: { min: number; base: number }): number => {
    if (nodeCount === 0) return band.base * spacingMul;
    const circumferenceNeeded = nodeCount * (NODE_WIDTH + MIN_ARC_SPACING) * spacingMul;
    const radiusFromCircumference = circumferenceNeeded / (2 * Math.PI);
    return Math.max(band.base * spacingMul, radiusFromCircumference);
  };

  const orderRadii: Record<number, number> = {};
  for (let order = 1; order <= 5; order++) {
    orderRadii[order] = calculateRadius(byOrder[order].length, ORDER_BANDS[order]);
  }

  // ── Order 1: ring around seed ──
  // Only compute positions for nodes that don't already have one
  const order1 = byOrder[1];
  const order1NeedingLayout = order1.filter(c => !positions.has(c.id));
  const order1Existing = order1.filter(c => positions.has(c.id));

  if (order1NeedingLayout.length > 0) {
    // Find angles already occupied by existing order-1 nodes
    const occupiedAngles = order1Existing.map(c => {
      const pos = positions.get(c.id)!;
      return Math.atan2(pos.y, pos.x);
    });

    // Distribute new nodes evenly in remaining angular space
    if (order1Existing.length === 0) {
      // Fresh layout: distribute all evenly
      order1NeedingLayout.forEach((c, idx) => {
        const totalCount = order1.length;
        const angle = (idx / totalCount) * 2 * Math.PI - Math.PI / 2;
        const radius = orderRadii[1];
        positions.set(c.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
      });
    } else {
      // Incremental: use the SAME radius as existing nodes (not the recalculated one)
      // so new nodes appear on the same ring, not closer/further.
      const existingRadii = order1Existing.map(c => {
        const pos = positions.get(c.id)!;
        return Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      });
      const existingRadius = existingRadii.reduce((a, b) => a + b, 0) / existingRadii.length;
      const radius = existingRadius > 0 ? existingRadius : orderRadii[1];

      // Find angular gaps between existing nodes and place new ones in the largest gaps
      const allAngles = [...occupiedAngles].sort((a, b) => a - b);

      const usedAngles = [...allAngles];
      let newIdx = 0;
      order1NeedingLayout.forEach((c) => {
        // Re-sort and find largest gap each time (like orders 2-5)
        usedAngles.sort((a, b) => a - b);
        let bestAngle = (newIdx / order1NeedingLayout.length) * 2 * Math.PI - Math.PI / 2; // fallback
        let bestGapSize = 0;

        for (let i = 0; i < usedAngles.length; i++) {
          const current = usedAngles[i];
          const next = i + 1 < usedAngles.length ? usedAngles[i + 1] : usedAngles[0] + 2 * Math.PI;
          const gapSize = next - current;
          if (gapSize > bestGapSize) {
            bestGapSize = gapSize;
            bestAngle = current + gapSize / 2;
          }
        }

        usedAngles.push(bestAngle);
        positions.set(c.id, {
          x: Math.cos(bestAngle) * radius,
          y: Math.sin(bestAngle) * radius,
        });
        newIdx++;
      });
    }
  }

  // ── Orders 2-5: positioned relative to parent ──
  for (let order = 2; order <= 5; order++) {
    const orderConsequences = byOrder[order];
    if (orderConsequences.length === 0) continue;

    // Only lay out nodes that don't already have positions
    const needingLayout = orderConsequences.filter(c => !positions.has(c.id));
    if (needingLayout.length === 0) continue;

    // Group by primary parent (first in parentIds array)
    const byParent: Record<string, Consequence[]> = {};
    needingLayout.forEach(c => {
      const primaryParent = c.parentIds[0] || 'seed';
      if (!byParent[primaryParent]) byParent[primaryParent] = [];
      byParent[primaryParent].push(c);
    });

    // Also find existing siblings (already positioned) for each parent so we
    // don't place new children on top of them.
    const existingSiblingsByParent: Record<string, Consequence[]> = {};
    orderConsequences.filter(c => positions.has(c.id)).forEach(c => {
      const pid = c.parentIds[0] || 'seed';
      if (!existingSiblingsByParent[pid]) existingSiblingsByParent[pid] = [];
      existingSiblingsByParent[pid].push(c);
    });

    Object.entries(byParent).forEach(([parentId, newChildren]) => {
      const parentPos = positions.get(parentId) || { x: 0, y: 0 };
      const parentAngleFromCenter = Math.atan2(parentPos.y, parentPos.x);

      // Collect angles already occupied by existing siblings of this parent
      const existingSiblings = existingSiblingsByParent[parentId] || [];
      const occupiedAngles = existingSiblings.map(sib => {
        const sibPos = positions.get(sib.id)!;
        return Math.atan2(sibPos.y - parentPos.y, sibPos.x - parentPos.x);
      });

      // Total children (existing + new) determines spread
      const totalChildren = existingSiblings.length + newChildren.length;
      const maxSpread = Math.PI / 2; // 90 degrees max
      const spreadPerChild = Math.min(Math.PI / 6, maxSpread / Math.max(totalChildren, 1));

      if (occupiedAngles.length === 0) {
        // No existing siblings — distribute new children around parent angle
        newChildren.forEach((c, idx) => {
          const centerIdx = (newChildren.length - 1) / 2;
          const offsetFromCenter = idx - centerIdx;
          const angle = parentAngleFromCenter + offsetFromCenter * spreadPerChild;

          const baseDistance = (500 + (order - 2) * 150) * spacingMul;
          const jitter = Math.sin(idx * 7.3) * 30;
          const distance = baseDistance + jitter;

          positions.set(c.id, {
            x: parentPos.x + Math.cos(angle) * distance,
            y: parentPos.y + Math.sin(angle) * distance,
          });
        });
      } else {
        // Has existing siblings — place new children adjacent to existing ones,
        // staying within the parent's outward cone (±maxSpread from parent angle).
        // This prevents nodes from wrapping around to the opposite side (closer to center).
        const allSiblingAngles = [...occupiedAngles].sort((a, b) => a - b);

        // Determine the angular bounds: parent direction ± maxSpread
        const halfSpread = maxSpread;
        const minAllowed = parentAngleFromCenter - halfSpread;
        const maxAllowed = parentAngleFromCenter + halfSpread;

        // Place new children at incremental offsets beyond existing siblings
        const usedAngles = [...allSiblingAngles];
        newChildren.forEach((c, idx) => {
          // Find the best angle: spread out from existing siblings within the allowed cone
          usedAngles.sort((a, b) => a - b);

          // Try placing at incremental offsets from the edge of existing siblings
          let bestAngle: number;
          const existingInCone = usedAngles.filter(a => a >= minAllowed && a <= maxAllowed);

          if (existingInCone.length === 0) {
            // Fallback: spread from parent angle
            bestAngle = parentAngleFromCenter + (idx + 1) * spreadPerChild;
          } else {
            // Find largest gap within the allowed cone
            const coneAngles = [...existingInCone].sort((a, b) => a - b);
            // Add the cone boundaries as virtual occupied angles
            const withBounds = [minAllowed, ...coneAngles, maxAllowed];
            let bestGapSize = 0;
            bestAngle = parentAngleFromCenter + (idx + 1) * spreadPerChild; // fallback

            for (let i = 0; i < withBounds.length - 1; i++) {
              const gapSize = withBounds[i + 1] - withBounds[i];
              if (gapSize > bestGapSize) {
                bestGapSize = gapSize;
                bestAngle = withBounds[i] + gapSize / 2;
              }
            }
          }

          // Clamp to allowed range
          bestAngle = Math.max(minAllowed, Math.min(maxAllowed, bestAngle));
          usedAngles.push(bestAngle);

          const baseDistance = (500 + (order - 2) * 150) * spacingMul;
          const jitter = Math.sin(idx * 7.3) * 30;
          const distance = baseDistance + jitter;

          positions.set(c.id, {
            x: parentPos.x + Math.cos(bestAngle) * distance,
            y: parentPos.y + Math.sin(bestAngle) * distance,
          });
        });
      }
    });
  }

  return positions;
}

// ─── resolveCollisions ───────────────────────────────────────────

/**
 * Iteratively pushes overlapping nodes apart.
 * Modifies positions in place and returns the same map.
 *
 * @param positions - Node positions (mutated in place)
 * @param consequences - For looking up node sizes (importance → width)
 * @param iterations - Number of nudge passes (default 5)
 * @returns The same positions map, with overlaps resolved
 */
export function resolveCollisions(
  positions: Map<string, Position>,
  consequences: Consequence[],
  iterations = 5,
): Map<string, Position> {
  // Build a lookup for node dimensions
  const nodeSizes = new Map<string, { w: number; h: number }>();
  nodeSizes.set('seed', { w: 280, h: 120 }); // seed node is larger

  for (const c of consequences) {
    const importance = c.importance || 'medium';
    const scale = IMPORTANCE_SIZES[importance];
    const w = 220 * scale + 24; // base width * scale + padding
    const h = 80 * scale + 16;  // approximate height + padding
    nodeSizes.set(c.id, { w, h });
  }

  const ids = Array.from(positions.keys());
  const padding = 20; // minimum gap between nodes

  for (let iter = 0; iter < iterations; iter++) {
    let hadOverlap = false;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const posA = positions.get(idA)!;
        const posB = positions.get(idB)!;
        const sizeA = nodeSizes.get(idA) || { w: 220, h: 80 };
        const sizeB = nodeSizes.get(idB) || { w: 220, h: 80 };

        // Check bounding box overlap
        const halfWA = (sizeA.w + padding) / 2;
        const halfHA = (sizeA.h + padding) / 2;
        const halfWB = (sizeB.w + padding) / 2;
        const halfHB = (sizeB.h + padding) / 2;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const overlapX = (halfWA + halfWB) - Math.abs(dx);
        const overlapY = (halfHA + halfHB) - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          hadOverlap = true;

          // Push apart along the axis of least overlap
          let pushX = 0;
          let pushY = 0;

          if (overlapX < overlapY) {
            pushX = (overlapX / 2) * (dx >= 0 ? 1 : -1);
          } else {
            pushY = (overlapY / 2) * (dy >= 0 ? 1 : -1);
          }

          // Don't move the seed node
          if (idA === 'seed') {
            positions.set(idB, { x: posB.x + pushX * 2, y: posB.y + pushY * 2 });
          } else if (idB === 'seed') {
            positions.set(idA, { x: posA.x - pushX * 2, y: posA.y - pushY * 2 });
          } else {
            positions.set(idA, { x: posA.x - pushX, y: posA.y - pushY });
            positions.set(idB, { x: posB.x + pushX, y: posB.y + pushY });
          }
        }
      }
    }

    // Early exit if no overlaps found
    if (!hadOverlap) break;
  }

  return positions;
}

// ─── computeFocusPositions ───────────────────────────────────────

/**
 * Computes "focus path" positions when a node is selected.
 *
 * Subtle approach:
 * - Ancestor chain: straightens into a radial beam from center to selected node
 * - Non-chain nodes: stay where they are UNLESS they overlap with a chain node's
 *   new position, in which case they're gently nudged away. The nudge is proportional
 *   to the overlap — nodes barely touching get a small nudge, nodes directly on top
 *   get a bigger push. Nodes far from the chain don't move at all.
 *
 * @param selectedId - The selected node ID
 * @param ancestorChain - Set of node IDs in the ancestor chain (includes seed + selected)
 * @param consequences - All consequences
 * @param currentPositions - Current positions of all nodes (to determine beam angle)
 * @returns Map of ALL node IDs → new focus positions
 */
export function computeFocusPositions(
  selectedId: string,
  ancestorChain: Set<string>,
  consequences: Consequence[],
  currentPositions: Map<string, Position>,
): Map<string, Position> {
  const focusPositions = new Map<string, Position>();

  // Start with all nodes at their current positions
  currentPositions.forEach((pos, id) => focusPositions.set(id, { ...pos }));

  // Seed always at origin
  focusPositions.set('seed', { x: 0, y: 0 });

  const selectedPos = currentPositions.get(selectedId);
  if (!selectedPos || selectedId === 'seed') {
    return focusPositions;
  }

  // ── Beam direction: from center toward selected node ──
  const beamAngle = Math.atan2(selectedPos.y, selectedPos.x);
  const beamDirX = Math.cos(beamAngle);
  const beamDirY = Math.sin(beamAngle);

  // ── Build ordered ancestor chain (seed → ... → selected) ──
  const chainOrdered: string[] = [];
  const consLookup = new Map(consequences.map(c => [c.id, c]));
  {
    let currentId: string | undefined = selectedId;
    while (currentId && currentId !== 'seed') {
      chainOrdered.unshift(currentId);
      const c = consLookup.get(currentId);
      currentId = (c?.parentIds.length ? c.parentIds[0] : undefined);
    }
    chainOrdered.unshift('seed');
  }

  // ── Place chain nodes along the beam ──
  // Each chain node keeps its current distance from center (no radial movement).
  // It only rotates to the beam angle — purely sideways motion.
  // Exception: order-1 nodes don't move at all (they're the first ring and
  // moving them is disorienting).
  // After placement, enforce minimum spacing so chain nodes don't overlap.
  const MIN_CHAIN_SPACING = 200; // minimum distance between consecutive chain nodes on beam
  const chainDists: number[] = [0]; // seed at distance 0

  for (let i = 1; i < chainOrdered.length; i++) {
    const id = chainOrdered[i];
    const c = consLookup.get(id);
    const order = c?.order || 1;
    const currentPos = currentPositions.get(id);
    if (!currentPos) {
      chainDists.push(chainDists[i - 1] + MIN_CHAIN_SPACING);
      continue;
    }

    const currentDist = Math.sqrt(currentPos.x * currentPos.x + currentPos.y * currentPos.y);

    // Order 1: keep at current distance (don't move radially)
    // Orders 2+: keep at current distance but enforce minimum gap from previous chain node
    const prevDist = chainDists[i - 1];
    const enforcedDist = Math.max(currentDist, prevDist + MIN_CHAIN_SPACING);
    chainDists.push(enforcedDist);
  }

  for (let i = 1; i < chainOrdered.length; i++) {
    const id = chainOrdered[i];
    const c = consLookup.get(id);
    const order = c?.order || 1;
    const currentPos = currentPositions.get(id);
    if (!currentPos) continue;

    // Order 1: don't move at all (keep original position)
    if (order === 1) {
      focusPositions.set(id, { ...currentPos });
      continue;
    }

    // Orders 2+: place along beam at the enforced distance
    focusPositions.set(id, {
      x: beamDirX * chainDists[i],
      y: beamDirY * chainDists[i],
    });
  }

  // ── Build node sizes for overlap detection ──
  const nodeSizes = new Map<string, { w: number; h: number }>();
  nodeSizes.set('seed', { w: 280, h: 120 });
  for (const c of consequences) {
    const importance = c.importance || 'medium';
    const scale = IMPORTANCE_SIZES[importance];
    nodeSizes.set(c.id, { w: 220 * scale + 24, h: 80 * scale + 16 });
  }

  // ── Nudge non-chain nodes that overlap with chain nodes ──
  // For each non-chain node, check against every chain node.
  // If overlapping, push it away from the closest chain node.
  // The push strength is proportional to the overlap amount.
  const PADDING = 40; // breathing room around chain nodes
  const chainIds = new Set(chainOrdered);

  for (const c of consequences) {
    if (chainIds.has(c.id)) continue; // skip chain nodes

    const nodePos = focusPositions.get(c.id);
    if (!nodePos) continue;
    const nodeSize = nodeSizes.get(c.id) || { w: 220, h: 80 };

    let totalPushX = 0;
    let totalPushY = 0;

    for (const chainId of chainOrdered) {
      const chainPos = focusPositions.get(chainId)!;
      const chainSize = nodeSizes.get(chainId) || { w: 220, h: 80 };

      const dx = nodePos.x - chainPos.x;
      const dy = nodePos.y - chainPos.y;

      const halfW = (nodeSize.w + chainSize.w + PADDING) / 2;
      const halfH = (nodeSize.h + chainSize.h + PADDING) / 2;

      const overlapX = halfW - Math.abs(dx);
      const overlapY = halfH - Math.abs(dy);

      if (overlapX > 0 && overlapY > 0) {
        // There's an overlap — push away from this chain node
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;

        // Push strength proportional to overlap magnitude
        const overlapMag = Math.min(overlapX, overlapY);
        totalPushX += dirX * (overlapMag + PADDING);
        totalPushY += dirY * (overlapMag + PADDING);
      }
    }

    if (totalPushX !== 0 || totalPushY !== 0) {
      focusPositions.set(c.id, {
        x: nodePos.x + totalPushX,
        y: nodePos.y + totalPushY,
      });
    }
  }

  return focusPositions;
}

// ─── getOptimalHandles ───────────────────────────────────────────

/**
 * Determines the best source/target handle pair based on relative node positions.
 * Extracted here so it can be used by both edge-building and edge-rebuild-on-drag.
 */
export function getOptimalHandles(
  sourcePos: Position,
  targetPos: Position,
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle >= -45 && angle < 45) {
    return { sourceHandle: 'right-source', targetHandle: 'left' };
  } else if (angle >= 45 && angle < 135) {
    return { sourceHandle: 'bottom-source', targetHandle: 'top' };
  } else if (angle >= -135 && angle < -45) {
    return { sourceHandle: 'top-source', targetHandle: 'bottom' };
  } else {
    return { sourceHandle: 'left-source', targetHandle: 'right' };
  }
}
