import { describe, expect, it } from 'vitest';
import type { Holding } from '../types';
import { isSameSecurity, normalizeTicker, upsertHoldings } from '../lib/upsert';

describe('normalizeTicker', () => {
  it('strips Tokyo exchange suffix', () => {
    expect(normalizeTicker('1482.T')).toBe('1482');
    expect(normalizeTicker('TYO:7203')).toBe('7203');
  });

  it('handles US and Hong Kong tickers', () => {
    expect(normalizeTicker('AAPL')).toBe('AAPL');
    expect(normalizeTicker('0700.HK')).toBe('00700');
    expect(normalizeTicker('513500.SS')).toBe('513500');
  });
});

describe('isSameSecurity', () => {
  it('identifies identical and equivalent tickers', () => {
    expect(isSameSecurity({ ticker: '1482.T' }, { ticker: '1482' })).toBe(true);
    expect(isSameSecurity({ ticker: 'NVDA' }, { ticker: 'nvda' })).toBe(true);
    expect(isSameSecurity({ ticker: '00700.HK' }, { ticker: '0700.HK' })).toBe(true);
  });

  it('matches by security name when ticker matches or name matches', () => {
    expect(
      isSameSecurity(
        { ticker: '2563.T', name: 'iShares S&P 500' },
        { ticker: '2563', name: 'iShares S&P 500 ETF' },
      ),
    ).toBe(true);
  });
});

describe('upsertHoldings', () => {
  const existingHoldings: Holding[] = [
    {
      id: 'h1',
      ticker: '1482.T',
      name: '美债 7-10年 (对冲)',
      broker: '乐天证券',
      account: '特定',
      market: 'Japan',
      currency: 'JPY',
      quantity: 50,
      costPerUnit: 2000,
      importedMarketValue: 100000,
      marketPrice: 2000,
      marketValue: 100000,
      valueInBase: 100000,
      layer: 'Defensive',
      theme: 'Bonds & Index',
      sourceType: 'manual',
      confidence: 1,
      needsReview: false,
      reviewReasons: [],
      targetWeight: 0.1,
      investmentThesis: '',
    },
    {
      id: 'h2',
      ticker: 'NVDA',
      name: 'NVIDIA Corp',
      broker: 'moomoo证券',
      account: 'US Account',
      market: 'US',
      currency: 'USD',
      quantity: 10,
      costPerUnit: 120,
      importedMarketValue: 1200,
      marketPrice: 120,
      marketValue: 1200,
      valueInBase: 180000,
      layer: 'Core',
      theme: 'AI 算力',
      sourceType: 'manual',
      confidence: 1,
      needsReview: false,
      reviewReasons: [],
      targetWeight: 0.15,
      investmentThesis: '',
    },
  ];

  it('updates quantity of existing ticker and adds new ticker', () => {
    const incoming: Holding[] = [
      {
        id: 'inc1',
        ticker: '1482', // Notice: without .T
        name: 'iShares 7-10',
        broker: '乐天证券',
        account: '',
        market: 'Japan',
        currency: 'JPY',
        quantity: 80, // Updated quantity from 50 to 80
        costPerUnit: 2050,
        importedMarketValue: 164000,
        marketPrice: 2050,
        marketValue: 164000,
        valueInBase: null,
        layer: 'Defensive',
        theme: 'Bonds',
        sourceType: 'image',
        confidence: 0.95,
        needsReview: false,
        reviewReasons: [],
        targetWeight: null,
        investmentThesis: '',
      },
      {
        id: 'inc2',
        ticker: '7203.T', // Brand new ticker Toyota
        name: 'Toyota Motor',
        broker: '乐天证券',
        account: '',
        market: 'Japan',
        currency: 'JPY',
        quantity: 100,
        costPerUnit: 3000,
        importedMarketValue: 300000,
        marketPrice: 3000,
        marketValue: 300000,
        valueInBase: null,
        layer: 'Core',
        theme: 'Japan Blue Chip',
        sourceType: 'image',
        confidence: 0.95,
        needsReview: false,
        reviewReasons: [],
        targetWeight: null,
        investmentThesis: '',
      },
    ];

    const result = upsertHoldings(existingHoldings, incoming);

    expect(result.summary.totalIncoming).toBe(2);
    expect(result.summary.updatedCount).toBe(1);
    expect(result.summary.addedCount).toBe(1);

    // 1482.T was updated to quantity 80 and new price 2050
    const updated1482 = result.updatedHoldings.find((h) => h.id === 'h1');
    expect(updated1482).toBeDefined();
    expect(updated1482?.quantity).toBe(80);
    expect(updated1482?.marketPrice).toBe(2050);

    // NVDA was untouched
    const nvda = result.updatedHoldings.find((h) => h.id === 'h2');
    expect(nvda?.quantity).toBe(10);

    // Toyota 7203.T was added
    const toyota = result.updatedHoldings.find((h) => h.ticker === '7203.T');
    expect(toyota).toBeDefined();
    expect(toyota?.quantity).toBe(100);
  });
});
