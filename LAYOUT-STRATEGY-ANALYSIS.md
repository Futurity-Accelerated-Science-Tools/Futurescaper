# Layout Strategy Analysis: Position Management × Anti-Overlap

## Current Architecture (The Problem)

`generateNodesAndEdges` is a single `useCallback` that rebuilds **every** node and edge from scratch on every call. It runs inside a `useEffect` that triggers whenever `consequences`, `filteredConsequences`, `highlightFilters`, or the function itself changes — and the function depends on `activeNodeId`, `editingNodeId`, `isGeneratingChildrenFor`, and a dozen handler references. This means:

- **Every click** (selecting a node) → full rebuild → all positions recomputed from radial math → any dragged positions lost
- **Every filter toggle** → full rebuild → same
- **Every edit/generate** → full rebuild → same

Positions are never stored. They exist only as outputs of trigonometry inside the function, computed fresh each time. ReactFlow's internal position tracking (via `onNodesChange`) is active but gets overwritten by the next `setNodes(newNodes)` call.

The export system (`miroExport.ts`) also independently computes radial positions for JSON export — it doesn't read from ReactFlow's state.

---

## Position Management Strategies

### Strategy A: Store Dragged Positions in State

**Mechanism**: Add `nodePositions: Map<string, {x, y}>` to component state. In `generateNodesAndEdges`, check if a stored position exists before computing from radial math. Capture drags via `onNodesChange` and write them into the map.

**Refactoring complexity**: LOW-MEDIUM. Add one state variable, modify position lookup in `generateNodesAndEdges`, add an `onNodesChange` handler that captures position changes. ~50 lines changed.

**Performance**: POOR. Still rebuilds the entire node array on every click/filter change. Every interaction creates N new node objects, which ReactFlow diffs internally. The position lookup adds negligible cost, but the root inefficiency (full rebuild on interaction) remains.

**Save/reload**: EASY. The `Map<string, {x, y}>` can be serialized alongside consequences. Add `position?: {x: number, y: number}` to the `Consequence` type or keep a parallel structure. On import, positions restore exactly.

**Incremental node addition**: GOOD. New nodes get computed positions. Existing nodes keep stored positions. No disruption to the existing layout.

**Drag persistence**: YES — that's the whole point.

**Future extensibility**: LIMITED. You're patching around the core problem (full rebuilds) rather than fixing it. Adding more interactive features (like animated transitions, collision avoidance on drag) gets increasingly awkward because every interaction still triggers a full rebuild that fights against the stored positions.

---

### Strategy B: Let ReactFlow Own Positions

**Mechanism**: Split `generateNodesAndEdges` into two concerns:
1. **`createNodes`** — only runs when `consequences` array changes (new nodes added/removed). Computes positions for new nodes, preserves existing ones.
2. **`updateNodeData`** — runs on click/filter/edit changes. Uses `setNodes(prev => prev.map(node => ({...node, data: newData})))` to update data without touching positions.

ReactFlow's internal state becomes the source of truth for positions. Drags are handled natively.

**Refactoring complexity**: HIGH. This is an architectural change. The current monolithic `generateNodesAndEdges` must be decomposed. The `useEffect` that triggers it needs to be split into separate effects for structural changes vs. data updates. Every handler that currently triggers a full rebuild needs to be re-evaluated. Estimate: 200-300 lines rewritten/restructured.

**Performance**: EXCELLENT. Data-only updates (clicks, filters, hover) no longer recreate node objects — they just update the `data` field. ReactFlow can diff efficiently. Position calculations only run when the graph structure actually changes (new consequences added). This is 10-50x fewer node rebuilds during typical interaction.

**Save/reload**: MEDIUM. Positions live inside ReactFlow's state (accessed via `useNodes()` or the `nodes` array from `useNodesState`). To export, you'd read current positions from `nodes` and serialize them. On import, you'd supply them as initial positions. Doable but requires coordination between ReactFlow state and your export logic.

**Incremental node addition**: EXCELLENT. New nodes get computed positions and are appended. Existing nodes are untouched. This is exactly how ReactFlow is designed to work.

**Drag persistence**: YES — natively. ReactFlow handles it with zero additional code.

**Future extensibility**: EXCELLENT. This architecture cleanly separates "what exists on the graph" from "how it looks right now." Adding animated transitions, collision avoidance, force simulation, viewport-aware rendering — all become much simpler because you're working with ReactFlow's grain rather than against it.

---

### Strategy C: Hybrid — Initial Layout + Drag Persistence

**Mechanism**: Track which node IDs have been laid out in a `Set<string>` (or `useRef`). In `generateNodesAndEdges`, check: if a node's ID is in the set AND exists in the current ReactFlow nodes array, use its current position (read from `nodes`). Otherwise, compute from radial math and add to the set. Add a "Reset Layout" button that clears the set and forces full recomputation.

