# Futurescaper — Task Tracker & Notes

## Pinned / Future Exploration

### Right-Click Tutorial Pop-Up
- Right-click on canvas creates an unconnected node (replaced the old double-click idea)
- Need a dismissable tutorial/hint that tells users this is an option
- Could be a small toast or overlay on first visit

### TL;DR Summary as Floating Overlay
- Could become a collapsible floating card in a graph corner
- Currently works fine in sidebar; low priority

### Related Subjects / Knowledge Graph Exploration
- Show related subjects as small satellite nodes around the seed
- Visually distinct (different shape/color), clickable to start new exploration
- Bigger idea: a knowledge graph view that includes both consequences AND subjects
- Subjects are currently fetched relative to the seed scenario + all consequences (keyword pre-filter from a static list, then LLM selects up to 20 direct + 10 tangential)
- **Approach: single-pass node linking** — extend the existing LLM subject-selection prompt to also return `relatedNodeIds` for each subject, mapping which consequences each subject is most relevant to. This gives us subject↔node edges for a knowledge graph without extra API calls. The prompt already receives the first 25 consequences; just ask the LLM to tag each selected subject with the IDs of its most related nodes.
- High complexity, interesting UX experiment �� pin for later

### Input Form as Left Panel State
- App should open to the visualization board (empty canvas with an empty-state seed node)
- The input form becomes a wider state of the left panel — same panel, two states
- First state (input mode): wider panel with the form
- After submission: panel narrows to the normal left panel (filters, export, etc.)
- Avoids the current "separate page" feel of the input form
- Consider an empty/placeholder seed node that invites the user to fill in the scenario
- **Priority**: After reports are done (Goal 2)

---

## Goal 2: Reports ✅ Complete

### Completed
- Extended `RelevantSubject` type with `relatedConsequenceIds` for subject↔consequence linking
- Updated `findRelevantSubjects` prompt to return consequence IDs per subject (with validation against hallucinated IDs)
- Refactored subject-finding trigger: `refreshSubjects()` reusable by sidebar, retry, and report pipeline; `areSubjectsStale()` tracks graph changes
- Defined report types: `ReportData`, `ReportSection`, `ReportSubSection`, `GraphStatistics`, `StructuralInsights`, `ReportGenerationPhase`
- Built Layer 1 (algorithmic graph statistics): STEEPE distribution, sentiment balance, probability/importance/timeframe/order analysis, cascading risk chains, unsolved consequence detection (`src/utils/graphStats.ts`)
- Built structural insights: convergence points, leverage points, sentiment inversions, blind spot detection, cross-domain bridges (`src/utils/graphStats.ts`)
- Built Layer 3 (AI report synthesis): structured prompt for Executive Summary, Key Risks & Wildcards, Opportunities & Recommendations; includes Statistics and Methodology sections (`src/api/reportGeneration.ts`)
- Built `ReportPanel` component: full-screen slide-in with collapsible section cards, floating TOC, distribution bars, Engine-aligned styling (`src/components/ReportPanel.tsx`)
- Integrated report pipeline into `FuturescapeMap`: Generate Report button in sidebar, 3-phase orchestration (stats → subjects → synthesis), View Report / Regenerate UX
- **HTML Export** — self-contained standalone HTML file via DOM snapshot approach:
  - `reportHtmlExport.ts`: Collects all CSS from `document.styleSheets` + CSS variables from `:root`, snapshots WebGL canvases as PNG data URLs, clones the rendered DOM, cleans up (strips interactive controls, fixes positioning, removes `[data-export-hide]` elements)
  - Pre-rendered tooltip cards: All `ConsequenceCardPreview` components rendered into hidden container during export prep, survive DOM cloning with inline styles
  - Vanilla JS interactivity injected into export: click-to-show card tooltips on consequence chips (`[data-chip-id]`), risk chart dots (`[data-consequence-id]` → sidebar), and ReactFlow map nodes (`.react-flow__node[data-id]`)
  - Export preparation flow: forces light mode, expands all collapsible sections via `forceExpanded` prop, resets ReadOnlyMap viewport via `resetView` prop, then snapshots
  - Google Fonts fallback for JetBrains Mono (app fonts don't resolve from `file://`)
  - Knowledge graph (Cosmograph WebGL) hidden from export (canvas snapshot unreliable)
- Fixed solution/idea counting in `computeGraphStatistics` — ideas/solutions stored as `Consequence` objects with `nodeType: 'solution' | 'idea'` are now counted correctly for total solutions, solved/unsolved detection
- Added 3 new example scenarios to InputForm (Antibiotic Resistance, Deepfakes, First Contact)
- Fixed missing `useEffect` import in `ReadOnlyMap.tsx`

### Remaining (polish, not blocking)
- Animation on panel open/close (currently instant render; could add framer-motion slide-in)
- Solutions integration (solutions array currently passed as `[]` — wire up when solutions feature is fully built)
- Consider: live stats widget in sidebar (Layer 1 data always available, could show before report)

---

## Goal 3: Futurescape Persistence & Sharing (Next)

### Overview
Save completed futurescapes (map data + generated report) to S3 so they can be:
1. Served on a public demo page for non-registered users (read-only futurescape + report view)
2. Fetched inside the FAST app for specific client organizations/labs as pre-built examples

### Key Tasks
- Design S3 storage schema for futurescape data (input, consequences, solutions, report JSON, map snapshot image)
- Build save-to-S3 flow from the Futurescaper after report generation
- Build a read-only futurescape page that loads data from S3 and renders the map + report in non-editable mode
- Integrate into the FAST app: fetch pre-built futurescapes for specific orgs/labs
- Integrate into a public demo page alongside Subjects, Personas, and Analysis artifacts

---

## Completed

- Interactive radial menu on nodes (5 buttons: Edit, Add Child, AI Expand, Ideas, Delete)
- Radial menu redesign (grouped management vs. creation actions)
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
- Parent chain z-index elevation on node selection
- Multi-parent ancestor chain highlighting fix
- AI-generated nodes radial menu fix (all orders now get callbacks)
- Filter panel in sidebar (starts collapsed, STEEP/sentiment/order filters)
- UI refinement pass: nodes, edges, arrows, pills, badges, shadows, seed glow, detail panel, generation progress, related subjects, export tooltip
- Custom bezier edge with straight arrowhead approach
- Zoom-compensated 1px node borders
- Graduated importance bar (weight-based hierarchy)
- Right-click canvas to create unconnected node
- Sidebar cleanup (redundant buttons removed)
- Export panel in sidebar (JSON, CSV, Markdown, HTML, share link)
