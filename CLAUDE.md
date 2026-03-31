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
- `estimandSlice` — estimands + statistical models, path highlighting, backdoor criterion, model generation
- `themeSlice` — whiteboard/chalkboard theme + TB/LR flow direction
- `useEstiplanStore` — composed store with canvas state (positions, layout, delete)
- `persistence.ts` — auto-save/load to localStorage with 500ms debounce

**Important:** Never call store getter functions (getRfNodes/getRfEdges) inside Zustand selectors — this causes infinite re-render loops. Use `useMemo` to derive React Flow nodes/edges from individual store values.

### Components
- `EstiplanCanvas` — main React Flow canvas (derives nodes/edges via useMemo)
- `VariableNode` — circle node with shorthand letter, labels, typed handles (triangle source ▼, circle target ●)
- `EstimandCard` — simplified card showing just the causal question (kind, plain English, do-notation)
- `ModelCard` — statistical strategy card (adjustment set with reasons, bad control warnings, math, brms code, interaction toggle, Table Two Fallacy note)
- `CausalArrow` — bezier edge with highlighting/dimming, invisible 20px hit area, hoverable square handle for annotations
- `Toolbar` — add variable, auto layout, flow direction toggle, theme toggle
- Context menus: Variable (edit, type, bidirectional estimands), Edge (annotate inline, delete), Canvas (add variable, layout)

### DAG Utilities (`src/dag/`)
- `dseparation.ts` — Full d-separation engine: triple classification (fork/pipe/collider), undirected path finding, path blocking checks, backdoor criterion with adjustment set and bad control detection
- `pathfinding.ts` — DFS all directed paths, adjacency list builder, cycle detection
- `mediators.ts` — find intermediate nodes on paths
- `confounds.ts` — legacy fork detection (now superseded by dseparation.ts for full analysis)
- `doCalculus.ts` — generate do-notation and plain English descriptions
- `modelGen.ts` — generate brms R code + math notation from estimand (supports interaction toggle, all variable type combos)
- `layout.ts` — dagre auto-layout (supports TB and LR directions)

### Card Architecture (Split Cards — A07)
The workflow mirrors McElreath's diagram: DAG → Estimand → Statistical Model

**Estimand Card** (the question):
- Kind badge (Total/Direct Effect)
- Plain English description
- do-calculus notation p(Y|do(X))

**Statistical Model Card** (the strategy):
- Identifiability status (backdoor criterion result)
- Adjustment set with per-variable reasons (fork, pipe, collider fix)
- Bad control warnings (colliders, post-treatment, mediators)
- Math notation + brms code
- Interaction toggle
- Table Two Fallacy note

### D-Separation Engine (`dseparation.ts`)
Implements all three rules:
1. **Fork** (X ← Z → Y): blocked by conditioning on Z
2. **Pipe** (X → Z → Y): blocked by conditioning on Z
3. **Collider** (X → Z ← Y): blocked UNLESS conditioning on Z or descendant of Z

Plus **Descendant** rule: conditioning on a descendant acts as weaker version.

**Backdoor Criterion Algorithm:**
1. Find all undirected paths between treatment and outcome
2. Classify each as causal (front door) or backdoor
3. For backdoor paths, identify fork/pipe/collider triples
4. Build adjustment set that blocks all backdoor paths without opening colliders
5. Detect bad controls (colliders, post-treatment variables, mediators)
6. Report identifiability status

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
Declaration flow now includes backdoor analysis summary before confirming.

### Model Generation
- Maps variable types to brms families: continuous→gaussian(), binary→bernoulli(), count→poisson(), ordinal→cumulative("logit"), proportion→Beta(), positive-continuous→lognormal()
- Generates math notation with Unicode symbols (α, β, μᵢ, σ)
- Generates copy-pasteable brms R code
- Interaction toggle works for all treatment types (categorical and continuous)
- ⓘ info tip about data preparation (centering, scaling)
- Table Two Fallacy note on model cards when adjustment variables present
- Default prior specification: generates sensible priors per family (logit-scale for binary, log-scale for count, etc.)
- Priors are editable per parameter with educational tooltips explaining each choice
- `set_prior()` calls included in generated brms code

### Variable Type Groups (UI)
Types organized into expandable groups in the context menu:
- **Continuous**: Continuous, Positive Continuous, Proportion (0–1)
- **Discrete**: Categorical, Binary, Ordinal, Count
- **Time**: Time (Series), Time (Cycle)
- **Special**: Unobserved / Latent

### Persistence
- Auto-saves to localStorage on every state change (500ms debounce)
- Auto-loads on app startup
- Saves: variables, edges, estimands, models, node positions, theme, flow direction

### Theme System
- Two themes: whiteboard (light, Inter font, dot grid) and chalkboard (dark gray/black, Nunito font, no grid)
- All colors via CSS custom properties (--estiplan-*)
- Info popups use solid `--estiplan-menu-bg` to avoid transparency bleed
- Code blocks use `--estiplan-code-bg` variable

## Build & Run
```bash
npm install
npm run dev        # dev server on localhost:5173
npx vite build     # production build
```

## Git
- Repo: GitHub (private)

