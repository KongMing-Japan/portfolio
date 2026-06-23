import { openDB } from 'idb';
import type { PortfolioSnapshot } from '../types';

const DB_NAME = 'portfolio-generator';
const STORE_NAME = 'portfolio';
const SNAPSHOT_KEY = 'latest';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
});

export async function saveSnapshot(snapshot: PortfolioSnapshot) {
  const db = await dbPromise;
  await db.put(STORE_NAME, snapshot, SNAPSHOT_KEY);
}

export async function loadSnapshot() {
  const db = await dbPromise;
  return (await db.get(STORE_NAME, SNAPSHOT_KEY)) as
    | PortfolioSnapshot
    | undefined;
}

export async function clearSnapshot() {
  const db = await dbPromise;
  await db.delete(STORE_NAME, SNAPSHOT_KEY);
}
