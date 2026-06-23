export type Layer = 'Core' | 'Satellite' | 'Defensive' | 'Cash';
export type SourceType = 'csv' | 'image' | 'json';
export type BaseCurrency = 'JPY' | 'USD' | 'CNY';
export type AppStep = 'upload' | 'processing' | 'review' | 'report';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  broker: string;
  account: string;
  market: string;
  currency: string;
  quantity: number;
  costPerUnit: number | null;
  importedMarketValue: number | null;
  marketPrice: number | null;
  marketValue: number | null;
  valueInBase: number | null;
  layer: Layer;
  theme: string;
  sourceType: SourceType;
  confidence: number;
  needsReview: boolean;
  reviewReasons: string[];
  targetWeight: number | null;
  investmentThesis: string;
}

export interface QuoteResult {
  ticker: string;
  price: number | null;
  currency: string | null;
  fetchedAt: string | null;
  error?: string;
}

export interface QuoteResponse {
  quotes: QuoteResult[];
  fx: Record<string, number>;
  fetchedAt: string;
}

export interface PortfolioSnapshot {
  version: 1;
  holdings: Holding[];
  baseCurrency: BaseCurrency;
  fx: Record<string, number>;
  quoteUpdatedAt: string | null;
  savedAt: string;
}

export interface AggregatedHolding {
  ticker: string;
  name: string;
  currency: string;
  layer: Layer;
  theme: string;
  quantity: number;
  marketValueBase: number;
  weight: number;
  accounts: Holding[];
}

export interface ProcessingStatus {
  parsing: 'pending' | 'active' | 'done' | 'error';
  matching: 'pending' | 'active' | 'done' | 'error';
  quotes: 'pending' | 'active' | 'done' | 'error';
  message: string;
}
