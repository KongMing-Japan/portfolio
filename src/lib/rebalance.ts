import type {
  AggregatedHolding,
  BaseCurrency,
  DriftStatus,
  FullRebalanceResult,
  Holding,
  InflowRebalanceResult,
  Layer,
  LayerDriftInfo,
  LayerTargetConfig,
  QuickTradeInput,
  RebalanceSettings,
  RebalanceTradeItem,
} from '../types';
import { recalculateBaseValues } from './portfolio';

export const SINGLE_SECURITY_CAP = 0.15; // 15% institutional hard cap per single security
export const SINGLE_THEME_CAP = 0.35; // 35% institutional hard cap per single theme
export const CORRIDOR_BAND_ABSOLUTE = 0.05; // ±5% absolute drift trigger
export const CORRIDOR_BAND_RELATIVE = 0.20; // ±20% relative drift trigger

export const DEFAULT_TARGET_CONFIG: LayerTargetConfig = {
  Core: 0.60,
  Satellite: 0.20,
  Defensive: 0.15,
  Cash: 0.05,
};

export const TARGET_PRESETS: Record<
  string,
  {
    name: string;
    description: string;
    targets: LayerTargetConfig;
  }
> = {
  crossBorderCore: {
    name: '跨境双核均衡 (55/15/20/10)',
    description: '适合多币种跨境实盘：55% 核心双主线、15% 战术卫星、20% 防守指数与基建、10% 机动现金',
    targets: {
      Core: 0.55,
      Satellite: 0.15,
      Defensive: 0.2,
      Cash: 0.1,
    },
  },
  institutional: {
    name: '机构基准 (60/20/15/5)',
    description: '标准机构资产配置：60% 核心基石、20% 战术卫星、15% 防守缓冲、5% 流动现金',
    targets: {
      Core: 0.6,
      Satellite: 0.2,
      Defensive: 0.15,
      Cash: 0.05,
    },
  },
  dualGrowth: {
    name: '长期双主线成长 (65/15/15/5)',
    description: '中美双主线长期配置：更高核心信仰仓位（AI+电动车），适度收紧卫星仓',
    targets: {
      Core: 0.65,
      Satellite: 0.15,
      Defensive: 0.15,
      Cash: 0.05,
    },
  },
  conservative: {
    name: '稳健防守型 (50/15/25/10)',
    description: '高防守与现金流配置：增加东京地铁、分红指数与防御资产缓冲，保留 10% 现金',
    targets: {
      Core: 0.5,
      Satellite: 0.15,
      Defensive: 0.25,
      Cash: 0.1,
    },
  },
};

export const DEFAULT_REBALANCE_SETTINGS: RebalanceSettings = {
  targets: DEFAULT_TARGET_CONFIG,
  singleSecurityCap: SINGLE_SECURITY_CAP,
  singleThemeCap: SINGLE_THEME_CAP,
  toleranceBandAbsolute: CORRIDOR_BAND_ABSOLUTE,
  toleranceBandRelative: CORRIDOR_BAND_RELATIVE,
};

const ALL_LAYERS: Layer[] = ['Core', 'Satellite', 'Defensive', 'Cash'];

/**
 * Calculates drift status and metrics for each layer against target configuration.
 */
export function calculateLayerDrift(
  aggregated: AggregatedHolding[],
  totalValue: number,
  targets: LayerTargetConfig = DEFAULT_TARGET_CONFIG,
  toleranceAbsolute = 0.05,
  toleranceRelative = 0.2,
): LayerDriftInfo[] {
  const layerValues: Record<Layer, number> = {
    Core: 0,
    Satellite: 0,
    Defensive: 0,
    Cash: 0,
  };

  for (const item of aggregated) {
    layerValues[item.layer] = (layerValues[item.layer] ?? 0) + item.marketValueBase;
  }

  return ALL_LAYERS.map((layer) => {
    const currentValue = layerValues[layer] ?? 0;
    const currentWeight = totalValue > 0 ? currentValue / totalValue : 0;
    const targetWeight = targets[layer] ?? 0;
    const driftAbsolute = currentWeight - targetWeight;
    const driftRelative =
      targetWeight > 0 ? (currentWeight - targetWeight) / targetWeight : 0;

    let status: DriftStatus = 'ok';
    if (driftAbsolute > toleranceAbsolute || driftRelative > toleranceRelative) {
      status = 'over';
    } else if (
      driftAbsolute < -toleranceAbsolute ||
      driftRelative < -toleranceRelative
    ) {
      status = 'under';
    }

    const valueDelta = targetWeight * totalValue - currentValue;

    return {
      layer,
      currentValue,
      currentWeight,
      targetWeight,
      driftAbsolute,
      driftRelative,
      status,
      valueDelta,
    };
  });
}

