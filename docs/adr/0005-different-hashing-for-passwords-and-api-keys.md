# ADR 0005: Different Hashing Mechanisms for Passwords and API Keys

## Status

Accepted

## Date

2026-06-07

## Context

The system stores two kinds of secrets that require hashing before persistence:

- **Passwords** — user-supplied, low-entropy strings that attackers can guess or
  brute-force if a database is compromised.
- **API keys** — machine-generated tokens of the form `ms_<32 random bytes hex>`,
  produced by `generateApiKey()` in `src/utils/apiKeyUtils.ts`.

Passwords are hashed with **scrypt** (N=16384, r=8, p=1, key length 64 bytes),
a memory-hard KDF designed to make brute-force attacks expensive even when the
hash database is stolen.

API keys are hashed with **SHA-256** (non-salted, single-pass), stored via
`hashApiKey()` in the same file.

Using the same slow KDF for both would be consistent but is not necessary for
API keys, because their entropy is already high: a 32-byte random value has 256
bits of entropy, making exhaustive search infeasible regardless of the hash
speed.

Additionally, the team plans to allow users to configure the complexity (length,
character set, or prefix format) of generated API keys in a future iteration.
Tying key storage to a KDF now would constrain that design work before the
requirements are clear.

## Decision

Keep hashing mechanisms separate:

- Passwords use **scrypt** with configurable parameters encoded in the stored
  string (`scrypt:N:r:p:salt:hash`), enabling future parameter upgrades without
  migration.
- API keys use **SHA-256** (no salt required given the key entropy), enabling
  fast lookup and straightforward equality checks.

Implementation of a more sophisticated API-key hashing or validation strategy is
explicitly deferred until the API key complexity feature is designed.

## Consequences

- Password storage is resistant to brute-force attacks on a compromised database.
- API key lookups are fast (no KDF overhead per request).
- The codebase has two distinct hashing utilities (`hashPassword` /
  `verifyPassword` in `src/utils/sessionAuthUtils.ts` and `hashApiKey` in
  `src/utils/apiKeyUtils.ts`), which must be used consistently and not
  interchanged.
- When the API key complexity feature is implemented, the team must revisit
  whether SHA-256 remains appropriate or whether a KDF or HMAC with a server-side
  secret should be introduced.

## Follow-up

- Design and implement the user-configurable API key complexity feature.
- Reassess API key hashing strategy as part of that design.
- Update or supersede this ADR once the API key complexity feature is shipped.