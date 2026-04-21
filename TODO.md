# Futurescaper — Task Tracker & Notes

## Active / In-Progress

### Radial Menu Redesign
- Current layout is scattered (buttons at cardinal/diagonal positions around node)
- Redesign: group Edit + Delete together (management), group Add Child + AI Expand + Ideas together (creation)
- Should look clean and make logical sense for the user

### Node Hover Expansion
- On hover (~500ms delay), smoothly expand the node to show full metadata
- Full text, STEEPE category name, probability, importance, order, timeframe
- Replaces the need to look at the sidebar DetailPanel for basic info

### Parent Chain Z-Index
- When a node is selected or hovered, bring its entire ancestor chain to the front
- Fixes overlap problem where nodes cover each other on the graph

### Fix: AI-Generated Nodes Missing Radial Menu
- Bug: orders 2–5 in `generateNodesAndEdges` are missing `onGenerateIdeas` and `isGeneratingIdeas` props
- Radial menu guard clause requires ALL callbacks → menu never shows on expanded nodes

### Chakra UI Filter Bar (Exploration)
- Floating filter bar at top-center of graph canvas (like Google Maps filter chips)
- Replaces sidebar highlight filters section
- Not using Chakra UI currently — need to decide on component library or build custom
- **Status**: Needs discussion — may build custom floating toolbar instead

---

## Pinned / Future Exploration

### Double-Click Canvas to Create Node (#6)
- Double-clicking empty canvas space creates a floating unconnected node
- User drags near a parent to connect
- Needs more discussion on whether it fits the workflow

### TL;DR Summary as Floating Overlay (#7)
- Could become a collapsible floating card in a graph corner
- Currently works fine in sidebar; low priority

### Related Subjects as Satellite Nodes (#8)
- Show related subjects as small satellite nodes around the seed
- Visually distinct (different shape/color), clickable to start new exploration
- High complexity, interesting UX experiment — pin for later

### Export as Floating Action Button (#9)
- Move export functions (CSV, JSON, Markdown, Share) to a FAB in corner
- Low priority — sidebar works fine, revisit once other floating UI is in place

### Sidebar Cleanup
- Once on-graph interactions are mature, remove redundant sidebar buttons:
  - "Expand Node" button in DetailPanel (already done via radial AI Expand)
  - "Generate Ideas" button in DetailPanel (already done via radial Ideas)
  - Edit/Delete buttons in DetailPanel (already done via radial)
- Keep in sidebar: Generation Progress, Scenario Header/Back, TLDR Summary, Export

---

## Completed

- Interactive radial menu on nodes (5 buttons: Edit, Add Child, AI Expand, Ideas, Delete)
- Interactive seed node with radial menu (Add Child, AI Generate)
- AI-generated placeholder/skeleton nodes during async generation
- Manual mode button on InputForm
- Inline on-graph editing with full property selectors
- Disable editing during generation
- `buildChildConsequencesPrompt` and `generateChildConsequencesWithAI` API functions
- CSS animations for radial menu (staggered spring animation)
- Delete confirmation with branch warning (descendant count)
- "Generate Ideas" button added to radial menu
- ARCHITECTURE.md and UI-ELEMENTS.md updated for Futurescaper
