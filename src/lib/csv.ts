import Papa from 'papaparse';
import type { Holding } from '../types';
import {
  makeId,
  marketFromTicker,
  normalizeLayer,
} from './portfolio';

const FIELD_ALIASES = {
  broker: ['broker', '券商', '证券公司', '證券公司', 'ブローカー', '証券会社'],
  account: ['account', '账户', '帳戶', '账号', '口座'],
  name: ['holding', 'name', 'security', '证券名称', '證券名稱', '持仓', '銘柄', '商品'],
  ticker: ['ticker', 'symbol', '代码', '代碼', '证券代码', '銘柄コード'],
  theme: ['theme', '主题', '主題', 'テーマ'],
  layer: ['type', 'layer', 'role', 'category', '类型', '類型', '分层', 'レイヤー'],
  targetWeight: ['target %', 'targetweight', 'target weight', '目标占比', '目標比率'],
  currency: ['currency', '币种', '幣種', '通貨'],
  quantity: ['shares', 'quantity', 'qty', '数量', '數量', '持有数量', '保有数量'],
  cost: ['buy price', 'cost_per_unit', 'cost', '买入价', '成本价', '取得単価'],
  marketPrice: ['market price', 'current price', '现价', '現在値', '市价'],
  marketValue: ['market value', 'value', '市值', '評価額', '资产'],
  thesis: ['investment thesis', 'thesis', '投资逻辑', '投資理由'],
} as const;

type FieldName = keyof typeof FIELD_ALIASES;
type CsvRow = Record<string, string | number | null | undefined>;

const normalizedAliasMap = new Map<string, FieldName>();
for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [
  FieldName,
  readonly string[],
][]) {
  for (const alias of aliases) normalizedAliasMap.set(normalizeHeader(alias), field);
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function parseNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const normalized = String(value)
    .trim()
    .replace(/[,\s]/g, '')
    .replace(/[¥$￥元]/g, '')
    .replace(/%$/, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRow(row: CsvRow) {
  const output: Partial<Record<FieldName, unknown>> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = normalizedAliasMap.get(normalizeHeader(key));
    if (field) output[field] = value;
  }
  return output;
}

function rowToHolding(row: CsvRow, sourceName: string): Holding | null {
  const normalized = normalizeRow(row);
  const ticker = String(normalized.ticker ?? '').trim();
  const name = String(normalized.name ?? ticker).trim();
  if (!ticker && !name) return null;

  const quantity = parseNumber(normalized.quantity);
  const currency = String(normalized.currency ?? '').trim().toUpperCase();
  const costPerUnit = parseNumber(normalized.cost);
  const importedMarketValue = parseNumber(normalized.marketValue);
  const marketPrice = parseNumber(normalized.marketPrice);
  const theme = String(normalized.theme ?? '').trim() || '未分类';
  const broker = String(normalized.broker ?? '').trim() || sourceName;
  const reviewReasons: string[] = [];

  if (!ticker) reviewReasons.push('缺少证券代码');
  if (!currency) reviewReasons.push('缺少币种');
  if (quantity == null || quantity < 0) reviewReasons.push('数量异常');

  return {
    id: makeId(),
    ticker,
    name: name || ticker || '未命名证券',
    broker,
    account: String(normalized.account ?? '').trim(),
    market: marketFromTicker(ticker),
    currency: currency || 'JPY',
    quantity: quantity ?? 0,
    costPerUnit,
    importedMarketValue,
    marketPrice,
    marketValue:
      marketPrice != null && quantity != null
        ? marketPrice * quantity
        : importedMarketValue,
    valueInBase: null,
    layer: normalizeLayer(
      String(normalized.layer ?? ''),
      ticker,
      name,
      theme,
    ),
    theme,
    sourceType: 'csv',
    confidence: reviewReasons.length ? 0.65 : 1,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    targetWeight:
      parseNumber(normalized.targetWeight) == null
        ? null
        : (parseNumber(normalized.targetWeight) ?? 0) / 100,
    investmentThesis: String(normalized.thesis ?? '').trim(),
  };
}

export function parseHoldingsCsv(text: string, sourceName = 'CSV 导入') {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  });
  if (result.errors.length && result.data.length === 0) {
    throw new Error(result.errors[0]?.message ?? 'CSV 无法解析');
  }
  return result.data
    .map((row) => rowToHolding(row, sourceName))
    .filter((holding): holding is Holding => holding != null);
}

export async function parseCsvFile(file: File) {
  return parseHoldingsCsv(await file.text(), file.name.replace(/\.csv$/i, ''));
}

export function markDuplicates(holdings: Holding[]) {
  const keys = new Map<string, number>();
  for (const item of holdings) {
    const key = [
      item.broker,
      item.account,
      item.ticker,
      item.quantity,
      item.costPerUnit ?? '',
    ].join('|');
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  return holdings.map((item) => {
    const key = [
      item.broker,
      item.account,
      item.ticker,
      item.quantity,
      item.costPerUnit ?? '',
    ].join('|');
    if ((keys.get(key) ?? 0) < 2) return item;
    const reasons = item.reviewReasons.includes('可能重复导入')
      ? item.reviewReasons
      : [...item.reviewReasons, '可能重复导入'];
    return { ...item, needsReview: true, reviewReasons: reasons };
  });
}
