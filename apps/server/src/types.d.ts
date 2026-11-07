import type { AuthContext } from './lib/users.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext | null;
  }
}