**Refactoring complexity**: MEDIUM. Modify `generateNodesAndEdges` to accept current nodes and do position lookups. Add a `laidOutNodes` ref. ~80-100 lines changed. The function still rebuilds all node objects on every interaction, but preserves positions for existing nodes.

**Performance**: MEDIOCRE. Still rebuilds the full node array on every click/filter. The position lookup adds a small cost (reading from the existing nodes array). Better than A (no separate position map to sync), worse than B (still doing unnecessary work).

**Save/reload**: MEDIUM. Same challenge as B — positions live in ReactFlow state. You'd read them from the nodes array at export time. On import, you'd need to supply initial positions, then mark them as "already laid out."

**Incremental node addition**: GOOD. New nodes get computed positions; existing nodes keep their current positions from ReactFlow.

**Drag persistence**: YES — by reading positions from the current nodes array, drags are preserved as long as the node still exists.

**Future extensibility**: MODERATE. It's a stepping stone toward B. You still have the monolithic rebuild function, but positions are stable. You could incrementally refactor toward B later.

---

## Anti-Overlap Strategies

### Strategy 1: Push-Apart on Select

**Mechanism**: When a node is selected, compute bounding box overlaps with nearby nodes. Apply temporary CSS `translate` offsets to push overlapping nodes outward. On deselection, animate them back. This runs as a separate pass after `generateNodesAndEdges`, modifying node positions in place.

**Performance**: GOOD for small neighborhoods. O(n) scan of nearby nodes per selection. Animation is CSS-only (GPU-accelerated).

**Layout quality**: LOW globally, HIGH locally. Solves the immediate problem (I can see what I clicked) but doesn't fix the overall layout. Nodes still overlap when nothing is selected.

**Interaction with position management**:
- With A: Conflicts — you'd need to distinguish "real stored positions" from "temporary push offsets." Complex.
- With B: Clean — apply offsets as ReactFlow node position deltas, restore on deselect. But modifying positions in ReactFlow state for temporary effects is a bit hacky.
- With C: Same conflict as A — how do you know if a position is "temporarily pushed" vs. "intentionally dragged"?

**Incremental node addition**: N/A — this is reactive, not layout-time. New nodes don't trigger push-apart unless selected.

---

### Strategy 2: Force-Directed Layout (d3-force)

**Mechanism**: After computing initial radial positions, run a d3-force simulation. Nodes have charge (repel each other) and are constrained to their approximate radial band. Edges act as springs. Simulation runs for 100-300 ticks, then stabilizes. Can be configured with: collision radius (prevents overlap), radial force (keeps order-based ring structure), link force (pulls connected nodes toward each other).

**Performance**: MODERATE at layout time (50-300ms for ~100 nodes). Zero cost during interaction — simulation only runs on structural changes.

**Layout quality**: EXCELLENT. Produces the most readable, naturally-spaced layouts. Handles any density gracefully. The radial constraint keeps the "orders emanating outward" aesthetic while preventing overlaps.

**Interaction with position management**:
- With A: Good fit. d3-force produces initial positions → store them → drags override → on "Reset Layout," re-run simulation.
- With B: BEST fit. d3-force computes positions for new nodes → ReactFlow owns them after → drags work natively → on new node addition, run incremental simulation only for new nodes.
- With C: Good fit. Same as A but positions read from ReactFlow state.

**Incremental node addition**: GOOD with care. When 3 new child nodes are added, you can run a "warm start" simulation that only moves the new nodes (fixing the old ones). This avoids disrupting the entire layout.

**Dependency**: Adds d3-force (~30KB gzipped). Well-maintained, tree-shakeable.

---

### Strategy 3: Collision Detection + Nudge

**Mechanism**: After computing radial positions, run 3-5 iterations of overlap resolution: for each node pair, check if bounding boxes overlap. If they do, push both nodes apart along the vector between their centers, each moving half the overlap distance. Repeat until no overlaps remain (or max iterations reached).

**Performance**: GOOD. O(n²) per iteration × 3-5 iterations. For 100 nodes, that's ~50K comparisons — runs in <5ms. Can be optimized with spatial partitioning if needed.

**Layout quality**: GOOD for moderate density. Resolves direct overlaps while preserving the radial structure. Doesn't optimize for readability (edge crossings, proximity to parent) — just eliminates box collisions.

**Interaction with position management**:
- With A: Simple — nudge runs after radial math, results stored. Clean separation.
- With B: Simple — nudge runs when new nodes are created, results fed to ReactFlow.
- With C: Simple — same as B.

**Incremental node addition**: GOOD. When new nodes are added, run nudge only in the local neighborhood (existing nodes nearby + new nodes). Cheap and non-disruptive.

**Dependency**: None. Pure geometry math.

---

### Strategy 4: Expand Radius Dynamically

**Mechanism**: Already partially implemented. When computing ring radii, factor in actual node widths (which vary by importance) and ensure minimum arc spacing. Add angular jitter to prevent alignment across rings.

