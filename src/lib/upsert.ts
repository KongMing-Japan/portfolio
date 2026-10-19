import type { Holding } from '../types';
import { makeId, marketFromTicker, normalizeLayer } from './portfolio';

export interface UpsertDetail {
  id: string;
  ticker: string;
  name: string;
  action: 'updated' | 'added';
  oldQuantity?: number;
  newQuantity: number;
  marketPrice: number | null;
  currency: string;
  broker: string;
}

export interface UpsertResult {
  updatedHoldings: Holding[];
  summary: {
    totalIncoming: number;
    updatedCount: number;
    addedCount: number;
    details: UpsertDetail[];
  };
}

/**
 * Normalizes stock/ETF ticker symbols for flexible cross-exchange matching
 * e.g., '1482.T' -> '1482', '7203' -> '7203', '0700.HK' -> '00700', 'AAPL' -> 'AAPL'
 */
export function normalizeTicker(ticker?: string | null): string {
  if (!ticker) return '';
  const upper = ticker.trim().toUpperCase();
  // Strip common prefix/suffix
  const cleaned = upper
    .replace(/^(TYO|TSE|NASDAQ|NYSE|AMEX|HKG|SHA|SHE):/i, '')
    .replace(/\.(T|TO|SS|SZ|HK|US)$/i, '');

  // Pad Hong Kong digits to 5 digits (e.g. 700 or 0700 -> 00700)
  if (/^\d{1,4}$/.test(cleaned) && upper.includes('.HK')) {
    return cleaned.padStart(5, '0');
  }
  return cleaned;
}

/**
 * Normalizes security names for comparison (strips punctuation, lowercase)
 */
export function normalizeSecurityName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[\s\-_·()（）[\]【】]/g, '')
    .trim();
}

/**
 * Checks whether two holding representations refer to the same underlying security
 */
export function isSameSecurity(
  a: { ticker: string; name?: string; broker?: string },
  b: { ticker: string; name?: string; broker?: string },
): boolean {
  const normA = normalizeTicker(a.ticker);
  const normB = normalizeTicker(b.ticker);

  // Cash comparison
  const aIsCash = normA.startsWith('CASH') || /现金|現金/i.test(a.ticker);
  const bIsCash = normB.startsWith('CASH') || /现金|現金/i.test(b.ticker);
  if (aIsCash || bIsCash) {
    if (aIsCash && bIsCash) {
      // If both are cash, match if currency or broker matches
      const aCur = a.ticker.split('_')[1] || '';
      const bCur = b.ticker.split('_')[1] || '';
      if (aCur && bCur && aCur.toUpperCase() === bCur.toUpperCase()) {
        return true;
      }
    }
    return false;
  }

  // Ticker symbol match
  if (normA && normB && normA === normB) {
    return true;
  }

  // Pure name match if both have meaningful names
  if (a.name && b.name) {
    const cleanA = normalizeSecurityName(a.name);
    const cleanB = normalizeSecurityName(b.name);
    if (cleanA && cleanB && (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA))) {
      // Avoid matching single-character or overly generic names
      if (cleanA.length >= 4 && cleanB.length >= 4) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Upserts incoming positions into the current holdings list:
 * - If a matching ticker/security is found: UPDATES quantity (and price/marketValue if provided).
 * - If no match is found: ADDS as a new holding.
 */
export function upsertHoldings(
  currentHoldings: Holding[],
  incomingPositions: Holding[],
): UpsertResult {
  const result: Holding[] = currentHoldings.map((h) => ({ ...h }));
  const details: UpsertDetail[] = [];
  let updatedCount = 0;
  let addedCount = 0;

  for (const incoming of incomingPositions) {
    if (!incoming.ticker?.trim() && !incoming.name?.trim()) {
      continue;
    }

    // 1. Try to find match with same security AND same broker first
    let matchIndex = -1;
    if (incoming.broker?.trim()) {
      matchIndex = result.findIndex(
        (h) =>
          isSameSecurity(h, incoming) &&
          h.broker.trim().toLowerCase() === incoming.broker.trim().toLowerCase(),
      );
    }

    // 2. If no broker-specific match, match first holding with same security
    if (matchIndex < 0) {
      matchIndex = result.findIndex((h) => isSameSecurity(h, incoming));
    }

    if (matchIndex >= 0) {
      // UPDATE existing holding
      const existing = result[matchIndex];
      const oldQuantity = existing.quantity;
      const newQuantity =
        incoming.quantity != null && incoming.quantity >= 0
          ? incoming.quantity
          : existing.quantity;

      // Update market price if incoming provides a valid price and existing does not have a real-time quote
      const newMarketPrice =
        incoming.marketPrice != null && incoming.marketPrice > 0
          ? incoming.marketPrice
          : existing.marketPrice;

      const newImportedValue =
        incoming.importedMarketValue != null && incoming.importedMarketValue > 0
          ? incoming.importedMarketValue
          : existing.importedMarketValue;

      const updatedHolding: Holding = {
        ...existing,
        quantity: newQuantity,
        marketPrice: newMarketPrice,
        importedMarketValue: newImportedValue,
        marketValue:
          newMarketPrice != null && newQuantity > 0
            ? newMarketPrice * newQuantity
            : newImportedValue ?? existing.marketValue,
        broker: existing.broker || incoming.broker || 'Default',
        needsReview:
          existing.needsReview &&
          Boolean(newMarketPrice == null && !existing.ticker.startsWith('Cash')),
      };

      result[matchIndex] = updatedHolding;
      updatedCount++;

      details.push({
        id: existing.id,
        ticker: existing.ticker,
        name: existing.name,
        action: 'updated',
        oldQuantity,
        newQuantity,
        marketPrice: newMarketPrice,
        currency: existing.currency,
        broker: updatedHolding.broker,
      });
    } else {
      // ADD as new holding
      const ticker = incoming.ticker?.trim() || incoming.name?.trim() || 'UNKNOWN';
      const name = incoming.name?.trim() || ticker;
      const currency = incoming.currency?.trim().toUpperCase() || 'JPY';
      const quantity = Math.max(0, incoming.quantity ?? 0);
      const marketPrice = incoming.marketPrice ?? incoming.costPerUnit ?? null;
      const marketValue =
        incoming.marketValue ??
        (marketPrice != null && quantity > 0 ? marketPrice * quantity : null);

      const newHolding: Holding = {
        ...incoming,
        id: incoming.id || makeId(),
        ticker,
        name,
        currency,
        quantity,
        marketPrice,
        marketValue,
        importedMarketValue: incoming.importedMarketValue ?? marketValue,
        market: incoming.market || marketFromTicker(ticker, name),
        layer: normalizeLayer(incoming.layer, ticker, name, incoming.theme),
        theme: incoming.theme?.trim() || 'Uncategorized',
        broker: incoming.broker?.trim() || 'Imported',
        account: incoming.account?.trim() || '',
        needsReview: marketPrice == null && !ticker.startsWith('Cash'),
        reviewReasons:
          marketPrice == null && !ticker.startsWith('Cash')
            ? ['Latest quote unavailable']
            : [],
      };

      result.push(newHolding);
      addedCount++;

      details.push({
        id: newHolding.id,
        ticker: newHolding.ticker,
        name: newHolding.name,
        action: 'added',
        newQuantity: quantity,
        marketPrice,
        currency: newHolding.currency,
        broker: newHolding.broker,
      });
    }
  }

  return {
    updatedHoldings: result,
    summary: {
      totalIncoming: incomingPositions.length,
      updatedCount,
      addedCount,
      details,
    },
  };
}
