import { DurableObjectNamespace, D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  ROOM_COORDINATOR: DurableObjectNamespace;
  ADMIN_PASSWORD?: string;
  PUBLIC_URL?: string;
}

export interface AppVariables {
  requestId: string;
}
