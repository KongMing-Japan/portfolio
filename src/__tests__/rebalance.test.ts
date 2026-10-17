import { describe, expect, it } from 'vitest';
import {
  applyRebalanceTradesToHoldings,
  calculateInflowRebalance,
  calculateLayerDrift,
  calculateFullRebalance,
  DEFAULT_TARGET_CONFIG,
  executeQuickTrade,
  SINGLE_SECURITY_CAP,
} from '../lib/rebalance';
import type { AggregatedHolding } from '../types';

const MOCK_HOLDINGS: AggregatedHolding[] = [
  {
    ticker: 'AAPL',
    name: 'Apple',
    currency: 'USD',
    layer: 'Core',
    theme: 'Technology',
    quantity: 100,
    marketValueBase: 2500000, // 50%
    weight: 0.5,
    accounts: [{
      id: '1',
      ticker: 'AAPL',
      name: 'Apple',
      broker: 'Interactive Brokers',
      account: 'Main',
      market: 'US',
      currency: 'USD',
      quantity: 100,
      costPerUnit: 150,
      importedMarketValue: 2500000,
      marketPrice: 200,
      marketValue: 20000,
      valueInBase: 2500000,
      layer: 'Core',
      theme: 'Technology',
      sourceType: 'manual',
      confidence: 1,
      needsReview: false,
      reviewReasons: [],
      targetWeight: 0.2,
      investmentThesis: '',
    }],
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA',
    currency: 'USD',
    layer: 'Core',
    theme: 'AI Ecosystem',
    quantity: 50,
    marketValueBase: 1500000, // 30%
    weight: 0.3,
    accounts: [{
      id: '2',
      ticker: 'NVDA',
      name: 'NVIDIA',
      broker: 'Interactive Brokers',
      account: 'Main',
      market: 'US',
      currency: 'USD',
      quantity: 50,
      costPerUnit: 100,
      importedMarketValue: 1500000,
      marketPrice: 200,
      marketValue: 10000,
      valueInBase: 1500000,
      layer: 'Core',
      theme: 'AI Ecosystem',
      sourceType: 'manual',
      confidence: 1,
      needsReview: false,
      reviewReasons: [],
      targetWeight: 0.15,
      investmentThesis: '',
    }],
  },
  {
    ticker: '7203.T',
    name: 'Toyota',
    currency: 'JPY',
    layer: 'Defensive',
    theme: 'Automotive',
    quantity: 300,
    marketValueBase: 600000, // 12%
    weight: 0.12,
    accounts: [{
      id: '3',
      ticker: '7203.T',
      name: 'Toyota',
      broker: 'SBI 証券',
      account: 'NISA',
      market: 'Japan',
      currency: 'JPY',
      quantity: 300,
      costPerUnit: 2000,
      importedMarketValue: 600000,
      marketPrice: 2000,
      marketValue: 600000,
      valueInBase: 600000,
      layer: 'Defensive',
      theme: 'Automotive',
      sourceType: 'manual',
      confidence: 1,
      needsReview: false,
      reviewReasons: [],
      targetWeight: 0.15,
      investmentThesis: '',
    }],
  },
  {
    ticker: 'Cash_JPY',
    name: 'JPY Cash',
    currency: 'JPY',
    layer: 'Cash',
    theme: 'Cash',
    quantity: 400000,
    marketValueBase: 400000, // 8%
    weight: 0.08,
    accounts: [{
      id: '4',
      ticker: 'Cash_JPY',
      name: 'JPY Cash',
      broker: 'SBI 証券',
      account: 'Main',
      market: 'Cash',
      currency: 'JPY',
      quantity: 400000,
      costPerUnit: 1,
      importedMarketValue: 400000,
      marketPrice: 1,
      marketValue: 400000,
      valueInBase: 400000,
      layer: 'Cash',
      theme: 'Cash',
      sourceType: 'manual',
      confidence: 1,
      needsReview: false,
      reviewReasons: [],
      targetWeight: 0.05,
      investmentThesis: '',
    }],
  },
];

