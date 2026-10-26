import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Vite bundles all route modules at build time — @/ aliases resolved, no filesystem scan needed
const routeModules = import.meta.glob<Record<string, any>>(
  '../src/app/api/**/route.js',
  { eager: true }
);

function globKeyToHonoPath(key: string): string {
  const rel = key.replace('../src/app/api', '').replace('/route.js', '');
  if (!rel) return '/';
  return '/' + rel.split('/').filter(Boolean).map((part) => {
    const spread = part.match(/^\[\.\.\.([^\]]+)\]$/);
    if (spread) return `:${spread[1]}{.+}`;
    const param = part.match(/^\[([^\]]+)\]$/);
    if (param) return `:${param[1]}`;
    return part;
  }).join('/');
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

// Longer paths first — specific routes registered before catch-alls
const sorted = Object.entries(routeModules).sort(([a], [b]) => b.length - a.length);

for (const [key, mod] of sorted) {
  const path = globKeyToHonoPath(key);
  for (const method of METHODS) {
    if (!mod[method]) continue;
    const handler: Handler = async (c) => mod[method](c.req.raw, { params: c.req.param() });
    switch (method) {
      case 'GET': api.get(path, handler); break;
      case 'POST': api.post(path, handler); break;
      case 'PUT': api.put(path, handler); break;
      case 'DELETE': api.delete(path, handler); break;
      case 'PATCH': api.patch(path, handler); break;
    }
  }
}

export { api, API_BASENAME };
