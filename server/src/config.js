import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '../..');

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPath(name, fallback) {
  const raw = process.env[name];
  return raw ? path.resolve(process.cwd(), raw) : fallback;
}

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: readNumber('PORT', 8080),
  wsPath: process.env.WS_PATH || '/ws',
  staticDir: readPath('STATIC_DIR', path.join(rootDir, 'web')),
  maxClients: readNumber('MAX_CLIENTS', 32),
  heartbeatMs: readNumber('HEARTBEAT_MS', 30000),
  logLevel: process.env.LOG_LEVEL || 'info',
};
