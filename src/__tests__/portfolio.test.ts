import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHoldingsCsv, parseHoldingsText, parseNumber } from '../lib/csv';
import {
  aggregateHoldings,
  applyQuotes,
  concentrationScore,
} from '../lib/portfolio';

const samplePath = resolve(process.cwd(), 'public/sample-positions.csv');

describe('portfolio import and analysis', () => {
  it('parses comma-separated quantities', () => {
    expect(parseNumber('5,000,000')).toBe(5_000_000);
    expect(parseNumber('2%')).toBe(2);
  });

  it('loads the Berkshire sample and normalizes cash', () => {
    const holdings = parseHoldingsCsv(readFileSync(samplePath, 'utf8'));
    expect(holdings).toHaveLength(10);
    expect(new Set(holdings.map((item) => item.broker))).toEqual(
      new Set(['Berkshire Hathaway 13F Demo']),
    );
    expect(new Set(holdings.map((item) => item.currency))).toEqual(
      new Set(['USD']),
    );
    expect(holdings.some((item) => item.ticker.startsWith('Cash_'))).toBe(false);
    expect(holdings.every((item) => item.account === 'Q1 2026 13F')).toBe(true);
  });

  it('aggregates duplicate tickers across accounts', () => {
    const holdings = parseHoldingsCsv(readFileSync(samplePath, 'utf8'));
    const priced = applyQuotes(
      holdings,
      {
        quotes: holdings.map((item) => ({
          ticker: item.ticker,
          price: item.costPerUnit ?? 1,
          currency: item.currency,
          fetchedAt: '2026-06-23T00:00:00.000Z',
        })),
        fx: { JPY: 1, USD: 150, HKD: 19, CNY: 21 },
        fetchedAt: '2026-06-23T00:00:00.000Z',
      },
      'JPY',
    );
    const aggregated = aggregateHoldings(priced);
    expect(aggregated).toHaveLength(10);
    expect(aggregated.find((item) => item.ticker === 'AAPL')?.quantity).toBe(
      289_000_000,
    );
    expect(concentrationScore(aggregated)).toBeGreaterThan(0);
  });

  it('parses pasted shorthand rows', () => {
    const holdings = parseHoldingsText(
      'AAPL, Apple, USD, 10, 200, Manual, Core, Consumer Tech\nCash_USD, USD Cash, USD, 5000, 1, Manual, Cash, Liquidity',
    );
    expect(holdings).toHaveLength(2);
    expect(holdings[0].sourceType).toBe('manual');
    expect(holdings[0].ticker).toBe('AAPL');
    expect(holdings[1].layer).toBe('Cash');
  });
});
