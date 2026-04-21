# Futurescaper UI Elements Breakdown

## Overview

The Futurescaper UI has two primary views: the **Input Form** (scenario entry) and the **Futurescaper Map** (visualization and analysis). The interface uses JetBrains Mono (monospace, imported from Google Fonts) as its primary font, a slate-based neutral palette, and a custom color system defined in Tailwind for STEEPE categories, sentiments, and semantic elements.

---

## View 1: Input Form (`InputForm.tsx`)

The input form is a vertically-stacked single-column layout (`max-w-3xl`, centered) on a `slate-50` to `slate-100` gradient background. It is the landing page of the application.

### Header Section

- **App icon**: 40x40px rounded-lg indigo (`bg-seed`) square with a white Sparkles icon (from Lucide)
- **Title**: "Futurescaper" — 3xl bold slate-900
- **Subtitle**: Descriptive text about STEEP framework consequence mapping — lg slate-600
- **Sub-subtitle**: "Generates 5 orders of consequences + macro/micro solutions" — sm slate-500 (Note: the text says "5 orders" but the current pipeline only generates 3)

### Input Mode Toggle

Two side-by-side buttons occupying equal width:

- **"Describe an Idea"** (Zap icon): Default mode. Free-text scenario input.
- **"Analyze from URL"** (Globe icon): Fetches content from a URL.

Active state: `border-seed bg-seed/5 text-seed` with 2px border. Inactive: `border-slate-200 text-slate-600`.

### Example Scenarios (inline, when idea mode is active)

When the "Describe an Idea" mode is active, example scenarios are displayed **inside the form** between the mode toggle and the title field. Section label: "Try an example scenario:" with 4 rounded-full pill buttons:

- "Autonomous Vehicles"
- "Universal Basic Income"
- "Remote Work Default"
- "Lab-Grown Meat"

Clicking an example populates the title and description fields.

### URL Input Section (visible when mode = 'url')

White rounded-xl card with shadow-sm and slate-200 border containing:
- Label with Link icon: "News Article or Source URL"
- Text input (`type="url"`) with "https://example.com/article..." placeholder
- "Fetch" button (ArrowRight icon) — slate-100 background, becomes Loader2 spinner during fetch
- Error display in amber-600
- Help text: "Some sites block direct fetching. If fetch fails, paste the article text below."

### Scenario Title Card

White rounded-xl card:
- Label: "What scenario or event are you analyzing?" (or "Title for this analysis" in URL mode)
- Text input — lg font, full width, with seed-colored focus ring
- Placeholder varies by mode

### Description Card

White rounded-xl card:
- Label: "Describe the scenario in detail" with "(optional)" in slate-400
- Textarea — 3 rows, no resize
- Help text: "More detail = better analysis. But you can skip this if the title is self-explanatory."

### Perspective Card

White rounded-xl card:
- Label with Users icon: "Whose perspective? (Important!)"
- Text input with placeholder listing examples
- Explanatory text about perspective-relative sentiment
- **Quick-select buttons**: 6 pre-set perspectives rendered as rounded-full pill buttons:
  - "General Public", "Business Owners", "Workers/Employees", "Government", "Investors", "Environment"
  - Active state: `bg-seed text-white`
  - Inactive: `bg-slate-100 text-slate-600`

### Time Horizon Card

White rounded-xl card:
- Label with Clock icon: "Analysis Depth (Time Horizon)"
- 3-column grid of selectable buttons:
  - **Near** (1-3 years): "Focus on immediate"
  - **Medium** (3-10 years): "Balanced analysis" — selected by default
  - **Far** (10+ years): "Long-term vision"
- Active: `border-seed bg-seed/5 text-seed`. Inactive: `border-slate-200 text-slate-600`

### Additional Context Card

White rounded-xl card:
- Label with FileText icon: "Additional Context (optional)"
- **File upload area**: Hidden `<input type="file">` (accepts .pdf, .txt, .md) triggered by a dashed-border drop zone button ("Upload PDF, TXT, or Markdown file" with Upload icon). When a file is selected, shows filename with X button to clear. Loader2 spinner during processing.
- **Text area**: 4 rows for pasting content. Shows character count in bottom-right corner when populated.

### Web Research Toggle Card

