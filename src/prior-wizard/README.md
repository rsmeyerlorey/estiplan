# Prior Wizard

An interactive, step-by-step tool that helps users specify Bayesian priors
for `brms` / Stan models. Originally built as a standalone app, now embedded
inside Estiplan's model card as a side panel.

The wizard translates what a user already knows — natural-unit beliefs about
their outcome and a plausible treatment effect — into a coherent set of
priors on the link scale used by each outcome family.

---

## Architecture

### Entry points

| File | Role |
|------|------|
| `PriorWizard.tsx` | The wizard itself. Owns `WizardState`, renders one step at a time, calls `onPriorsReady` when done. Works standalone or embedded. |
| `PriorWizardPanel.tsx` | Side-panel shell used by Estiplan. Adds header, back/close buttons, and slides in from the right. |
| `wizardEvents.ts` | Custom-event bridge so Estiplan's `ModelCard` can request the wizard without importing it directly. |
| `familyMap.ts` | Maps Estiplan's `VariableType` to a Prior Wizard `OutcomeFamily`. |
| `theme-bridge.css` | Declares `--pw-*` CSS vars that read from Estiplan's `--estiplan-*` vars. Keeps the wizard themeable without duplicating color tokens. |
| `prior-wizard.css` | Standalone styling (shared inputs, cards, buttons). |

### State

`WizardState` (in `lib/types.ts`) holds everything the user enters:
family choice, outcome/treatment descriptions, the claimed treatment
effect with confidence bounds, and the user's final scale choice. It is
the sole source of truth driving every step and the prior computation.

localStorage persistence is on for standalone mode, off for embedded
(so the Estiplan model card always starts fresh from the estimand's
variable names and family).

### Step flow

```
StepZero          → intro / resume state
StepFamily        → choose outcome family (7 supported)
StepStandardPriors→ show weakly informative defaults for that family
StepDescribe      → user states variables in natural units + effect claim
StepThreeWays     → side-by-side preview of the same prior on 3 scales
                    (natural · centered · standardized), each editable
StepDispersion    → family-specific σ / φ prior (if applicable)
                  → calls onPriorsReady with the final PriorResult
```

### Supported families (7)

| Family         | Link     | Dispersion |
|----------------|----------|------------|
| `gaussian`     | identity | σ |
| `lognormal`    | log      | σ (log-scale) |
| `beta`         | logit    | φ (precision) |
| `bernoulli`    | logit    | — |
| `poisson`      | log      | — |
| `cumulative`   | logit    | — (uses thresholds) |
| `categorical`  | logit    | — (uses per-category intercepts) |

See `FAMILIES` in `lib/types.ts` for link + brms family + meanings.

---

## Prior computation (`computeScaledPriors`)

All user input is collected in natural units ("typical value 45000, range
15000–200000; +1 year of education ≈ +10%"). The wizard then computes
the intercept and slope prior on the **link scale** and projects onto
three data-preparation scales:

1. **Natural** — predictors unchanged. Intercept is the linear predictor
   at X = 0 (often an extrapolation).
2. **Centered** — predictors minus their mean. Intercept is the linear
   predictor at the average predictor level (almost always more interpretable).
3. **Standardized** — predictors centered + divided by SD.
   - identity link: outcome is also standardized → `β_std = β × (SD_x / SD_y)`, intercept forced to Normal(0, 0.5).
   - logit / log links: only predictors standardized → `β_std = β × SD_x`, intercept stays on the link scale.

`estimateSD(desc)` uses the user's plausible range: `SD ≈ range / 4`
(approximating ±2 SD ≈ 95% coverage).

For ordinal and categorical families, thresholds get a fixed weakly-
informative Normal(0, 1.5) prior and only the slope is user-driven.

---

## Integration with Estiplan

- Opened from the `ModelCard` "Open Prior Wizard" button. A custom event
  in `wizardEvents.ts` carries the estimand context (family, variable
  names) up to `App.tsx`, which mounts `PriorWizardPanel` with pre-filled
  props.
- When the user finishes, `onPriorsReady` returns a `PriorResult`.
  `App.tsx` converts this into a `normal(mean, sd)` string and calls
  `updateModelPrior`.
- **Scale-aware propagation:** for `standardized`, the slope prior
  applies to *every* slope (`class: 'b'`) in the model — all predictors
  live on SD units. For `natural` / `centered`, the prior is applied
  only to the treatment slope because its units are specific to that
  variable.
- The panel slides in from the right and pushes the canvas left, rather
  than overlaying, so the DAG stays visible.

---

## Tests

`lib/__tests__/computeScaledPriors.test.ts` covers:

- Well-formedness: 7 families × 3 scales = 21 combos return finite numbers,
  positive SDs, non-empty labels.
- Natural-scale intercept matches the user's baseline on the link scale
  (identity / logit / log).
- Slope is derived correctly from the user's stated effect.
- Centered slope equals natural slope (on every link).
- Standardized rescaling matches the documented formula on both identity
  and non-identity links.
- Zero-effect edge case returns slope = 0 with a positive fallback SD.

Run with:

```bash
npm test
```

---

## Known gaps / future work

- The wizard's elicitation flow works best with **continuous predictors**.
  Binary/categorical predictors produce valid priors but the wording
  doesn't yet walk through group-difference framing in detail.
- Only the *direct* treatment slope is derived from user reasoning;
  additional adjustment-set predictors inherit the same slope prior
  only when the user chose the standardized scale.