**Performance**: EXCELLENT. Just math during initial layout. Zero additional cost.

**Layout quality**: LOW-MODERATE. Fixes same-ring crowding but cannot prevent cross-ring overlaps (a large "critical" 2nd-order node overlapping a small 3rd-order node on the ring behind it). Also, aggressive radius expansion makes the graph very large, requiring more zooming.

**Interaction with position management**: Compatible with all. It's a modification to the existing radial math, not a separate pass.

**Incremental node addition**: POOR for re-added nodes. When AI generates 3 new children in a ring that's already full, the radius needs to expand, which moves ALL nodes on that ring. This is disruptive if those nodes have been manually arranged.

**Dependency**: None.

---

## Combination Rankings

Evaluated on 6 dimensions (5-point scale: 1=poor, 5=excellent):

| Combination | Refactor | Perf | Save/Reload | UX Quality | Incremental | Extensibility | **Total** |
|---|---|---|---|---|---|---|---|
| **B + 2** (ReactFlow owns + d3-force) | 2 | 5 | 4 | 5 | 5 | 5 | **26** |
| **C + 2** (Hybrid + d3-force) | 3 | 3 | 4 | 5 | 4 | 3 | **22** |
| **B + 3** (ReactFlow owns + collision nudge) | 2 | 5 | 4 | 4 | 4 | 5 | **24** |
| **C + 3** (Hybrid + collision nudge) | 4 | 3 | 3 | 4 | 4 | 3 | **21** |
| **A + 2** (Stored positions + d3-force) | 3 | 2 | 5 | 5 | 4 | 2 | **21** |
| **A + 3** (Stored positions + collision nudge) | 4 | 2 | 5 | 4 | 4 | 2 | **21** |
| **C + 4** (Hybrid + expand radius) | 5 | 4 | 3 | 2 | 2 | 3 | **19** |
| **B + 1** (ReactFlow owns + push-apart) | 2 | 4 | 4 | 3 | 3 | 4 | **20** |
| **A + 4** (Stored positions + expand radius) | 5 | 2 | 5 | 2 | 2 | 2 | **18** |

---

## Top 3 Recommendations

### 1st Pick: B + 2 (ReactFlow Owns Positions + d3-Force Layout) — Score: 26

**Why**: This is the "do it right" option. Splitting the monolithic rebuild function is the single highest-impact architectural improvement. It fixes the snap-back, eliminates unnecessary re-renders, and makes every future feature easier. d3-force produces the best layouts and handles density gracefully. Together, they solve both problems completely and set up the codebase for everything on the roadmap (floating filters, satellite nodes, etc.).

**The catch**: Highest refactoring effort. The `generateNodesAndEdges` decomposition touches the most critical function in the app. It needs careful testing.

**Implementation approach**: Phase 1: Split `generateNodesAndEdges` into structural updates vs. data updates (~2-3 hours). Phase 2: Add d3-force layout (~1-2 hours). Phase 3: Polish transitions and incremental simulation (~1 hour).

### 2nd Pick: B + 3 (ReactFlow Owns Positions + Collision Nudge) — Score: 24

**Why**: Same architectural benefits as B+2 but with a simpler anti-overlap strategy. No new dependency. Collision nudge is fast, deterministic, and preserves the radial aesthetic more faithfully than d3-force. If you like the current radial look and just want to eliminate overlaps, this is the way.

**The catch**: Same refactoring effort for the position management side. Collision nudge doesn't produce layouts as readable as d3-force for very dense graphs — it just eliminates box overlaps without optimizing for readability.

**When to prefer over B+2**: If you want to keep the strict radial ring structure and avoid the "organic" look of force-directed layout. Also if you want to avoid adding d3-force as a dependency.

### 3rd Pick: C + 3 (Hybrid + Collision Nudge) — Score: 21

**Why**: The pragmatic "get it working now" option. Smallest refactoring effort that still solves snap-back AND overlap. You keep the existing `generateNodesAndEdges` structure and just add position preservation + a nudge pass. Can be done in 1-2 hours.

**The catch**: You're still doing full node rebuilds on every click. Performance is acceptable for graphs under ~200 nodes but will become an issue at scale. It's also harder to evolve toward more sophisticated features (animated transitions, real-time collision avoidance) because the monolithic rebuild function is still in the way.

**When to prefer**: If you want to ship a fix quickly and refactor the architecture later. This is a valid stepping stone toward B+2 or B+3.

---

## Suggested Path

If you want to be pragmatic: **Start with C+3** (ship a fix this session), then refactor toward **B+2** (proper architecture) in a follow-up session.

If you want to do it right the first time: **Go straight to B+2** or **B+3** (your choice depends on whether you want the organic d3-force look or the strict radial look with nudge).

Either way, **Strategy 1 (push-apart on select)** can be layered on TOP of any combination as an additional UX polish later — it's not mutually exclusive with the others.