White rounded-xl card:
- Label with Search icon: "Auto-scan Web for Latest Context"
- **Custom toggle switch**: 48x24px rounded-full with 16x16px sliding white circle. On: `bg-seed`. Off: `bg-slate-300`. Enabled by default.
- Descriptive text: "Searches recent news articles and academic papers to enrich your analysis with real-world context."
- **"Preview Research" button**: Only visible when toggle is on. Slate-100 background with Search icon. Shows "Scanning..." with Loader2 during research.
- **Research results preview**: Green-50 card with green border showing:
  - "Found N sources" header with BookOpen icon
  - Up to 5 source titles with Newspaper (news) or BookOpen (academic) icons
  - First key insight displayed below a green separator

### Submit Button

Full-width xl button:
- Default: `bg-seed text-white` — "Generate Comprehensive Futurescaper" with ArrowRight icon
- During research: Shows Loader2 spinner with "Scanning Web Sources..."
- Disabled when no title or research is in progress

### Manual Mode Button

Below the submit button:
- **"Manual Mode — Build Map by Hand"** button with Hammer icon
- Enters manual map-building mode where the user constructs the consequence map without AI generation

### Load Previous Analysis Button

Below the manual mode button:
- **"Load Previous Analysis (JSON)"** button with FolderOpen icon
- Opens a file picker to import a previously exported JSON map

### Timing Indicator

Centered text below submit: "Includes web research - Full analysis takes 2-4 minutes" (or "2-3 minutes - Generates 60-80 consequences + solutions" if research is off)

---

## Floating Element: API Key Input (`ApiKeyInput.tsx`)

Positioned as a fixed element at the bottom of the input form view (`fixed bottom-6 left-6 right-6 max-w-xl mx-auto z-50`).

### Three States:

**1. Configuration Mode** (no key set):
- Slate-50 card with Key icon and "AI Provider Setup" heading
- Provider dropdown: Full-width button showing current provider name + cost badge. Opens a dropdown list of 6 providers, each showing name, description, cost badge, and per-1M-token price. Provider badges:
  - DeepSeek: Green "Best Value" with DollarSign icon
  - Groq: Blue "Free Tier" with Zap icon
  - Gemini: Cyan "Cheap" with DollarSign icon
  - OpenAI: Emerald "Popular"
  - Claude: Purple "Highest Quality" with Sparkles icon
  - OpenRouter: No badge
- API key input: Password field with Eye/EyeOff toggle, monospace font
- "Save API Key" button (blue-600) + "Get an API key" external link to provider's signup page
- Tip text at bottom: "DeepSeek offers best value at ~$0.14/1M tokens..."

**2. Saved State** (key configured, no error):
- Green-50 card with CheckCircle2 icon
- Shows provider name + cost
- "Change" button (green-100) + "Clear" button (red-100)

**3. Error State** (key configured, but failing):
- Red-50 card with AlertCircle icon
- "API Key Error" heading with explanation
- "Enter New API Key" button (red-600) + "Clear Key" button (red-100)

---

## View 2: Futurescaper Map (`FuturescapeMap.tsx`)

Full-screen layout with two regions: a 320px-wide left sidebar and the remaining space for the ReactFlow graph.

### Left Sidebar

A vertical stack of collapsible sections with `bg-white` background and `border-r border-slate-200`:

#### Section 1: Scenario Header
- **Back button**: ArrowLeft icon + "Back" text — navigates to input form
- **Title**: Bold slate-900
- **Description**: sm slate-600, clamped to 3 lines
- **"Add Manual Node" button**: In the header area, opens the Add Manual Node Modal (see below)

#### Section 2: Error Display (conditional)
- Red-50 background with AlertCircle icon
- "Generation Error" heading + error message
- Conditional buttons:
  - "Change API Key" (amber-600) — shown for auth-related errors
  - "Use Demo Mode" (red-600) — always shown, falls back to mock data

#### Section 3: Generation Progress / Manual Mode
**During AI generation:**
- "Generation Progress" label with phase counter ("2/4")
- **Progress bar**: Slate-200 track with `bg-seed` fill, rounded-full, h-2. Width transitions smoothly.
- Status text: Shows current progress message, or "Analysis complete (N consequences)" in green-600 when done

**During manual mode:**
- Hammer icon with "Manual Mode" heading
- Instruction text explaining how to build the map by hand (instead of the progress bar)

#### Section 4: TL;DR Summary (after completion)
- Collapsible, opened by default
- FileText icon + "TL;DR Summary" heading
- **Stats block** (slate-50 rounded-lg):
  - "N consequences identified: X% concerning, Y% positive (Z critical)"
  - "Primary impact area: [STEEPE category]"
