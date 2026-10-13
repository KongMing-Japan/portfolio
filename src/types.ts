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

export interface LayerTargetConfig {
  Core: number;
  Satellite: number;
  Defensive: number;
  Cash: number;
}

export interface RebalanceSettings {
  targets: LayerTargetConfig;
  singleSecurityCap: number;
  singleThemeCap: number;
  toleranceBandAbsolute: number;
  toleranceBandRelative: number;
}

export type DriftStatus = 'ok' | 'under' | 'over';

export interface LayerDriftInfo {
  layer: Layer;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  driftAbsolute: number;
  driftRelative: number;
  status: DriftStatus;
  valueDelta: number;
}

export interface RebalanceTradeItem {
  ticker: string;
  name: string;
  layer: Layer;
  broker: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  currentShares: number;
  suggestedShares: number;
  currentWeight: number;
  projectedWeight: number;
  priceInBase: number;
  amountInBase: number;
  currency: string;
  priceInCurrency: number | null;
  urgency: 'high' | 'medium' | 'low';
  reason: string;
}

export interface InflowRebalanceResult {
  inflowAmount: number;
  projectedTotal: number;
  trades: RebalanceTradeItem[];
  projectedLayerWeights: Record<Layer, number>;
  unallocatedCash: number;
}

export interface FullRebalanceResult {
  currentTotal: number;
  trades: RebalanceTradeItem[];
  totalSellAmount: number;
  totalBuyAmount: number;
  turnoverRate: number;
  projectedLayerWeights: Record<Layer, number>;
}

export interface ReviewJournalNote {
  summary?: string;
  disciplineChecks?: {
    singleHoldingUnderCap: boolean;
    singleThemeUnderCap: boolean;
    cashReserveAdequate: boolean;
  };
  bestDecision?: string;
  worstDecision?: string;
  nextQuarterPlan?: string;
}

export interface ReviewSnapshot {
  id: string;
  label: string;
  createdAt: string;
  baseCurrency: BaseCurrency;
  totalValueBase: number;
  holdings: Holding[];
  layerWeights: Record<Layer, number>;
  hhiScore: number;
  notes?: ReviewJournalNote;
}

export interface SnapshotDiffItem {
  ticker: string;
  name: string;
  layer: Layer;
  sharesBefore: number;
  sharesAfter: number;
  sharesDelta: number;
  valueBefore: number;
  valueAfter: number;
  valueDelta: number;
  weightBefore: number;
  weightAfter: number;
  weightDelta: number;
}

export interface SnapshotDiffResult {
  totalBefore: number;
  totalAfter: number;
  totalDelta: number;
  totalDeltaPercent: number;
  layerDiffs: Record<Layer, { before: number; after: number; delta: number }>;
  items: SnapshotDiffItem[];
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
