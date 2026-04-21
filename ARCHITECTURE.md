# Futurescaper -- Architecture Document

> Last updated: 2026-04-21

---

## Overview

Futurescaper is a single-page React application that generates interactive **consequence maps** for futures analysis. Given a scenario (e.g., "AI replaces white-collar jobs by 2030"), it uses the **STEEPE framework** (Social, Technological, Economic, Environmental, Political, **Ethical**) and the **Synthesizing Futures** methodology to map cascading consequences across **up to 5 orders** of impact, then generates actionable solutions and ideas that appear as nodes directly on the graph.

The user interacts with a radial force-directed graph built on React Flow. Every consequence is a clickable node with a floating radial action menu. The map supports AI-powered expansion, manual node creation, free-prompt natural-language expansion, inline editing, JSON import/export, and multi-format report export.

### Key Design Principles

- **Graph-first**: The radial consequence map IS the primary interface. Sidebar panels are secondary.
- **Interactive nodes**: Every node is clickable, editable, expandable, and deletable via a floating radial menu.
- **Progressive generation**: Consequences appear on the graph as each phase completes (not all at once).
- **Mixed human + AI**: Users can build maps entirely by hand (Manual Mode), entirely via AI, or any mix.
- **Single-file deployable**: Vite's `vite-plugin-singlefile` compiles everything into one `index.html`.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 19 | Functional components, hooks only |
| Language | TypeScript 5.9 | Strict mode via `tsconfig.app.json` |
| Build | Vite 7 | `vite-plugin-singlefile` for single-HTML output |
| Graph | React Flow 11 | Custom node types (`seed`, `consequence`), handles on all 4 sides |
| Styling | Tailwind CSS 3.4 + custom CSS | `index.css` for animations, Tailwind for layout |
| Font | **JetBrains Mono** (monospace) | Loaded via Google Fonts; set as both `sans` and `mono` in Tailwind config |
| Icons | Lucide React 0.460 | Tree-shakable SVG icons |
| AI Provider | **DeepSeek** (`deepseek-chat`) | OpenAI-compatible REST API; key via `VITE_DEEPSEEK_API_KEY` or backend proxy |
| Utilities | `clsx`, `tailwind-merge` | Class merging |
| Containerization | Docker (multi-stage: Node 20 builder + nginx) | Single `Dockerfile` + `docker-compose.yml` |

---

## Application Architecture

### Routing & State Management

There is no router. The app has two screens, toggled by the presence of `input` state in `App.tsx`:

1. **InputForm** -- scenario entry, file upload, URL fetch, web research, JSON import, Manual Mode button
2. **FuturescapeMap** -- the full graph view with sidebar, filters, detail panel, free-prompt bar

State is managed entirely via `useState` hooks in `App.tsx` (top-level: `input`, `importedData`, `manualMode`) and `FuturescapeMap.tsx` (everything else). There is no Redux, Zustand, or Context API.

### Data Flow

```
InputForm
  |
  |--> onSubmit(FutureInput)       --> AI generation flow
  |--> onManualMode(FutureInput)   --> Skip AI, start with empty graph + seed node
  |--> onImport(ImportedData)      --> Load full saved map from JSON
  |
  v
App.tsx  (stores input, importedData, manualMode)
  |
  v
FuturescapeMap
  |
  |--> generateComprehensiveFuturescape()   [if AI mode]
  |     |--> Phase 1: first-order consequences
  |     |--> Phase 2: second-order consequences
  |     |--> Phase 3: third-order consequences + wildcards
  |     |--> Phase 4: solution/idea nodes for key consequences
  |     |--> findRelevantSubjects() [post-generation]
  |
  |--> Manual interactions:
  |     |--> Radial menu: Edit, Add Child, AI Generate Children, Delete
  |     |--> Seed radial menu: Add Child, AI Generate Children
  |     |--> Free-prompt expansion bar
  |     |--> DetailPanel: Expand node, Generate ideas
  |     |--> Inline editing (text, sentiment, category, probability, importance)
  |
  |--> consequences[] state updates --> generateNodesAndEdges() --> React Flow render
```

