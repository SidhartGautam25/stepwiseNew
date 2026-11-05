# ADR 0004: Three-Level Adaptive Content Model

## Status
Accepted

## Context
Learners have varying degrees of systems programming background. Providing a single explanation either bores senior engineers with elementary syntax or overwhelms beginners with dense protocol nuances.

## Decision
1. In Handrail, every step's `task`, `theory`, and `hints` are authored in three explicit depth levels:
   - `beginner`: Detailed guidance, conceptual breakdowns, step-by-step structural suggestions.
   - `intermediate`: Standard professional briefing, protocol references, idiomatic hints.
   - `expert`: Terse, direct requirements, exact specification RFC links, zero hand-holding.
2. Content storage in `catalog_service` normalizes content into `step_content` rows keyed by `(step_id, kind, level)`.
3. The content linter strictly enforces that every step has valid MDX for all three levels across task and theory.
4. The web application prefetches all three variants for the active step, allowing instant client-side level switching without network delay or layout flicker.

## Consequences
- Content authoring requires slightly higher initial effort, but provides a superior personalized learning experience.
- The web UI state is driven by a lightweight Zustand store.

