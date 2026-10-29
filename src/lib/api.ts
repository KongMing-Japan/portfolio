import type { Holding, QuoteResponse } from '../types';
import { makeId, marketFromTicker, normalizeLayer } from './portfolio';

interface ExtractedPosition {
  ticker: string;
  name: string;
  broker: string;
  account: string;
  currency: string;
  quantity: number | null;
  costPerUnit: number | null;
  marketValue: number | null;
  theme: string;
  layer: string;
  confidence: number;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mapExtractedToHoldings(
  positions: ExtractedPosition[],
  defaultBroker: string,
  sourceType: 'image' | 'text',
): Holding[] {
  return positions.map((position) => {
    const ticker = position.ticker.trim();
    const name = position.name.trim() || ticker;
    const reviewReasons: string[] = [];
    if (!ticker) reviewReasons.push('Missing ticker');
    if (!position.currency) reviewReasons.push('Missing currency');
    if (position.quantity == null || position.quantity < 0) {
      reviewReasons.push('Invalid quantity');
    }
    if (position.confidence != null && position.confidence < 0.8) {
      reviewReasons.push('Low confidence');
    }

    const marketPrice =
      position.marketValue != null && position.quantity && position.quantity > 0
        ? position.marketValue / position.quantity
        : (position.costPerUnit ?? null);

    const currency = position.currency.trim().toUpperCase() || 'JPY';

    return {
      id: makeId(),
      ticker,
      name: name || 'Unnamed security',
      broker: position.broker.trim() || defaultBroker,
      account: position.account.trim(),
      market: marketFromTicker(ticker, name),
      currency,
      quantity: position.quantity ?? 0,
      costPerUnit: position.costPerUnit,
      importedMarketValue: position.marketValue,
      marketPrice,
      marketValue:
        position.marketValue ??
        (marketPrice != null && position.quantity
          ? marketPrice * position.quantity
          : null),
      valueInBase: null,
      layer: normalizeLayer(position.layer, ticker, name, position.theme),
      theme: position.theme.trim() || 'Uncategorized',
      sourceType,
      confidence: position.confidence ?? 1.0,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
      targetWeight: null,
      investmentThesis: '',
    };
  });
}

export async function extractImagePositions(file: File): Promise<Holding[]> {
  const response = await fetch('/api/extract-positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: await fileToDataUrl(file),
      filename: file.name,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? 'Screenshot recognition failed.');
  }
  const payload = (await response.json()) as { positions: ExtractedPosition[] };
  return mapExtractedToHoldings(
    payload.positions,
    file.name.replace(/\.[^.]+$/, ''),
    'image',
  );
}

export async function extractTextPositions(text: string): Promise<Holding[]> {
  const response = await fetch('/api/extract-positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? 'Text AI extraction failed.');
  }
  const payload = (await response.json()) as { positions: ExtractedPosition[] };
  return mapExtractedToHoldings(payload.positions, 'Text Import', 'text');
}

export async function fetchQuotes(holdings: Holding[]): Promise<QuoteResponse> {
  const unique = new Map<string, { ticker: string; currency: string }>();
  for (const holding of holdings) {
    if (holding.ticker) {
      unique.set(holding.ticker, {
        ticker: holding.ticker,
        currency: holding.currency,
      });
    }
  }
  const response = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holdings: [...unique.values()] }),
  });
  if (!response.ok) throw new Error('Market data is temporarily unavailable.');
  return (await response.json()) as QuoteResponse;
}

export async function fetchBundledPrices(): Promise<QuoteResponse> {
  const response = await fetch('/data/prices.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Bundled market data is unavailable.');
  const payload = (await response.json()) as {
    prices: { ticker: string; price: number; currency: string; fetchedAt?: string }[];
    fx: Record<string, number>;
  };
  const fetchedAt =
    payload.prices.find((item) => item.fetchedAt)?.fetchedAt ??
    new Date().toISOString();
  return {
    quotes: payload.prices.map((item) => ({
      ticker: item.ticker,
      price: item.price,
      currency: item.currency,
      fetchedAt: item.fetchedAt ?? fetchedAt,
    })),
    fx: payload.fx,
    fetchedAt,
  };
}

export interface CloudPortfolioResponse {
  isOwner: boolean;
  portfolio?: {
    id: string;
    name: string;
    baseCurrency: string;
    fx: Record<string, number>;
    quoteUpdatedAt: string | null;
    holdings: Holding[];
  };
}

export async function fetchPortfolioFromCloud(): Promise<CloudPortfolioResponse | null> {
  try {
    const response = await fetch('/api/portfolio', {
      headers: {
        Accept: 'application/json',
        'X-Owner-Pin': '8888',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as CloudPortfolioResponse;
  } catch {
    return null;
  }
}

export async function saveHoldingToCloud(holding: Holding): Promise<boolean> {
  try {
    const response = await fetch('/api/holdings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Owner-Pin': '8888',
      },
      body: JSON.stringify({ holding }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function saveHoldingsBatchToCloud(holdings: Holding[]): Promise<boolean> {
  try {
    const response = await fetch('/api/holdings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Owner-Pin': '8888',
      },
      body: JSON.stringify({ holdings }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deleteHoldingFromCloud(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/holdings?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'X-Owner-Pin': '8888',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function savePortfolioSettingsToCloud(settings: {
  baseCurrency?: string;
  fx?: Record<string, number>;
  quoteUpdatedAt?: string;
  name?: string;
}): Promise<boolean> {
  try {
    const response = await fetch('/api/portfolio', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Owner-Pin': '8888',
      },
      body: JSON.stringify(settings),
    });
    return response.ok;
  } catch {
    return false;
  }
}