function isEligibleForAutoBuy(item: AggregatedHolding): boolean {
  const combined = `${item.ticker} ${item.name} ${item.theme}`;
  if (/\b(1571|1357|1459|sqqq|spxu)\b|反向|インバース|inverse|空头对冲|crypto_|worldcoin|bitget/i.test(combined)) {
    return false;
  }
  return true;
}

/**
 * Mode A: Inflow Rebalancing (新增注资补仓模式)
 * Allocates `inflowAmount` strictly via BUYS into underweight layers and assets,
 * without selling any existing positions. Minimizes portfolio drift with zero tax/sell fees.
 */
export function calculateInflowRebalance(
  aggregated: AggregatedHolding[],
  inflowAmount: number,
  targets: LayerTargetConfig = DEFAULT_TARGET_CONFIG,
  currentTotal: number,
  singleSecurityCap = 0.15,
): InflowRebalanceResult {
  if (inflowAmount <= 0) {
    const projectedWeights: Record<Layer, number> = {
      Core: 0,
      Satellite: 0,
      Defensive: 0,
      Cash: 0,
    };
    for (const item of aggregated) {
      projectedWeights[item.layer] =
        (projectedWeights[item.layer] ?? 0) +
        (currentTotal > 0 ? item.marketValueBase / currentTotal : 0);
    }
    return {
      inflowAmount: 0,
      projectedTotal: currentTotal,
      trades: [],
      projectedLayerWeights: projectedWeights,
      unallocatedCash: 0,
    };
  }

  const projectedTotal = currentTotal + inflowAmount;
  const layerDrifts = calculateLayerDrift(aggregated, currentTotal, targets);

  // 1. Calculate how much each layer is underweight relative to the new target total
  const layerDeficits: Record<Layer, number> = {
    Core: 0,
    Satellite: 0,
    Defensive: 0,
    Cash: 0,
  };

  let totalDeficit = 0;
  for (const layer of ALL_LAYERS) {
    const targetValue = targets[layer] * projectedTotal;
    const currentLayerVal =
      layerDrifts.find((d) => d.layer === layer)?.currentValue ?? 0;
    const deficit = Math.max(0, targetValue - currentLayerVal);
    layerDeficits[layer] = deficit;
    totalDeficit += deficit;
  }

  // 2. Allocate the inflow across underweight layers
  const layerAllocations: Record<Layer, number> = {
    Core: 0,
    Satellite: 0,
    Defensive: 0,
    Cash: 0,
  };

  let remainingInflow = inflowAmount;
  if (totalDeficit > 0) {
    for (const layer of ALL_LAYERS) {
      const share =
        totalDeficit >= inflowAmount
          ? (layerDeficits[layer] / totalDeficit) * inflowAmount
          : layerDeficits[layer];
      layerAllocations[layer] = share;
      remainingInflow -= share;
    }
  }

  // If there's surplus inflow left, allocate it to Core first, or Cash
  if (remainingInflow > 0.01) {
    layerAllocations.Core += remainingInflow;
    remainingInflow = 0;
  }

  // 3. For each layer that receives allocation, distribute to individual holdings
  const trades: RebalanceTradeItem[] = [];
  const allocatedHoldingsValue: Record<string, number> = {};

  for (const layer of ALL_LAYERS) {
    const layerFund = layerAllocations[layer];
    if (layerFund <= 0) continue;

    const layerItems = aggregated.filter((item) => item.layer === layer);
    if (!layerItems.length) {
      // If no holdings in this layer yet (e.g. Cash layer is empty), create cash holding recommendation
      trades.push({
        ticker: `Cash_${layer}`,
        name: `${layer} 预留现金`,
        layer,
        broker: 'Default Account',
        action: 'BUY',
        currentShares: 0,
        suggestedShares: 1,
        currentWeight: 0,
        projectedWeight: layerFund / projectedTotal,
        priceInBase: layerFund,
        amountInBase: layerFund,
        currency: 'USD',
        priceInCurrency: layerFund,
        urgency: 'medium',
        reason: `${layer} 层资金缺口，建议配置现金或基础资产`,
      });
      continue;
    }

    // Distribute layerFund among existing layer holdings, prioritizing lower weights
    // and respecting singleSecurityCap + excluding tactical short hedges
    const eligibleItems = layerItems.filter((item) => {
      if (!isEligibleForAutoBuy(item)) return false;
      const currentWeight =
        projectedTotal > 0 ? item.marketValueBase / projectedTotal : 0;
      return currentWeight < singleSecurityCap;
    });

    const targetList = eligibleItems.length > 0 ? eligibleItems : layerItems.filter(isEligibleForAutoBuy);
    const totalCurrentLayerBase = targetList.reduce(
      (sum, item) => sum + item.marketValueBase,
      0,
    );

    const rawWeights = targetList.map((item) => {
      if (targetList.length === 1 || totalCurrentLayerBase <= 0) return 1;
      return Math.max(1, totalCurrentLayerBase - item.marketValueBase);
    });
    const weightSum = rawWeights.reduce((sum, w) => sum + w, 0) || 1;

    for (let idx = 0; idx < targetList.length; idx += 1) {
      const item = targetList[idx];
      const proportion = rawWeights[idx] / weightSum;

      const itemAllocation = layerFund * proportion;
      const unitPriceInBase =
        item.quantity > 0 ? item.marketValueBase / item.quantity : itemAllocation;

      let suggestedShares =
        unitPriceInBase > 0 ? itemAllocation / unitPriceInBase : 0;

      // Round shares intelligently (integer for JP/CN/HK stocks, 2 decimals for US)
      if (
        item.currency === 'JPY' ||
        item.currency === 'CNY' ||
        item.currency === 'HKD' ||
        /\.(T|SS|SZ|HK)$/i.test(item.ticker)
      ) {
        suggestedShares = Math.max(1, Math.round(suggestedShares));
      } else {
        suggestedShares = Number(suggestedShares.toFixed(2));
      }

      const actualAmountInBase = suggestedShares * unitPriceInBase;
      const currentWeight =
        currentTotal > 0 ? item.marketValueBase / currentTotal : 0;
      const projectedWeight =
        (item.marketValueBase + actualAmountInBase) / projectedTotal;

      allocatedHoldingsValue[item.ticker] = actualAmountInBase;

      trades.push({
        ticker: item.ticker,
        name: item.name,
        layer: item.layer,
        broker: item.accounts[0]?.broker || 'Default',
        action: 'BUY',
        currentShares: item.quantity,
        suggestedShares,
        currentWeight,
        projectedWeight,
        priceInBase: unitPriceInBase,
        amountInBase: actualAmountInBase,
        currency: item.currency,
        priceInCurrency: item.accounts[0]?.marketPrice ?? null,
        urgency:
          layerDrifts.find((d) => d.layer === item.layer)?.status === 'under'
            ? 'high'
            : 'medium',
        reason: `${item.layer} 处于低配区间，补仓后将有效拉平偏离走廊`,
      });
    }
  }

  // 4. Calculate projected layer weights
  const projectedLayerWeights: Record<Layer, number> = {
    Core: 0,
    Satellite: 0,
    Defensive: 0,
    Cash: 0,
  };

  for (const layer of ALL_LAYERS) {
    const curVal = layerDrifts.find((d) => d.layer === layer)?.currentValue ?? 0;
    const added = layerAllocations[layer] ?? 0;
    projectedLayerWeights[layer] = (curVal + added) / projectedTotal;
  }

  return {
    inflowAmount,
    projectedTotal,
    trades: trades.sort((a, b) => b.amountInBase - a.amountInBase),
    projectedLayerWeights,
    unallocatedCash: Math.max(0, remainingInflow),
  };
}

