# Estiplan

## Project Overview
Estiplan is an interactive causal DAG (Directed Acyclic Graph) workflow visualizer inspired by Richard McElreath's "Statistical Rethinking" course (2026 Lecture A05). The goal is to help scientists turn whiteboard sketches of causal models into formal statistical coding plans.

The key insight from McElreath: existing pipeline software handles computation chains, but there's no tool that combines **scientific justifications** with **workflow visualization** and **attached code** at each step. Estiplan aims to fill that gap.

## Tech Stack
- **React 19 + TypeScript** (Vite)
- **@xyflow/react** (React Flow) — node graph canvas
- **Zustand** — state management (composed slices)
- **@dagrejs/dagre** — automatic graph layout
- **CSS Modules** with CSS custom properties for theming

## Architecture

### State Management (Zustand slices)
- `variableSlice` — Map<string, Variable> for DAG variables
- `edgeSlice` — causal edges array
- `estimandSlice` — estimands, path highlighting, do-calculus
- `themeSlice` — whiteboard/chalkboard theme + TB/LR flow direction
- `useEstiplanStore` — composed store with canvas state (positions, layout, delete)

**Important:** Never call store getter functions (getRfNodes/getRfEdges) inside Zustand selectors — this causes infinite re-render loops. Use `useMemo` to derive React Flow nodes/edges from individual store values.

### Components
- `EstiplanCanvas` — main React Flow canvas (derives nodes/edges via useMemo)
- `VariableNode` — circle node with shorthand letter, labels, typed handles
- `EstimandCard` — floating card showing estimand notation
- `CausalArrow` — bezier edge with highlighting/dimming
- `Toolbar` — add variable, auto layout, flow direction, theme toggle
- Context menus: Variable (edit, type, estimands), Edge (annotate, delete), Canvas (add variable, layout)

### DAG Utilities (`src/dag/`)
- `pathfinding.ts` — DFS all-paths, adjacency list builder
- `mediators.ts` — find intermediate nodes on paths
- `doCalculus.ts` — generate do-notation and plain English descriptions
- `layout.ts` — dagre auto-layout (supports TB and LR directions)

### Node UX Design
- **Source handle** (triangle ▼/►): "effects..." — on BOTTOM (TB) or RIGHT (LR)
- **Target handle** (circle ●): "is affected by..." — on TOP (TB) or LEFT (LR)
- **Labels** appear on the side that doesn't conflict with arrows: RIGHT (TB) or BELOW (LR)
- Node bounding box is fixed 64x64 (circle only); labels are position:absolute to keep handles centered

### Estimand Declaration
Bidirectional — users can declare estimands from either direction:
- Forward: "What is the effect on...?" (right-click cause → pick effect)
- Reverse: "What affects this?" (right-click effect → pick cause)
Both produce correct source/target estimands with total/direct effect options.

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
3. ⬜ Statistical model generation from DAG + estimand
4. ⬜ Code attachment to workflow nodes (R/Stan/Python)
5. ⬜ Synthetic data simulation & testing loop
6. ⬜ Prior predictive checks
7. ⬜ Posterior predictions & causal effect contrasts
8. ⬜ Export (runnable script, JSON save/load, static report)
