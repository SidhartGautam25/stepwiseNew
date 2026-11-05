# ADR 0006: Frontend Hook-Based Architecture and Reusable Design System

## Status
Accepted

## Context
Milestone 2 introduces the learning UI and workshop navigation. The user requires a strict separation of concerns:
1. Components must NOT contain business, fetching, or mutation logic.
2. Logic must be encapsulated in purpose-built custom React hooks.
3. Configuration, query keys, API routes, and design tokens must be centralized.
4. A modular, reusable design system (atomic UI components: buttons, badges, cards, tabs, modal, rails, level switcher) must be employed.

## Decision
1. **Directory Structure**:
   - `src/config/`: Centralized site metadata, API routes, query keys, and level definitions.
   - `src/components/ui/`: Dumb presentational atoms (`Button`, `Badge`, `Card`, `Tabs`, `Skeleton`, `Dropdown`).
   - `src/components/common/`: Shared layout pieces (`Navbar`, `Footer`, `SidebarRail`, `LevelSwitcher`).
   - `src/components/workshop/`: Composed view components receiving configuration and handlers.
   - `src/hooks/`: Headless business hooks (`useWorkshops`, `useWorkshopOverview`, `useStepDetail`, `useLevelPreference`, `useAuthAction`).
2. **State & Caching Strategy**:
   - Server State: TanStack Query with deterministic query keys defined in `src/config/query-keys.ts`.
   - Client Preferences: Zustand persisted store with hooks (`useLevelPreference`) providing live switching across `beginner`, `intermediate`, and `expert`.
   - Step Prefetching: React Query pre-caches all 3 level variants when a step loads, ensuring zero-latency depth switching.

## Consequences
- Clean separation between presentation and data fetching.
- High component reusability and testability.
- Easily themes and standardizes button styles, accessibility, and loading states.