/**
 * Mode B: Full Rebalancing (完全再平衡模式)
 * Computes buys and sells across all holdings to bring the portfolio exactly to target allocation.
 */
export function calculateFullRebalance(
  aggregated: AggregatedHolding[],
  targets: LayerTargetConfig = DEFAULT_TARGET_CONFIG,
  currentTotal: number,
  singleSecurityCap = 0.15,
): FullRebalanceResult {
  if (currentTotal <= 0 || !aggregated.length) {
    return {
      currentTotal,
      trades: [],
      totalSellAmount: 0,
      totalBuyAmount: 0,
      turnoverRate: 0,
      projectedLayerWeights: targets,
    };
  }

  const layerDrifts = calculateLayerDrift(aggregated, currentTotal, targets);
  const trades: RebalanceTradeItem[] = [];
  let totalSellAmount = 0;
  let totalBuyAmount = 0;

  // Track layer totals
  const layerTargetValues: Record<Layer, number> = {
    Core: targets.Core * currentTotal,
    Satellite: targets.Satellite * currentTotal,
    Defensive: targets.Defensive * currentTotal,
    Cash: targets.Cash * currentTotal,
  };

  for (const layer of ALL_LAYERS) {
    const layerItems = aggregated.filter((item) => item.layer === layer);
    const layerDrift = layerDrifts.find((d) => d.layer === layer);
    const layerTotalVal = layerDrift?.currentValue ?? 0;
    const targetLayerVal = layerTargetValues[layer];

    if (!layerItems.length) continue;

    // Consolidate multi-account Cash deployment instead of splitting across 14 bank/wallet rows
    if (layer === 'Cash' && layerItems.length > 2) {
      const cashDiff = targetLayerVal - layerTotalVal;
      if (cashDiff < -100) {
        const deployAmount = Math.abs(cashDiff);
        totalSellAmount += deployAmount;
        trades.push({
          ticker: 'Cash·机动调配',
          name: '动用超配现金储备 (优先券商现金池与乐天银行)',
          layer: 'Cash',
          broker: 'Tiger证券 / 乐天银行 / moomoo',
          action: 'SELL',
          currentShares: 1,
          suggestedShares: 1,
          currentWeight: layerTotalVal / currentTotal,
          projectedWeight: targetLayerVal / currentTotal,
          priceInBase: deployAmount,
          amountInBase: deployAmount,
          currency: 'JPY',
          priceInCurrency: null,
          urgency: layerDrift?.status === 'over' ? 'high' : 'medium',
          reason: '现金储备高于目标走廊，划转富余交易子弹补齐低配核心/卫星资产',
        });
      }
      continue;
    }

    for (const item of layerItems) {
      const currentWeight = item.marketValueBase / currentTotal;
      const unitPriceInBase =
        item.quantity > 0 ? item.marketValueBase / item.quantity : 1;

      // 1. Check if single holding exceeds hard risk cap (e.g. 15%)
      let targetItemVal =
        layerTotalVal > 0
          ? (item.marketValueBase / layerTotalVal) * targetLayerVal
          : targetLayerVal / layerItems.length;

      // Enforce single security cap
      const maxAllowedVal = currentTotal * singleSecurityCap;
      if (targetItemVal > maxAllowedVal) {
        targetItemVal = maxAllowedVal;
      }

      const diffVal = targetItemVal - item.marketValueBase;
      const projectedWeight = targetItemVal / currentTotal;

      if (Math.abs(diffVal) < 10) {
        // Negligible difference
        continue;
      }

      const isIntegerLot =
        item.currency === 'JPY' ||
        item.currency === 'CNY' ||
        item.currency === 'HKD' ||
        /\.(T|SS|SZ|HK)$/i.test(item.ticker);

      if (diffVal < 0) {
        // Need to SELL
        const sellAmount = Math.abs(diffVal);
        let sharesToSell =
          unitPriceInBase > 0 ? sellAmount / unitPriceInBase : 0;
        if (isIntegerLot) {
          sharesToSell = Math.min(item.quantity, Math.round(sharesToSell));
        } else {
          sharesToSell = Math.min(item.quantity, Number(sharesToSell.toFixed(2)));
        }

        if (sharesToSell > 0) {
          const actualSellAmount = sharesToSell * unitPriceInBase;
          totalSellAmount += actualSellAmount;
          trades.push({
            ticker: item.ticker,
            name: item.name,
            layer: item.layer,
            broker: item.accounts[0]?.broker || 'Default',
            action: 'SELL',
            currentShares: item.quantity,
            suggestedShares: sharesToSell,
            currentWeight,
            projectedWeight,
            priceInBase: unitPriceInBase,
            amountInBase: actualSellAmount,
            currency: item.currency,
            priceInCurrency: item.accounts[0]?.marketPrice ?? null,
            urgency:
              currentWeight > singleSecurityCap || layerDrift?.status === 'over'
                ? 'high'
                : 'medium',
            reason:
              currentWeight > singleSecurityCap
                ? `单一持仓突破机构风控上限 (${(singleSecurityCap * 100).toFixed(0)}%)，需强制锁利减配`
                : `${item.layer} 整体处于超配状态，按规则止盈收缩`,
          });
        }
      } else if (isEligibleForAutoBuy(item)) {
        // Need to BUY
        const buyAmount = diffVal;
        let sharesToBuy =
          unitPriceInBase > 0 ? buyAmount / unitPriceInBase : 0;
        if (isIntegerLot) {
          sharesToBuy = Math.max(1, Math.round(sharesToBuy));
        } else {
          sharesToBuy = Number(sharesToBuy.toFixed(2));
        }

        if (sharesToBuy > 0) {
          const actualBuyAmount = sharesToBuy * unitPriceInBase;
          totalBuyAmount += actualBuyAmount;
          trades.push({
            ticker: item.ticker,
            name: item.name,
            layer: item.layer,
            broker: item.accounts[0]?.broker || 'Default',
            action: 'BUY',
            currentShares: item.quantity,
            suggestedShares: sharesToBuy,
            currentWeight,
            projectedWeight,
            priceInBase: unitPriceInBase,
            amountInBase: actualBuyAmount,
            currency: item.currency,
            priceInCurrency: item.accounts[0]?.marketPrice ?? null,
            urgency: layerDrift?.status === 'under' ? 'high' : 'medium',
            reason: `${item.layer} 低于目标配置走廊，加仓至基准权重`,
          });
        }
      }
    }
  }

  const turnoverRate =
    currentTotal > 0
      ? (totalSellAmount + totalBuyAmount) / 2 / currentTotal
      : 0;

  return {
    currentTotal,
    trades: trades.sort((a, b) => {
      // Prioritize sells before buys for execution clarity
      if (a.action !== b.action) return a.action === 'SELL' ? -1 : 1;
      return b.amountInBase - a.amountInBase;
    }),
    totalSellAmount,
    totalBuyAmount,
    turnoverRate,
    projectedLayerWeights: targets,
  };
}

