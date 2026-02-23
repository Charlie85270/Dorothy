// Plugin database for Claude Code plugins marketplace
// Supports multiple data sources with per-source localStorage caching

import { useState, useEffect, useRef } from 'react';

// ── Public types ──

export interface Plugin {
  name: string;
  description: string;
  category: string;
  marketplace: string;
  author?: string;
  tags?: string[];
  homepage?: string;
  binaryRequired?: string;
  installCommand?: string;
}

export interface Marketplace {
  id: string;
  name: string;
  description: string;
  source: string;
}

export type PluginCategory = string;

// ── Remote schema ──

interface RemotePlugin {
  id: string;
  name: string;
  description: string;
  source: string;
  marketplace: string;
  marketplaceUrl: string;
  category: string;
  installCommand: string;
  version?: string;
  author?: { name: string; email?: string };
  tags?: string[];
}

// ── Data source abstraction ──

interface PluginSource {
  /** Unique key — used as localStorage cache key suffix */
  id: string;
  /** Human-readable label */
  name: string;
  /** Fetches raw plugin data from the source */
  fetch: () => Promise<RemotePlugin[]>;
  /** Cache TTL in ms (default: DEFAULT_TTL) */
  ttl?: number;
}

const DEFAULT_TTL = 86_400_000; // 24 hours
const CACHE_PREFIX = 'dorothy-plugins-src-';

// ── Source registry ──
// Add new sources here. Each is fetched, cached, and merged independently.

const SOURCES: PluginSource[] = [
  {
    id: 'claudemarketplaces',
    name: 'Claude Marketplaces',
    fetch: async () => {
      const res = await fetch(
        'https://raw.githubusercontent.com/mertbuilds/claudemarketplaces.com/refs/heads/main/lib/data/plugins.json',
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  },
];

// ── Plugin filters ──
// Add predicates here to exclude plugins from the final list.
// A plugin is kept only if ALL filters return true.

type PluginFilter = (plugin: Plugin) => boolean;

const FILTERS: PluginFilter[] = [];

// ── Per-source localStorage cache ──

interface CacheEntry {
  timestamp: number;
  data: RemotePlugin[];
}

function readCache(sourceId: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + sourceId);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(sourceId: string, data: RemotePlugin[]): void {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data };
    localStorage.setItem(CACHE_PREFIX + sourceId, JSON.stringify(entry));
  } catch {
    // Quota exceeded or other storage error — ignore
  }
}

function isFresh(entry: CacheEntry, ttl: number): boolean {
  return Date.now() - entry.timestamp < ttl;
}

// ── Mapping & derivation ──

function mapRemotePlugin(remote: RemotePlugin): Plugin {
  return {
    name: remote.name,
    description: remote.description || '',
    category: remote.category || 'community',
    marketplace: remote.marketplace,
    author: remote.author?.name,
    tags: remote.tags,
    homepage: remote.marketplaceUrl,
    installCommand: remote.installCommand,
  };
}

function deriveCategories(plugins: Plugin[]): string[] {
  const categories = new Set<string>();
  for (const p of plugins) {
    // Only expose categories that start with a capital letter
    if (p.category && /^[A-Z]/.test(p.category)) categories.add(p.category);
  }
  return Array.from(categories).sort();
}

function deriveAuthors(plugins: Plugin[]): string[] {
  const authors = new Set<string>();
  for (const p of plugins) {
    if (p.author) authors.add(p.author);
  }
  return Array.from(authors).sort();
}

/** Marketplaces exposed in the source dropdown. */
const ALLOWED_MARKETPLACES = new Set(['anthropics-claude-code']);

function deriveMarketplaces(plugins: Plugin[]): Marketplace[] {
  const seen = new Map<string, Marketplace>();
  for (const p of plugins) {
    if (!seen.has(p.marketplace) && ALLOWED_MARKETPLACES.has(p.marketplace)) {
      seen.set(p.marketplace, {
        id: p.marketplace,
        name: p.marketplace,
        description: `Plugins from ${p.marketplace}`,
        source: p.homepage || p.marketplace,
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Fetch a single source (cache-first) ──

async function fetchSource(source: PluginSource): Promise<RemotePlugin[]> {
  const ttl = source.ttl ?? DEFAULT_TTL;
  const cached = readCache(source.id);

  // Fresh cache → return immediately
  if (cached && isFresh(cached, ttl)) {
    return cached.data;
  }

  // Fetch from remote
  try {
    const data = await source.fetch();
    writeCache(source.id, data);
    return data;
  } catch {
    // Fetch failed — fall back to stale cache if available
    if (cached) return cached.data;
    return [];
  }
}

// ── Aggregate all sources ──

let cachedPlugins: Plugin[] | null = null;
let cachedCategories: string[] | null = null;
let cachedMarketplaces: Marketplace[] | null = null;
let cachedAuthors: string[] | null = null;
let fetchPromise: Promise<Plugin[]> | null = null;

async function fetchPlugins(): Promise<Plugin[]> {
  if (cachedPlugins) return cachedPlugins;
  if (fetchPromise) return fetchPromise;

  fetchPromise = Promise.allSettled(SOURCES.map(fetchSource))
    .then((results) => {
      const allRemote: RemotePlugin[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allRemote.push(...result.value);
        }
      }

      // Deduplicate by name@marketplace
      const seen = new Set<string>();
      const unique: RemotePlugin[] = [];
      for (const p of allRemote) {
        const key = `${p.name}@${p.marketplace}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(p);
        }
      }

      cachedPlugins = unique.map(mapRemotePlugin).filter(
        (p) => FILTERS.every((fn) => fn(p)),
      );
      cachedCategories = deriveCategories(cachedPlugins);
      cachedMarketplaces = deriveMarketplaces(cachedPlugins);
      cachedAuthors = deriveAuthors(cachedPlugins);
      fetchPromise = null;
      return cachedPlugins;
    })
    .catch((err) => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
}

// ── React hook ──

export function usePluginsDatabase() {
  const [plugins, setPlugins] = useState<Plugin[]>(cachedPlugins || []);
  const [categories, setCategories] = useState<string[]>(cachedCategories || []);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>(cachedMarketplaces || []);
  const [authors, setAuthors] = useState<string[]>(cachedAuthors || []);
  const [loading, setLoading] = useState(!cachedPlugins);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (cachedPlugins) return;

    fetchPlugins()
      .then((data) => {
        if (!mounted.current) return;
        setPlugins(data);
        setCategories(cachedCategories!);
        setMarketplaces(cachedMarketplaces!);
        setAuthors(cachedAuthors!);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted.current) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch plugins');
        setLoading(false);
      });

    return () => {
      mounted.current = false;
    };
  }, []);

  return { plugins, categories, marketplaces, authors, loading, error };
}
