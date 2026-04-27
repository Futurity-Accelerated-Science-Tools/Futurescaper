# Cowork Session Prompt: Futurescape Persistence & Public Demo Page

Copy everything below the line into a new Cowork chat, with the `Futurity-Accelerated-Science-Tools-Frontend` folder selected.

---

## Context

I'm building **Futurescaper**, a standalone futures analysis tool inside the FAST (Futurity Accelerated Science Tools) frontend monorepo. It lives at `Futurescaper/` and is a Vite + React + TypeScript app using Chakra UI v3 and ReactFlow v11.

Futurescaper lets users enter a future scenario seed (e.g. "Antibiotic Resistance Makes Most Antibiotics Ineffective"), then generates an interactive consequence map — a DAG of cascading consequences across STEEPE categories (Social, Technological, Economic, Environmental, Political, Ethical). Users can also generate ideas/solutions attached to consequences. After building the map, users can generate a full analytical report with AI-synthesized sections, risk matrices, structural insights, and interactive charts.

**What's already built and working:**
- Full interactive map with AI-powered node generation, manual editing, filtering
- Complete report generation pipeline (algorithmic graph stats → structural insights → AI synthesis)
- In-app `ReportPanel` component (full-screen overlay with collapsible sections, charts, ReadOnlyMap)
- **HTML export** of the report as a self-contained standalone file with vanilla JS interactivity (click-to-show consequence cards on chips, risk chart dots, and map nodes). This is fully working via a DOM snapshot approach in `Futurescaper/src/components/reportHtmlExport.ts`.
- The app currently stores all state in-memory (React state). There is no persistence — refreshing the page loses everything.

**Key files to understand the data model:**
- `Futurescaper/src/types.ts` — All TypeScript types (`FutureInput`, `Consequence`, `Solution`, `ReportData`, `GraphStatistics`, `StructuralInsights`, etc.)
- `Futurescaper/src/components/FuturescapeMap.tsx` — Main map component, orchestrates generation, holds all state
- `Futurescaper/src/components/ReportPanel.tsx` — Report display component
- `Futurescaper/src/components/ReadOnlyMap.tsx` — Read-only ReactFlow map used in reports
- `Futurescaper/src/utils/graphStats.ts` — Pure functions for computing graph statistics and structural insights
- `Futurescaper/src/api/reportGeneration.ts` — AI report synthesis
- `Futurescaper/src/components/reportHtmlExport.ts` — HTML export logic
- `Futurescaper/TODO.md` — Current task tracker with completed work and next goals

## What I Need To Build

### Immediate Goal: Save & Serve Completed Futurescapes

I need to persist completed futurescapes (the map data + generated report) so they can be loaded later in two contexts:

1. **Inside the FAST app** — For specific client organizations/labs, we want to show pre-built futurescape examples. The FAST app is the parent React app in `src/` (same monorepo), and it has its own routing, auth (Supabase), and API layer. The Futurescaper is currently a separate Vite app in `Futurescaper/`.

2. **On a public demo page for non-registered users** — A standalone page (or section of a page) where cold-email recipients can view completed artifacts without logging in. This demo page will eventually show 4 types of artifacts:
   - **Futurescapes** (map + report) — THIS IS THE FOCUS OF THIS SESSION
   - **Subjects** — A browsable collection of FAST subject pages (to be defined later)
   - **Personas** — AI-generated personas with ElevenLabs voice agents (pipeline exists, needs a serving page — later)
   - **Analysis Reports** — Output from the Futurity Engine (just received the Engine code, needs investigation — later)

   The demo page will have a single panel with 4 options (with preview images), and users click to explore whichever artifact type interests them.

### Storage Approach

I'm thinking S3 (or equivalent) for storing completed futurescape data. The data to persist per futurescape would be:
- `FutureInput` (the seed scenario: title, description, horizon, perspective, etc.)
- `Consequence[]` (all nodes including ideas/solutions — these have `nodeType` field)
- `Solution[]` (legacy, may be empty)
- `ReportData` (the generated report with all sections)
- `GraphStatistics` and `StructuralInsights` (pre-computed stats)
- ReactFlow node/edge positions (so the map layout is preserved)
- Possibly a preview image/thumbnail of the map

### What I Need Help With

1. **Design the S3 storage schema** — What gets saved, how it's organized, naming conventions
2. **Build a save flow** — After report generation, allow saving the complete futurescape to S3
3. **Build a read-only futurescape viewer** — A page/component that loads saved data from S3 and renders the map + report in a non-editable, non-generative mode. This could be a new route in the Futurescaper app or a new component.
4. **Figure out the serving architecture** — How the public demo page and the FAST app both access these saved futurescapes. Consider: Should the demo page be a route in the Futurescaper app? A separate lightweight page? Part of the FAST app?

### Constraints & Preferences
- The FAST app backend is FastAPI (Python) with Supabase for auth/DB. Environment config is in `ENVIRONMENT_CONFIG.md`.
- I'd prefer a simple approach — maybe just JSON files in S3 with a lightweight API or even direct S3 presigned URLs for the demo page.
- The demo page should work without authentication.
- Keep the Futurescaper's existing architecture intact — it's working well as a standalone Vite app.

Please start by reading the types file (`Futurescaper/src/types.ts`) and the TODO (`Futurescaper/TODO.md`), then let's discuss the storage schema and architecture before writing any code.
