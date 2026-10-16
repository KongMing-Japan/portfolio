import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHoldingsCsv, parseHoldingsText, parseNumber } from '../lib/csv';
import {
  aggregateHoldings,
  applyQuotes,
  concentrationScore,
  estimateAssetVolatility,
  formatExactMoney,
  formatMoney,
  isDailyMemoAccount,
  sanitizeCurrencyCode,
} from '../lib/portfolio';
import { sanitizeLoadedSnapshot } from '../lib/storage';
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

  it('reconciles the 18-account real portfolio to ~128,418,099 JPY and merges cross-market S&P 500', () => {
    const holdings = REAL_PORTFOLIO_SNAPSHOT.holdings;
    const brokers = new Set(holdings.map((h) => h.broker));
    expect(brokers.size).toBe(18);

    const totalJpy = holdings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    expect(totalJpy).toBeCloseTo(128_418_099, -1);

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
    // SBI Shinsei Bank is daily life cash
    expect(dailyHoldings.some((h) => h.broker === 'SBI新生银行')).toBe(true);

    const dailySum = dailyHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    const coreSum = coreHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    expect(dailySum + coreSum).toBeCloseTo(128_418_099, -1);

    const mergedCore = aggregateHoldings(coreHoldings, { mergeEquivalent: true });
    for (const item of mergedCore) {
      const vol = estimateAssetVolatility(item);
      expect(vol.annualVol).toBeGreaterThan(0);
      expect(typeof vol.beta).toBe('number');
    }
  });

  it('safely handles and sanitizes invalid currency codes without throwing', () => {
    const invalidCurrency = '889日元，即约1.099亿日元。以下按账户、类别列出明细和小计。';
    expect(sanitizeCurrencyCode(invalidCurrency)).toBe('JPY');
    expect(sanitizeCurrencyCode('USD')).toBe('USD');
    expect(sanitizeCurrencyCode('人民币')).toBe('CNY');
    expect(sanitizeCurrencyCode('¥')).toBe('JPY');
    expect(sanitizeCurrencyCode('unknown_garbage')).toBe('USD');

    // Neither formatMoney nor formatExactMoney should ever throw RangeError
    expect(() => formatMoney(1234567, invalidCurrency)).not.toThrow();
    expect(() => formatExactMoney(1234567, invalidCurrency)).not.toThrow();
    // JPY rule: >= 1亿 uses 亿 with decimal point (e.g. 1.1亿), >= 10,000 uses integer 万, < 10,000 exact
    expect(formatMoney(109902889, invalidCurrency)).toBe('¥1.1亿');
    expect(formatMoney(128418099, 'JPY')).toBe('¥1.3亿');
    expect(formatMoney(62144, 'JPY')).toBe('¥6万');
    expect(formatMoney(4872000, 'JPY')).toBe('¥487万');
    expect(formatMoney(7058, 'JPY')).toBe('¥7,058');
  });

  it('sanitizes loaded snapshots by filtering out corrupted commentary holdings', () => {
    const rawSnapshot: any = {
      version: 1,
      baseCurrency: 'JPY',
      fx: { JPY: 1, USD: 157.9 },
      holdings: [
        {
          id: 'valid-1',
          ticker: '1482.T',
          name: '美国国债ETF 1482',
          currency: 'JPY',
          quantity: 100,
          marketPrice: 1479,
        },
        {
          id: 'corrupted-commentary',
          ticker: '全部补齐后，资产折合约109',
          name: '902',
          currency: '889日元，即约1.099亿日元。以下按账户、类别列出明细和小计。',
          quantity: 0,
        },
      ],
    };

    const sanitized = sanitizeLoadedSnapshot(rawSnapshot);
    expect(sanitized).toBeDefined();
    expect(sanitized?.holdings).toHaveLength(1);
    expect(sanitized?.holdings[0].ticker).toBe('1482.T');
  });
});
