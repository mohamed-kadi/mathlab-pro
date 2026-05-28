import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import type { NextFunction, Request, Response } from 'express';

export interface CacheStatus {
  provider: 'memory' | 'redis';
  enabled: boolean;
  ttlSeconds: number;
  redisUrl?: string;
}

export interface CalculationCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  status(): CacheStatus;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

class MemoryCalculationCache implements CalculationCache {
  private entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlSeconds: number) {}

  async get<T>(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = this.ttlSeconds) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  status(): CacheStatus {
    return {
      provider: 'memory',
      enabled: true,
      ttlSeconds: this.ttlSeconds
    };
  }
}

class RedisCalculationCache implements CalculationCache {
  private unavailableUntil = 0;

  constructor(
    private readonly redisUrl: string,
    private readonly ttlSeconds: number
  ) {}

  async get<T>(key: string) {
    if (this.isUnavailable()) return null;

    try {
      const responses = await this.execute(['GET', key]);
      const payload = responses.at(-1);
      return typeof payload === 'string' ? JSON.parse(payload) as T : null;
    } catch (error) {
      this.markUnavailable(error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = this.ttlSeconds) {
    if (this.isUnavailable()) return;

    try {
      await this.execute(['SETEX', key, String(Math.max(1, Math.floor(ttlSeconds))), JSON.stringify(value)]);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  status(): CacheStatus {
    return {
      provider: 'redis',
      enabled: !this.isUnavailable(),
      ttlSeconds: this.ttlSeconds,
      redisUrl: redactRedisUrl(this.redisUrl)
    };
  }

  private isUnavailable() {
    return Date.now() < this.unavailableUntil;
  }

  private markUnavailable(error: unknown) {
    this.unavailableUntil = Date.now() + 30_000;
    console.warn('Redis calculation cache unavailable; falling back to cache misses.', error);
  }

  private async execute(command: string[]) {
    const url = new URL(this.redisUrl);
    const commands: string[][] = [];
    if (url.password) {
      commands.push(url.username ? ['AUTH', decodeURIComponent(url.username), decodeURIComponent(url.password)] : ['AUTH', decodeURIComponent(url.password)]);
    }
    const db = url.pathname.replace('/', '');
    if (db) {
      commands.push(['SELECT', db]);
    }
    commands.push(command);
    return executeRedisCommands(url, commands);
  }
}

export function createCalculationCache(): CalculationCache {
  const ttlSeconds = Number(process.env.CALCULATION_CACHE_TTL_SECONDS || 900);
  if (process.env.NODE_ENV !== 'test' && process.env.REDIS_URL) {
    return new RedisCalculationCache(process.env.REDIS_URL, ttlSeconds);
  }
  return new MemoryCalculationCache(ttlSeconds);
}

export function calculationCacheMiddleware(cache: CalculationCache) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' || req.path === '/ai-explain') {
      return next();
    }

    const key = calculationCacheKey(req.originalUrl.split('?')[0], req.body);
    const cached = await cache.get<unknown>(key);
    if (cached !== null) {
      res.setHeader('X-MathLab-Cache', 'HIT');
      res.setHeader('X-MathLab-Cache-Key', key);
      return res.json(cached);
    }

    res.setHeader('X-MathLab-Cache', 'MISS');
    res.setHeader('X-MathLab-Cache-Key', key);
    const originalJson = res.json;
    res.json = function jsonWithCache(body?: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void cache.set(key, body);
      }
      return originalJson.call(this, body);
    };
    return next();
  };
}

function calculationCacheKey(pathname: string, body: unknown) {
  const fingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({ pathname, body: canonicalize(body) }))
    .digest('hex');
  return `mathlab:calc:${fingerprint}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalize((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function encodeRedisCommand(parts: string[]) {
  return `*${parts.length}\r\n${parts.map(part => {
    const bytes = Buffer.byteLength(part);
    return `$${bytes}\r\n${part}\r\n`;
  }).join('')}`;
}

function executeRedisCommands(url: URL, commands: string[][]) {
  return new Promise<unknown[]>((resolve, reject) => {
    if (!['redis:', 'rediss:'].includes(url.protocol)) {
      reject(new Error(`Unsupported Redis protocol: ${url.protocol}`));
      return;
    }

    const port = Number(url.port || 6379);
    const host = url.hostname || '127.0.0.1';
    const socket = url.protocol === 'rediss:'
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });
    const responses: unknown[] = [];
    let buffer = Buffer.alloc(0);
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback();
    };

    socket.setTimeout(750);
    socket.once(url.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => {
      socket.write(commands.map(encodeRedisCommand).join(''));
    });
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        while (responses.length < commands.length) {
          const parsed = parseResp(buffer);
          if (!parsed) return;
          responses.push(parsed.value);
          buffer = buffer.subarray(parsed.nextOffset);
        }
        settle(() => resolve(responses));
      } catch (error) {
        settle(() => reject(error));
      }
    });
    socket.on('timeout', () => settle(() => reject(new Error('Redis command timed out'))));
    socket.on('error', error => settle(() => reject(error)));
  });
}

function parseResp(buffer: Buffer): { value: unknown; nextOffset: number } | null {
  if (buffer.length < 3) return null;

  const type = String.fromCharCode(buffer[0]);
  const lineEnd = buffer.indexOf('\r\n');
  if (lineEnd === -1) return null;
  const line = buffer.toString('utf8', 1, lineEnd);

  if (type === '+') return { value: line, nextOffset: lineEnd + 2 };
  if (type === ':') return { value: Number(line), nextOffset: lineEnd + 2 };
  if (type === '-') throw new Error(`Redis error: ${line}`);
  if (type !== '$') throw new Error(`Unsupported Redis response type: ${type}`);

  const length = Number(line);
  if (length === -1) return { value: null, nextOffset: lineEnd + 2 };

  const valueStart = lineEnd + 2;
  const valueEnd = valueStart + length;
  if (buffer.length < valueEnd + 2) return null;

  return {
    value: buffer.toString('utf8', valueStart, valueEnd),
    nextOffset: valueEnd + 2
  };
}

function redactRedisUrl(redisUrl: string) {
  try {
    const url = new URL(redisUrl);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return 'redis://invalid-url';
  }
}