/**
 * Finds the best matching broker cash holding to debit/credit when executing a trade.
 */
export function findDefaultBrokerCashHolding(
  holdings: Holding[],
  targetOrBroker: Pick<Holding, 'broker' | 'currency'> | string,
  currencyArg?: string,
): Holding | undefined {
  const broker = typeof targetOrBroker === 'string' ? targetOrBroker : targetOrBroker.broker;
  const currency = typeof targetOrBroker === 'string' ? (currencyArg ?? 'JPY') : targetOrBroker.currency;

  const cashItems = holdings.filter(
    (h) =>
      h.layer === 'Cash' ||
      /^(CASH|BALANCE|DEPOSIT|MMF|YEB)[-_]/i.test(h.ticker),
  );
  // 1. Exact broker + currency match
  const exact = cashItems.find(
    (c) => c.broker === broker && c.currency === currency,
  );
  if (exact) return exact;
  // 2. Same broker (any currency)
  const sameBroker = cashItems.find((c) => c.broker === broker);
  if (sameBroker) return sameBroker;
  // 3. Linked bank for Rakuten Securities -> Rakuten Bank
  if (/乐天证券|Rakuten/i.test(broker)) {
    const rakutenBank = cashItems.find((c) => /乐天银行/i.test(c.broker));
    if (rakutenBank) return rakutenBank;
  }
  // 4. Same currency cash pool
  return cashItems.find((c) => c.currency === currency);
}

