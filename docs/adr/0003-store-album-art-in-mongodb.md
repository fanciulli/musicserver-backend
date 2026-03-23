# ADR 0003: Store Album Art in MongoDB

## Status

Accepted

## Date

2026-03-23

## Context

The current implementation stores album art binary data directly in MongoDB.

This is not considered the optimal long-term solution from a storage and
serving perspective, but it allows the project to avoid introducing an
additional architectural component (for example, a dedicated object storage
layer) during early delivery phases.

To reduce the impact on query performance and payload size, search and listing
flows use field projections so that album art data is excluded from search
result payloads unless explicitly needed.

## Decision

Album art will be stored in MongoDB for the initial MVP phase.

The team accepts this trade-off to keep the architecture simpler and reduce
operational complexity while the product is still gathering initial adoption
feedback.

## Consequences

- Architecture remains simpler in the short term, with fewer moving parts.
- Database size and backup/restore costs can grow faster due to binary assets.
- Read and search paths are partially protected by projections that exclude
  album art data from non-essential queries.

## Follow-up

- Collect feedback and performance metrics from initial MVPs.
- Re-evaluate this decision once usage and data volume patterns are clearer.
- Consider a dedicated media storage strategy if MongoDB storage or transfer
  overhead becomes significant.
