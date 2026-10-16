import { openDB } from 'idb';
import type {
  Holding,
  Layer,
  PortfolioSnapshot,
  ReviewSnapshot,
  SnapshotDiffItem,
  SnapshotDiffResult,
} from '../types';
import { sanitizeCurrencyCode } from './portfolio';

const DB_NAME = 'portfolio-generator';
const STORE_NAME = 'portfolio';
const SNAPSHOT_KEY = 'latest';
const OWNER_SNAPSHOT_KEY = 'owner_vault_v1';
const STORE_REVIEW_SNAPSHOTS = 'review_snapshots';
const OWNER_PIN_STORAGE_KEY = 'portfolio-owner-pin-v1';
const OWNER_SESSION_KEY = 'portfolio-owner-unlocked-session';
export const DEFAULT_OWNER_PIN = '8888';

let dbInstance: Promise<any> | null = null;

function getDb() {
  if (!dbInstance) {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }
    dbInstance = openDB(DB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(STORE_REVIEW_SNAPSHOTS)) {
          db.createObjectStore(STORE_REVIEW_SNAPSHOTS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbInstance;
}

export function isCorruptedHolding(holding: unknown): boolean {
  if (!holding || typeof holding !== 'object') return true;
  const h = holding as Record<string, unknown>;
  const ticker = String(h.ticker ?? '').trim();
  const name = String(h.name ?? '').trim();
  const currency = String(h.currency ?? '').trim();
  const combined = `${ticker} ${name} ${currency}`;

  if (ticker.length > 50 || name.length > 80 || currency.length > 20) return true;
  if (
    /全部补齐后|按币种|日元部分|美元部分|港币部分|人民币部分|折合约|账户小计|账户合计|总资产折合|折算统一采用|即约|以下按账户/i.test(
      combined,
    )
  ) {
    return true;
  }
  return false;
}

export function sanitizeLoadedSnapshot(
  snapshot: PortfolioSnapshot | undefined,
): PortfolioSnapshot | undefined {
  if (!snapshot || !Array.isArray(snapshot.holdings)) return snapshot;

  const sanitizedHoldings = snapshot.holdings
    .filter((h) => !isCorruptedHolding(h))
    .map((h) => ({
      ...h,
      currency: sanitizeCurrencyCode(h.currency),
    }));

  return {
    ...snapshot,
    holdings: sanitizedHoldings,
  };
}

export async function saveSnapshot(snapshot: PortfolioSnapshot) {
  const db = await getDb();
  await db.put(STORE_NAME, snapshot, SNAPSHOT_KEY);
}

export async function loadSnapshot() {
  const db = await getDb();
  const raw = (await db.get(STORE_NAME, SNAPSHOT_KEY)) as
    | PortfolioSnapshot
    | undefined;
  return sanitizeLoadedSnapshot(raw);
}

export async function clearSnapshot() {
  const db = await getDb();
  await db.delete(STORE_NAME, SNAPSHOT_KEY);
}

export async function saveOwnerSnapshot(snapshot: PortfolioSnapshot) {
  const db = await getDb();
  await db.put(STORE_NAME, snapshot, OWNER_SNAPSHOT_KEY);
}

export async function loadOwnerSnapshot() {
  const db = await getDb();
  const raw = (await db.get(STORE_NAME, OWNER_SNAPSHOT_KEY)) as
    | PortfolioSnapshot
    | undefined;
  return sanitizeLoadedSnapshot(raw);
}

export async function clearOwnerSnapshot() {
  const db = await getDb();
  await db.delete(STORE_NAME, OWNER_SNAPSHOT_KEY);
}

export function getOwnerPin(): string {
  try {
    const saved = localStorage.getItem(OWNER_PIN_STORAGE_KEY);
    if (saved && /^\d{4}$/.test(saved)) return saved;
  } catch {}
  return DEFAULT_OWNER_PIN;
}

export function setOwnerPin(newPin: string): boolean {
  if (!/^\d{4}$/.test(newPin)) return false;
  try {
    localStorage.setItem(OWNER_PIN_STORAGE_KEY, newPin);
    return true;
  } catch {
    return false;
  }
}

export function verifyOwnerPin(inputPin: string): boolean {
  return inputPin === getOwnerPin();
}

export function isOwnerSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(OWNER_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOwnerSessionUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(OWNER_SESSION_KEY, '1');
    } else {
      sessionStorage.removeItem(OWNER_SESSION_KEY);
    }
  } catch {}
}

