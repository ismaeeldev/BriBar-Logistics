/**
 * Password hashing (SRS 22.1: "Passwords stored only as secure hashes").
 *
 * Argon2id, which is the current OWASP recommendation and the winner of the
 * Password Hashing Competition. The choice over bcrypt matters here: bcrypt's
 * work factor is CPU-only, so a GPU cracks it far faster than it cracks
 * Argon2id at equivalent cost. Argon2id is deliberately memory-hard, which is
 * what removes that advantage.
 *
 * Parameters follow OWASP's second recommended configuration - m=19456 KiB,
 * t=2, p=1 - which targets roughly 50 ms per hash on server hardware. That is
 * slow enough to make offline cracking expensive and fast enough that a login
 * on a serverless instance does not approach the platform's request timeout.
 *
 * The parameters are embedded in the PHC string that `hash` returns, so
 * raising them later does not invalidate existing hashes: `verify` reads each
 * hash's own settings, and `needsRehash` reports which ones are behind.
 */
import { hash, parseOptions, verify, type Options } from '@node-rs/argon2';

/**
 * `Algorithm.Argon2id`.
 *
 * @node-rs/argon2 declares `Algorithm` as an ambient `const enum`, which
 * `isolatedModules` cannot import - each file is transpiled alone, so there is
 * no whole-program view in which to inline the member. The literal is the
 * documented value and is asserted against `parseOptions` in the unit suite.
 */
const ARGON2ID: NonNullable<Options['algorithm']> = 2;

/**
 * Shared by the seed script and the credentials provider so a password set at
 * bootstrap verifies identically to one set through the admin panel.
 */
export const ARGON2_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // KiB
  timeCost: 2, // iterations
  parallelism: 1, // lanes
};

/** Hashes a plaintext password. The result is a self-describing PHC string. */
export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Checks a password against a stored hash.
 *
 * Never throws. A malformed or truncated hash - a half-written migration, a
 * column edited by hand - is a failed verification, not a 500 that tells an
 * attacker they found an account in an unusual state (SRS 22.1).
 *
 * `verify` is constant-time with respect to the password, so this does not
 * leak how much of a guess was correct.
 */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Whether a stored hash was produced with weaker parameters than the current
 * policy.
 *
 * The natural place to act on this is straight after a successful login, which
 * is the only moment the plaintext is available to rehash with. V1 has no such
 * upgrade step; this exists so that raising the cost parameters later is a
 * contained change rather than a forced password reset for everyone.
 */
export function needsRehash(storedHash: string): boolean {
  try {
    const current = parseOptions(storedHash);

    return (
      current.algorithm !== ARGON2_OPTIONS.algorithm ||
      current.memoryCost < ARGON2_OPTIONS.memoryCost! ||
      current.timeCost < ARGON2_OPTIONS.timeCost! ||
      current.parallelism !== ARGON2_OPTIONS.parallelism
    );
  } catch {
    // Unparseable means it was not produced by this policy, so it qualifies.
    return true;
  }
}