### Component Tree

```
App
 +-- InputForm
 |    +-- (file upload, URL input, web research, JSON import)
 +-- FuturescapeMap
      +-- ReactFlow
      |    +-- SeedNode (custom node type)
      |    |    +-- SeedRadialMenu (Add Child, AI Generate)
      |    +-- ConsequenceNode (custom node type, memo'd)
      |    |    +-- RadialMenu (Edit, Add Child, AI Generate, Delete)
      |    |    +-- EditModeView (inline form: text, sentiment, category, probability, importance)
      |    |    +-- Placeholder skeleton (when AI is generating)
      |    +-- Background, Controls, MiniMap
      +-- Sidebar (left, 320px)
      |    +-- GenerationProgress / Manual Mode indicator
      |    +-- TL;DR Summary (collapsible)
      |    +-- Highlight Filters (category, sentiment, order, probability, importance, ideas toggle)
      |    +-- RelatedSubjects
      |    +-- DetailPanel (selected node details, expand, generate ideas, delete)
      |    +-- ExportPanel (JSON, CSV, Markdown, Share)
      +-- Center progress overlay (during generation)
      +-- Floating prompt bar (bottom-center, post-generation)
      +-- AddNodeModal (manual node creation dialog)
```

---

## API Layer Architecture

### Provider System

The app supports two API routing modes, selected at build time:

1. **Direct provider** (`src/api/providers.ts`): Calls `https://api.deepseek.com/chat/completions` directly with `VITE_DEEPSEEK_API_KEY` from the `.env` file. Used in development / single-file builds.

2. **Backend proxy** (`src/api/backend.ts`): Calls `http://localhost:3001/api/generate` (dev) or `/api/generate` (prod). The backend holds the API key securely. Used in Docker deployments.

The orchestrator (`src/api/claude.ts`) re-exports `setApiKey`, `getApiKey`, `hasApiKey` from the active provider and wraps all calls through `callAPI()`.

### Prompt Architecture (`src/api/prompts.ts`)

All prompts follow the **Synthesizing Futures** methodology with STEEPE analysis. The system prompt (`SYSTEM_PROMPT`) is ~90 lines covering:

- STEEPE framework deep-analysis guidance for all 6 categories including **Ethical**
- Perspective-aware sentiment (positive/negative depends on stakeholder viewpoint)
- Geographic scopes (local, regional, global)
- Time frames (immediate, short-term, long-term)
- Probability levels per Voros Cone (probable, plausible, possible, wildcard)

#### Prompt Functions

| Function | Purpose |
|---|---|
| `buildAnalysisPrompt()` | Initial scenario analysis (currently unused in generation flow) |
| `buildFirstOrderPrompt()` | Direct, obvious consequences (order 1) |
| `buildSecondOrderPrompt()` | Ripple effects from first-order (order 2) |
| `buildThirdOrderPrompt()` | Cascade effects, wildcards (order 3) |
| `buildFourthOrderPrompt()` | Systemic shifts (order 4) -- exists but NOT used in main generation; available for free-prompt and node expansion |
| `buildFifthOrderPrompt()` | Paradigm shifts (order 5) -- same: exists, available via expansion paths |
| `buildSolutionsPrompt()` | Legacy solutions prompt (generates `Solution[]` objects) |
| `buildChildConsequencesPrompt()` | Generates 3 children from a specific parent node (used by radial menu AI Generate) |
| `parseConsequencesResponse()` | Parses JSON array from LLM response into `Consequence[]` with parent assignment |
| `parseSolutionsResponse()` | Parses JSON into `Solution[]` (legacy format) |

### Orchestration (`src/api/claude.ts`)

#### Core Functions

