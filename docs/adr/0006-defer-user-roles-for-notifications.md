# ADR 0006: Defer User Roles for Notification Deletion

## Status

Accepted

## Date

2026-06-13

## Context

The notifications feature lets any authenticated user delete notifications,
including broadcast notifications addressed to all users. The system currently
has no concept of user roles or per-resource authorization: every authenticated
admin user is equivalent.

Adding role-based access control (RBAC) now would be premature while the user
model is a single shared admin account and the feature set is still forming.

## Decision

The `DELETE /admin/notifications/:id` endpoint performs no permission or role
check. Any authenticated user may delete any notification, including
notifications sent to all users.

We accept this temporary trade-off to ship the notifications feature, while
tracking the decision here for visibility and future follow-up.

## Consequences

- The delete endpoint stays simple and unblocked by an authorization model that
  does not yet exist.
- There is no protection against one user removing a broadcast notification that
  is still relevant to others.
- Future work must introduce user roles and revisit authorization on delete (and
  potentially on send) before multi-user, untrusted usage.

## Follow-up

- Introduce a user role model.
- Add authorization policies for notification deletion (e.g. only the recipient
  or an admin role may delete).
- Update this ADR status or create a superseding ADR once RBAC is implemented.
