# Estiplan Test Checklist

For each test: **Load** the file via toolbar → **Load** button, then follow the exact steps.

The estimand menu is accessed by **right-clicking a variable node**:
- **"What is the effect on…?"** = this variable is the **treatment** (cause)
- **"What affects [name]?"** = this variable is the **outcome** (effect)

After picking the other variable, you choose **Total causal effect** or **Direct effect (exclude mediators)…**

---

## Test 01 — Waffle Divorce (McElreath's classic)
**DAG:** S → A → D, S → M → D, A → M
**File:** `01-waffle-divorce.estiplan.json`

### Test 1a: Total effect of Marriage Rate → Divorce Rate
1. Right-click **Marriage Rate** → "What is the effect on…?" → click **Divorce Rate** → click **Total causal effect**
2. Estimand card appears. Verify:
   - [ ] Shows: **p(D | do(M))**
   - [ ] Plain English mentions "total effect of Marriage Rate on Divorce Rate"
   - [ ] Hover over estimand card → DAG highlights path M → D
3. On estimand card, click **Generate Statistical Model…**
4. Preview appears. Verify:
   - [ ] Adjustment set: **Age at Marriage** (fork) and **South** (fork)
   - [ ] No bad controls listed
   - [ ] Shows "identifiable"
5. Click **Create Model Card**
6. Model card appears. Verify:
   - [ ] ✓ Identifiable badge
   - [ ] brms: `divorce_rate ~ marriage_rate + age_at_marriage + south`
   - [ ] Family: `gaussian()`
   - [ ] Table Two Fallacy note appears

### Test 1b: Direct effect of Age at Marriage → Divorce Rate
1. Right-click **Age at Marriage** → "What is the effect on…?" → click **Divorce Rate** → click **Direct effect (exclude mediators)…**
2. Mediator picker appears. Verify:
   - [ ] **Marriage Rate** is listed as excludable mediator
3. Leave **Marriage Rate** checked → click **Declare Estimand**
4. Estimand card appears. Verify:
   - [ ] Shows direct effect notation
5. Click **Generate Statistical Model…** → **Create Model Card**
6. Model card. Verify:
   - [ ] Conditions on **Marriage Rate** (excluded mediator) + **South** (fork)
   - [ ] brms includes `marriage_rate` and `south` as predictors

### Test 1c: Total effect of South → Divorce Rate
1. Right-click **South** → "What is the effect on…?" → click **Divorce Rate** → click **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] **No adjustment variables** (nothing causes South, so no backdoor paths)
   - [ ] brms: `divorce_rate ~ south`
   - [ ] Family: `gaussian()`
   - [ ] No Table Two Fallacy note (no controls)

---

## Test 02 — Simple Fork
**DAG:** Z → X, Z → Y, X → Y
**File:** `02-simple-fork.estiplan.json`

1. Right-click **Treatment** → "What is the effect on…?" → click **Outcome** → **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] Estimand: **p(Y | do(X))**
   - [ ] Adjustment set: **Common Cause** with tag **(fork)**
   - [ ] Identifiable ✓
   - [ ] brms: `outcome ~ treatment + common_cause`
   - [ ] Family: `gaussian()`
   - [ ] Table Two Fallacy note: "Only the coefficient for Treatment is a causal effect"

---

## Test 03 — Simple Pipe
**DAG:** X → Z → Y (no direct edge X → Y)
**File:** `03-simple-pipe.estiplan.json`

### Test 3a: Total effect
1. Right-click **Treatment** → "What is the effect on…?" → click **Outcome** → **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] **Empty adjustment set** — no backdoor paths exist
   - [ ] brms: `outcome ~ treatment`
   - [ ] No Table Two note (no controls)

### Test 3b: Direct effect (excluding Mediator)
1. Right-click **Treatment** → "What is the effect on…?" → click **Outcome** → **Direct effect (exclude mediators)…**
2. **Mediator** should be listed and checked → click **Declare Estimand**
3. Click **Generate Statistical Model…** → **Create Model Card**
4. Verify:
   - [ ] Conditions on **Mediator**
   - [ ] brms: `outcome ~ treatment + mediator`

