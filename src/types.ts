export type Layer = 'Core' | 'Satellite' | 'Defensive' | 'Cash';
export type SourceType = 'csv' | 'image' | 'json' | 'manual';
export type BaseCurrency = 'JPY' | 'USD' | 'CNY';
export type AppStep = 'upload' | 'processing' | 'review' | 'report';
export type Locale = 'zh' | 'ja' | 'en';

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

export interface ManualHoldingInput {
  ticker: string;
  name: string;
  broker: string;
  account: string;
  currency: string;
  quantity: number;
  averagePrice: number;
  marketPrice: number | null;
  layer: Layer;
  theme: string;
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

export type SuperinvestorHoldingStatus =
  | 'new'
  | 'increased'
  | 'decreased'
  | 'unchanged'
  | 'exited';

export interface SuperinvestorHolding {
  cusip: string;
  ticker: string;
  issuer: string;
  classTitle: string;
  value: number;
  shares: number;
  weight: number;
  status: SuperinvestorHoldingStatus;
  sharesChange: number;
  weightChange: number;
}

export interface SuperinvestorMove {
  ticker: string;
  issuer: string;
  status: SuperinvestorHoldingStatus;
  weightChange: number;
}

export interface Superinvestor {
  id: string;
  name: string;
  firm: string;
  cik: string;
  portrait: string;
  accent: string;
  secEntityUrl: string;
  reportDate: string;
  filedAt: string;
  previousReportDate: string;
  filingUrl: string;
  totalValue: number;
  totalValueChange: number | null;
  positionCount: number;
  holdings: SuperinvestorHolding[];
  topMoves: SuperinvestorMove[];
}

export interface SuperinvestorData {
  version: 1;
  source: string;
  sourceUpdatedAt: string;
  caveat: string;
  investors: Superinvestor[];
}