export async function saveReviewSnapshot(reviewSnapshot: ReviewSnapshot) {
  const db = await getDb();
  await db.put(STORE_REVIEW_SNAPSHOTS, reviewSnapshot);
}

export async function loadReviewSnapshots(): Promise<ReviewSnapshot[]> {
  const db = await getDb();
  const list = (await db.getAll(STORE_REVIEW_SNAPSHOTS)) as ReviewSnapshot[];
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function deleteReviewSnapshot(id: string) {
  const db = await getDb();
  await db.delete(STORE_REVIEW_SNAPSHOTS, id);
}

export function calculateSnapshotDiff(
  beforeHoldings: Holding[],
  afterHoldings: Holding[],
  totalBefore: number,
  totalAfter: number,
): SnapshotDiffResult {
  const totalDelta = totalAfter - totalBefore;
  const totalDeltaPercent =
    totalBefore > 0 ? (totalAfter - totalBefore) / totalBefore : 0;

  const layerKeys: Layer[] = ['Core', 'Satellite', 'Defensive', 'Cash'];
  const layerDiffs: Record<Layer, { before: number; after: number; delta: number }> = {
    Core: { before: 0, after: 0, delta: 0 },
    Satellite: { before: 0, after: 0, delta: 0 },
    Defensive: { before: 0, after: 0, delta: 0 },
    Cash: { before: 0, after: 0, delta: 0 },
  };

  const beforeMap = new Map<string, { holding: Holding; baseVal: number }>();
  for (const h of beforeHoldings) {
    const val = h.valueInBase ?? 0;
    const cur = beforeMap.get(h.ticker) ?? { holding: h, baseVal: 0 };
    cur.baseVal += val;
    beforeMap.set(h.ticker, cur);
    if (layerDiffs[h.layer]) {
      layerDiffs[h.layer].before += val;
    }
  }

  const afterMap = new Map<string, { holding: Holding; baseVal: number }>();
  for (const h of afterHoldings) {
    const val = h.valueInBase ?? 0;
    const cur = afterMap.get(h.ticker) ?? { holding: h, baseVal: 0 };
    cur.baseVal += val;
    afterMap.set(h.ticker, cur);
    if (layerDiffs[h.layer]) {
      layerDiffs[h.layer].after += val;
    }
  }

  for (const l of layerKeys) {
    const bWeight = totalBefore > 0 ? layerDiffs[l].before / totalBefore : 0;
    const aWeight = totalAfter > 0 ? layerDiffs[l].after / totalAfter : 0;
    layerDiffs[l].before = bWeight;
    layerDiffs[l].after = aWeight;
    layerDiffs[l].delta = aWeight - bWeight;
  }

  const allTickers = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const items: SnapshotDiffItem[] = [];

  for (const ticker of allTickers) {
    const b = beforeMap.get(ticker);
    const a = afterMap.get(ticker);

    const name = a?.holding.name || b?.holding.name || ticker;
    const layer = (a?.holding.layer || b?.holding.layer || 'Core') as Layer;

    const sharesBefore = b?.holding.quantity ?? 0;
    const sharesAfter = a?.holding.quantity ?? 0;
    const valueBefore = b?.baseVal ?? 0;
    const valueAfter = a?.baseVal ?? 0;

    const weightBefore = totalBefore > 0 ? valueBefore / totalBefore : 0;
    const weightAfter = totalAfter > 0 ? valueAfter / totalAfter : 0;

    items.push({
      ticker,
      name,
      layer,
      sharesBefore,
      sharesAfter,
      sharesDelta: sharesAfter - sharesBefore,
      valueBefore,
      valueAfter,
      valueDelta: valueAfter - valueBefore,
      weightBefore,
      weightAfter,
      weightDelta: weightAfter - weightBefore,
    });
  }

  return {
    totalBefore,
    totalAfter,
    totalDelta,
    totalDeltaPercent,
    layerDiffs,
    items: items.sort((x, y) => Math.abs(y.valueDelta) - Math.abs(x.valueDelta)),
  };
}
