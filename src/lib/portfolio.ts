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
    description: '长期压舱的大盘基石与双主线龙头资产',
    color: '#2563eb',
    pale: '#eff6ff',
  },
  Satellite: {
    label: '卫星仓',
    description: '高赔率成长主题与非线性阿尔法机会',
    color: '#3b82f6',
    pale: '#f0f7ff',
  },
  Defensive: {
    label: '防守仓',
    description: '低波动国债、宽基定投、高股息基建与抗风险资产',
    color: '#475569',
    pale: '#f1f5f9',
  },
  Cash: {
    label: '现金储备',
    description: '高流动性资金缓冲池与再平衡交易子弹',
    color: '#94a3b8',
    pale: '#f8fafc',
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
 * 资产底层经济体与国别分布
 * 穿透日股挂牌的美债/标普/纳指 ETF 与 A 股跨境 ETF/QDII 至底层真实挂钩经济体
 */
export function underlyingMarketFromHolding(holding: Pick<Holding, 'ticker' | 'name' | 'theme' | 'currency'>): string {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`.toLowerCase();
  if (CASH_PATTERN.test(combined)) return '现金储备';
  if (/vietnam|越南|cn_qdii_vn/i.test(combined)) return '越南';
  if (
    /\b(1482|2563|2845|513500)\b|emaxis.*s&p|s&p\s*500|标普\s*500|nasdaq|纳指|美国国债|美债/i.test(
      combined,
    )
  ) {
    return '美国';
  }
  if (
    /\b(00700|01810|513130|300750)\b|腾讯|小米|恒生科技|宁德时代|china/i.test(
      combined,
    )
  ) {
    return '中国';
  }
  if (
    /\b(1571|3905|7581|9023|9616)\b|\.t\b|日经|日経|萨莉亚|共立|东京地铁|datasection/i.test(
      combined,
    )
  ) {
    return '日本';
  }
  const surface = marketFromTicker(holding.ticker, holding.name);
  if (surface === 'US') return '美国';
  if (surface === 'Hong Kong' || surface === 'China') return '中国';
  if (surface === 'Japan') return '日本';
  return '全球与其他';
}

/**
 * 检查是否为日元对冲型外币资产 ETF (為替ヘッジあり)
 */
export function isJpyHedgedAsset(holding: Pick<Holding, 'ticker' | 'name' | 'theme'>): boolean {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;
  return /\b(1482|2563|2845)(\.T)?\b|日元对冲|為替ヘッジあり|jpy\s*hedged/i.test(combined);
}

/**
 * 检查是否为战术反向对冲标的
 */
export function isTacticalHedgeHolding(holding: Pick<Holding, 'ticker' | 'name' | 'theme'>): boolean {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;
  return /\b(1571|1357|1459|sqqq|spxu|sh)\b|反向|インバース|inverse|空头对冲/i.test(combined);
}

/**
 * 底层币种与汇率对冲敞口
 */
export function fxExposureFromHolding(holding: Pick<Holding, 'ticker' | 'name' | 'theme' | 'currency'>): string {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`;
  if (isJpyHedgedAsset(holding)) {
    return '日元对冲 (USD→JPY)';
  }
  if (/emaxis.*s&p|513500|标普500etf博时/i.test(combined)) {
    return '美元';
  }
  if (/vietnam|越南|cn_qdii_vn/i.test(combined)) {
    return '越南盾';
  }
  if (/513130|恒生科技/i.test(combined)) {
    return '港币';
  }
  const cur = (holding.currency || 'JPY').toUpperCase();
  if (cur === 'USD') return '美元';
  if (cur === 'HKD') return '港币';
  if (cur === 'CNY') return '人民币';
  return '日元';
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
  'SBI新生银行',
  'Sony银行',
  '瑞穗银行',
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
  return top === 'USD' ? 'USD' : 'JPY';
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

export function sanitizeCurrencyCode(cur?: string | null): string {
  if (!cur) return 'USD';
  const raw = String(cur).trim();
  const clean = raw.toUpperCase();
  if (/^[A-Z]{3}$/.test(clean)) return clean;
  if (/日元|円|JPY|[¥￥]/i.test(raw)) return 'JPY';
  if (/美元|USD|\$/i.test(raw)) return 'USD';
  if (/人民币|CNY|RMB|元/i.test(raw)) return 'CNY';
  if (/港币|HKD/i.test(raw)) return 'HKD';
  if (/欧元|EUR/i.test(raw)) return 'EUR';
  return 'USD';
}

export function recalculateBaseValues(
  holdings: Holding[],
  fx: Record<string, number>,
  baseCurrency: BaseCurrency,
) {
  const safeFx = fx || { JPY: 1, USD: 157.97, HKD: 20.13, CNY: 23.61 };
  const baseToJpy = safeFx[baseCurrency] ?? 1;
  return holdings.map((holding) => {
    const currency = sanitizeCurrencyCode(holding.currency);
    const localValue =
      holding.marketPrice == null
        ? holding.importedMarketValue
        : holding.marketPrice * holding.quantity;
    const rate = safeFx[currency] ?? safeFx[holding.currency] ?? 1;
    return {
      ...holding,
      currency,
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
    if (/brokerage|券商|moomoo|tiger|wechatsec|微信证券|乐天银行|rakutenbank/i.test(combined)) {
      return {
        key: 'CASH_POOL_BROKER',
        ticker: 'Cash·券商现金池',
        name: '券商现金池',
        theme: 'Cash & Liquidity',
      };
    }
    if (/linked|联动|余额宝|yuebao|招商银行|cmb|ant\s*bank/i.test(combined)) {
      return {
        key: 'CASH_POOL_LINKED',
        ticker: 'Cash·理财储备',
        name: '理财储备池 (余额宝 / 招行 / ANT)',
        theme: 'Linked Bank Reserve (理财储备)',
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
    const currency = sanitizeCurrencyCode(holding.currency);
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
        currency,
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
  const safeCur = sanitizeCurrencyCode(currency);
  const numStr = Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: safeCur === 'JPY' ? 0 : 2,
    maximumFractionDigits: safeCur === 'JPY' ? 0 : 2,
  });
  if (safeCur === 'JPY') return `¥${numStr}`;
  if (safeCur === 'USD') return `$${numStr}`;
  if (safeCur === 'CNY') return `¥${numStr}`;
  if (safeCur === 'HKD') return `HK$${numStr}`;
  return `${safeCur} ${numStr}`;
}

export function formatMoney(value: number, currency: string) {
  const safeCur = sanitizeCurrencyCode(currency);
  const prefix =
    safeCur === 'USD'
      ? '$'
      : safeCur === 'JPY'
        ? '¥'
        : safeCur === 'CNY'
          ? '¥'
          : safeCur === 'HKD'
            ? 'HK$'
            : `${safeCur} `;
  const absolute = Math.abs(value);

  if (safeCur === 'JPY') {
    if (absolute >= 100_000_000) {
      const yi = (value / 100_000_000).toFixed(1).replace(/\.0$/, '');
      return `${prefix}${yi}亿`;
    }
    if (absolute >= 10_000) {
      const wan = Math.round(value / 10_000);
      return `${prefix}${wan.toLocaleString('en-US')}万`;
    }
    return `${prefix}${Math.round(value).toLocaleString('en-US')}`;
  }

  if (safeCur === 'CNY') {
    if (absolute >= 100_000_000) {
      return `${prefix}${(value / 100_000_000).toFixed(2).replace(/\.?0+$/, '')}亿`;
    }
    if (absolute >= 10_000) {
      const wan = Math.round(value / 10_000);
      return `${prefix}${wan.toLocaleString('en-US')}万`;
    }
  } else {
    if (absolute >= 1_000_000_000) {
      return `${prefix}${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (absolute >= 1_000_000) {
      return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
    }
  }

  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: safeCur,
      maximumFractionDigits: safeCur === 'JPY' ? 0 : 2,
    }).format(value);
  } catch {
    return `${prefix}${Number(value || 0).toLocaleString('zh-CN', {
      maximumFractionDigits: safeCur === 'JPY' ? 0 : 2,
    })}`;
  }
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatEditableNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return Number(value.toFixed(4)).toString();
}

export function getCleanSecurityName(ticker: string, originalName = ''): string {
  const t = (ticker || '').trim().toUpperCase();
  const n = (originalName || '').trim();

  if (t === '1482' || t === '1482.T') return '美债 7-10年 (对冲)';
  if (t === '1571' || t === '1571.T') return '日经反向';
  if (t === '2563' || t === '2563.T') return 'S&P 500 (对冲)';
  if (t === '2845' || t === '2845.T') return '纳斯达克 100 (对冲)';
  if (t === '7581' || t === '7581.T' || /萨莉亚|サイゼリヤ/i.test(n)) return '萨莉亚';
  if (t === '9616' || t === '9616.T' || /共立/i.test(n)) return '共立维护';
  if (t === '3905' || t === '3905.T' || /DataSection/i.test(n)) return 'DataSection';
  if (t === '9023' || t === '9023.T' || /东京地铁|東京メトロ/i.test(n)) return '东京地铁';
  if (t === 'EMAXIS_SP500' || /eMAXIS.*S&P/i.test(n) || t === '513500' || t === '513500.SS' || /标普\s*500/i.test(n)) return 'S&P 500';
  if (t === '513130' || t === '513130.SS' || /恒生科技/i.test(n)) return '恒生科技';
  if (t === '300750' || t === '300750.SZ' || /宁德时代/i.test(n)) return '宁德时代';
  if (t === 'CN_QDII_VN' || /越南|VN30/i.test(n)) return '越南 VN30';
  if (t === 'CRCL' || /Circle/i.test(n)) return 'Circle';
  if (t === 'NVDA' || /英伟达/i.test(n)) return '英伟达';
  if (t === 'SMR' || /NuScale/i.test(n)) return 'NuScale Power';
  if (t === '00700' || t === '00700.HK' || /腾讯/i.test(n)) return '腾讯';
  if (t === '01810' || t === '01810.HK' || /小米/i.test(n)) return '小米';
  if (t === 'TSLA' || /特斯拉/i.test(n)) return '特斯拉';
  if (t === 'AAPL' || /苹果/i.test(n)) return '苹果';
  if (t === 'MSFT' || /微软/i.test(n)) return '微软';
  if (t === 'GOOGL' || t === 'GOOG' || /谷歌/i.test(n)) return '谷歌';
  if (/券商现金池/i.test(n) || /券商现金池/i.test(t)) return '券商现金池';
  if (/余额宝/i.test(n) || t.includes('YUEBAO')) return '余额宝';
  if (/招商银行/i.test(n) || t.includes('CMB')) return '招商银行';
  if (/微信支付/i.test(n) || t.includes('WECHAT')) return '微信支付';
  if (/乐天银行/i.test(n) || t.includes('RAKUTENBANK')) return '乐天银行';
  if (/三井住友/i.test(n) || t.includes('SMBC')) return '三井住友银行';
  if (/瑞穗/i.test(n) || t.includes('MIZUHO')) return '瑞穗银行';
  if (/Sony/i.test(n) || t.includes('SONY')) return 'Sony银行';
  if (/新生|SBI新生/i.test(n) || t.includes('SHINSEI') || t.includes('SBI新生')) return 'SBI新生银行';
  if (/Wise/i.test(n) || t.includes('WISE')) return 'Wise';
  if (/PayPal/i.test(n) || t.includes('PAYPAL')) return 'PayPal';
  if (/Revolut/i.test(n) || t.includes('REVOLUT')) return 'Revolut';
  if (/Ant\s*Bank/i.test(n) || t.includes('ANTBANK')) return 'ANT BANK';
  if (/Worldcoin/i.test(n) || t.includes('WORLDCOIN') || t.includes('WLD')) return 'Worldcoin';
  if (/Bitget/i.test(n) || t.includes('BITGET')) return 'Bitget Wallet';

  if (!n) return t || '未命名标的';
  return n
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*（[^）]*）/g, '')
    .trim() || n;
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

export type AccountRole = 'brokerage' | 'banking' | 'wallet';

const DAILY_BANKING_BROKERS = new Set([
  '三井住友银行',
  'Sony银行',
  '招商银行',
  '瑞穗银行',
  'ANT BANK',
  'SBI新生银行',
  '新生银行',
]);

const DAILY_WALLET_BROKERS = new Set([
  'Wise',
  '微信支付',
  'Revolut',
  'PayPal',
  'Bitget Wallet',
  'Worldcoin',
]);

/**
 * 判断持仓是否属于日常消费、生活现金或备忘账户：
 * - 乐天银行：属于投资现金，纳入主投资组合（不属于日常备忘）
 * - 证券账户现金（乐天证券、moomoo证券、Tiger证券、微信证券）：属于投资现金
 * - 蚂蚁财富：天弘越南股票QDII属于投资；余额宝属于日常消费现金
 * - 微信支付、招商银行活期、三井住友、Sony银行、瑞穗、Wise、Revolut、PayPal等：属于日常消费生活现金
 */
export function isDailyMemoAccount(holding: Pick<Holding, 'broker' | 'ticker' | 'name' | 'layer'>): boolean {
  const broker = (holding.broker || '').trim();
  const ticker = (holding.ticker || '').toUpperCase();
  const name = (holding.name || '').trim();

  // 乐天银行现金属于投资现金
  if (broker === '乐天银行') return false;

  // 蚂蚁财富：余额宝为日常生活现金；越南QDII为投资
  if (broker === '蚂蚁财富') {
    return ticker.includes('YU_E_BAO') || ticker.includes('YUEBAO') || name.includes('余额宝');
  }

  // 核心证券账户（包括证券内现金）属于投资
  if (
    broker === '乐天证券' ||
    broker === 'moomoo证券' ||
    broker === 'Tiger证券' ||
    broker === '微信证券'
  ) {
    return false;
  }

  // 其余银行与支付/数字钱包均属于日常生活备忘账户
  return true;
}

/**
 * 账户角色归类：
 * - 'brokerage': 核心证券与基金账户、投资备用现金（乐天银行）
 * - 'banking': 日常生活银行账户（三井住友、Sony、招行、瑞穗、ANT BANK、余额宝）
 * - 'wallet': 跨境支付与数字钱包（Wise、微信支付、Revolut、PayPal、Bitget、Worldcoin）
 */
export function classifyAccountRole(holding: Pick<Holding, 'broker' | 'ticker' | 'name' | 'layer'>): AccountRole {
  const broker = (holding.broker || '').trim();
  if (DAILY_WALLET_BROKERS.has(broker) || holding.ticker === 'CRYPTO_BITGET' || holding.ticker === 'CRYPTO_WLD') {
    return 'wallet';
  }
  if (DAILY_BANKING_BROKERS.has(broker)) {
    return 'banking';
  }
  if (isDailyMemoAccount(holding)) {
    return 'banking';
  }
  return 'brokerage';
}

export interface AssetRiskMetrics {
  annualVol: number;
  expectedReturn: number;
  beta: number;
  riskCategory: string;
}

/**
 * Empirical annualized volatility (σ), beta (β), and expected return (μ)
 * for classic Markowitz Mean-Variance & Risk Parity budgeting.
 */
export function estimateAssetVolatility(
  item: Pick<Holding, 'ticker' | 'name' | 'layer' | 'theme'>,
): AssetRiskMetrics {
  const sym = (item.ticker || '').toUpperCase();
  const name = (item.name || '').toUpperCase();

  if (item.layer === 'Cash' || sym.startsWith('CASH')) {
    return {
      annualVol: 0.015,
      expectedReturn: 0.024,
      beta: 0.02,
      riskCategory: '机动现金与货币工具',
    };
  }
  if (sym.includes('1482')) {
    return {
      annualVol: 0.075,
      expectedReturn: 0.042,
      beta: 0.15,
      riskCategory: '美债与防守固收',
    };
  }
  if (sym.includes('9023')) {
    return {
      annualVol: 0.135,
      expectedReturn: 0.078,
      beta: 0.45,
      riskCategory: '日本内需与高息基建',
    };
  }
  if (
    sym.includes('S&P500') ||
    sym.includes('2563') ||
    sym.includes('EMAXIS') ||
    sym.includes('513500') ||
    sym === 'VOO' ||
    sym === 'SPY'
  ) {
    return {
      annualVol: 0.165,
      expectedReturn: 0.098,
      beta: 1.0,
      riskCategory: '美股核心宽基',
    };
  }
  if (sym.includes('2845') || sym === 'QQQ') {
    return {
      annualVol: 0.215,
      expectedReturn: 0.118,
      beta: 1.22,
      riskCategory: '美股核心宽基',
    };
  }
  if (sym.includes('7581') || sym.includes('9616')) {
    return {
      annualVol: 0.22,
      expectedReturn: 0.096,
      beta: 0.78,
      riskCategory: '日本内需与高息基建',
    };
  }
  if (sym.includes('1571')) {
    return {
      annualVol: 0.19,
      expectedReturn: -0.015,
      beta: -0.85,
      riskCategory: '战术对冲与新兴市场',
    };
  }
  if (sym.includes('QDII_VN') || name.includes('越南')) {
    return {
      annualVol: 0.24,
      expectedReturn: 0.112,
      beta: 0.88,
      riskCategory: '战术对冲与新兴市场',
    };
  }
  if (sym.includes('00700') || sym.includes('513130') || sym.includes('300750')) {
    return {
      annualVol: 0.31,
      expectedReturn: 0.126,
      beta: 1.18,
      riskCategory: '中港科技与新经济',
    };
  }
  if (sym.includes('01810')) {
    return {
      annualVol: 0.36,
      expectedReturn: 0.138,
      beta: 1.32,
      riskCategory: '中港科技与新经济',
    };
  }
  if (sym === 'NVDA') {
    return {
      annualVol: 0.44,
      expectedReturn: 0.165,
      beta: 1.62,
      riskCategory: '高Beta前沿卫星',
    };
  }
  if (sym.includes('3905')) {
    return {
      annualVol: 0.52,
      expectedReturn: 0.172,
      beta: 1.7,
      riskCategory: '高Beta前沿卫星',
    };
  }
  if (sym === 'CRCL' || sym === 'SMR' || sym.startsWith('CRYPTO')) {
    return {
      annualVol: 0.60,
      expectedReturn: 0.188,
      beta: 1.85,
      riskCategory: '高Beta前沿卫星',
    };
  }

  // Fallback by layer
  if (item.layer === 'Defensive') {
    return {
      annualVol: 0.11,
      expectedReturn: 0.06,
      beta: 0.35,
      riskCategory: '美债与防守固收',
    };
  }
  if (item.layer === 'Satellite') {
    return {
      annualVol: 0.38,
      expectedReturn: 0.145,
      beta: 1.45,
      riskCategory: '高Beta前沿卫星',
    };
  }
  return {
    annualVol: 0.19,
    expectedReturn: 0.102,
    beta: 1.05,
    riskCategory: '美股核心宽基',
  };
}

/**
 * 规范化战略投资主题（解决同一 AI / EV / 标普 主题因括号备注不同而被拆散的问题）
 */
export function canonicalThemeFromHolding(
  holding: Pick<Holding, 'ticker' | 'name' | 'theme' | 'layer'>,
): string {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`.toLowerCase();
  if (holding.layer === 'Cash' || CASH_PATTERN.test(combined)) {
    return '机动现金与流动性储备';
  }
  if (
    /\b(2845|nvda|3905|smr|00700|513130|googl|goog|aapl|msft)\b|ai\s*ecosystem|算力|芯片|核能|恒生科技|互联网|digital\s*platform/i.test(
      combined,
    )
  ) {
    return 'AI 算力与科技生态';
  }
  if (/\b(01810|300750|tsla)\b|ev\b|智能电车|电池|人车家|小米|宁德时代/i.test(combined)) {
    return '智能电车与新能源';
  }
  if (/\b(2563|513500)\b|emaxis|s&p\s*500|标普\s*500/i.test(combined)) {
    return '标普 500 宽基定投';
  }
  if (/\b(1482|9023)\b|美债|国债|bond|treasury|东京地铁|urban\s*transport|基建/i.test(combined)) {
    return '美债与高息基建防守';
  }
  if (/\b(7581|9616)\b|萨莉亚|共立|hospitality|餐饮|旅游|酒店/i.test(combined)) {
    return '日本内需与文旅消费';
  }
  if (/\b(crcl|crypto_bitget|crypto_wld)\b|web3|stablecoin|稳定币|circle|worldcoin|bitget/i.test(combined)) {
    return 'Web3 与链上金融';
  }
  if (/\b(cn_qdii_vn|1571)\b|越南|vietnam|反向|tactical\s*hedge/i.test(combined)) {
    return '新兴市场与战术对冲';
  }
  const raw = (holding.theme || '').trim();
  if (!raw || raw === 'Uncategorized') return '其他配置主题';
  return raw.replace(/\s*\([^)]*\)/g, '').replace(/\s*（[^）]*）/g, '').trim() || raw;
}

export type DualEngineCategory =
  | '美股 AI 算力与科技生态'
  | '中国智能电车与平台经济'
  | '全球宽基与固收缓冲'
  | '战术卫星与新兴市场'
  | '多币种流动性储备';

/**
 * 中美双主线（AI + EV）战略矩阵归类
 */
export function dualEngineFromHolding(
  holding: Pick<Holding, 'ticker' | 'name' | 'theme' | 'layer' | 'currency'>,
): DualEngineCategory {
  const combined = `${holding.ticker} ${holding.name} ${holding.theme}`.toLowerCase();
  if (holding.layer === 'Cash' || CASH_PATTERN.test(combined)) {
    return '多币种流动性储备';
  }
  const market = underlyingMarketFromHolding(holding);

  if (/\b(01810|300750|00700|513130|tsla)\b|ev\b|智能电车|电池|人车家|小米|宁德时代|恒生科技|腾讯/i.test(combined)) {
    if (market === '中国') {
      return '中国智能电车与平台经济';
    }
  }
  if (
    /\b(2845|nvda|3905|smr|googl|goog|aapl|msft)\b|ai\s*ecosystem|算力|芯片|核能|纳指|nasdaq/i.test(
      combined,
    )
  ) {
    return '美股 AI 算力与科技生态';
  }
  if (
    holding.layer === 'Defensive' ||
    /\b(2563|513500|1482|9023)\b|emaxis|s&p\s*500|标普\s*500|美债|国债|东京地铁/i.test(combined)
  ) {
    return '全球宽基与固收缓冲';
  }
  if (market === '中国') {
    return '中国智能电车与平台经济';
  }
  if (market === '美国' && holding.layer === 'Core') {
    return '美股 AI 算力与科技生态';
  }
  return '战术卫星与新兴市场';
}

export interface HoldingPnLMetrics {
  costBasisBase: number;
  marketValueBase: number;
  unrealizedPnLBase: number;
  returnPct: number;
  unrealizedPnLPct: number;
  hasCost: boolean;
  hasCostBasis: boolean;
   hasDistinctCost: boolean;
  satelliteDiscipline: 'take_profit' | 'stop_loss' | 'ok';
  disciplineAlert: 'take-profit' | 'stop-loss-review' | null;
}

/**
 * 计算单笔或聚合持仓的成本、浮动盈亏与卫星仓铁律触发状态（+30% 止盈 / -15% 止损）
 */
export function calculateAggregatedPnL(
  item: AggregatedHolding,
  fx?: Record<string, number>,
  baseCurrency: BaseCurrency = 'JPY',
): HoldingPnLMetrics {
  const safeFx = fx || { JPY: 1, USD: 157.97, HKD: 20.13, CNY: 23.61 };
  const baseToJpy = safeFx[baseCurrency] ?? 1;

  let costBasisBase = 0;
  let marketValueBase = 0;
  let hasDistinctCost = false;

  for (const acc of item.accounts) {
    const cur = sanitizeCurrencyCode(acc.currency);
    const rate = safeFx[cur] ?? safeFx[acc.currency] ?? 1;
    const mktPrice = acc.marketPrice ?? acc.costPerUnit ?? 1;
    const costPrice = acc.costPerUnit ?? mktPrice;
    if (
      acc.costPerUnit != null &&
      acc.marketPrice != null &&
      Math.abs(acc.costPerUnit - acc.marketPrice) > 1e-5
    ) {
      hasDistinctCost = true;
    }
    const localCost = acc.quantity * costPrice;
    const localMkt =
      acc.marketValue ?? acc.importedMarketValue ?? acc.quantity * mktPrice;

    costBasisBase += (localCost * rate) / baseToJpy;
    marketValueBase += acc.valueInBase ?? (localMkt * rate) / baseToJpy;
  }

  const unrealizedPnLBase = marketValueBase - costBasisBase;
  const returnPct = costBasisBase > 0 ? unrealizedPnLBase / costBasisBase : 0;

  let satelliteDiscipline: 'take_profit' | 'stop_loss' | 'ok' = 'ok';
  let disciplineAlert: 'take-profit' | 'stop-loss-review' | null = null;
  if (item.layer === 'Satellite' && hasDistinctCost) {
    if (returnPct >= 0.30) {
      satelliteDiscipline = 'take_profit';
      disciplineAlert = 'take-profit';
    } else if (returnPct <= -0.15) {
      satelliteDiscipline = 'stop_loss';
      disciplineAlert = 'stop-loss-review';
    }
  }

  return {
    costBasisBase,
    marketValueBase,
    unrealizedPnLBase,
    returnPct,
    unrealizedPnLPct: returnPct,
    hasCost: hasDistinctCost,
    hasCostBasis: hasDistinctCost,
    hasDistinctCost,
    satelliteDiscipline,
    disciplineAlert,
  };
}



