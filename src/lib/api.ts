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
    throw new Error(error?.error ?? '截图识别失败');
  }
  const payload = (await response.json()) as { positions: ExtractedPosition[] };
  return payload.positions.map((position) => {
    const ticker = position.ticker.trim();
    const name = position.name.trim() || ticker;
    const reviewReasons: string[] = [];
    if (!ticker) reviewReasons.push('缺少证券代码');
    if (!position.currency) reviewReasons.push('缺少币种');
    if (position.quantity == null || position.quantity < 0) {
      reviewReasons.push('数量异常');
    }
    if (position.confidence < 0.8) reviewReasons.push('截图识别置信度较低');
    return {
      id: makeId(),
      ticker,
      name: name || '未命名证券',
      broker: position.broker.trim() || file.name.replace(/\.[^.]+$/, ''),
      account: position.account.trim(),
      market: marketFromTicker(ticker),
      currency: position.currency.trim().toUpperCase() || 'JPY',
      quantity: position.quantity ?? 0,
      costPerUnit: position.costPerUnit,
      importedMarketValue: position.marketValue,
      marketPrice:
        position.marketValue != null && position.quantity
          ? position.marketValue / position.quantity
          : null,
      marketValue: position.marketValue,
      valueInBase: null,
      layer: normalizeLayer(position.layer, ticker, name, position.theme),
      theme: position.theme.trim() || '未分类',
      sourceType: 'image',
      confidence: position.confidence,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
      targetWeight: null,
      investmentThesis: '',
    };
  });
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
  if (!response.ok) throw new Error('行情服务暂时不可用');
  return (await response.json()) as QuoteResponse;
}

export async function fetchBundledPrices(): Promise<QuoteResponse> {
  const response = await fetch('/data/prices.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('本地行情不可用');
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
