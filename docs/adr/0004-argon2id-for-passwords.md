# 4. Argon2id rather than bcrypt

**Status:** Accepted

## Context

SRS 22.1 requires that passwords be stored only as secure hashes and 8.1
AUTH-003 that only a one-way hash is persisted. Neither names an algorithm.

bcrypt is the common default in the Node ecosystem and would satisfy a literal
reading. Argon2id is the current OWASP recommendation and the Password Hashing
Competition winner.

## Decision

Argon2id via `@node-rs/argon2`, with OWASP's second recommended configuration:

```
memoryCost  19456 KiB   (19 MiB)
timeCost    2 iterations
parallelism 1 lane
```

## Consequences

bcrypt's work factor is CPU-only, so an attacker with a GPU cracks it far faster
than the defender's cost model assumes. Argon2id is memory-hard: each guess
needs 19 MiB, which removes most of that advantage because GPU memory bandwidth
becomes the constraint rather than raw parallelism. bcrypt also silently
truncates input at 72 bytes, which quietly caps the strength of a long
passphrase.

The parameters target roughly 50 ms per hash on server hardware — slow enough to
make offline cracking expensive, fast enough that a login on a serverless
instance does not approach the platform's request timeout.

`@node-rs/argon2` is a native NAPI binding, so it needs the Node runtime, not
the Edge runtime. This shapes the Auth.js setup in Phase 2: the credentials
provider's `authorize` (which hashes) must run in Node, so the config splits
into an edge-safe `auth.config.ts` for middleware and a Node `auth.ts` for the
provider. That split is the standard Auth.js v5 pattern regardless, so it costs
nothing here. Prebuilt binaries ship for every platform this project targets, so
there is no compile step at install.

Cost parameters are embedded in the PHC string each hash carries, so raising
them later does not invalidate existing hashes: `verify` reads each hash's own
settings. `needsRehash` reports which stored hashes are behind current policy —
the natural place to act on it is immediately after a successful login, the only
moment the plaintext is available. V1 has no such upgrade step; the function
exists so adding one later is contained rather than a forced reset for everyone.

`verifyPassword` never throws. A malformed hash is a failed verification, not a
500 — a 500 would tell an attacker they had found an account in an unusual
state, which SRS 22.1 rules out.