| Function | Signature | Description |
|---|---|---|
| `generateConsequencesWithAI()` | `(input, order, existing) => Consequence[]` | Generate consequences for a specific order (1-3). Calls the matching `buildXOrderPrompt()` function. |
| `generateChildConsequencesWithAI()` | `(input, parentConsequence) => Consequence[]` | Generate 3 child nodes from a specific parent. Used by radial menu "AI Generate Children". |
| `generateComprehensiveFuturescape()` | `(input, callbacks) => {consequences, solutions}` | Full generation pipeline: 3 orders + solution/idea phase. Fires callbacks per phase for progressive rendering. |
| `expandNodeConsequences()` | `(input, node, existing) => Consequence[]` | Generate 3-4 children from a selected node. Used by DetailPanel "Expand" button. |
| `generateSolutionIdeas()` | `(input, targetNode, existing) => Consequence[]` | Generate 2 idea/solution nodes (1 radical, 1 conservative) attached to a key consequence. Returns `Consequence[]` with `nodeType: 'solution' | 'idea'`. |
| `freePromptExpand()` | `(input, existing, userPrompt, onProgress?) => Consequence[]` | Natural language expansion. User types anything; AI interprets intent and generates 8-15 new consequences attached to existing nodes. |
| `fetchUrlContent()` | `(url) => string` | Fetches and extracts text from a URL using DOMParser. |

#### Generation Pipeline Detail

`generateComprehensiveFuturescape()` runs 4 phases sequentially:

1. **first-order**: `generateConsequencesWithAI(input, 1, [])` -- ~7-10 direct consequences
2. **second-order**: `generateConsequencesWithAI(input, 2, firstOrder)` -- ripple effects, ~10-15 nodes
3. **third-order**: `generateConsequencesWithAI(input, 3, all)` -- cascade effects + wildcards, ~10-15 nodes
4. **solutions**: For up to 8 key consequences (round-robin across STEEPE categories, distributed across parent chains), calls `generateSolutionIdeas()` per node, generating 2 ideas each (1 radical, 1 conservative). These appear as on-graph `Consequence` nodes with `nodeType: 'solution' | 'idea'` and amber/orange styling.

After all 4 phases complete, `findRelevantSubjects()` runs asynchronously to identify related academic/policy subjects.

**Important**: Orders 4 and 5 are NOT generated during the main pipeline. They are reachable via:
- Free-prompt expansion (user asks to "go deeper")
- Node expansion (expanding a 3rd-order node creates 4th-order children, etc.)
- AI Generate Children on the radial menu

### Web Research (`src/api/webResearch.ts`)

Optional pre-generation research that scans:
- Google News RSS (via Vite dev proxy to `news.google.com`)
- Bing News RSS (via proxy to `bing.com`)
- Semantic Scholar API (via proxy to `api.semanticscholar.org`)

Results are formatted into the prompt context. Proxy configuration is in `vite.config.ts`.

### Document Parser (`src/api/documentParser.ts`)

Extracts text from uploaded files (`.txt`, `.pdf`, `.docx`, `.html`) and URLs. Text is truncated to ~4000 chars for prompt context.

### Related Subjects (`src/api/subjects.ts`)

Post-generation module that:
1. Pre-filters a large subject list (`src/data/subjects.ts`, ~2000+ technology/innovation/policy subjects) using keyword matching and bigram overlap
2. Sends top 300 candidates to the LLM
3. LLM selects up to 20 **directly relevant** and 10 **tangentially disruptive** subjects
4. Results displayed in the `RelatedSubjects` sidebar panel

---

## Mock Data System

`src/mockData.ts` provides a fully offline fallback when no API key is available or the user clicks "Use Demo Mode" after an API error. It generates:

- **First order**: 5-7 generic consequences, plus keyword-specific ones (AI, climate, health)
- **Second order**: 1-2 per first-order parent, cross-category STEEPE effects using template banks
- **Third order**: 3-4 wildcard consequences randomly attached to second-order nodes

The mock system uses `setTimeout` delays (1.5s, 2s, 2.5s) to simulate progressive generation.

---

## Type System

All types are defined in `src/types.ts`.

### Core Types