describe('Rebalance Engine', () => {
  const total = 5000000;

  it('accurately calculates layer drift and detects over/underweight layers', () => {
    // Current: Core = 4M (80%), Defensive = 600k (12%), Cash = 400k (8%), Satellite = 0 (0%)
    // Target: Core = 60%, Satellite = 20%, Defensive = 15%, Cash = 5%
    const drifts = calculateLayerDrift(MOCK_HOLDINGS, total, DEFAULT_TARGET_CONFIG);

    const core = drifts.find((d) => d.layer === 'Core')!;
    expect(core.currentWeight).toBeCloseTo(0.8);
    expect(core.targetWeight).toBeCloseTo(0.6);
    expect(core.status).toBe('over'); // 80% vs 60% exceeds tolerance

    const sat = drifts.find((d) => d.layer === 'Satellite')!;
    expect(sat.currentWeight).toBe(0);
    expect(sat.status).toBe('under'); // 0% vs 20%

    const defensive = drifts.find((d) => d.layer === 'Defensive')!;
    expect(defensive.currentWeight).toBeCloseTo(0.12);
    // 12% vs 15% -> -3% absolute diff (within 5% tolerance band)
    expect(defensive.status).toBe('ok');
  });

  it('calculates Inflow Rebalancing without any SELL orders', () => {
    const inflowAmount = 1000000; // 1M inflow
    const result = calculateInflowRebalance(
      MOCK_HOLDINGS,
      inflowAmount,
      DEFAULT_TARGET_CONFIG,
      total,
    );

    expect(result.inflowAmount).toBe(inflowAmount);
    expect(result.projectedTotal).toBe(total + inflowAmount);

    // Every single trade must be a BUY
    expect(result.trades.every((t) => t.action === 'BUY')).toBe(true);

    // Satellite was at 0%, so it should be prioritized for allocation
    const satTrades = result.trades.filter((t) => t.layer === 'Satellite');
    expect(satTrades.length).toBeGreaterThan(0);
  });

  it('calculates Full Rebalancing with SELL and BUY orders to match target allocation', () => {
    const result = calculateFullRebalance(
      MOCK_HOLDINGS,
      DEFAULT_TARGET_CONFIG,
      total,
      0.25, // 25% single holding cap
    );

    expect(result.currentTotal).toBe(total);
    expect(result.trades.length).toBeGreaterThan(0);

    const sellTrades = result.trades.filter((t) => t.action === 'SELL');
    const buyTrades = result.trades.filter((t) => t.action === 'BUY');

    expect(sellTrades.length).toBeGreaterThan(0);
    expect(buyTrades.length).toBeGreaterThan(0);

    // AAPL was 50% (2.5M), exceeding target and single cap, so it must be sold down
    const aaplTrade = sellTrades.find((t) => t.ticker === 'AAPL');
    expect(aaplTrade).toBeDefined();
    expect(aaplTrade?.suggestedShares).toBeGreaterThan(0);
  });

  it('executes QuickTrade and automatically debits/credits broker cash pool', () => {
    expect(SINGLE_SECURITY_CAP).toBe(0.15);
    const flatHoldings = MOCK_HOLDINGS.flatMap((h) => h.accounts);
    const fx = { JPY: 1, USD: 150 };

    // Buy 50 shares of Toyota (7203.T) at 2000 JPY = 100,000 JPY deducted from SBI Cash_JPY (400,000 -> 300,000)
    const afterBuy = executeQuickTrade(
      flatHoldings,
      {
        holdingId: '3',
        action: 'BUY',
        quantityDelta: 50,
        executionPrice: 2200,
        syncBrokerCash: true,
      },
      fx,
      'JPY',
    );

    const toyota = afterBuy.find((h) => h.id === '3')!;
    const sbiCash = afterBuy.find((h) => h.id === '4')!;
    expect(toyota.quantity).toBe(350);
    // Weighted avg cost: (300 * 2000 + 50 * 2200) / 350 = 2028.5714
    expect(toyota.costPerUnit).toBeCloseTo(2028.5714, 3);
    // Cash reduced by 50 * 2200 = 110,000 -> 290,000
    expect(sbiCash.quantity).toBe(290000);

    // One-click apply rebalance trades
    const applied = applyRebalanceTradesToHoldings(
      flatHoldings,
      [
        {
          ticker: '7203.T',
          name: 'Toyota',
          broker: 'SBI 証券',
          layer: 'Defensive',
          currency: 'JPY',
          action: 'BUY',
          amountInBase: 40000,
          currentShares: 300,
          suggestedShares: 20,
          priceInBase: 2000,
          priceInCurrency: 2000,
          currentWeight: 0.12,
          projectedWeight: 0.128,
          reason: '补足防守仓位',
          urgency: 'medium',
        },
      ],
      fx,
      'JPY',
    );
    expect(applied.find((h) => h.id === '3')?.quantity).toBe(320);
    expect(applied.find((h) => h.id === '4')?.quantity).toBe(360000);
  });
});

