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

## Roadmap (McElreath's full workflow)
1. ✅ DAG builder (variables, causal arrows, layout)
2. ✅ Estimand declaration with do-calculus notation
3. ✅ Statistical model generation (brms code + math notation)
4. ✅ Auto-save/load persistence (localStorage)
5. ⬜ Clear/New + Export/Import JSON files
6. ⬜ Undo/Redo
7. ⬜ Edge validation (prevent self-loops, duplicates)
8. ⬜ Conditioning set suggestions (backdoor criterion / d-separation)
9. ⬜ Prior specification UI
10. ⬜ Full R script export
11. ⬜ Synthetic data simulation & testing loop
12. ⬜ Multiple generative models comparison