```typescript
type Sentiment = 'positive' | 'negative' | 'neutral';
type STEEPCategory = 'social' | 'technological' | 'economic' | 'environmental' | 'political' | 'ethical';
type ConsequenceOrder = 1 | 2 | 3 | 4 | 5;
type Horizon = 'near' | 'medium' | 'far';
type TimeFrame = 'immediate' | 'short-term' | 'long-term';
type Probability = 'probable' | 'plausible' | 'possible' | 'wildcard';
type Importance = 'critical' | 'high' | 'medium' | 'low';
type NodeType = 'consequence' | 'solution' | 'idea';
```

### Consequence Interface

```typescript
interface Consequence {
  id: string;
  text: string;
  title?: string;           // Short name for solution/idea nodes (e.g., "Digital Funerals")
  sentiment: Sentiment;
  category: STEEPCategory;
  order: ConsequenceOrder;
  parentId: string | null;
  timeFrame?: TimeFrame;
  probability?: Probability;
  geographicScope?: GeographicScope;
  importance?: Importance;
  isManual?: boolean;        // True if manually added by user
  expandedAt?: number;       // Timestamp for expansion highlight glow
  nodeType?: NodeType;       // 'solution' | 'idea' for amber action nodes; defaults to 'consequence'
}
```

**Key design decision**: Solutions and ideas are stored AS `Consequence` objects with `nodeType: 'solution' | 'idea'`. They appear on the graph as children of the consequence they address, with amber/orange styling. The legacy `Solution` interface still exists but is not used by the current generation pipeline.

### Color Constants

```typescript
// STEEPE category colors
STEEP_COLORS = {
  social: '#e91e8c',       // Hot pink / magenta
  technological: '#00d4aa', // Cyan / teal
  economic: '#c8e600',      // Yellow-lime
  environmental: '#22c55e', // Green
  political: '#ff6b35',     // Orange
  ethical: '#7c5cfc',       // Blue-purple
};

// Sentiment colors
SENTIMENT_COLORS = {
  positive: { bg: '#e6fff5', border: '#00d4aa', text: '#0a6847' },   // Teal-green
  negative: { bg: '#fff0f3', border: '#ff4d6d', text: '#a4133c' },   // Coral-red
  neutral:  { bg: '#e8eaef', border: '#8891a0', text: '#2d3341' },   // Slate blue-gray
};

// Solution/Idea node colors
SOLUTION_COLORS = { bg: '#fff7e6', border: '#ff9f1c', text: '#7a4100' }; // Amber-orange

// Seed node color
--seed: #7c5cfc  (purple, matches ethical category)
```

### Importance Scaling

Nodes scale physically based on importance:
- `critical`: 1.4x (plus amber ring, "Critical" badge)
- `high`: 1.2x ("High" badge)
- `medium`: 1.0x (baseline)
- `low`: 0.8x

---

## Graph Layout Algorithm

The layout is a **custom radial algorithm** in `FuturescapeMap.generateNodesAndEdges()`. It is NOT a force simulation.

### Radial Rings

Each consequence order occupies a concentric ring around the central seed node:

| Order | Label | Min Radius | Description |
|---|---|---|---|
| 1 | Direct | 500px | Evenly spaced on a circle around seed |
| 2 | Ripple | 900px | Grouped around their order-1 parent, spread in arcs |
| 3 | Cascade | 1400px | Grouped around their order-2 parent |
| 4 | Systemic | 1900px | Grouped around their order-3 parent |
| 5 | Wildcard | 2400px | Grouped around their order-4 parent |

**Dynamic radius**: If the number of nodes at a given order requires more circumference than `2 * PI * minRadius`, the radius expands to `(nodeCount * (250 + 30)) / (2 * PI)`.

### Edge Routing

Edges use `getOptimalHandles()` which calculates the angle between source and target positions, then selects the best handle pair (top/bottom/left/right) on each side. Each node has 8 handles (4 source + 4 target) for clean routing.

