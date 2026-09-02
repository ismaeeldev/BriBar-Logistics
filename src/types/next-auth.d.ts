/**
 * Session and token typing.
 *
 * Auth.js ships a permissive default shape — `user` has an optional name, email
 * and image and nothing else. Every authorisation decision in this application
 * turns on `id` and `role`, so without this augmentation each one would need a
 * cast, and a typo in a role comparison would compile.
 */
import type { DefaultSession } from 'next-auth';

import type { Role } from '@/modules/services/domain/service-status';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  /** What the credentials provider's `authorize` returns. */
  interface User {
    id?: string;
    name?: string | null;
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** The user id. Auth.js populates `sub` from the returned user. */
    sub?: string;
    role?: Role;
  }
}
