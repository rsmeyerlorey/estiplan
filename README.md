# Estiplan

An interactive causal DAG workflow tool that helps scientists turn whiteboard sketches of causal models into formal statistical coding plans.

Inspired by Richard McElreath's [Statistical Rethinking](https://github.com/rmcelreath/stat_rethinking_2026) course (2026), Estiplan fills a gap McElreath identified: existing pipeline tools handle computation chains, but nothing combines **scientific justifications** with **workflow visualization** and **attached code** at each step.

## What it does

1. **Build a causal DAG** -- add variables (continuous, binary, ordinal, count, etc.), draw causal arrows, and let auto-layout keep things tidy.

2. **Declare estimands** -- specify what causal effect you want to estimate (total or direct), and Estiplan generates the do-calculus notation and plain-English description.

3. **Get a statistical model** -- Estiplan runs the backdoor criterion via a full d-separation engine, identifies the correct adjustment set (with per-variable reasons), warns about bad controls (colliders, post-treatment bias, mediators), and generates both the math notation and copy-pasteable `brms` R code.

## Features

- Full d-separation engine (fork, pipe, collider, descendant rules)
- Backdoor criterion with automatic adjustment sets
- Bad control detection and Table Two Fallacy warnings
- `brms` code generation for all common outcome types (Gaussian, Bernoulli, Poisson, Beta, ordinal, lognormal)
- Default prior specification with educational tooltips (editable per parameter)
- Interaction toggle for treatment effects
- Undo/redo, save/load (.estiplan.json files), auto-persistence
- Whiteboard and chalkboard themes
- Bidirectional estimand declaration (forward and reverse)
- Test suite with 10 reference DAGs covering common causal structures

## Tech stack

React 19 + TypeScript, Vite, [React Flow](https://reactflow.dev/), Zustand, dagre

## Getting started

```bash
npm install
npm run dev        # dev server on localhost:5173
npx vite build     # production build
```

## Status

Active development, following McElreath's 2026 lecture series. Core DAG-to-model pipeline is complete through Lecture A07, with prior specification added. See [ROADMAP.md](ROADMAP.md) for planned features and [CLAUDE.md](CLAUDE.md) for detailed architecture notes.

## License

MIT
