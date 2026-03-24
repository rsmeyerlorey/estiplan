# Estiplan — Future Features

Ideas and features to consider adding as the tool matures. Items move out of here and into active development as they become relevant (usually driven by new McElreath lectures).

---

## Variable Types to Consider

### Compositional
- Parts of a whole that sum to 1 (e.g., diet proportions, time allocation across activities)
- Relevant in McElreath's anthropology work (dietary composition studies)
- brms: `dirichlet()` family or softmax transform
- Requires special handling: can't just throw in a linear model

### Zero-Inflated Count
- Counts with excess zeros (e.g., number of papers published, species counts at a site)
- Common in ecology, epidemiology, social science
- brms: `zero_inflated_poisson()` or `zero_inflated_negbinomial()`
- Two-process model: probability of zero vs. count given non-zero

### Survival / Duration (Time-to-Event)
- Time until an event occurs (e.g., time until failure, disease onset, job change)
- Entire modeling paradigm with censoring, hazard functions
- brms: `cox()`, `weibull()`, `exponential()`
- May need a richer UI than a single variable type (censoring indicator, etc.)

---

## DAG / Analysis Features

### Mutilated DAG View
- When an estimand is selected, visually show the "intervention DAG" — arrows into the treatment variable grayed out or dashed
- Helps users understand what `do(X)` means graphically
- Now that d-separation is implemented, this is purely visual

### ~~Confound Warnings~~ ✅ DONE (A07)
### ~~Backdoor Criterion~~ ✅ DONE (A07)

### Multiple Valid Adjustment Sets
- The backdoor criterion may yield multiple valid adjustment sets
- Show all options and let user choose between minimal sets
- Current implementation finds one valid set; could enumerate alternatives

### Instrument Variables
- Detect potential instrumental variable patterns in the DAG
- IV: Z → X → Y with no direct Z → Y path and no common causes of Z and Y
- Generate 2SLS or IV-regression code

### Prior Specification UI
- Visual interface for choosing priors on model parameters
- Prior predictive simulation (as McElreath demonstrates in A06)
- Show what the priors imply about the outcome space

### Full R Script Export
- Generate a complete, runnable R script from the DAG + estimand
- Include: library loading, data prep, model fitting, posterior checks, causal effect simulation
- Match the simulation approach McElreath teaches (simulate intervention, compute contrast)

### Synthetic Data Simulation
- Generate fake data from the DAG structure to test the estimator
- Verify that the model recovers known causal effects
- McElreath's "test before you invest" workflow

### Multiple Generative Models Comparison
- Side-by-side comparison of different DAG assumptions
- Show how different causal assumptions lead to different estimators
- "What if this arrow doesn't exist?" sensitivity analysis

### Multilevel / Hierarchical Models
- Varying effects syntax in brms: `(1 + x | group)`
- Relevant when variables have natural grouping structure
- Comes up in later McElreath lectures

### Multivariate Models
- Multiple outcome variables modeled jointly
- brms `bf()` syntax for multivariate formulas
- Relevant for mediation analysis and SEM-style models

---

## UI / UX

### Minimap
- React Flow minimap for large DAGs
- Especially useful once DAGs get 10+ variables

### Collaborative Editing
- Real-time collaboration on DAGs (like Figma)
- Way in the future, but architecture should accommodate

### Export as Image
- PNG/SVG export of the current DAG
- Useful for papers and presentations

### Keyboard-Driven Workflow
- Quick-add variables with keyboard shortcut
- Navigate between nodes with arrow keys
- Vim-like bindings for power users
