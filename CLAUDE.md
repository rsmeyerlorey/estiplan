# Estiplan

## Project Overview
Estiplan is an interactive causal DAG (Directed Acyclic Graph) workflow visualizer inspired by Richard McElreath's "Statistical Rethinking" course (2026 Lecture A05). The goal is to help scientists turn whiteboard sketches of causal models into formal statistical coding plans.

The key insight from McElreath: existing pipeline software handles computation chains, but there's no tool that combines **scientific justifications** with **workflow visualization** and **attached code** at each step. Estiplan aims to fill that gap.

## Tech Stack
- **React 19 + TypeScript** (Vite)
- **@xyflow/react** (React Flow) — node graph canvas
- **Zustand** — state management (composed slices + subscribeWithSelector)
- **@dagrejs/dagre** — automatic graph layout
- **CSS Modules** with CSS custom properties for theming

## Architecture

### State Management (Zustand slices)
- `variableSlice` — Map<string, Variable> for DAG variables
- `edgeSlice` — causal edges array
- `estimandSlice` — estimands, path highlighting, do-calculus, model generation, interaction toggle
- `themeSlice` — whiteboard/chalkboard theme + TB/LR flow direction
- `useEstiplanStore` — composed store with canvas state (positions, layout, delete)
- `persistence.ts` — auto-save/load to localStorage with 500ms debounce

**Important:** Never call store getter functions (getRfNodes/getRfEdges) inside Zustand selectors — this causes infinite re-render loops. Use `useMemo` to derive React Flow nodes/edges from individual store values.

### Components
- `EstiplanCanvas` — main React Flow canvas (derives nodes/edges via useMemo)
- `VariableNode` — circle node with shorthand letter, labels, typed handles (triangle source ▼, circle target ●)
- `EstimandCard` — expanded card showing estimand + math notation + brms code + interaction toggle + info tip
- `CausalArrow` — bezier edge with highlighting/dimming, invisible 20px hit area, hoverable square handle for annotations
- `Toolbar` — add variable, auto layout, flow direction toggle, theme toggle
- Context menus: Variable (edit, type, bidirectional estimands), Edge (annotate inline, delete), Canvas (add variable, layout)

### DAG Utilities (`src/dag/`)
- `pathfinding.ts` — DFS all-paths, adjacency list builder
- `mediators.ts` — find intermediate nodes on paths
- `doCalculus.ts` — generate do-notation and plain English descriptions
- `modelGen.ts` — generate brms R code + math notation from estimand (supports interaction toggle, all variable type combos)
- `layout.ts` — dagre auto-layout (supports TB and LR directions)

### Node UX Design
- **Source handle** (triangle ▼/►): "effects..." — on BOTTOM (TB) or RIGHT (LR), tangent to circle edge
- **Target handle** (circle ●): "is affected by..." — on TOP (TB) or LEFT (LR)
- **Labels** appear on the side that doesn't conflict with arrows: RIGHT (TB) or BELOW (LR)
- Node bounding box is fixed 64x64 (circle only); labels are position:absolute to keep handles centered
- All variable types show their badge (including Continuous)

### Estimand Declaration
Bidirectional — users can declare estimands from either direction:
- Forward: "What is the effect on...?" (right-click cause → pick effect)
- Reverse: "What affects this?" (right-click effect → pick cause)
Both produce correct source/target estimands with total/direct effect options.

### Model Generation
- Maps variable types to brms families: continuous→gaussian(), binary→bernoulli(), count→poisson()
- Generates math notation with Unicode symbols (α, β, μᵢ, σ)
- Generates copy-pasteable brms R code
- Interaction toggle works for all treatment types (categorical and continuous)
- ⓘ info tip about data preparation (centering, scaling)

### Persistence
- Auto-saves to localStorage on every state change (500ms debounce)
- Auto-loads on app startup
- Saves: variables, edges, estimands, node positions, theme, flow direction

### Theme System
- Two themes: whiteboard (light, Inter font) and chalkboard (dark green, Caveat cursive)
- All colors via CSS custom properties (--estiplan-*)
- Info popups use solid `--estiplan-menu-bg` to avoid transparency bleed on chalkboard
- Code blocks use `--estiplan-code-bg` variable

## Build & Run
```bash
npm install
npm run dev        # dev server on localhost:5173
npx vite build     # production build
```

## Git
- Repo: local only (no remote yet)
- User: Robin <robinmeyerlorey@gmail.com>

## Development Workflow
Lecture-driven development: watch McElreath's Statistical Rethinking 2026 lectures, paste transcripts, add features as new concepts are introduced. Each lecture is a natural test case.

## Completed Features
1. ✅ DAG builder (variables, causal arrows, layout, TB/LR toggle)
2. ✅ Estimand declaration with do-calculus notation (bidirectional)
3. ✅ Statistical model generation (brms code + math notation + interaction toggle)
4. ✅ Auto-save/load persistence (localStorage, debounced)
5. ✅ Save/Load .estiplan.json files with validation
6. ✅ Undo/Redo (50-snapshot history, Ctrl+Z/Y, debounced drag handling)
7. ✅ Edge validation (self-loops, duplicates, cycle detection)
8. ✅ New/Clear with confirm dialog
9. ✅ Duplicate as variant (export + clear estimands)
10. ✅ Edge annotations with hoverable square handle + inline editing
11. ✅ Whiteboard/chalkboard themes

## Architecture Notes
- `history.ts` — HistoryManager class with pause/resume to prevent recursive snapshots during undo/redo apply
- `wouldCreateCycle()` in pathfinding.ts — BFS from target to check reachability of source before adding edge
- Keyboard shortcuts registered in App.tsx useEffect, excludes input fields
- Toolbar uses visual separator divs for button grouping

## Roadmap (Lecture-Driven)
- ⬜ A06: Conditioning set suggestions (backdoor criterion / d-separation)
- ⬜ Prior specification UI
- ⬜ Full R script export
- ⬜ Synthetic data simulation & testing loop
- ⬜ Multiple generative models comparison
- ⬜ Multilevel models (varying effects syntax in brms)
- ⬜ Multivariate models (bf() syntax in brms)
