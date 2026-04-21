# Refactor Plan: B+3 Layout Strategy

**Goal**: Split the monolithic `generateNodesAndEdges` so ReactFlow owns node positions, add collision-nudge anti-overlap, and add a "Tidy Layout" button. Preserve the radial aesthetic with order-based distance bands.

**Files touched**: Primarily `FuturescapeMap.tsx`, minor touches to `ConsequenceNode.tsx` and `index.css`.

---

## Architecture Overview: Before → After

### Before (current)
```
consequences change → generateNodesAndEdges() → computes ALL positions from trig
                                                → builds ALL node data objects
                                                → builds ALL edge objects
                                                → setNodes(newNodes), setEdges(newEdges)
                                                → ReactFlow renders

click/filter/edit → same function re-runs → ALL positions recomputed → drags lost
```

### After (target)
```
consequences change → computeLayout() → positions for NEW nodes only (radial + nudge)
                    → buildEdges()    → edges for ALL connections (using current positions)
                    → addNodes/removeNodes via setNodes(prev => ...)
                    → ReactFlow renders, owns positions

click/filter/edit  → updateNodeData() → setNodes(prev => prev.map(update data only))
                   → NO position recomputation, NO edge rebuild (unless structure changed)

"Tidy Layout" btn  → computeLayout(force=true) → recomputes ALL positions → collision nudge
                   → setNodes with new positions → setEdges with new handles
```

---

## Phase 1: Extract Layout Computation (Pure Function)

**What**: Pull the radial position math out of `generateNodesAndEdges` into a standalone pure function `computeRadialLayout()`.

**New function signature**:
```ts
function computeRadialLayout(
  consequences: Consequence[],
  existingPositions?: Map<string, {x: number, y: number}>,  // for incremental adds
  forceRelayout?: boolean  // true = ignore existingPositions (Tidy Layout)
): Map<string, {x: number, y: number}>
```

**What it does**:
- Seed always at (0, 0)
- For each consequence: if `existingPositions` has it AND `!forceRelayout`, keep existing position
- Otherwise, compute from radial math:
  - Order 1: ring at radius based on count (current `calculateRadius` logic)
  - Orders 2-5: positioned along arc emanating from parent's position
  - Parent position comes from `existingPositions` if available, else from just-computed positions
- Distance from center is order-dependent but should be a **range** (band), not a fixed radius:
  - Order 1: 400–600 from center
  - Order 2: 750–1050
  - Order 3: 1200–1600
  - Order 4: 1700–2100
  - Order 5: 2200–2600
  - Within each band, actual radius varies by node count and parent angle
- Returns a Map of id → {x, y}

**What changes**:
- Move lines 497-530 (radius calculation) and lines 531-567 (order-1 placement) and lines 597-708 (orders 2-5 placement) into this new function
- The function does NOT create node objects or edges — just positions

**Risk**: The parent-relative positioning for orders 2-5 currently reads `nodePositions[parentId]` which is built up as the function runs. We need to handle the case where a parent exists in `existingPositions` (was already laid out) vs. just computed in the same batch. Order of iteration matters.

---

## Phase 2: Add Collision Nudge Pass

**What**: After `computeRadialLayout`, run a collision-nudge pass that resolves overlapping nodes.

**New function**:
```ts
function resolveCollisions(
  positions: Map<string, {x: number, y: number}>,
  consequences: Consequence[],  // to look up importance for node size
  iterations?: number  // default 5
): Map<string, {x: number, y: number}>
```

**Algorithm**:
1. For each pair of nodes, compute bounding box (width depends on importance scale)
2. If boxes overlap, compute overlap vector and push both apart by half the overlap distance
3. Repeat for `iterations` rounds
4. Optionally: after nudging, clamp nodes back into their order's radial band so they don't drift too far

**What changes**: New utility function, called after `computeRadialLayout` in both the initial layout path and the Tidy Layout path.

**Risk**: O(n²) per iteration. For 100 nodes × 5 iterations = 50K comparisons. Should be <10ms. If graphs grow to 500+ nodes, we'd want spatial partitioning (quadtree), but that's a future optimization.

---

## Phase 3: Split generateNodesAndEdges into Three Functions

This is the core architectural change.

### 3a: `buildNodeData(consequence, uiState)` — builds a single node's data object