---

## Test 04 — Classic Collider ⚠️
**DAG:** X → Z ← Y (no edge between X and Y)
**File:** `04-classic-collider.estiplan.json`

1. Right-click **Talent** → "What is the effect on…?" → click **Attractiveness** → **Total causal effect**
   - ⚠️ Note: There is NO causal path from Talent to Attractiveness. The estimand should still be declarable.
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] **No adjustment set** (no backdoor paths — X and Y are independent)
   - [ ] **Hollywood Success** listed as **bad control (collider)** — "conditioning would open a non-causal path"
   - [ ] brms: `attractiveness ~ talent` (Hollywood Success is NOT in the formula)
   - [ ] Family: `bernoulli()` (binary outcome — wait, Attractiveness is continuous, so `gaussian()`)

---

## Test 05 — Collider + Descendant ⚠️
**DAG:** X → Z ← Y, Z → D
**File:** `05-collider-descendant.estiplan.json`

1. Right-click **Education** → "What is the effect on…?" → click **Earnings** → **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] **No adjustment set** (no backdoor, X and Y are independent)
   - [ ] **Occupation** flagged as bad control **(collider)**
   - [ ] **Job Title** flagged as bad control **(descendant of collider)**
   - [ ] brms: `earnings ~ education` (neither Z nor D in formula)
   - [ ] Family: `lognormal()` (Earnings is positive-continuous)

---

## Test 06 — Unidentifiable ⚠️⚠️
**DAG:** X → Y, U → X, U → Y (U is unobserved/latent)
**File:** `06-unidentifiable.estiplan.json`

1. Right-click **Treatment** → "What is the effect on…?" → click **Outcome** → **Total causal effect**
2. Click **Generate Statistical Model…**
3. Verify preview:
   - [ ] Shows ⚠ **"No sufficient adjustment set found"** or similar non-identifiable warning
   - [ ] U is recognized as unobserved and **cannot** be in the adjustment set
4. Click **Create Model Card** (if available)
5. Verify:
   - [ ] Red/orange ⚠ identifiability warning prominently displayed
   - [ ] Model still generates but user is clearly warned

---

## Test 07 — Multiple Backdoor Paths
**DAG:** A → X, A → Y, B → X, B → Y, X → Y (two independent forks)
**File:** `07-multiple-backdoors.estiplan.json`

1. Right-click **Treatment** → "What is the effect on…?" → click **Outcome** → **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] Adjustment set includes BOTH **Confound A (fork)** AND **Confound B (fork)**
   - [ ] Identifiable ✓
   - [ ] brms: `outcome ~ treatment + confound_a + confound_b`
   - [ ] Family: `poisson()` (Outcome is count type)
   - [ ] Table Two Fallacy note present

---

## Test 08 — Post-Treatment Bias
**DAG:** X → M → Y, X → Y (direct + mediated paths)
**File:** `08-post-treatment-bias.estiplan.json`

### Test 8a: Total effect of Fertilizer → Fruit Yield
1. Right-click **Fertilizer** → "What is the effect on…?" → click **Fruit Yield** → **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] **No adjustment set** (no backdoor paths — nothing causes Fertilizer)
   - [ ] **Plant Height** flagged as bad control **(post-treatment)** or **(mediator for total effect)**
   - [ ] brms: `fruit_yield ~ fertilizer` (Plant Height NOT in formula)
   - [ ] Family: `lognormal()` (positive-continuous outcome)

