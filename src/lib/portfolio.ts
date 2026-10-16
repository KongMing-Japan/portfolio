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
    description: '长期压舱的大盘基石与宽基指数资产',
    color: '#2563eb',
    pale: '#eff6ff',
  },
  Satellite: {
    label: '卫星仓',
    description: '高成长科技主题与阿尔法收益机会',
    color: '#d97706',
    pale: '#fffbeb',
  },
  Defensive: {
    label: '防守仓',
    description: '低波动国债、高股息与抵御风险资产',
    color: '#16a34a',
    pale: '#f0fdf4',
  },
  Cash: {
    label: '现金储备',
    description: '高流动性资金缓冲池与再平衡弹药',
    color: '#64748b',
    pale: '#f1f5f9',
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

export function marketFromTicker(ticker: string, name = ''): string {
  const combined = `${ticker} ${name}`.trim();
  if (CASH_PATTERN.test(combined)) return 'Cash';
  if (/\.T$|^TYO:|^(1482|1571|2563|2845|3905|7581|9023|9616)(\.T)?$/i.test(ticker) || /日本|東証|日経|TOPIX|emaxis/i.test(name)) return 'Japan';
  if (/^HKG:|\.HK$|^0\d{4}$/i.test(ticker) || /港股|恒生/i.test(name)) return 'Hong Kong';
  if (
    /^(SHA|SHE):|\.(SS|SZ)$/i.test(ticker) ||
    /^[0356]\d{5}$/.test(ticker) ||
    /A股|沪深|QDII|华泰柏瑞|博时|天弘|宁德时代/i.test(name)
  ) {
    return 'China';
  }
  if (/^[A-Z]{1,6}$|^(NASDAQ|NYSE|BATS):/i.test(ticker)) return 'US';
  return 'Global / Other';
}

/**
 * Look-Through Underlying Economy / Geography (底层穿透国别敞口)
 * Distinguishes listing market (e.g., TSE 2845.T / 2563.T / 1482.T or SSE 513500.SS)
 * from the actual underlying economic exposure (US, China, Japan, Vietnam, Cash).
 */
export function underlyingMarketFromHolding(holding: Pick<Holding, 'ticker' | 'name' | 'theme' | 'currency'>): string {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`.toLowerCase();
  if (CASH_PATTERN.test(combined)) return '多币种现金池 (Cash)';
  if (/vietnam|越南|cn_qdii_vn/i.test(combined)) return '越南市场 (Vietnam)';
  if (
    /\b(1482|2563|2845|513500)\b|emaxis.*s&p|s&p\s*500|标普\s*500|nasdaq|纳指|美国国债|美债/i.test(
      combined,
    )
  ) {
    return '美国核心资产 (US)';
  }
  if (
    /\b(00700|01810|513130|300750)\b|腾讯|小米|恒生科技|宁德时代|china/i.test(
      combined,
    )
  ) {
    return '中国核心资产 (China)';
  }
  if (
    /\b(1571|3905|7581|9023|9616)\b|\.t\b|日经|日経|萨莉亚|共立|东京地铁|datasection/i.test(
      combined,
    )
  ) {
    return '日本本土资产 (Japan)';
  }
  const surface = marketFromTicker(holding.ticker, holding.name);
  if (surface === 'US') return '美国核心资产 (US)';
  if (surface === 'Hong Kong' || surface === 'China') return '中国核心资产 (China)';
  if (surface === 'Japan') return '日本本土资产 (Japan)';
  return '全球与其他 (Global)';
}

/**
 * Checks whether a holding is a JPY-hedged foreign asset ETF (為替ヘッジあり),
 * which carries USD-JPY interest rate differential hedging cost.
 */
export function isJpyHedgedAsset(holding: Pick<Holding, 'ticker' | 'name' | 'theme'>): boolean {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;
  return /\b(1482|2563|2845)(\.T)?\b|日元对冲|為替ヘッジあり|jpy\s*hedged/i.test(combined);
}

/**
 * Checks whether a holding is an inverse ETF or tactical short hedge that should not be auto-bought.
 */
export function isTacticalHedgeHolding(holding: Pick<Holding, 'ticker' | 'name' | 'theme'>): boolean {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;
  return /\b(1571|1357|1459|sqqq|spxu|sh)\b|反向|インバース|inverse|空头对冲/i.test(combined);
}

/**
 * Look-Through Currency & FX Hedge Exposure (底层真实汇率与对冲敞口)
 */
export function fxExposureFromHolding(holding: Pick<Holding, 'ticker' | 'name' | 'theme' | 'currency'>): string {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;
  if (isJpyHedgedAsset(holding)) {
    return 'USD→JPY 对冲敞口 (為替ヘッジ)';
  }
  if (/emaxis.*s&p|513500|标普500etf博时/i.test(combined)) {
    return 'USD 底层敞口 (无对冲)';
  }
  if (/vietnam|越南|cn_qdii_vn/i.test(combined)) {
    return 'VND 越南盾底层敞口';
  }
  if (/513130|恒生科技/i.test(combined)) {
    return 'HKD 港股底层敞口 (CNY计价)';
  }
  const cur = (holding.currency || 'JPY').toUpperCase();
  if (cur === 'USD') return 'USD 底层敞口 (无对冲)';
  if (cur === 'HKD') return 'HKD 港币敞口';
  if (cur === 'CNY') return 'CNY 人民币敞口';
  return 'JPY 纯日元敞口';
}

export const POPULAR_BROKERS = [
  '乐天证券',
  'moomoo证券',
  'Tiger证券',
  '微信证券',
  '蚂蚁财富',
  '乐天银行',
  '三井住友银行',
  '招商银行',
  'SBI証券',
  'Interactive Brokers',
  '富途牛牛',
  '现金储备 (Cash Reserve)',
];

export function suggestCurrencyFromTicker(
  ticker: string,
  name = '',
): 'USD' | 'JPY' | 'CNY' | 'HKD' {
  const m = marketFromTicker(ticker, name);
  if (m === 'Japan') return 'JPY';
  if (m === 'China') return 'CNY';
  if (m === 'Hong Kong') return 'HKD';
  return 'USD';
}

export type AssetClassType = 'Equity' | 'ETF' | 'Fund' | 'Cash';

export function assetClassFromHolding(
  ticker: string,
  name = '',
  theme = '',
): AssetClassType {
  const combined = `${ticker} ${name} ${theme}`.toLowerCase();
  if (CASH_PATTERN.test(combined)) return 'Cash';
  if (
    /(etf|1482|1571|2563|2845|513130|513500|510\d{3}|159\d{3}|1306|2558|\bspy\b|\bvoo\b|\bqqq\b|\bvti\b)/i.test(
      combined,
    )
  ) {
    return 'ETF';
  }
  if (/(fund|基金|信託|投信|emaxis|qdii|mutual|理财|世界|worldcoin|bitget|crypto)/i.test(combined)) return 'Fund';
  return 'Equity';
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
      (reason) => reason !== 'Latest quote unavailable' && reason !== '未获取到最新行情',
    );
    if (missingQuote) reviewReasons.push('Latest quote unavailable');

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

/**
 * Resolves a canonical grouping key when `mergeEquivalent` is enabled:
 * - Merges all S&P 500 wrappers (2563.T + EMAXIS_SP500 + 513500.SS) into a single Look-Through group
 * - Groups scattered cash/bank/wallet items into 3 actionable liquidity tiers:
 *   1) 券商交易子弹 (Brokerage Cash)
 *   2) 银证联动与理财储备 (Linked Bank & Money Market)
 *   3) 日常银行与支付钱包 (Living & Payment Wallets)
 */
function resolveCanonicalGroup(holding: Holding): {
  key: string;
  ticker: string;
  name: string;
  theme?: string;
} {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;

  // 1. S&P 500 Equivalent Index Group (2563.T + eMAXIS Slim + 513500.SS)
  if (/\b(2563|513500)(\.T|\.SS)?\b|emaxis_sp500|emaxis.*s&p/i.test(combined)) {
    return {
      key: 'GROUP_SP500_INDEX',
      ticker: 'S&P500·合并',
      name: '标普 500 指数全口径 (2563.T + eMAXIS + 513500)',
      theme: 'Bonds & Index (标普500定投)',
    };
  }

  // 2. Three-Tier Cash Pool Grouping when multiple cash accounts exist
  if (holding.layer === 'Cash' || CASH_PATTERN.test(combined)) {
    if (/brokerage|券商|moomoo|tiger|wechatsec|微信证券/i.test(combined)) {
      return {
        key: 'CASH_POOL_BROKER',
        ticker: 'Cash·券商子弹',
        name: '券商可用交易现金池 (Tiger美港币 / moomoo / 微信证券)',
        theme: 'Brokerage Cash (券商交易子弹)',
      };
    }
    if (/linked|联动|乐天银行|rakutenbank|余额宝|yuebao|招商银行|cmb|ant\s*bank/i.test(combined)) {
      return {
        key: 'CASH_POOL_LINKED',
        ticker: 'Cash·联动储备',
        name: '银证联动与理财储备池 (乐天银行 / 余额宝 / 招行 / ANT)',
        theme: 'Linked Bank Reserve (银证联动储备)',
      };
    }
    return {
      key: 'CASH_POOL_LIVING',
      ticker: 'Cash·日常与钱包',
      name: '日常银行与跨境支付钱包池 (SMBC / Sony / Wise / 微信等)',
      theme: 'Living & Emergency (日常与应急储备)',
    };
  }

  const defaultKey = holding.ticker || `${holding.broker}-${holding.name}`;
  return {
    key: defaultKey,
    ticker: holding.ticker,
    name: holding.name || holding.ticker,
  };
}

export function aggregateHoldings(
  holdings: Holding[],
  options?: { mergeEquivalent?: boolean },
): AggregatedHolding[] {
  const mergeEquivalent = options?.mergeEquivalent ?? false;
  const groups = new Map<string, Omit<AggregatedHolding, 'weight'>>();

  for (const holding of holdings) {
    const resolved = mergeEquivalent
      ? resolveCanonicalGroup(holding)
      : {
          key: holding.ticker || `${holding.broker}-${holding.name}`,
          ticker: holding.ticker,
          name: holding.name || holding.ticker,
          theme: undefined,
        };

    const existing = groups.get(resolved.key);
    if (existing) {
      existing.quantity += holding.quantity;
      existing.marketValueBase += holding.valueInBase ?? 0;
      existing.accounts.push(holding);
    } else {
      groups.set(resolved.key, {
        ticker: resolved.ticker,
        name: resolved.name,
        currency: holding.currency,
        layer: holding.layer,
        theme: resolved.theme || holding.theme || 'Uncategorized',
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
  if (score < 0.15) return '分散良好 (低集中度)';
  if (score <= 0.25) return '适度集中 (均衡配置)';
  return '高度集中 (关注单边波动)';
}

export function formatExactMoney(value: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);
}

export function formatMoney(value: number, currency: string) {
  const prefix =
    currency === 'USD'
      ? 'US$'
      : currency === 'JPY'
        ? '¥'
        : currency === 'CNY'
          ? 'CN¥'
          : currency === 'HKD'
            ? 'HK$'
            : `${currency} `;
  const absolute = Math.abs(value);

  if (currency === 'JPY' || currency === 'CNY') {
    if (absolute >= 100_000_000) {
      return `${prefix}${(value / 100_000_000).toFixed(3).replace(/\.?0+$/, '')}亿`;
    }
    if (absolute >= 1_000_000) {
      const wan = value / 10_000;
      return `${prefix}${wan.toLocaleString('en-US', {
        maximumFractionDigits: wan >= 100 ? 1 : 2,
      })}万`;
    }
  } else {
    if (absolute >= 1_000_000_000) {
      return `${prefix}${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (absolute >= 1_000_000) {
      return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
    }
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
  if (!value) return 'Not updated';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
