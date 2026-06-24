import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  QuoteResponse,
} from '../types';

export const LAYER_META: Record<
  Layer,
  { label: string; description: string; color: string; pale: string }
> = {
  Core: {
    label: '核心仓',
    description: '长期结构资产，承载主要投资信念',
    color: '#124f9b',
    pale: '#eaf2fb',
  },
  Satellite: {
    label: '卫星仓',
    description: '主题与成长机会，增强组合收益来源',
    color: '#b78a22',
    pale: '#faf3df',
  },
  Defensive: {
    label: '防御仓',
    description: '低波动与稳定收益，降低组合波动',
    color: '#66731b',
    pale: '#f1f3e5',
  },
  Cash: {
    label: '现金',
    description: '流动性储备，为调整保留空间',
    color: '#6b7280',
    pale: '#f1f3f5',
  },
};

const CASH_PATTERN = /(^cash[_\s-]|现金|現金|cash)/i;
const DEFENSIVE_PATTERN =
  /(bond|treasury|国债|國債|債券|债券|s&p\s?500|index|指数|インデックス|infra|transport|consumer staples)/i;
const SATELLITE_PATTERN =
  /(satellite|rise|growth|emerging|energy|vietnam|japan|核能|uranium|tourism|reopening)/i;

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeLayer(
  raw: string | null | undefined,
  ticker: string,
  name: string,
  theme: string,
): Layer {
  const combined = `${ticker} ${name} ${theme}`;
  if (CASH_PATTERN.test(combined)) return 'Cash';

  const value = String(raw ?? '').trim().toLowerCase();
  if (['core', '核心', '核心仓', '信仰层'].includes(value)) return 'Core';
  if (['satellite', '卫星', '衛星', '卫星仓', '机会层'].includes(value)) {
    return 'Satellite';
  }
  if (
    ['defensive', 'defense', '防御', '防守', '防御仓', '防守仓'].includes(value)
  ) {
    return 'Defensive';
  }
  if (['cash', '现金', '現金'].includes(value)) return 'Cash';
  if (DEFENSIVE_PATTERN.test(combined)) return 'Defensive';
  if (SATELLITE_PATTERN.test(combined)) return 'Satellite';
  return 'Core';
}

export function marketFromTicker(ticker: string) {
  if (/cash/i.test(ticker)) return 'Cash';
  if (/\.T$|^TYO:/i.test(ticker)) return 'Japan';
  if (/^HKG:/i.test(ticker)) return 'Hong Kong';
  if (/^(SHA|SHE):/i.test(ticker)) return 'China';
  if (/^[A-Z]{1,6}$|^(NASDAQ|NYSE|BATS):/i.test(ticker)) return 'US';
  return 'Other';
}

export function suggestBaseCurrency(holdings: Holding[]): BaseCurrency {
  const totals = new Map<string, number>();
  for (const item of holdings) {
    const estimate =
      item.importedMarketValue ??
      (item.costPerUnit == null ? item.quantity : item.quantity * item.costPerUnit);
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + estimate);
  }
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top === 'USD' || top === 'CNY' ? top : 'JPY';
}

export function applyQuotes(
  holdings: Holding[],
  response: QuoteResponse,
  baseCurrency: BaseCurrency,
) {
  const quoteMap = new Map(response.quotes.map((quote) => [quote.ticker, quote]));
  const fxToJpy: Record<string, number> = { JPY: 1, ...response.fx };
  const baseToJpy = fxToJpy[baseCurrency] ?? 1;

  return holdings.map((holding) => {
    const quote = quoteMap.get(holding.ticker);
    const marketPrice =
      quote?.price ??
      holding.marketPrice ??
      (holding.importedMarketValue != null && holding.quantity > 0
        ? holding.importedMarketValue / holding.quantity
        : holding.costPerUnit);
    const localValue =
      marketPrice == null ? holding.importedMarketValue : marketPrice * holding.quantity;
    const fx = fxToJpy[holding.currency] ?? null;
    const valueInBase =
      localValue != null && fx != null ? (localValue * fx) / baseToJpy : null;
    const missingQuote =
      quote?.price == null &&
      holding.marketPrice == null &&
      holding.importedMarketValue == null &&
      !CASH_PATTERN.test(holding.ticker);
    const reviewReasons = holding.reviewReasons.filter(
      (reason) => reason !== '未获取到最新行情',
    );
    if (missingQuote) reviewReasons.push('未获取到最新行情');

    return {
      ...holding,
      marketPrice,
      marketValue: localValue,
      valueInBase,
      needsReview: holding.needsReview || missingQuote,
      reviewReasons,
    };
  });
}

export function recalculateBaseValues(
  holdings: Holding[],
  fx: Record<string, number>,
  baseCurrency: BaseCurrency,
) {
  const baseToJpy = fx[baseCurrency] ?? 1;
  return holdings.map((holding) => {
    const localValue =
      holding.marketPrice == null
        ? holding.importedMarketValue
        : holding.marketPrice * holding.quantity;
    const rate = fx[holding.currency];
    return {
      ...holding,
      marketValue: localValue,
      valueInBase:
        localValue != null && rate != null ? (localValue * rate) / baseToJpy : null,
    };
  });
}

export function aggregateHoldings(holdings: Holding[]): AggregatedHolding[] {
  const groups = new Map<string, Omit<AggregatedHolding, 'weight'>>();
  for (const holding of holdings) {
    const key = holding.ticker || `${holding.broker}-${holding.name}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += holding.quantity;
      existing.marketValueBase += holding.valueInBase ?? 0;
      existing.accounts.push(holding);
    } else {
      groups.set(key, {
        ticker: holding.ticker,
        name: holding.name || holding.ticker,
        currency: holding.currency,
        layer: holding.layer,
        theme: holding.theme || '未分类',
        quantity: holding.quantity,
        marketValueBase: holding.valueInBase ?? 0,
        accounts: [holding],
      });
    }
  }
  const total = [...groups.values()].reduce(
    (sum, holding) => sum + holding.marketValueBase,
    0,
  );
  return [...groups.values()]
    .map((holding) => ({
      ...holding,
      weight: total > 0 ? holding.marketValueBase / total : 0,
    }))
    .sort((a, b) => b.marketValueBase - a.marketValueBase);
}

export function concentrationScore(aggregated: AggregatedHolding[]) {
  return aggregated.reduce((sum, holding) => sum + holding.weight ** 2, 0);
}

export function concentrationLabel(score: number) {
  if (score < 0.15) return '较为分散';
  if (score <= 0.25) return '中等集中';
  return '集中度偏高';
}

export function formatMoney(value: number, currency: string) {
  const prefix =
    currency === 'USD'
      ? 'US$'
      : currency === 'JPY'
        ? '¥'
        : currency === 'CNY'
          ? 'CN¥'
          : `${currency} `;
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) {
    return `${prefix}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absolute >= 1_000_000) {
    return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDateTime(value: string | null) {
  if (!value) return '未更新';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