/**
 * Executes a Quick Buy / Sell trade on a specific holding:
 * - Adjusts quantity
 * - Recalculates weighted average costPerUnit on BUY
 * - Updates marketPrice & marketValue
 * - Automatically debits/credits the linked broker cash holding if syncBrokerCash is enabled
 */
export function executeQuickTrade(
  holdings: Holding[],
  trade: QuickTradeInput,
  fx: Record<string, number>,
  baseCurrency: BaseCurrency,
): Holding[] {
  const target = holdings.find((h) => h.id === trade.holdingId);
  if (!target || trade.quantityDelta <= 0) return holdings;

  const safeFx: Record<string, number> = {
    JPY: 1,
    USD: 157.97,
    HKD: 20.13,
    CNY: 23.61,
    ...fx,
  };

  const execPrice =
    trade.executionPrice > 0
      ? trade.executionPrice
      : (target.marketPrice ?? target.costPerUnit ?? 1);
  const tradeValueLocal = trade.quantityDelta * execPrice;
  const targetRateToJpy = safeFx[target.currency] ?? 1;
  const tradeValueJpy = tradeValueLocal * targetRateToJpy;

  const cashTarget = trade.syncBrokerCash
    ? holdings.find((h) => h.id === trade.cashHoldingId) ??
      findDefaultBrokerCashHolding(holdings, target)
    : undefined;

  const nextHoldings = holdings.map((item) => {
    if (item.id === target.id) {
      const oldQty = Math.max(0, item.quantity);
      const newQty =
        trade.action === 'BUY'
          ? oldQty + trade.quantityDelta
          : Math.max(0, oldQty - trade.quantityDelta);

      let newCost = item.costPerUnit;
      if (trade.action === 'BUY' && newQty > 0) {
        const oldCostBasis =
          oldQty * (item.costPerUnit ?? item.marketPrice ?? execPrice);
        newCost = Number(((oldCostBasis + tradeValueLocal) / newQty).toFixed(4));
      }

      const newMarketValue = newQty * execPrice;
      return {
        ...item,
        quantity: Number(newQty.toFixed(4)),
        costPerUnit: newCost,
        marketPrice: execPrice,
        importedMarketValue: newMarketValue,
        marketValue: newMarketValue,
        investmentThesis: trade.note
          ? `${item.investmentThesis ? `${item.investmentThesis} · ` : ''}${trade.note}`
          : item.investmentThesis,
      };
    }

    if (cashTarget && item.id === cashTarget.id) {
      const cashRateToJpy = safeFx[item.currency] ?? 1;
      const cashDeltaLocal = cashRateToJpy > 0 ? tradeValueJpy / cashRateToJpy : 0;
      const signedDelta = trade.action === 'BUY' ? -cashDeltaLocal : cashDeltaLocal;

      const currentLocalVal =
        item.marketValue ??
        (item.marketPrice != null ? item.quantity * item.marketPrice : item.quantity);
      const nextLocalVal = Math.max(0, currentLocalVal + signedDelta);

      if (item.marketPrice === 1 || item.quantity > 100) {
        return {
          ...item,
          quantity: Math.round(nextLocalVal),
          marketPrice: 1,
          importedMarketValue: Math.round(nextLocalVal),
          marketValue: Math.round(nextLocalVal),
        };
      }
      return {
        ...item,
        marketPrice: Number(nextLocalVal.toFixed(2)),
        importedMarketValue: Number(nextLocalVal.toFixed(2)),
        marketValue: Number(nextLocalVal.toFixed(2)),
      };
    }

    return item;
  });

  return recalculateBaseValues(nextHoldings, safeFx, baseCurrency);
}

