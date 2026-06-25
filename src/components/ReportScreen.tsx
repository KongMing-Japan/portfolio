import { useMemo, useState, type FormEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Download,
  Layers3,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import {
  aggregateHoldings,
  concentrationLabel,
  concentrationScore,
  formatDateTime,
  formatMoney,
  formatPercent,
  LAYER_META,
} from '../lib/portfolio';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  ManualHoldingInput,
  PortfolioSnapshot,
} from '../types';

interface ReportScreenProps {
  holdings: Holding[];
  baseCurrency: BaseCurrency;
  fx: Record<string, number>;
  quoteUpdatedAt: string | null;
  onBaseCurrencyChange: (currency: BaseCurrency) => void;
  onReimport: () => void;
  onClear: () => void;
  onAddHolding: (input: ManualHoldingInput) => Promise<void>;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
  onRemoveHolding: (id: string) => Promise<void>;
}

type ExposureMode = 'currency' | 'theme' | 'broker';

const LAYERS = Object.keys(LAYER_META) as Layer[];
const CURRENCIES = ['USD', 'JPY', 'CNY', 'HKD'] as const;

const EMPTY_DRAFT: ManualHoldingInput = {
  ticker: '',
  name: '',
  broker: '',
  account: '',
  currency: 'USD',
  quantity: 0,
  averagePrice: 0,
  marketPrice: null,
  layer: 'Core',
  theme: '',
};