### Test 8b: Direct effect of Fertilizer → Fruit Yield (exclude Plant Height)
1. Right-click **Fertilizer** → "What is the effect on…?" → click **Fruit Yield** → **Direct effect (exclude mediators)…**
2. **Plant Height** should be listed → leave checked → **Declare Estimand**
3. Click **Generate Statistical Model…** → **Create Model Card**
4. Verify:
   - [ ] Conditions on **Plant Height** (now correct — it's required for direct effect)
   - [ ] brms: `fruit_yield ~ fertilizer + plant_height`
   - [ ] Plant Height is NO LONGER flagged as bad control (it's wanted here)

---

## Test 09 — Table Two Fallacy (Kitchen Sink)
**DAG:** Age → X/Y, Sex → X/Y, Diet → X/Y, X → Y (three forks)
**File:** `09-table-two-fallacy.estiplan.json`

1. Right-click **Exercise** → "What is the effect on…?" → click **Blood Pressure** → **Total causal effect**
2. Click **Generate Statistical Model…** → **Create Model Card**
3. Verify:
   - [ ] Adjustment set: **Age (fork)**, **Sex (fork)**, **Diet Quality (fork)** — all three
   - [ ] Identifiable ✓
   - [ ] brms: `blood_pressure ~ exercise + age + sex + diet_quality`
   - [ ] Family: `gaussian()`
   - [ ] **Table Two Fallacy note**: "Only the coefficient for Exercise is a causal effect"
4. Toggle the **interaction checkbox**
5. Verify:
   - [ ] brms code updates with interaction terms (e.g., `exercise:age + exercise:sex + exercise:diet_quality`)
   - [ ] Math notation updates with interaction notation

---

## Test 10 — brms Family Sweep
**DAG:** X → 7 different outcome types
**File:** `10-brms-family-sweep.estiplan.json`

For EACH outcome below, do:
Right-click **Treatment** → "What is the effect on…?" → click **[Outcome]** → **Total causal effect** → **Generate Statistical Model…** → **Create Model Card**

Then verify the family and math distribution:

| # | Right-click Treatment → effect on… | Expected brms family | Expected math line 1 |
|---|-------------------------------------|---------------------|-----------------------|
| a | **Weight** | `gaussian()` | Wᵢ ~ Normal(μᵢ, σ) |
| b | **Survived** | `bernoulli()` | Svᵢ ~ Bernoulli(πᵢ) |
| c | **Offspring Count** | `poisson()` | Nᵢ ~ Poisson(λᵢ) |
| d | **Species** | `categorical()` | Spᵢ ~ Categorical(πᵢ) |
| e | **Severity** | `cumulative("logit")` | Sevᵢ ~ OrderedLogit(φᵢ, κ) |
| f | **Proportion Infected** | `Beta()` | Pᵢ ~ Beta(μᵢ, φ) |
| g | **Income** | `lognormal()` | Iᵢ ~ LogNormal(μᵢ, σ) |

Checkboxes:
- [ ] 10a: gaussian ✓
- [ ] 10b: bernoulli ✓
- [ ] 10c: poisson ✓
- [ ] 10d: categorical ✓
- [ ] 10e: cumulative ✓
- [ ] 10f: Beta ✓
- [ ] 10g: lognormal ✓

---

## Cross-Cutting Checks (pick any 2-3 tests to verify these)

### Hover & Highlighting
- [ ] Hover over **estimand card** → causal path lights up on DAG
- [ ] Hover over **model card** → dashed lines appear from estimand + treatment + outcome to model card
- [ ] Move mouse away → highlights/dashes disappear

### Card Behavior
- [ ] Estimand cards and model cards are **independently draggable** (move one, other stays)
- [ ] Both card types are **resizable** via bottom-right drag handle
- [ ] Close (×) on model card → removes it, estimand card shows "Generate Model" button again

### brms Code
- [ ] **Copy button** on model card copies brms code to clipboard

### Theme
- [ ] **Chalkboard**: dark gray background, Nunito font, no gridlines
- [ ] **Whiteboard**: light background, dot grid pattern
- [ ] Switch themes mid-session — everything still readable

### Save/Load Roundtrip
- [ ] Build a full DAG + estimand + model → **Save** → **New** (clears all) → **Load** the saved file → everything restores correctly including estimand and model cards

### Undo/Redo
- [ ] Create estimand → Ctrl+Z undoes it → Ctrl+Y redoes it

### Edge Cases
- [ ] Right-click a variable with no edges → estimand menu shows "No causal paths found" where appropriate
- [ ] Try to create estimand between unconnected variables → should still allow declaration but note no paths