**What**: Extract the data-object construction into a helper. Given a consequence and the current UI state (activeNodeId, editingNodeId, etc.), return the `data` field for a ReactFlow node.

**Why**: This is reused by both "create new node" and "update existing node" paths.

### 3b: `syncGraphStructure(consequences, nodes)` — structural sync

**What**: Called when `consequences` array changes. Diffs against current `nodes`:
- New consequence IDs not in nodes → compute position (via layout), create node, add to graph
- Consequence IDs removed from array → remove node from graph
- Existing IDs → update data only (no position change)

Also rebuilds edges (since edges depend on which consequences exist and their parent relationships).

**Edge handle calculation**: Currently uses position data to pick optimal handles. After refactor, we read positions from the current `nodes` array (ReactFlow state). For newly added nodes, we use their just-computed positions. For existing nodes that were dragged, we use their current position — so edge handles update correctly even after dragging.

**Dependency array**: Only `consequences` and things needed for data construction. NOT `activeNodeId` etc.

### 3c: `updateNodeDataOnly(nodes, uiState)` — data-only update

**What**: Called when UI state changes (click, filter, edit, etc.) WITHOUT structural changes. Uses `setNodes(prev => prev.map(...))` to update each node's data field. Never touches positions.

**What triggers it**: `activeNodeId`, `editingNodeId`, `isGeneratingChildrenFor`, `isGeneratingIdeasFor`, `highlightFilters`, `generationPhase`, `showNewHighlight`, `lastExpansionTime`, `isGenerationRunning`, `getAncestorChain`.

**Key insight**: This is the function that runs on every click/filter. Because it only calls `setNodes(prev => prev.map(...))` without creating new node objects (just updating data), ReactFlow can diff efficiently and positions are never touched.

### What gets deleted

The current `generateNodesAndEdges` useCallback (lines 470-719) and its useEffect (lines 722-725) are replaced by:
- `computeRadialLayout` (pure function, outside component)
- `resolveCollisions` (pure function, outside component)
- `syncGraphStructure` (useCallback, depends on consequences + layout functions)
- `updateNodeDataOnly` (useCallback, depends on UI state)
- Two separate useEffects:
  - `useEffect(() => syncGraphStructure(...), [consequences])` — structural changes
  - `useEffect(() => updateNodeDataOnly(...), [activeNodeId, editingNodeId, ...uiState])` — data changes

---

## Phase 4: Tidy Layout Button

**What**: Add a button (in the floating controls area or sidebar) that re-runs `computeRadialLayout(force=true)` + `resolveCollisions` and applies the result.

**UI location**: Bottom-right corner near ReactFlow's built-in controls, or as a small button in the sidebar header area. Visually: a "grid" or "layout" icon.

**Behavior**:
1. Read current consequences
2. Run `computeRadialLayout(consequences, undefined, true)` — ignores all existing positions
3. Run `resolveCollisions(positions, consequences)`
4. Apply new positions: `setNodes(prev => prev.map(n => ({...n, position: newPositions.get(n.id) || n.position})))`
5. Rebuild edges with new handle directions
6. Optionally: call `fitView()` on the ReactFlow instance to re-center

**What changes**: New button in the JSX, new handler function. Needs a `reactFlowInstance` ref (via `onInit` callback) for `fitView()`.

---

## Phase 5: Edge Rebuild on Drag

**What**: When a node is dragged, edge handles may become stale (edge enters from wrong side). We need to recalculate edges when positions change significantly.

**Options** (choose one):
- **A: Rebuild edges on drag end** — listen to `onNodeDragStop`, recalculate `getOptimalHandles` for edges connected to the dragged node, update those edges only. Efficient, only fires on drag end.
- **B: Remove explicit handle selection entirely** — use ReactFlow's default edge routing (no sourceHandle/targetHandle). Edges connect center-to-center and ReactFlow picks the best path. Simpler but less control over aesthetics.
- **C: Rebuild all edges on any position change** — overkill, but simple to implement. Just recalculate edges in a debounced handler.

**Recommendation**: Option A. Surgical, efficient, preserves the current handle-optimization aesthetic.

---

## Implementation Order

1. **Phase 1** (extract layout) — Lowest risk, no behavior change. Creates the foundation.
2. **Phase 2** (collision nudge) — Immediately visible improvement, still no architectural change.
3. **Phase 3** (split the function) — The big one. This is where snap-back gets fixed.
4. **Phase 5** (edge rebuild on drag) — Fixes edge handles after the split enables dragging.
5. **Phase 4** (Tidy Layout button) — Polish. Only meaningful after positions persist.