function downloadJson(
  holdings: Holding[],
  baseCurrency: BaseCurrency,
  fx: Record<string, number>,
  quoteUpdatedAt: string | null,
) {
  const snapshot: PortfolioSnapshot = {
    version: 1,
    holdings,
    baseCurrency,
    fx,
    quoteUpdatedAt,
    savedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `portfolio-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function groupExposure(
  holdings: Holding[],
  mode: ExposureMode,
  total: number,
) {
  const groups = new Map<string, number>();
  for (const holding of holdings) {
    const key =
      mode === 'currency'
        ? holding.currency
        : mode === 'theme'
          ? holding.theme || '未分类'
          : holding.broker || '未识别券商';
    groups.set(key, (groups.get(key) ?? 0) + (holding.valueInBase ?? 0));
  }
  return [...groups.entries()]
    .map(([label, value]) => ({
      label,
      value,
      weight: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function topHoldingsWithOther(aggregated: AggregatedHolding[]) {
  if (aggregated.length <= 8) return aggregated;
  const top = aggregated.slice(0, 8);
  const others = aggregated.slice(8);
  const otherValue = others.reduce(
    (sum, holding) => sum + holding.marketValueBase,
    0,
  );
  const otherWeight = others.reduce((sum, holding) => sum + holding.weight, 0);
  return [
    ...top,
    {
      ticker: 'OTHER',
      name: `其他 ${others.length} 项`,
      currency: '',
      layer: 'Defensive' as Layer,
      theme: '',
      quantity: 0,
      marketValueBase: otherValue,
      weight: otherWeight,
      accounts: [],
    },
  ];
}

function formatEditableNumber(value: number | null) {
  if (value == null) return '';
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function ReportScreen({
  holdings,
  baseCurrency,
  fx,
  quoteUpdatedAt,
  onBaseCurrencyChange,
  onReimport,
  onClear,
  onAddHolding,
  onUpdateHolding,
  onRemoveHolding,
}: ReportScreenProps) {
  const [exposureMode, setExposureMode] = useState<ExposureMode>('currency');
  const [holdingsOpen, setHoldingsOpen] = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ManualHoldingInput>(EMPTY_DRAFT);

  const aggregated = useMemo(() => aggregateHoldings(holdings), [holdings]);
  const total = useMemo(
    () => aggregated.reduce((sum, holding) => sum + holding.marketValueBase, 0),
    [aggregated],
  );
  const brokers = useMemo(
    () => new Set(holdings.map((holding) => holding.broker)).size,
    [holdings],
  );
  const layerRows = useMemo(
    () =>
      LAYERS.map((layer) => {
        const rows = aggregated.filter((holding) => holding.layer === layer);
        const value = rows.reduce(
          (sum, holding) => sum + holding.marketValueBase,
          0,
        );
        return {
          layer,
          rows,
          value,
          weight: total > 0 ? value / total : 0,
        };
      }),
    [aggregated, total],
  );
  const exposureRows = useMemo(
    () => groupExposure(holdings, exposureMode, total),
    [exposureMode, holdings, total],
  );
  const topRows = useMemo(() => topHoldingsWithOther(aggregated), [aggregated]);
  const topBarMax = useMemo(
    () => Math.max(...aggregated.slice(0, 8).map((holding) => holding.weight), 0.01),
    [aggregated],
  );
  const hhi = useMemo(() => concentrationScore(aggregated), [aggregated]);
  const largest = aggregated[0]?.weight ?? 0;
  const topFive = aggregated
    .slice(0, 5)
    .reduce((sum, holding) => sum + holding.weight, 0);

  const submitManualHolding = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.ticker.trim() || draft.quantity <= 0 || draft.averagePrice <= 0) {
      return;
    }
    await onAddHolding(draft);
    setDraft({ ...EMPTY_DRAFT, currency: baseCurrency === 'CNY' ? 'CNY' : 'USD' });
    setEditorOpen(false);
  };

  return (
    <main className="report-page">
      <header className="report-header">
        <button className="report-brand" onClick={onReimport}>
          Portfolio
        </button>
        <div className="report-actions">
          <label className="currency-select">
            <span className="visually-hidden">基准货币</span>
            <select
              value={baseCurrency}
              onChange={(event) =>
                onBaseCurrencyChange(event.target.value as BaseCurrency)
              }
            >
              <option value="JPY">JPY</option>
              <option value="USD">USD</option>
              <option value="CNY">CNY</option>
            </select>
          </label>
          <button
            className="header-button"
            onClick={() =>
              downloadJson(holdings, baseCurrency, fx, quoteUpdatedAt)
            }
          >
            <Download size={16} />
            导出
          </button>
          <button className="header-button" onClick={onReimport}>
            <RefreshCcw size={16} />
            重新导入
          </button>
        </div>
      </header>

      <div className="report-content">
        <div className="report-title-row">
          <div>
            <h1>我的投资组合</h1>
            <p>行情更新 {formatDateTime(quoteUpdatedAt)}</p>
          </div>
          <button
            className="finance-search-button"
            onClick={() => setEditorOpen(true)}
          >
            <Search size={18} />
            <span>搜索或添加股票代码</span>
            <Plus size={17} />
          </button>
        </div>

        <section className="summary-strip" aria-label="组合摘要">
          <div>
            <span>总资产</span>
            <strong>{formatMoney(total, baseCurrency)}</strong>
          </div>
          <div>
            <span>证券</span>
            <strong>{aggregated.length}</strong>
          </div>
          <div>
            <span>券商</span>
            <strong>{brokers}</strong>
          </div>
          <div>
            <span>行情更新</span>
            <strong>{formatDateTime(quoteUpdatedAt)}</strong>
          </div>
        </section>

        <section className="portfolio-editor-panel">
          <div className="editor-heading">
            <div>
              <h2>持仓管理</h2>
              <p>追加股票，或直接修改账户级数量、平均成本和当前价。</p>
            </div>
            <button
              className="editor-add-button"
              onClick={() => setEditorOpen((open) => !open)}
            >
              <Plus size={17} />
              添加持仓
            </button>
          </div>

          {editorOpen ? (
            <form className="manual-holding-form" onSubmit={submitManualHolding}>
              <label>
                <span>Ticker</span>
                <input
                  value={draft.ticker}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ticker: event.target.value,
                    }))
                  }
                  placeholder="AAPL / 7203.T"
                  required
                />
              </label>
              <label>
                <span>名称</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Apple"
                />
              </label>
              <label>
                <span>数量</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft.quantity || ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      quantity: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>平均成本</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft.averagePrice || ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      averagePrice: Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>当前价</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft.marketPrice ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      marketPrice:
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                    }))
                  }
                  placeholder="默认同平均成本"
                />
              </label>
              <label>
                <span>币种</span>
                <select
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>分层</span>
                <select
                  value={draft.layer}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      layer: event.target.value as Layer,
                    }))
                  }
                >
                  {LAYERS.map((layer) => (
                    <option key={layer} value={layer}>
                      {layer} · {LAYER_META[layer].label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>主题</span>
                <input
                  value={draft.theme}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      theme: event.target.value,
                    }))
                  }
                  placeholder="Technology"
                />
              </label>
              <label>
                <span>券商</span>
                <input
                  value={draft.broker}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      broker: event.target.value,
                    }))
                  }
                  placeholder="手动添加"
                />
              </label>
              <div className="manual-form-actions">
                <button type="button" onClick={() => setEditorOpen(false)}>
                  取消
                </button>
                <button type="submit">添加到组合</button>
              </div>
            </form>
          ) : null}

          <div className="editor-table-wrap">
            <table className="editor-table">
              <thead>
                <tr>
                  <th>证券</th>
                  <th>券商</th>
                  <th>分层</th>
                  <th className="numeric">数量</th>
                  <th className="numeric">平均成本</th>
                  <th className="numeric">当前价</th>
                  <th className="numeric">市值</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <EditableHoldingRow
                    key={holding.id}
                    holding={holding}
                    baseCurrency={baseCurrency}
                    onUpdate={onUpdateHolding}
                    onRemove={onRemoveHolding}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="allocation-section">
          <div className="section-heading">
            <h2>四层结构</h2>
          </div>
          <div className="allocation-bar" aria-label="四层资产结构">
            {layerRows.map((row) =>
              row.weight > 0 ? (
                <div
                  className={`allocation-segment ${
                    row.weight < 0.09 ? 'is-compact' : ''
                  }`}
                  key={row.layer}
                  style={{
                    width: `${row.weight * 100}%`,
                    background: LAYER_META[row.layer].color,
                  }}
                  title={`${LAYER_META[row.layer].label} ${formatPercent(row.weight)}`}
                >
                  {row.weight < 0.09 ? (
                    <span>
                      <b>{row.layer}</b> {formatPercent(row.weight)}
                    </span>
                  ) : (
                    <>
                      <span>
                        <b>{row.layer}</b> {LAYER_META[row.layer].label}
                      </span>
                      <strong>{formatPercent(row.weight)}</strong>
                    </>
                  )}
                </div>
              ) : null,
            )}
          </div>
          <div className="allocation-scale" aria-hidden="true">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </section>

        <div className="report-grid">
          <section className="report-panel layer-panel">
            <div className="section-heading">
              <h2>分层明细</h2>
            </div>
            <div className="table-labels">
              <span>层级</span>
              <span>资产（{baseCurrency}）</span>
              <span>占比</span>
            </div>
            {layerRows.map((row) => (
              <div className="layer-row" key={row.layer}>
                <div className="layer-name">
                  <span
                    className="layer-dot"
                    style={{ background: LAYER_META[row.layer].color }}
                  />
                  <div>
                    <strong>
                      {row.layer} {LAYER_META[row.layer].label}
                    </strong>
                    <span>{LAYER_META[row.layer].description}</span>
                  </div>
                </div>
                <strong className="numeric">
                  {formatMoney(row.value, baseCurrency)}
                </strong>
                <strong className="numeric">{formatPercent(row.weight)}</strong>
              </div>
            ))}
            <div className="layer-total">
              <strong>合计</strong>
              <strong>{formatMoney(total, baseCurrency)}</strong>
              <strong>100.0%</strong>
            </div>
          </section>

          <section className="report-panel top-panel">
            <div className="section-heading">
              <h2>Top Holdings</h2>
            </div>
            <div className="top-table-labels">
              <span>持仓</span>
              <span>市值（{baseCurrency}）</span>
              <span>占比</span>
            </div>
            <div className="ranked-bars">
              {topRows.map((holding, index) => (
                <div className="ranked-row" key={holding.ticker}>
                  <span className="rank">{index + 1}</span>
                  <span className="rank-name" title={holding.name}>
                    {holding.name}
                  </span>
                  <span className="bar-track">
                    <span
                      className={`bar-fill ${
                        holding.ticker === 'OTHER' ? 'is-other' : ''
                      }`}
                      style={{
                        width: `${Math.max(
                          Math.min((holding.weight / topBarMax) * 100, 100),
                          1.4,
                        )}%`,
                      }}
                    />
                  </span>
                  <strong>{formatMoney(holding.marketValueBase, baseCurrency)}</strong>
                  <strong>{formatPercent(holding.weight)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="report-panel exposure-panel">
            <div className="section-heading with-tabs">
              <h2>风险暴露</h2>
              <div className="tabs" role="tablist" aria-label="风险暴露维度">
                {[
                  ['currency', '币种'],
                  ['theme', '主题'],
                  ['broker', '券商'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={exposureMode === value ? 'is-active' : ''}
                    role="tab"
                    aria-selected={exposureMode === value}
                    onClick={() => setExposureMode(value as ExposureMode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="exposure-bars">
              {exposureRows.slice(0, 8).map((row) => (
                <div className="exposure-row" key={row.label}>
                  <span title={row.label}>{row.label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${row.weight * 100}%` }}
                    />
                  </div>
                  <strong>{formatMoney(row.value, baseCurrency)}</strong>
                  <strong>{formatPercent(row.weight)}</strong>
                </div>
              ))}
            </div>
            <div className="exposure-total">
              <strong>合计</strong>
              <strong>{formatMoney(total, baseCurrency)}</strong>
              <strong>100.0%</strong>
            </div>
          </section>

          <section className="report-panel health-panel">
            <div className="section-heading">
              <h2>结构体检</h2>
            </div>
            <div className="health-grid">
              <div className="health-metric">
                <Target size={31} />
                <span>最大持仓占比</span>
                <strong>{formatPercent(largest)}</strong>
                <p>
                  {largest <= 0.2
                    ? '单一持仓处于较克制区间。'
                    : '单一持仓对组合影响较大。'}
                </p>
              </div>
              <div className="health-metric">
                <Layers3 size={31} />
                <span>Top 5 合计占比</span>
                <strong>{formatPercent(topFive)}</strong>
                <p>
                  {topFive <= 0.6
                    ? '前五大持仓分布相对均衡。'
                    : '组合主要由前五大持仓驱动。'}
                </p>
              </div>
              <div className="health-metric">
                <CircleGauge size={31} />
                <span>集中度分数</span>
                <strong>{Math.round(hhi * 100)}</strong>
                <p>
                  {concentrationLabel(hhi)}，用于观察结构，不代表投资结论。
                </p>
              </div>
            </div>
            <p className="health-note">
              以上指标基于当前持仓市值计算，仅用于结构体检，不构成投资建议。
            </p>
          </section>
        </div>

        <section className="holdings-panel">
          <button
            className="holdings-summary"
            aria-expanded={holdingsOpen}
            onClick={() => setHoldingsOpen((open) => !open)}
          >
            <div>
              <strong>完整持仓</strong>
              <span>
                共 {aggregated.length} 只证券 · 市值 {formatMoney(total, baseCurrency)}
              </span>
            </div>
            {holdingsOpen ? <ChevronDown size={19} /> : <ChevronRight size={19} />}
          </button>
          {holdingsOpen ? (
            <div className="holdings-table-wrap">
              <table className="holdings-table">
                <thead>
                  <tr>
                    <th>证券</th>
                    <th>Ticker</th>
                    <th>分层</th>
                    <th>币种</th>
                    <th className="numeric">数量</th>
                    <th className="numeric">市值</th>
                    <th className="numeric">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((holding) => (
                    <HoldingsRow
                      key={holding.ticker}
                      holding={holding}
                      baseCurrency={baseCurrency}
                      expanded={expandedTicker === holding.ticker}
                      onToggle={() =>
                        setExpandedTicker((current) =>
                          current === holding.ticker ? null : holding.ticker,
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <footer className="report-footer">
          <a
            href="https://github.com/halftokyo/portfolio/blob/main/docs/methodology.zh.md"
            target="_blank"
            rel="noreferrer"
          >
            查看组合方法论
          </a>
          <button className="danger-link" onClick={onClear}>
            <Trash2 size={14} />
            清除全部本地数据
          </button>
        </footer>
      </div>
    </main>
  );
}

function HoldingsRow({
  holding,
  baseCurrency,
  expanded,
  onToggle,
}: {
  holding: AggregatedHolding;
  baseCurrency: BaseCurrency;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="holding-main-row" onClick={onToggle}>
        <td>
          <button className="holding-name-button">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <span>{holding.name}</span>
          </button>
        </td>
        <td>{holding.ticker}</td>
        <td>
          <span
            className="layer-tag"
            style={{
              color: LAYER_META[holding.layer].color,
              background: LAYER_META[holding.layer].pale,
            }}
          >
            {LAYER_META[holding.layer].label}
          </span>
        </td>
        <td>{holding.currency}</td>
        <td className="numeric">{holding.quantity.toLocaleString('zh-CN')}</td>
        <td className="numeric">
          {formatMoney(holding.marketValueBase, baseCurrency)}
        </td>
        <td className="numeric">{formatPercent(holding.weight)}</td>
      </tr>
      {expanded
        ? holding.accounts.map((account) => (
            <tr className="account-detail-row" key={account.id}>
              <td colSpan={2}>
                {account.broker}
                {account.account ? ` · ${account.account}` : ''}
              </td>
              <td>{account.theme}</td>
              <td>{account.currency}</td>
              <td className="numeric">{account.quantity.toLocaleString('zh-CN')}</td>
              <td className="numeric">
                {formatMoney(account.valueInBase ?? 0, baseCurrency)}
              </td>
              <td />
            </tr>
          ))
        : null}
    </>
  );
}

function EditableHoldingRow({
  holding,
  baseCurrency,
  onUpdate,
  onRemove,
}: {
  holding: Holding;
  baseCurrency: BaseCurrency;
  onUpdate: (id: string, patch: Partial<Holding>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <tr className="editor-row">
      <td>
        <div className="editor-security">
          <strong>{holding.ticker || holding.name}</strong>
          <span>{holding.name || holding.ticker}</span>
        </div>
      </td>
      <td>
        <div className="editor-broker">
          <strong>{holding.broker || '未识别券商'}</strong>
          <span>{holding.account || holding.sourceType}</span>
        </div>
      </td>
      <td>
        <select
          className="compact-select"
          value={holding.layer}
          onChange={(event) =>
            void onUpdate(holding.id, { layer: event.target.value as Layer })
          }
        >
          {LAYERS.map((layer) => (
            <option key={layer} value={layer}>
              {LAYER_META[layer].label}
            </option>
          ))}
        </select>
      </td>
      <td className="numeric">
        <input
          className="compact-number"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={holding.quantity}
          onChange={(event) =>
            void onUpdate(holding.id, { quantity: Number(event.target.value) })
          }
        />
      </td>
      <td className="numeric">
        <input
          className="compact-number"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={formatEditableNumber(holding.costPerUnit)}
          onChange={(event) =>
            void onUpdate(holding.id, {
              costPerUnit:
                event.target.value === '' ? null : Number(event.target.value),
            })
          }
        />
      </td>
      <td className="numeric">
        <input
          className="compact-number"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={formatEditableNumber(holding.marketPrice)}
          onChange={(event) =>
            void onUpdate(holding.id, {
              marketPrice:
                event.target.value === '' ? null : Number(event.target.value),
            })
          }
        />
      </td>
      <td className="numeric">
        <strong>{formatMoney(holding.valueInBase ?? 0, baseCurrency)}</strong>
        <span className="editor-currency">{holding.currency}</span>
      </td>
      <td className="numeric">
        <button
          className="row-delete"
          aria-label={`删除 ${holding.ticker || holding.name}`}
          onClick={() => void onRemove(holding.id)}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
