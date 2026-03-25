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

### 2.1 Prior specification UI
- Let users set priors per coefficient on the model card
- Generate `set_prior()` calls in brms code
- Prior predictive simulation (show what priors imply about outcome space)
- **Why:** Statistical Rethinking is fundamentally Bayesian; priors are modeling decisions, not defaults to ignore

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

### 3.4 Multilevel & multivariate models
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
