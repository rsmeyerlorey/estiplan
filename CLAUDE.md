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

Excluded mediators (direct effects) and selection variables count as conditioned-on throughout: the engine detects colliders they open, adds observed blockers to the adjustment set (reason `opened-collider`), and reports non-identifiability when an opener (e.g. unobserved mediator–outcome confounder) can't be blocked. Parents of the outcome with no connection to the treatment surface as optional **precision covariates** (include-toggle on the model card). Direct-effect model cards always carry the "no unmeasured mediator–outcome confounder" assumption note.

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
- **Special**: Unobserved / Latent, Selection (sampled on)

Selection variables mark "the sample is conditioned on this by design" (McElreath A10: NBA membership, police stops). They render with a double-ring outline, are treated as permanently conditioned-on by the d-separation engine, and trigger warnings when selection opens a non-causal path (collider) or blocks part of the effect (mediator).

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

## Git & Deployment
- Repo: GitHub (public): https://github.com/rsmeyerlorey/estiplan
- Live site: https://rsmeyerlorey.github.io/estiplan/
- GitHub Actions deploys on every push to main (`.github/workflows/deploy.yml`: install → build → test → Pages deploy)

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
26. ✅ About panel (estimand etymology + course link) — lives in the ☰ side panel
27. ✅ Prior Wizard integrated as resizable side panel (☰ menu + model card entry points, estimand pre-fill, scale-aware prior propagation)
28. ✅ GitHub Pages deployment via GitHub Actions (build + test + deploy on push to main)
29. ✅ Direct-effect mediator–outcome confounding detection + assumption note (A9/A10)
30. ✅ Precision covariate suggestions with include-toggle on model cards (A8)
31. ✅ Selection variable type — sample selection as built-in conditioning, with warnings (A10)
32. ✅ brms code: `fit <-` assignment, `chains = 4, cores = 4`, MCMC diagnostics reminder (A8)

## Prior Wizard (integrated)
The Prior Wizard walks users through setting Bayesian priors step by step. Integrated into Estiplan April 2026; lives in `src/prior-wizard/` — see its README.md for full architecture. The original standalone app also remains at `../prior-wizard/` (local git only, no GitHub remote).

- Two entry points: ☰ hamburger menu (left side panel with about blurb + wizard launcher) and "Open Prior Wizard" button in the model card priors section
- Side panel pushes the canvas (doesn't overlay) and is resizable by dragging its edge; panel state in App.tsx (closed / menu / wizard)
- ModelCard requests the wizard via a custom-event bridge (`wizardEvents.ts`), pre-filled from the estimand (variable names + family via `familyMap.ts`)
- `onPriorsReady` returns a PriorResult; App.tsx applies it via `updateModelPrior` — scale-aware: standardized applies to all slopes (class `b`), natural/centered only to the treatment slope
- Theming via `theme-bridge.css` (`--pw-*` vars read from `--estiplan-*`)
- Supports all 7 outcome families (Gaussian, Log-Normal, Beta, Bernoulli, Poisson, Ordinal, Categorical); three prior scales (natural / centered / standardized) with interactive editors + confidence bounds; distribution plots with axis labels
- localStorage persistence in standalone mode only (embedded mode starts fresh from the estimand)
- Tests: `src/prior-wizard/lib/__tests__/computeScaledPriors.test.ts` (7 families × 3 scales)
- Known gap: elicitation wording assumes a continuous predictor (categorical/binary treatment support is ROADMAP Tier 3.4)

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
- ✅ Prior Wizard integration (side panel, estimand pre-fill, scale-aware prior propagation)
- ✅ GitHub Pages deployment (Actions: build + test + deploy)
- ✅ A08–A10 quick wins: precision covariates, selection nodes, direct-effect assumption warnings, MCMC diagnostics in generated code
- ⬜ A9–B1 backlog: sensitivity analysis phase 1 (hypothetical confounder), aggregated binomial type, indirect-effect estimand, simulation loop, multilevel varying intercepts
- ⬜ B2+: Continue with lectures (measurement error, missing data, Gaussian processes, etc.)
- ⬜ Full R script export
- ⬜ Synthetic data simulation & testing loop
- ⬜ Multiple generative models comparison
- ⬜ Multilevel models (varying effects syntax in brms)
- ⬜ Multivariate models (bf() syntax in brms)
- ⬜ Treatment variable type support (categorical/binary predictors — changes slope interpretation)
- See ROADMAP.md for the full prioritized roadmap