---

## Risk Areas

1. **Placeholder nodes during AI generation**: Placeholders are added to `consequences`, then replaced with real nodes. The structural sync needs to handle this cleanly — removing placeholders and adding real nodes in the same batch, computing positions for the real nodes.

2. **Edge animation during generation**: Currently, edges get `animated: true` during specific generation phases. The data-only update path needs to handle edge styling changes too, not just node data. Edges may need their own update path.

3. **Seed node is special**: It's not in the `consequences` array. It's always at (0,0). The structural sync needs to handle it as a constant fixture, not a dynamic node.

4. **Manual mode + blank nodes**: When a user creates a blank node via "Add Child", it has empty text and goes straight into edit mode. The structural sync needs to place it and immediately set `isEditing: true`.

5. **getAncestorChain for z-index**: Currently computed inside `generateNodesAndEdges`. After split, it needs to be applied in `updateNodeDataOnly`. The z-index is a node property, not a data property — so we need `setNodes(prev => prev.map(n => ({...n, zIndex: ..., data: {...n.data, ...}})))`.

6. **Filter-driven edge styling**: When filters change, edges need their `opacity` and `strokeWidth` updated (dimmed edges for dimmed nodes). This means edge updates need to happen in the data-only path too, not just the structural path.

---

## Rollback Strategy

If the refactor goes wrong mid-way:
- The current `generateNodesAndEdges` function is the single source of truth. As long as we don't delete it until the replacements are fully working, we can always revert by switching back to the old useEffect.
- **Approach**: Build the new functions alongside the old one. Wire them up with a feature flag or just swap the useEffect. Only delete the old function once the new system is verified.

---

## Change Log (updated during implementation)

### Phase 1 + 2: Extract Layout + Collision Nudge
- Status: COMPLETE
- Created new file `src/layout.ts` with three pure functions:
  - `computeRadialLayout(consequences, existingPositions?, forceRelayout?)` — computes radial positions with order-based bands, supports incremental placement (only computes positions for nodes not in existingPositions)
  - `resolveCollisions(positions, consequences, iterations?)` — bounding-box overlap detection, pushes overlapping nodes apart iteratively, seed node is pinned (never moves), uses IMPORTANCE_SIZES for variable node widths
  - `getOptimalHandles(sourcePos, targetPos)` — extracted from FuturescapeMap so it can be shared between edge building and edge-rebuild-on-drag
- ORDER_BANDS defined as min/base pairs: Order 1 (400/500), Order 2 (750/900), etc. Actual radius expands with node count.
- Incremental placement for order-1 nodes: finds angular gaps between existing nodes and fills them, rather than redistributing all nodes evenly
- Issues: None. Clean compile on first try.

### Phase 3: Split generateNodesAndEdges
- Status: COMPLETE
- Deleted the monolithic `generateNodesAndEdges` useCallback (~250 lines) and its useEffect
- Replaced with four new functions:
  1. `buildEdges(consequences, positionMap)` — builds all edge objects from current positions. Extracted edge-building logic that was previously inline in the main function. Uses imported `getOptimalHandles`.
  2. `buildConsequenceData(consequence)` — builds the data object for a single consequence node. All the interactive state (isSelected, isDimmed, callbacks) in one place, reused by both sync and update paths.
  3. `syncGraphStructure()` — runs when consequence IDs change. Diffs current vs. previous IDs. Computes positions for new nodes only (via computeRadialLayout + resolveCollisions reading existing positions from ReactFlow state). Adds new nodes, removes deleted nodes, updates data on existing nodes.
  4. `updateNodeDataOnly()` — runs on UI state changes (click, filter, edit). Uses `setNodes(prev => prev.map(...))` to update data and zIndex without touching positions. Also updates edge styling (dimming, animation phase).
- Two separate useEffects:
  - Structural: triggers on consequences ID fingerprint change (sorted IDs joined)
  - Data-only: triggers on activeNodeId, editingNodeId, filter changes, generation state, etc.
