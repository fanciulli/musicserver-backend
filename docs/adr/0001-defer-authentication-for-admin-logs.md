# ADR 0001: Defer Authentication for All API Endpoints

## Status

Accepted

## Date

2026-03-21

## Context

The service currently exposes multiple API endpoints for browsing, streaming,
scanning, plugin management, health checks, and log access.

At this stage, implementation work is focused on core functionality and
operational behavior.

At this stage of the project, introducing authentication and authorization is not considered a priority by the team. The functionality is intentionally left unauthenticated for now, with the understanding that access control will be introduced in a future iteration.

## Decision

Authentication and authorization are explicitly deferred for all currently
exposed API endpoints.

The team accepts this temporary trade-off to move forward with logging improvements, while tracking the decision in this ADR for visibility and future follow-up.

## Consequences

- The endpoint remains easier to use for local diagnostics and short-term operations.
- There is a known security exposure if the service is reachable by untrusted clients.
- Future work must add authentication and authorization before the API surface is considered production-ready in untrusted networks.

## Follow-up

- Add authentication middleware for API routes.
- Add authorization policies for privileged operations and resources.
- Update this ADR status or create a superseding ADR once access control is implemented.
