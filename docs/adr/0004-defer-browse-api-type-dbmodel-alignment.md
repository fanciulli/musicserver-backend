# ADR 0004: Defer Browse API Type and DB Model Alignment

## Status

Accepted

## Date

2026-05-15

## Context

The current browse API flow returns data assembled from DB model objects in a
way that mixes API response concerns with persistence model concerns.

This creates ambiguity about ownership of response shape and can make future
browse changes harder to reason about, because API contracts and DB model
structures may evolve at different speeds.

For the current PR scope, this is outside the intended change set and should
not be redesigned ad hoc.

## Decision

Leave the current browse implementation unchanged in this PR.

Document the architectural concern and track a follow-up issue to redesign the
browse flow so API response types are clearly separated from DB model types.

## Consequences

- The current behavior remains stable for now.
- The architectural mismatch remains as known technical debt.
- Follow-up work can be planned independently, with explicit scope and review.

## Follow-up

- Create and track a GitHub issue for browse API and DB model type alignment.
- Define migration steps to keep backward-compatible API responses while
  decoupling from DB model return types.
