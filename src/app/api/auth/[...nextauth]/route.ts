/**
 * Auth.js callback endpoints (SRS 18.2).
 *
 * The only route in the application that is deliberately public: sign-in,
 * sign-out and session endpoints must be reachable without a session
 * (SRS 8.1). Everything Auth.js needs is behind this catch-all.
 */
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