/**
 * Applies a batch of simulated RebalanceTradeItem recommendations directly into holdings
 * so the user can commit a rebalance plan in 1 click.
 */
export function applyRebalanceTradesToHoldings(
  holdings: Holding[],
  trades: RebalanceTradeItem[],
  fx: Record<string, number>,
  baseCurrency: BaseCurrency,
): Holding[] {
  let working = [...holdings];
  for (const t of trades) {
    if (t.action === 'HOLD' || t.suggestedShares <= 0 || t.ticker.startsWith('Cash')) continue;
    // Find matching primary holding by ticker (or canonical S&P 500 wrapper)
    const candidate =
      working.find((h) => h.ticker === t.ticker && h.broker === t.broker) ??
      working.find((h) => h.ticker === t.ticker) ??
      (t.ticker === 'S&P500·合并'
        ? working.find((h) => h.ticker === '2563.T' || h.ticker === 'EMAXIS_SP500')
        : undefined);

    if (!candidate) continue;

    const unitPriceLocal =
      candidate.marketPrice ??
      t.priceInCurrency ??
      (candidate.quantity > 0 && candidate.marketValue != null
        ? candidate.marketValue / candidate.quantity
        : 1);

    // If it's a merged wrapper like S&P500·合并, convert amountInBase to local candidate shares
    const safeFx: Record<string, number> = {
      JPY: 1,
      USD: 157.97,
      HKD: 20.13,
      CNY: 23.61,
      ...fx,
    };
    const baseToJpy = safeFx[baseCurrency] ?? 1;
    const candidateRateToJpy = safeFx[candidate.currency] ?? 1;
    const tradeAmountJpy = t.amountInBase * baseToJpy;
    const tradeAmountLocal =
      candidateRateToJpy > 0 ? tradeAmountJpy / candidateRateToJpy : t.amountInBase;

    const computedShares =
      candidate.ticker === t.ticker
        ? t.suggestedShares
        : unitPriceLocal > 0
          ? Math.max(1, Math.round(tradeAmountLocal / unitPriceLocal))
          : t.suggestedShares;

    working = executeQuickTrade(
      working,
      {
        holdingId: candidate.id,
        action: t.action,
        quantityDelta: computedShares,
        executionPrice: unitPriceLocal,
        syncBrokerCash: true,
        note: '智能调仓指令执行',
      },
      safeFx,
      baseCurrency,
    );
  }
  return working;
}