- **Top Concerns** section:
  - Red TrendingDown icon + "Top Concerns" heading (red-700)
  - Up to 3 consequence excerpts (100 char max) with red-200 left border
- **Top Opportunities** section:
  - Green TrendingUp icon + "Top Opportunities" heading (green-700)
  - Up to 3 consequence excerpts with green-200 left border

#### Section 5: Highlight Filters
- "Highlight Filters" heading with "Reset" link
- Filter groups, each with compact pill buttons:

  **Importance** (Star icon):
  - Critical: amber-100/amber-700 when active
  - High: blue-100/blue-700 when active
  - Medium, Low: slate-200/slate-700 when active
  - Inactive: slate-100/slate-400

  **High Impact Filter** ("Key Only" toggle):
  - Zap icon + "Key Only" label
  - Filters the map to show only nodes that are probable/plausible AND critical/high importance

  **Probability** (Target icon):
  - Each button uses its probability color from `PROBABILITY_COLORS` (green/blue/amber/red) at 20% opacity for background

  **Category** (Layers icon):
  - 6 STEEPE buttons labeled with first 4 letters ("Soci", "Tech", "Econ", "Envi", "Poli", "Ethi")
  - Active: Category color at 20% opacity background, full color text and border
  - Inactive: slate-100/slate-400

  **Sentiment**:
  - Positive: TrendingUp icon + "+" — green-100/green-700
  - Negative: TrendingDown icon + "-" — red-100/red-700
  - Neutral: Minus icon + "o" — slate-200/slate-700
  - **Ideas**: Lightbulb icon + "Ideas" — amber-100/amber-700. Toggles visibility of solution/idea nodes.

  **Order**:
  - "1", "2", "3" buttons — indigo-100/indigo-700 when active

Deselecting a filter dims (not hides) matching nodes to 35% opacity with 50% grayscale.

#### Section 6: Solutions Panel (conditional)
- Lightbulb icon (amber-500) + "Solutions (N)" heading
- Collapsible list (max-h-64, scrollable):
  - Each solution is a yellow-50 card with yellow-200 border
  - Type badge: "macro" (purple-100/purple-700) or "micro" (blue-100/blue-700)
  - Category label in slate-500
  - Solution text in slate-700

#### Section 7: Related Subjects Panel (conditional, after generation)
- Shows related academic/policy subjects found by AI
- Displays after generation completes in the sidebar

#### Section 8: Detail Panel (conditional, on node selection)
- See Detail Panel section below

#### Section 9: Export Panel (always visible at bottom)
- See Export Panel section below

### Main Graph Area

The ReactFlow canvas occupies all space right of the sidebar. Configuration:
- Background: `#ffffff` (white, no dot grid)
- Controls: Default ReactFlow zoom/pan controls (bottom-left)
- MiniMap: Shows node colors by sentiment (positive=green, negative=red, neutral=gray, seed=indigo). Mask: black at 10% opacity.
- Zoom: 0.1x to 2x range
- Fit view on load with 0.2 padding
- Connection mode: Loose

### Center Screen Progress Overlay

During generation, a centered overlay card appears on the map:
- Loader2 spinner + Sparkles icon
- Phase-specific heading (e.g., "Mapping Direct Consequences")
- Progress bar matching the sidebar progress bar
- Count of consequences mapped so far

### Floating Prompt Bar

Fixed at bottom center of the map when generation is complete:
- White/95 background with `backdrop-blur` and `rounded-2xl`
- Sparkles icon + text input field + Send button
- Shows progress text during expansion operations
- Optional "new highlight" toggle (Sparkles button) to highlight recently added nodes with a glow effect

---

## Node Types

### Seed Node (`SeedNode` in `ConsequenceNode.tsx`)

The central node representing the scenario. Now interactive:
- Max width: 280px
- Styling: `rounded-2xl shadow-lg border-2 bg-seed-light border-seed`
- **Clickable**: `cursor-pointer`
- **Selected state**: `ring-2 ring-offset-2 ring-blue-400`
- Content:
  - 32x32px rounded-lg `bg-seed` icon container with seed emoji
  - "Seed" label: xs, semibold, uppercase, tracking-wider, `text-seed`
  - Title: bold, lg, `text-seed-dark`
  - Description: sm, `text-seed-dark/70`, clamped to 3 lines
- Handles: 4 source handles (top, right, bottom, left), 12x12px, `bg-seed`

#### Seed Radial Menu

