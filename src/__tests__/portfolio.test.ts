import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHoldingsCsv, parseHoldingsText, parseNumber } from '../lib/csv';
import {
  aggregateHoldings,
  applyQuotes,
  concentrationScore,
  estimateAssetVolatility,
  isDailyMemoAccount,
} from '../lib/portfolio';
import { REAL_PORTFOLIO_SNAPSHOT } from '../lib/realPortfolioData';

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

  it('reconciles the 17-account real portfolio to ~128,355,955 JPY and merges cross-market S&P 500', () => {
    const holdings = REAL_PORTFOLIO_SNAPSHOT.holdings;
    const brokers = new Set(holdings.map((h) => h.broker));
    expect(brokers.size).toBe(17);

    const totalJpy = holdings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    expect(totalJpy).toBeCloseTo(128_355_955, -1);

    const merged = aggregateHoldings(holdings, { mergeEquivalent: true });
    const sp500 = merged.find((item) => item.ticker === 'S&P500·合并');
    expect(sp500).toBeDefined();
    expect(sp500?.accounts.length).toBe(4); // 2563.T x2 + eMAXIS Slim + 513500.SS
    expect(sp500?.marketValueBase ?? 0).toBeCloseTo(15_297_300, -1);
  });

  it('separates daily life cash from investment portfolio according to user classification', () => {
    const holdings = REAL_PORTFOLIO_SNAPSHOT.holdings;
    const dailyHoldings = holdings.filter(isDailyMemoAccount);
    const coreHoldings = holdings.filter((h) => !isDailyMemoAccount(h));

    // Rakuten Bank is investment cash
    expect(coreHoldings.some((h) => h.broker === '乐天银行')).toBe(true);
    // Ant Fortune Vietnam QDII is investment
    expect(coreHoldings.some((h) => h.ticker === 'CN_QDII_VN')).toBe(true);
    // Ant Fortune Yu'e Bao is daily life cash
    expect(dailyHoldings.some((h) => h.ticker === 'Cash_CNY_Yuebao')).toBe(true);
    // WeChat Pay is daily life cash
    expect(dailyHoldings.some((h) => h.broker === '微信支付')).toBe(true);

    const dailySum = dailyHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    const coreSum = coreHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    expect(dailySum + coreSum).toBeCloseTo(128_355_955, -1);

    const mergedCore = aggregateHoldings(coreHoldings, { mergeEquivalent: true });
    for (const item of mergedCore) {
      const vol = estimateAssetVolatility(item);
      expect(vol.annualVol).toBeGreaterThan(0);
      expect(typeof vol.beta).toBe('number');
    }
  });
});
