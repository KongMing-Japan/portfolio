import { describe, expect, it } from 'vitest';
import { calculateSnapshotDiff } from '../lib/storage';
import type { Holding } from '../types';

describe('calculateSnapshotDiff', () => {
  const h1: Holding = {
    id: '1',
    ticker: 'AAPL',
    name: 'Apple',
    broker: 'IBKR',
    account: 'Main',
    market: 'US',
    currency: 'USD',
    quantity: 100,
    costPerUnit: 150,
    importedMarketValue: 20000,
    marketPrice: 200,
    marketValue: 20000,
    valueInBase: 3000000,
    layer: 'Core',
    theme: 'Tech',
    sourceType: 'manual',
    confidence: 1,
    needsReview: false,
    reviewReasons: [],
    targetWeight: 0.5,
    investmentThesis: '',
  };

  const h2: Holding = {
    id: '2',
    ticker: '7203.T',
    name: 'Toyota',
    broker: 'SBI',
    account: 'NISA',
    market: 'Japan',
    currency: 'JPY',
    quantity: 200,
    costPerUnit: 2500,
    importedMarketValue: 500000,
    marketPrice: 2500,
    marketValue: 500000,
    valueInBase: 500000,
    layer: 'Defensive',
    theme: 'Auto',
    sourceType: 'manual',
    confidence: 1,
    needsReview: false,
    reviewReasons: [],
    targetWeight: 0.15,
    investmentThesis: '',
  };

  it('calculates portfolio diff between two snapshot states', () => {
    const beforeHoldings = [h1, h2];
    const totalBefore = 3500000;

    // After state: AAPL increased shares from 100 to 120 and value grew, Toyota sold down
    const h1After: Holding = {
      ...h1,
      quantity: 120,
      valueInBase: 3600000,
    };
    const h2After: Holding = {
      ...h2,
      quantity: 100,
      valueInBase: 250000,
    };
    const afterHoldings = [h1After, h2After];
    const totalAfter = 3850000;

    const diff = calculateSnapshotDiff(beforeHoldings, afterHoldings, totalBefore, totalAfter);

    expect(diff.totalBefore).toBe(3500000);
    expect(diff.totalAfter).toBe(3850000);
    expect(diff.totalDelta).toBe(350000);
    expect(diff.totalDeltaPercent).toBeCloseTo(0.1); // +10%

    // AAPL item check
    const aapl = diff.items.find((i) => i.ticker === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl?.sharesDelta).toBe(20);
    expect(aapl?.valueDelta).toBe(600000);

    // Toyota item check
    const toyota = diff.items.find((i) => i.ticker === '7203.T');
    expect(toyota).toBeDefined();
    expect(toyota?.sharesDelta).toBe(-100);
    expect(toyota?.valueDelta).toBe(-250000);
  });
});