## Development Workflow
Lecture-driven development: follow along with McElreath's Statistical Rethinking 2026 lectures, adding features as new concepts are introduced. Each lecture is a natural test case.

## Completed Features
1. ✅ DAG builder (variables, causal arrows, layout, TB/LR toggle)
2. ✅ Estimand declaration with do-calculus notation (bidirectional)
3. ✅ Statistical model generation (brms code + math notation + interaction toggle)
4. ✅ Auto-save/load persistence (localStorage, debounced)
5. ✅ Save/Load .estiplan.json files with name prompt
6. ✅ Undo/Redo (50-snapshot history, Ctrl+Z/Y, debounced drag handling)
7. ✅ Edge validation (self-loops, duplicates, cycle detection)
8. ✅ New/Clear with confirm dialog
9. ✅ Duplicate as variant (export + clear estimands)
10. ✅ Edge annotations with hoverable square handle + inline editing
11. ✅ Whiteboard/chalkboard themes (chalkboard: dark gray, Nunito, no grid)
12. ✅ Variable types: 10 types in 4 groups (continuous, discrete, time, special)
13. ✅ Fork confound detection + conditioning set suggestions (A06)
14. ✅ Full d-separation engine — fork, pipe, collider, descendant (A07)
15. ✅ Backdoor criterion — automatic adjustment set with reasons
16. ✅ Bad control warnings — collider, post-treatment, mediator detection
17. ✅ Split card architecture — Estimand Card (question) + Model Card (strategy)
18. ✅ Table Two Fallacy note on model cards
19. ✅ Resizable model cards (drag handle, nopan/nodrag)
20. ✅ Context menu viewport adjustment (measures actual size)
21. ✅ Grouped variable type picker
22. ✅ Hover-only dashed connector lines (model card → estimand + DAG variables)
23. ✅ Default prior specification with educational tooltips (editable per parameter)
24. ✅ Automated test suite (10 reference DAGs, d-separation + prior generation tests)
25. ✅ Minimal adjustment set algorithm + non-standard path handling
26. ✅ About panel on title click (estimand etymology + course link)

## Prior Wizard (standalone, pending integration)
A separate app in `../prior-wizard/` that walks users through setting Bayesian priors step by step. Currently standalone; integration plan is documented in ROADMAP.md §2.1. Key design decisions:
- ☰ hamburger menu next to title opens a left side panel (pushes canvas, doesn't overlay)
- Model card priors section gets "click to edit directly, or use the Prior Wizard"
- Wizard pre-fills from estimand context (variable names, types, family)
- Wizard component accepts props and returns priors via callback

### Prior Wizard current status
- Supports all 7 outcome families (Gaussian, Log-Normal, Beta, Bernoulli, Poisson, Ordinal, Categorical)
- Three prior views: natural, centered, standardized (with interactive slope editors + confidence bounds)
- localStorage persistence with auto-save
- Gaussian/identity link is fully polished; logit/log links functional but need UX work
- Gaussian vs Log-Normal framed as additive vs multiplicative effects
- Log-normal effects shown as percentage change
- Currently assumes continuous predictor (categorical treatment support is a Tier 3 goal)

### Prior Wizard remaining TODOs
- Intercept (α) editors for logit/log links (only identity link has one currently)
- Standardized card clarity for logit/log (show treatment in SD units)
- Distribution plot axis labels (log/logit) + optional natural-scale view
- Input validation for bounded families (proportions 0–1)
- Explanation for non-editable ordinal/categorical intercepts
- Test suite for `computeScaledPriors` (7 families × 3 scales)
- Replace boilerplate README

## Architecture Notes
- `history.ts` — HistoryManager class with pause/resume to prevent recursive snapshots during undo/redo apply
- `wouldCreateCycle()` in pathfinding.ts — BFS from target to check reachability of source before adding edge
- Keyboard shortcuts registered in App.tsx useEffect, excludes input fields
- Toolbar uses visual separator divs for button grouping
- EstimandCard and ModelCard are separate React Flow node types linked by IDs
- Card nodes need invisible `<Handle>` components (opacity:0, pointerEvents:none) for React Flow to route edges to them — without handles, edges silently don't render
- CSS `var()` custom properties don't work in React inline styles on SVG elements — use hardcoded color values for edge styles

## Roadmap (Lecture-Driven)
- ✅ A05: DAG builder + estimand declaration + model generation
- ✅ A06: Fork confound detection + conditioning set suggestions
- ✅ A07: Complete d-separation (pipe, collider, descendant) + backdoor criterion + split cards + Table Two Fallacy
- ✅ Prior specification UI (default priors with educational tooltips, editable)
- ⬜ A08+: Continue with lectures (sensitivity analysis, measurement error, missing data, etc.)
- ⬜ Full R script export
- ⬜ Synthetic data simulation & testing loop
- ⬜ Multiple generative models comparison
- ⬜ Multilevel models (varying effects syntax in brms)
- ⬜ Multivariate models (bf() syntax in brms)
- ⬜ Treatment variable type support (categorical/binary predictors — changes slope interpretation)
- See ROADMAP.md for the full prioritized roadmap