- Added `prevConsequenceIdsRef` to track previous consequence set for diffing
- Added `prevConsequenceJsonRef` for fingerprint-based structural change detection
- Seed node handled as constant fixture: always present, always at (0,0), data updated in both paths
- Issues: Had to carefully handle the edge case where `syncGraphStructure` reads `nodes` from ReactFlow state for existing positions — this creates a dependency on `nodes` in the useCallback, but the useEffect only triggers on consequence fingerprint changes, not on every node position update. This is correct behavior.

### Phase 4: Tidy Layout Button
- Status: COMPLETE
- Added `handleTidyLayout` callback: calls `computeRadialLayout(consequences)` with no existing positions (full recompute), then `resolveCollisions`, applies positions via `setNodes(prev => prev.map(...))`, rebuilds edges
- Added button in the ReactFlow canvas area (top-right, absolute positioned): LayoutGrid icon + "Tidy Layout" text, only visible when generation is complete and consequences exist
- Styled as a subtle floating button matching the app's white/blur aesthetic

### Phase 5: Edge Rebuild on Drag
- Status: COMPLETE
- Added `handleNodeDragStop` callback: on drag stop, finds all edges connected to the dragged node, recalculates their sourceHandle/targetHandle using the node's new position via `getOptimalHandles`
- Wired to ReactFlow via `onNodeDragStop={handleNodeDragStop}`
- Only updates edges for the dragged node, not all edges — efficient for single-node drags

### All Phases: TypeScript Verification
- `npx tsc --noEmit` passed cleanly after all phases
- No type errors, no unused imports
- `LayoutGrid` icon imported from lucide-react for the Tidy Layout button
- `ConsequenceNodeData` imported from ConsequenceNode.tsx (already exported)
- `computeRadialLayout`, `resolveCollisions`, `getOptimalHandles`, `Position` imported from layout.ts

### Architecture Notes for Future Reference
- The old `generateNodesAndEdges` was ~250 lines and ran on EVERY interaction (click, filter, hover)
- The new architecture: structural sync runs only on consequence array changes; data-only update runs on interaction — positions are never touched by the data-only path
- If you need to revert: the old function is fully replaced, not preserved alongside. To revert, restore FuturescapeMap.tsx from git and delete src/layout.ts. The old approach was: one useCallback + one useEffect that rebuilt everything.
- The `nodes` dependency in `syncGraphStructure` is intentional — it reads current positions. But the useEffect that calls it only fires on consequence fingerprint changes, so it won't create an infinite loop.
- Edge handles are recalculated in three places: (1) syncGraphStructure when edges are first built, (2) updateNodeDataOnly preserves existing handles (only updates styling), (3) onNodeDragStop recalculates handles for the dragged node's edges

### Phase 6: Focus-Path on Select
- Status: COMPLETE
- New pure function `computeFocusPositions()` in `layout.ts`:
  - Takes selectedId, ancestorChain, consequences, currentPositions
  - Straightens ancestor chain into a radial beam from (0,0) toward the selected node's original angle
  - Siblings of chain nodes fan out perpendicular to the beam (60° spread, 350px from parent)
  - Descendants of selected node fan out along beam direction (90° spread)
  - Unrelated nodes pushed away from beam if within 400px perpendicular distance
  - Returns new positions for ALL nodes
- New state in `FuturescapeMap.tsx`:
  - `preFocusPositionsRef` — saves positions before any focus animation
  - `focusAnimClass` — toggles CSS transition class on the ReactFlow wrapper
  - `prevActiveNodeIdRef` — tracks previous activeNodeId to detect changes
- New useEffect on `activeNodeId`:
  - On focus (node selected): saves original positions, computes focus layout from original positions, applies with 400ms CSS transition
  - On switch (different node selected): reuses saved original positions, computes new focus layout
  - On unfocus (deselect): restores original positions with 300ms CSS transition, clears refs
  - Skipped during generation (too many nodes changing)
- CSS in `index.css`:
  - `.focus-animating .react-flow__node` — 400ms ease-out transition on transform
  - `.unfocus-animating .react-flow__node` — 300ms ease-out transition on transform
- Tidy Layout handler clears `preFocusPositionsRef` since it resets all positions
- Bug fixes in same commit:
  - `prevConsequenceJsonRef` initialized to `'__uninitialized__'` (was `''`) — fixes seed node not appearing in manual mode
  - Removed `backdrop-filter: blur(8px)` from `.consequence-node` — fixes blur on selected nodes