When the seed node is clicked/selected, a floating radial menu appears with 2 action buttons:
- **Top (green)**: Add Child — creates a blank child node in inline edit mode
- **Bottom (purple)**: AI Generate — creates 20 placeholder nodes, then replaces them with AI-generated results

Buttons use the same `node-action-btn` CSS class and spring animation as the consequence radial menu.

### Consequence Node (`ConsequenceNode` in `ConsequenceNode.tsx`)

Each consequence is rendered as a card node. It is wrapped in `React.memo` for performance.

**Sizing**: Base width 220px, scaled by importance multiplier (0.8x to 1.4x). Critical nodes are 308px wide, low-importance nodes are 176px wide. Expands to 340px during inline edit mode.

**Container styling**:
- `rounded-xl shadow-md` with hover scale animation (105%) and shadow increase
- Background color: Sentiment-based (green-50, red-50, gray-50)
- Border color: Sentiment-based (green, red, gray) — overridden to purple for wildcards
- Border width: 2px (normal), 2.5px (high importance), 3px (critical)
- Border style: Dashed for wildcards, solid otherwise
- Critical nodes get a `ring-2 ring-offset-2 ring-amber-400` highlight ring
- Dimmed nodes: `opacity: 0.35, filter: grayscale(50%)` with 0.3s transition
- **Newly expanded glow**: Nodes added via expansion get a pulsing amber glow animation (`newExpandGlow` keyframe)
- Hover scale is suppressed when the radial menu is showing: `.consequence-node:has(.node-action-btn) { transform: none }`

**Content structure**:

Row 1 — Sentiment icon + Text:
- Icon: TrendingUp (positive/green), TrendingDown (negative/red), or Minus (neutral/gray). Scaled by importance.
- Text: Font-medium, leading-snug, 11px base scaled by importance. Color matches sentiment.

Row 2 — Badge row (flex-wrap):
- **STEEPE badge**: Category name in uppercase, category-colored background at 20% opacity
- **Probability badge**: Target icon + dot indicator (three-dot probable, two-dot plausible, one-dot possible, diamond wildcard). Color from `PROBABILITY_COLORS`.
- **Wildcard badge** (conditional): Purple-100 "Wild" with Zap icon
- **Critical badge** (conditional): Amber-100 "Critical" with filled Star icon
- **High badge** (conditional): Blue-100 "High" with Star icon
- **TimeFrame badge** (conditional): Slate-100 with Clock icon. Labels: "Now" (immediate), "Soon" (short-term), "Later" (long-term)

**Handles**: 8 handles total — 4 target (top, right, bottom, left) and 4 source (top-source, right-source, bottom-source, left-source). All 8x8px, slate-400, hidden by default and shown at 50% opacity on node hover (via CSS).

### Solution/Idea Nodes

Consequence nodes can have `nodeType` of `'solution'` or `'idea'`:
- **Styling**: Amber/orange color scheme using `SOLUTION_COLORS` (bg: `#fff7e6`, border: `#ff9f1c`, text: `#7a4100`)
- **Icon**: Wrench icon for solutions, Lightbulb icon for ideas
- **Badge**: Displays "Solution" or "Idea" label badge
- **Content**: Shows a **title** (bold) and a **description** text, unlike standard consequence nodes which show only consequence text

### Placeholder Nodes (during AI generation)

Skeleton loading nodes that appear while AI is generating:
- Dashed purple border, `purple-50` background, `generating-pulse` animation
- Loader2 spinning icon + "AI Generating..." text
- 3 shimmer skeleton lines with varying widths and opacity
- **Count**: 20 placeholders for seed-level generation, 3 for individual node expansion

### Edges

Edges connect parent nodes to child nodes:
- Color: Matches child node's sentiment color (green/red/gray), purple for wildcards
- Width: 2px normally, 1px when dimmed
- Style: Dashed (`strokeDasharray: 5,5`) for wildcards
- Opacity: 0.6-0.7 normally, 0.2 when dimmed
- Arrow markers: ArrowClosed, 15x15px (seed to 1st order), 12x12px (higher orders)
- Animation: Dashed animation during generation (CSS `@keyframes dash`)
- Hover: 3px width, full opacity, drop-shadow glow effect

---

## Interactive Radial Menu

When clicking a consequence node, a floating radial menu appears around the node with 4 action buttons at cardinal positions:

- **Top (blue)**: Edit — enters inline edit mode on the node
- **Right (green)**: Add Child — creates a blank child node in inline edit mode
- **Bottom (purple)**: AI Generate — creates 3 placeholder children, then replaces them with AI-generated results
- **Left (red)**: Delete — removes the node and its direct children (with confirmation)

