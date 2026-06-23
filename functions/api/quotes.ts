interface QuoteRequestItem {
  ticker: string;
  currency: string;
}

interface QuoteBody {
  holdings?: unknown;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
      };
    }>;
  };
}

const FX_TO_JPY_SYMBOLS: Record<string, string> = {
  USD: 'USDJPY=X',
  CNY: 'CNYJPY=X',
  HKD: 'HKDJPY=X',
  EUR: 'EURJPY=X',
  GBP: 'GBPJPY=X',
  SGD: 'SGDJPY=X',
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isQuoteItem(value: unknown): value is QuoteRequestItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'ticker') === 'string' &&
    typeof Reflect.get(value, 'currency') === 'string'
  );
}

function mapToYahoo(ticker: string) {
  if (!ticker || /^cash_/i.test(ticker)) return null;
  if (ticker.startsWith('NASDAQ:') || ticker.startsWith('NYSE:')) {
    return ticker.split(':')[1];
  }
  if (ticker.startsWith('TYO:')) {
    return `${ticker.split(':')[1].replace(/^0+/, '')}.T`;
  }
  if (ticker.startsWith('HKG:')) {
    return `${ticker.split(':')[1].padStart(4, '0')}.HK`;
  }
  if (ticker.startsWith('SHA:')) return `${ticker.split(':')[1]}.SS`;
  if (ticker.startsWith('SHE:')) return `${ticker.split(':')[1]}.SZ`;
  return ticker;
}

async function fetchYahooPrice(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?interval=1d&range=1d`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'portfolio-generator/1.0',
      },
    },
  );
  if (!response.ok) return null;
  const payload = await response.json<YahooChartResponse>();
  const meta = payload.chart?.result?.[0]?.meta;
  return meta?.regularMarketPrice == null
    ? null
    : { price: meta.regularMarketPrice, currency: meta.currency ?? null };
}

async function getQuote(item: QuoteRequestItem) {
  if (/^cash_/i.test(item.ticker)) {
    return {
      ticker: item.ticker,
      price: 1,
      currency: item.currency,
      fetchedAt: new Date().toISOString(),
    };
  }
  const symbol = mapToYahoo(item.ticker);
  if (!symbol) {
    return {
      ticker: item.ticker,
      price: null,
      currency: item.currency,
      fetchedAt: null,
      error: 'Unsupported ticker',
    };
  }
  try {
    const result = await fetchYahooPrice(symbol);
    return {
      ticker: item.ticker,
      price: result?.price ?? null,
      currency: result?.currency ?? item.currency,
      fetchedAt: result ? new Date().toISOString() : null,
      ...(result ? {} : { error: 'Quote unavailable' }),
    };
  } catch {
    return {
      ticker: item.ticker,
      price: null,
      currency: item.currency,
      fetchedAt: null,
      error: 'Quote unavailable',
    };
  }
}

async function getFx(currencies: string[]) {
  const entries = await Promise.all(
    currencies.map(async (currency) => {
      if (currency === 'JPY') return [currency, 1] as const;
      const symbol = FX_TO_JPY_SYMBOLS[currency];
      if (!symbol) return [currency, null] as const;
      try {
        const result = await fetchYahooPrice(symbol);
        return [currency, result?.price ?? null] as const;
      } catch {
        return [currency, null] as const;
      }
    }),
  );
  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, number] => entry[1] != null),
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: QuoteBody;
  try {
    body = await context.request.json<QuoteBody>();
  } catch {
    return json({ error: '请求格式无效。' }, 400);
  }
  if (!Array.isArray(body.holdings)) {
    return json({ error: '缺少持仓数据。' }, 400);
  }
  const holdings = body.holdings.filter(isQuoteItem);
  if (holdings.length === 0 || holdings.length > 200) {
    return json({ error: '持仓数量必须在 1–200 之间。' }, 400);
  }

  const sanitized = holdings.map((item) => ({
    ticker: item.ticker.trim().slice(0, 40),
    currency: item.currency.trim().toUpperCase().slice(0, 5),
  }));
  const currencies = [...new Set(sanitized.map((item) => item.currency))];
  const [quotes, fx] = await Promise.all([
    Promise.all(sanitized.map(getQuote)),
    getFx(currencies),
  ]);

  return json({
    quotes,
    fx,
    fetchedAt: new Date().toISOString(),
  });
};

export const onRequest: PagesFunction<Env> = async () =>
  json({ error: 'Method not allowed' }, 405);