Edge styling:
- **Color**: Matches child sentiment (or amber for solution/idea, purple for wildcard)
- **Dash pattern**: Dashed for wildcards and solution/idea nodes; solid otherwise
- **Animated**: During the generation phase that produced them
- **Dimmed**: When node fails highlight filter criteria (`opacity: 0.2`)

### Node Positioning (Orders 2-5)

Higher-order nodes are positioned relative to their parent:
1. Calculate parent's angle from center: `atan2(parentY, parentX)`
2. Spread children in an arc centered on that angle
3. Spread per child: `min(PI/6, PI/2 / childCount)` -- more children = tighter spacing
4. Distance from parent: `350 + (order - 2) * 100` plus deterministic jitter

---

## Interactive Node System

### Radial Menu

Clicking any consequence node toggles `activeNodeId`, which renders a floating `RadialMenu` with 4 buttons positioned at compass points around the node:

| Position | Button | Action |
|---|---|---|
| Top | Edit (pencil) | Opens `EditModeView` inline form |
| Right | Add Child (plus) | Creates blank child `Consequence`, opens inline edit |
| Bottom | AI Generate (sparkles) | Calls `generateChildConsequencesWithAI()`, shows placeholder skeletons |
| Left | Delete (trash) | Confirmation dialog, removes node + direct children |

The radial menu is **disabled during comprehensive generation** (`isGenerationRunning` flag) to prevent conflicts.

### Seed Radial Menu

The seed node has its own `SeedRadialMenu` with 2 buttons:
- **Top**: Add Child (manual)
- **Bottom**: AI Generate Children (generates ~20 first-order consequences)

### Inline Editing (`EditModeView`)

When edit mode is triggered, the node replaces its display with a full inline form:
- **Textarea** for consequence text (auto-focused, auto-selected)
- **Sentiment selector** (positive/negative/neutral pill buttons)
- **STEEPE category selector** (6 pill buttons with category colors)
- **Probability selector** (probable/plausible/possible/wildcard)
- **Importance selector** (critical/high/medium/low)
- **Save/Cancel buttons** + keyboard shortcuts (Cmd+Enter to save, Escape to cancel)

Node dragging is disabled while editing. If the user cancels on a blank new node, the node is automatically removed.

### Placeholder Nodes

When AI generation is triggered (via radial menu or seed), skeleton placeholder nodes appear immediately:
- Dashed purple border, pulsing animation
- Spinner icon + "AI Generating..." label
- 3 animated skeleton text bars
- Replaced with real nodes when the API responds; removed on error

### Free-Prompt Expansion

A floating bar at the bottom center of the map (visible only after generation completes) lets users type natural language requests:
- "Add more wildcards"
- "Explore economic impacts in more depth"
- "Push to 5th order"
- "What about impacts on indigenous communities?"

The input is sent to `freePromptExpand()`, which builds a compact map summary (up to 60 nodes), includes the user's prompt, and asks the LLM to generate 8-15 new consequences attached to existing nodes via `parentIndex` mapping.

New nodes receive an `expandedAt` timestamp and get a gold glow animation (`newly-expanded-glow`) that can be toggled via the sparkle button in the prompt bar.

---

## Export System

### JSON Export (Unified Format)

`src/api/miroExport.ts` produces a single JSON file that serves two purposes:

1. **Applet reload**: Contains `input`, `consequences[]`, and `solutions[]` fields. Can be re-imported via the InputForm's JSON import button to restore the full map.
2. **Miro REST API v2 compatible**: Contains `miro` section with `tags`, `cards` (positioned with radial coordinates), and `connectors` for automated Miro board creation.

### JSON Import

The InputForm has a hidden file input that accepts `.json` files. It validates the structure (`input`, `consequences` required), then passes the data to `App.tsx` via `onImport()`. The map renders immediately in `complete` state.

### Other Export Formats