**Styling**:
- Buttons use the `node-action-btn` CSS class
- Spring animation on appearance: `nodeActionAppear` keyframe (scale(0) to scale(1.15) to scale(1) with opacity, `cubic-bezier(0.34, 1.56, 0.64, 1)`)
- Staggered animation delays: 0ms, 40ms, 80ms, 120ms per button
- Labels appear on hover via `node-action-label` class (opacity transition)
- All buttons call `e.stopPropagation()` to prevent ReactFlow drag behavior

**Generation disabled**: During comprehensive generation (`isGenerationInProgress` flag), the radial menu is hidden and not rendered.

---

## Inline Edit Mode

When the Edit action is activated (from the radial menu), the node expands to 340px and renders an inline editor directly within the node:

- **Textarea**: For editing the consequence text, auto-focused on open
- **Sentiment selector**: 3 buttons (Positive / Negative / Neutral) with outline/outlineColor styling for the active state
- **STEEPE Category selector**: 6 buttons (S / T / E / E / P / E) with outline/outlineColor styling for the active state
- **Probability selector**: 4 buttons for probability levels
- **Importance selector**: 4 buttons for importance levels
- **Save / Cancel buttons**: Plus keyboard shortcuts (Cmd+Enter to save, Escape to cancel)

The node is **not draggable** during edit mode.

---

## Add Manual Node Modal

A modal dialog accessible via the "Add Manual Node" button in the sidebar header. Contains:

- **Text area**: For entering consequence text
- **Parent selector dropdown**: To choose which existing node the new node connects to
- **STEEPE category grid**: 6 category buttons for classification
- **Sentiment buttons**: Positive / Negative / Neutral selection

This is separate from the radial menu's Add Child action, which creates the child inline on the graph.

---

## Detail Panel (`DetailPanel.tsx`)

Appears in the sidebar when a node is selected. 320px wide, `rounded-xl shadow-lg`.

**Header**: STEEPE category badge + X close button

**Consequence display**: Colored card with 4px left border, sentiment icon + full text

**Metadata section**:
- Order: "First-Order" / "Second-Order" / "Third-Order" + optional "Wildcard" badge with Zap icon (purple-600)
- Sentiment: Icon + capitalized label in sentiment color

**"Caused By" section** (conditional): Shows parent consequence text in parent's sentiment-colored card

**"Leads To" section** (conditional): Shows child consequence count + scrollable list (max-h-32) of child texts in their sentiment colors

**Action buttons** (at bottom, separated by border-t):
- **"Expand"** button: Generates 3-4 more children for this node via AI. Shows loading state during the async operation.
- **"Generate Ideas"** button: Creates solution/idea nodes attached to this consequence. Shows loading state during the async operation.
- "Edit" (Edit3 icon): Opens inline edit mode on the node
- "Delete" (Trash2 icon): Removes the consequence with confirmation

---

## Export Panel (`ExportPanel.tsx`)

Pinned to the bottom of the sidebar (`mt-auto`), separated by `border-t`.

**Header**: Download icon + "Export & Share"

**Stats grid** (2x1):
- Total consequences count (2xl bold)
- Solutions count (2xl bold)

**Export buttons** (vertical stack):
- "Export CSV (Excel)": Green-100, FileSpreadsheet icon
- "Export JSON": Slate-100, FileJson icon
- "Export Report (MD)": Slate-100, FileText icon
- "Copy Share Link": `bg-seed` (purple), Share2 icon — triggers clipboard copy with alert

---

## Generation Progress Component (`GenerationProgress.tsx`)

A standalone component (though the sidebar has its own inline progress UI). White rounded-xl card:

**Header**: "Generating Map..." (or "Generation Complete") + Pause/Continue button

**Phase list** (3 items):
1. "First-Order Consequences" — "Obvious, intuitive effects"
2. "Second-Order Consequences" — "STEEP framework analysis"
3. "Third-Order Consequences" — "Wild cards & unknown unknowns"

Each phase shows:
- CheckCircle2 (green, complete)
- Loader2 (seed color, spinning, active)
- Circle (slate-300, pending)

**Waiting message** (during generation): Amber-50 card with "This takes 2-4 minutes" message and STEEP description.

---

## Filter Panel (`FilterPanel.tsx`)

A standalone filter component (superseded by inline filters in FuturescapeMap). Contains:

**STEEPE Categories**: Vertical list of buttons with colored dots (3x3 rounded-full circles)

