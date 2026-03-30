# Estiplan Roadmap

Organized by priority. Tier 1 is pre-launch; Tiers 2-4 are lecture-driven and ongoing.

---

## Tier 1 — Pre-launch polish ✅

Completed. Before making the repo public or sharing broadly.

### 1.1 Automated test suite for DAG engine
- Load each `test-dags/*.estiplan.json` programmatically
- Run `backdoorCriterion()`, assert adjustment sets, bad controls, identifiability
- Pure function tests — no UI needed
- Covers: fork, pipe, collider, descendant, unidentifiable, multiple backdoors, post-treatment bias, Table Two Fallacy, brms family mapping
- **Why:** A tool that recommends adjustment sets must be validated against known DAGs

### 1.2 Optimal minimal adjustment set
- Replace greedy algorithm with principled enumeration (smallest set that blocks all backdoor paths)
- Current implementation finds *a* valid set, but may over-condition on complex graphs
- **Why:** Over-conditioning wastes statistical power and can introduce bias in finite samples

### 1.3 Handle non-standard path types
- Paths that start forward but reverse mid-way (neither pure causal nor classic backdoor)
- Currently silently ignored
- Rare in practice, but a methodologist will construct one

---

## Tier 2 — Bayesian workflow features (lecture-driven)

Core features that complete the DAG-to-inference pipeline McElreath teaches.

### 2.1 Prior Wizard integration
The Prior Wizard is a standalone app (`../prior-wizard/`) that walks users through setting Bayesian priors step by step. Once complete, it integrates into Estiplan as follows:

**UI design:**
- **Hamburger menu (☰) next to "Estiplan" title** in the toolbar replaces the current title-click about panel
  - Opens a left side panel (pushes canvas over, doesn't overlay)
  - Contains: about blurb, Prior Wizard launcher, and a home for future tools
- **Model card priors section** expanded by default
  - "Click a prior to edit directly, or use the Prior Wizard"
  - Clicking "Prior Wizard" opens the left panel with wizard pre-filled from the estimand
- **Two entry points:** model card (contextual) and side panel (exploratory)

**Architecture:**
- New `SidePanel` component in flex layout next to the canvas
- Panel state in Zustand store (open/closed, active tool)
- Prior Wizard becomes a component that accepts pre-filled props (outcome name, treatment name, family from variable types) and returns priors via callback
- `modelGen.ts` uses wizard-set priors when available, falls back to defaults
- Prior Wizard also remains standalone at `prior-wizard/` for users who just want to set priors without a DAG

**What Estiplan already knows (free pre-fill):**
- Variable names, types → outcome family (Steps 0–1 skipped)
- Which variable is treatment vs outcome (from estimand)
- The DAG stays visible while setting priors

**Prior Wizard TODOs before integration:**
- [ ] Add intercept (α) editors for logit/log link families (currently only Gaussian has one)
- [ ] Clarify standardized cards for logit/log links (show treatment in SD units, explain what changes vs stays the same)
- [ ] Add axis labels to distribution plots (log/logit scale) + optional "show on natural scale" view
- [ ] Validate proportion inputs (clamp 0–1 for Beta/Bernoulli outcomes)
- [ ] Explain why ordinal/categorical intercepts aren't user-editable (fixed priors with rationale)
- [ ] Add test suite for `computeScaledPriors` (all 7 families × 3 scales, edge cases)
- [ ] Replace boilerplate README with project-specific docs

**Why:** Statistical Rethinking is fundamentally Bayesian; priors are modeling decisions, not defaults to ignore

### 2.2 Simulation loop
- Generate synthetic data from the DAG (specify true effect sizes → simulate)
- Export as R code with `rnorm`/`rbinom`/etc.
- Enables "simulate → fit → recover" workflow
- **Why:** McElreath's "test before you invest" — verify the model recovers known causal effects before using real data

### 2.3 Mutilated DAG view
- When hovering/selecting an estimand, gray out arrows into the treatment variable
- Visualizes what `do(X)` means graphically
- Purely visual — d-separation engine already exists
- **Why:** Bridges the gap between notation and intuition

### 2.4 Full R script export
- Assemble all model cards into one complete script
- Include: library loads, data prep, priors, model fitting, posterior checks
- Match the simulation approach McElreath teaches (simulate intervention, compute contrast)

---

## Tier 3 — Advanced causal inference (later lectures)

Features that extend beyond the backdoor criterion.

### 3.1 Front-door criterion & instrumental variables
- Alternative identification strategies when backdoor fails
- Show "not identifiable via backdoor, but front-door criterion applies"
- Detect IV patterns: Z → X → Y with no direct Z → Y and no common causes of Z and Y
- **Why:** Currently a non-identifiable result is a dead end; these give the user somewhere to go

### 3.2 Sensitivity analysis
- "What if there's an unmeasured confounder?"
- Bias amplification or E-value computation
- **Why:** Even "identifiable" effects are only identified under DAG assumptions; users need tools to assess robustness

### 3.3 Multiple competing DAGs
- Side-by-side comparison of two DAGs for the same variables
- Show how different causal assumptions lead to different models
- "What if this arrow doesn't exist?" exploration

### 3.4 Treatment variable type support
- Currently the Prior Wizard and model generation assume a continuous predictor
- Supporting categorical/binary/ordinal treatments changes slope interpretation entirely: β becomes a group difference (treatment vs control) instead of a per-unit rate
- Requires: treatment type selector in Prior Wizard, conditional slope framing ("group A vs group B" instead of "per unit increase"), interaction handling for categorical × categorical, dummy/contrast coding options
- Affects both standalone Prior Wizard and integrated Estiplan model cards
- **Why:** Most experimental designs have categorical treatments (treatment/control, drug A/B/placebo); continuous-only is a significant limitation for real-world use

### 3.5 Multilevel & multivariate models
- Varying effects: `(1 + x | group)` syntax in brms
- Multivariate: `bf()` syntax for joint outcome models
- Relevant for mediation analysis and hierarchical data

---

## Tier 4 — Polish & extensibility

Quality-of-life features and broader compatibility.

### 4.1 Functional time variable types
- Autoregressive terms for time series, cyclical splines for seasonal data
- Currently "Time (Series)" and "Time (Cycle)" are cosmetic labels mapping to `gaussian()`

### 4.2 Additional variable types
- Compositional: `dirichlet()` for parts-of-whole data
- Zero-inflated: `zero_inflated_poisson()` for excess-zero counts
- Survival/duration: `cox()`, `weibull()` for time-to-event

### 4.3 DAGitty/DOT import
- Import existing DAGs from other tools
- Lower barrier to adoption for researchers with existing models

### 4.4 Export as image
- PNG/SVG export of the current DAG for papers and presentations

### 4.5 Keyboard-driven workflow
- Quick-add variables, arrow key navigation, power-user bindings
