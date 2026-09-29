/**
 * Data layer with two interchangeable backends:
 *  - Prisma (PostgreSQL) when DATABASE_URL is set — the production path (§35/§86).
 *  - JSON file store at .data/taxos.json for zero-dependency local development.
 * The repository surface is intentionally small and typed; API routes use it exclusively,
 * so swapping storage never leaks into business logic.
 */
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

const DATA_DIR = process.env.LOCAL_DATA_DIR ?? '.data';
const DATA_FILE = `${DATA_DIR}/taxos.json`;

export interface Row { id: string; [k: string]: unknown; }
type Table = Row[];
interface StoreShape { [table: string]: Table }

let cache: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<StoreShape> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')) as StoreShape;
  } catch {
    cache = {};
  }
  return cache!;
}

async function persist() {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache, null, 2));
    await fs.rename(tmp, DATA_FILE); // atomic-ish replace
  });
  return writeChain;
}

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'in' in (v as object)) {
      return (v as { in: unknown[] }).in.includes(row[k] as unknown);
    }
    return row[k] === v;
  });
}

export interface Repo {
  findMany(table: string, where?: Record<string, unknown>): Promise<Row[]>;
  findOne(table: string, where: Record<string, unknown>): Promise<Row | null>;
  insert(table: string, data: Omit<Row, 'id'> & { id?: string }): Promise<Row>;
  update(table: string, id: string, patch: Partial<Row>): Promise<Row | null>;
  remove(table: string, where: Record<string, unknown>): Promise<number>;
}

/* ------------------------- Prisma-backed repo ------------------------- */
function prismaRepo(client: any): Repo {
  const modelOf = (table: string) => {
    const m = client[table];
    if (!m) throw new Error(`Unknown model ${table}`);
    return m;
  };
  const encode = (row: Row): Row => {
    const out: Row = { ...row };
    for (const k of Object.keys(out)) if (typeof out[k] === 'number' && !Number.isInteger(out[k])) out[k] = out[k];
    return out;
  };
  const decode = (r: any): Row => {
    if (!r) return r;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[k] = typeof v === 'bigint' ? Number(v) : v instanceof Date ? v.toISOString() : v;
    return out as Row;
  };
  return {
    async findMany(table, where = {}) { return (await modelOf(table).findMany({ where })).map(decode); },
    async findOne(table, where) { return decode(await modelOf(table).findFirst({ where })); },
    async insert(table, data) { const id = data.id ?? `cuid_${randomUUID().replace(/-/g, '').slice(0, 24)}`; return decode(await modelOf(table).create({ data: { ...encode(data), id } })); },
    async update(table, id, patch) { return decode(await modelOf(table).update({ where: { id }, data: encode(patch as Row) })); },
    async remove(table, where) { return (await modelOf(table).deleteMany({ where })).count; },
  };
}

/* ------------------------- File-backed repo --------------------------- */
function fileRepo(): Repo {
  return {
    async findMany(table, where = {}) {
      const s = await load();
      return (s[table] ?? []).filter(r => matches(r, where));
    },
    async findOne(table, where) {
      const s = await load();
      return (s[table] ?? []).find(r => matches(r, where)) ?? null;
    },
    async insert(table, data) {
      const s = await load();
      const row: Row = { id: data.id ?? randomUUID(), ...data, createdAt: (data.createdAt as string) ?? new Date().toISOString() };
      (s[table] ??= []).push(row);
      await persist();
      return row;
    },
    async update(table, id, patch) {
      const s = await load();
      const arr = s[table] ?? [];
      const idx = arr.findIndex(r => r.id === id);
      if (idx < 0) return null;
      arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
      await persist();
      return arr[idx];
    },
    async remove(table, where) {
      const s = await load();
      const before = (s[table] ?? []).length;
      s[table] = (s[table] ?? []).filter(r => !matches(r, where));
      await persist();
      return before - s[table].length;
    },
  };
}

let _repo: Repo | null = null;
export async function getRepo(): Promise<Repo> {
  if (_repo) return _repo;
  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import('@prisma/client');
    _repo = prismaRepo(new PrismaClient());
  } else {
    _repo = fileRepo();
  }
  return _repo;
}

/** For tests / dev reset. */
export function __resetRepoCache() { _repo = null; cache = null; }