**Sentiment**: 3 equal-width buttons with colored backgrounds (green/red/amber) when active

**Consequence Order**: "1st", "2nd", "3rd" buttons with seed-colored active state + description "1: Direct, 2: Ripple, 3: Cascade"

Note: This component is defined but not currently used — FuturescapeMap implements its own filter UI inline.

---

## CSS & Animation System (`index.css`)

**Font Import**: JetBrains Mono from Google Fonts (`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:...')`)

**CSS Variables**:
- `--positive: #0a6847` (deep green)
- `--negative: #a4133c` (deep rose)
- `--neutral: #3c2f80` (deep purple)
- `--seed: #7c5cfc` (purple)

**Custom Animations**:
- `pulse-ring` (1.5s, infinite): Scale 0.95 to 1.3 with opacity fade. Applied to nodes during generation via `.generating-pulse::before` pseudo-element.
- `fadeInUp` (0.4s): Translate Y 10px to 0 with opacity. Used on detail panel entrance.
- `dash` (0.5s, linear, infinite): Stroke-dashoffset animation for animated edges during generation.
- `nodeActionAppear`: `scale(0)` to `scale(1.15)` to `scale(1)` with opacity transition. Uses `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring effect. Staggered delays: 0ms, 40ms, 80ms, 120ms per radial menu button.
- `newExpandGlow`: Pulsing amber `box-shadow` animation applied to nodes added via the expand/generate actions.

**ReactFlow Overrides**:
- Handles hidden by default (opacity: 0), shown on node hover (opacity: 0.5)
- Attribution badge hidden
- Edge paths: rounded caps and joins, hover increases to 3px with drop-shadow glow
- Z-index: Edges behind nodes (edges z-index: 0, nodes z-index: 1)

**Consequence Node**:
- Hover: `scale(1.05)` + `box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2)`
- Transition: transform and box-shadow at 0.2s ease
- `.consequence-node:has(.node-action-btn)`: `transform: none` — prevents hover scale when radial menu is showing

**Node Action Label**:
- `.node-action-label`: opacity transition on hover for radial menu button labels

**Badge styling**:
- `.steep-badge`: 0.65rem, 2px 6px padding, 4px border-radius, 600 weight, uppercase, 0.05em letter-spacing

---

## Tailwind Theme Extensions (`tailwind.config.js`)

**Custom Colors**:
- `positive`: light (#e6fff5), DEFAULT (#0a6847), dark (#0a6847)
- `negative`: light (#fff0f3), DEFAULT (#a4133c), dark (#a4133c)
- `neutral`: light (#e8eaef), DEFAULT (#3c2f80), dark (#2d3341)
- `seed`: light (purple tint), DEFAULT (#7c5cfc), dark (deeper purple)
- `steep.social`: #e91e8c (magenta)
- `steep.technological`: #00d4aa (teal)
- `steep.economic`: #c8e600 (lime)
- `steep.environmental`: #22c55e (green)
- `steep.political`: #ff6b35 (orange)
- `steep.ethical`: #7c5cfc (purple)

**Sentiment Color Tokens**:
- Positive: bg `#e6fff5`, border `#00d4aa`, text `#0a6847`
- Negative: bg `#fff0f3`, border `#ff4d6d`, text `#a4133c`
- Neutral: bg `#e8eaef`, border `#8891a0`, text `#2d3341`

**Solution Color Tokens** (`SOLUTION_COLORS`):
- bg `#fff7e6`, border `#ff9f1c`, text `#7a4100`

**Fonts**: JetBrains Mono (monospace), imported from Google Fonts

---

## Responsive Behavior

The application has minimal responsive design:
- Input form uses `p-6 md:p-12` padding
- Form layout is single-column and works on mobile
- The map view is designed for desktop — the 320px sidebar + ReactFlow canvas assumes a wide viewport
- No explicit mobile breakpoints for the map view
- ReactFlow's built-in pinch-to-zoom provides some touch support

---

## Accessibility Notes

Current accessibility gaps:
- No ARIA labels on filter toggle buttons
- Color-only differentiation for STEEPE categories (no pattern/shape alternatives)
- Sentiment communicated via color + small icon — may be hard to distinguish
- Node text can be very small (7-11px base, further scaled by importance)
- Inline edit mode improves over the old browser `prompt()` / `confirm()` dialogs but still lacks full ARIA support
- No keyboard navigation support for the graph (radial menu is click-only)
- No screen reader announcements for generation progress or placeholder node transitions