| Format | Function | Contents |
|---|---|---|
| **CSV** | `exportCSV()` | All consequences with order, category, sentiment, importance, probability, timeframe, geographic scope. Solutions as a separate section. |
| **Markdown** | `exportMarkdown()` | Full analysis report with consequences grouped by order (1-5), emoji sentiment indicators, probability badges, and solutions section. |
| **Share Link** | `copyShareLink()` | Demo only -- base64-encodes a truncated snapshot to clipboard. Requires backend for real sharing. |

---

## Highlight / Filter System

The sidebar provides **highlight filters** that DIM (not hide) non-matching nodes. All nodes remain visible at all times.

Filter dimensions:
- **STEEPE categories** (6 toggles with category colors)
- **Sentiment** (positive/negative/neutral + Ideas toggle for solution/idea nodes)
- **Order** (1-5, only shows orders that have nodes)
- **Probability** (probable/plausible/possible/wildcard)
- **Importance** (critical/high/medium/low)

**Key Only** button: Quick filter to show only `probable` + `plausible` probability AND `critical` + `high` importance.

Dimmed nodes get `opacity: 0.35`, `grayscale(50%)`, and their edges get `opacity: 0.2`.

---

## Deployment Architecture

### Development

```bash
npm run dev    # Vite dev server with hot reload + proxy config
```

Vite dev server proxies `/api/news-proxy`, `/api/bing-news-proxy`, `/api/scholar-proxy` to their respective external APIs for web research.

### Production Build

```bash
npm run build  # Single-file output via vite-plugin-singlefile
```

Output: `dist/index.html` -- a single HTML file with all JS, CSS, and assets inlined. Can be deployed to any static hosting or opened directly in a browser.

### Docker

Multi-stage build:
1. **Builder stage** (Node 20 Alpine): `npm ci` + `npm run build` with build-time `ARG` for API keys
2. **Production stage** (nginx Alpine): Serves `dist/` on port 80

```bash
docker compose up --build
```

---

## Security Considerations

1. **API key exposure**: In single-file mode, the DeepSeek API key is embedded in the built HTML via `import.meta.env.VITE_DEEPSEEK_API_KEY`. The backend proxy mode (`backend.ts`) keeps the key server-side.

2. **No authentication**: The app has no user accounts or auth. Anyone with access to the URL can use it.

3. **URL fetching**: `fetchUrlContent()` uses `fetch()` directly, which is subject to CORS. The Vite dev proxy bypasses CORS for news/scholar APIs in development only.

4. **File uploads**: `documentParser.ts` processes files client-side only. `.pdf` extraction is basic (regex for text between stream markers). No files are sent to a server.

5. **LLM prompt injection**: User-provided text (scenario title, description, free-prompt) is interpolated directly into prompts with no sanitization. This is acceptable for a single-user tool but would need guardrails for multi-tenant deployment.

---

## Unused / Dormant Code

| Item | Location | Status |
|---|---|---|
| `Solution` interface | `types.ts` | Still defined but the generation pipeline now produces solutions as `Consequence` objects with `nodeType`. Legacy `generateSolutionsWithAI()` exists but is not called by the main flow. |
| `buildAnalysisPrompt()` | `prompts.ts` | Defined but never called in the generation pipeline. |
| `buildFourthOrderPrompt()` | `prompts.ts` | Exists and works but not used in main `generateComprehensiveFuturescape()`. Available via free-prompt expansion. |
| `buildFifthOrderPrompt()` | `prompts.ts` | Same as above. |
| `App.css` | `src/App.css` | Vite boilerplate CSS (logo spin, card, read-the-docs). Not imported by any component. |
| `ApiKeyInput` component | `components/ApiKeyInput.tsx` | Exists for manual key entry UI but may not be wired into the current flow if backend proxy is active. |
| `FilterPanel` component | `components/FilterPanel.tsx` | Standalone filter component; the highlight filters are now inline in `FuturescapeMap.tsx`. |
| `GenerationProgress` component | `components/GenerationProgress.tsx` | Standalone progress component; progress UI is now inline in the sidebar. |
| `providers.ts` direct mode | `api/providers.ts` | The `callProviderAPI()` function still works for direct DeepSeek calls, but in Docker deployments `backend.ts` is used instead. |

---

## Key Design Decisions & Trade-offs

### 1. Solutions as Consequence nodes, not separate objects

**Decision**: Solutions and ideas are `Consequence` objects with `nodeType: 'solution' | 'idea'` placed ON the graph as children of key consequences, with amber/orange styling.

**Why**: Keeps solutions spatially connected to the problems they address. Users can see the causal chain from scenario to consequence to solution without switching views. Simplifies the data model (one array instead of two).

**Trade-off**: The `Solution` interface and `solutions[]` array still exist for backward compatibility but are largely vestigial.

### 2. Five orders defined, three generated

**Decision**: `ConsequenceOrder = 1 | 2 | 3 | 4 | 5` and all 5 order prompt builders exist, but the main generation pipeline only runs orders 1-3 + solutions.

**Why**: Generating 5 orders automatically would produce an overwhelming number of nodes and slow generation significantly. Orders 4-5 are available for targeted exploration via free-prompt, node expansion, and radial menu AI generation.

**Trade-off**: Users must actively expand to reach orders 4-5. The UI supports 5 rings but they are sparse unless expanded.

### 3. STEEPE (6 categories) not STEEP (5)

**Decision**: Added **Ethical** as a 6th category covering moral dilemmas, fairness, human rights, consent, bias, intergenerational justice, and transparency.

**Why**: Modern futures analysis increasingly requires explicit ethical consideration. The category is baked into the system prompt, all filter UIs, color palettes, and prompt engineering.

### 4. No state management library

**Decision**: All state lives in `useState` hooks within `App.tsx` and `FuturescapeMap.tsx`.

**Why**: The app has a simple two-screen flow. The consequence array is the single source of truth, and all mutations happen through `setConsequences()`. React Flow manages its own node/edge state via `useNodesState` / `useEdgesState`, synced from consequences via `generateNodesAndEdges()`.

**Trade-off**: `FuturescapeMap.tsx` is large (~1600 lines) because all state and handlers colocate. A refactor to extract state into a custom hook or context would reduce component size.

### 5. Custom radial layout, not force-directed

**Decision**: Nodes are placed with a deterministic radial algorithm, not a physics simulation.

**Why**: Force-directed layouts (like d3-force) produce nondeterministic results and can cause visual "jitter" as nodes settle. The radial layout provides stable, predictable positioning where order = distance from center. Users can still drag nodes.

**Trade-off**: The layout doesn't auto-avoid overlaps for dense maps. Nodes at the same order can overlap if there are many siblings.

### 6. Single-file output

**Decision**: `vite-plugin-singlefile` inlines all assets into one HTML file.

**Why**: Enables zero-infrastructure deployment -- drop the file anywhere (email, local filesystem, USB drive) and it works. Critical for environments where users cannot run a web server.

**Trade-off**: The single HTML file can be large (2-5MB). No code splitting or lazy loading is possible. The API key (if using direct mode) is embedded in the file.

### 7. JetBrains Mono everywhere

**Decision**: The entire app uses JetBrains Mono as both `sans` and `mono` in Tailwind config.

**Why**: Gives the application a distinctive, technical aesthetic that signals "research tool" rather than "consumer app". Monospace text also improves readability of consequence descriptions at small sizes.

**Trade-off**: Monospace fonts are wider than proportional fonts, which means less text fits in the same space. Node widths are set accordingly (220px base).

### 8. Radial menu over context menu

**Decision**: Node interactions use a floating radial menu with 4 compass-positioned action buttons, animated with spring physics (`nodeActionAppear` keyframe).

**Why**: More discoverable than right-click context menus. Visual and spatial -- users learn the positions (top=edit, right=add, bottom=AI, left=delete). The spring animation and tooltip labels make actions feel responsive and self-documenting.

**Trade-off**: The radial menu requires more screen space around each node. It is disabled during generation to prevent conflicts.
