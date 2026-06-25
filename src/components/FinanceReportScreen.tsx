import { useMemo, useState, type FormEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Layers3,
  Plus,
  RefreshCcw,
  Search,
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

interface FinanceReportScreenProps {
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
  if (value == null || !Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function FinanceReportScreen({
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
}: FinanceReportScreenProps) {
  const [exposureMode, setExposureMode] = useState<ExposureMode>('currency');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ManualHoldingInput>({
    ...EMPTY_DRAFT,
    currency: baseCurrency === 'CNY' ? 'CNY' : 'USD',
  });

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
    () =>
      Math.max(...aggregated.slice(0, 8).map((holding) => holding.weight), 0.01),
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
    setAddOpen(false);
  };

  return (
    <main className="gf-page">
      <header className="gf-topbar">
        <button className="gf-brand" onClick={onReimport}>
          Portfolio
        </button>
        <button className="gf-search" onClick={() => setAddOpen(true)}>
          <Search size={18} />
          <span>Search or add stocks</span>
        </button>
        <div className="gf-top-actions">
          <label className="gf-currency">
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
            className="gf-icon-button"
            aria-label="导出 JSON"
            onClick={() =>
              downloadJson(holdings, baseCurrency, fx, quoteUpdatedAt)
            }
          >
            <Download size={18} />
          </button>
          <button
            className="gf-icon-button"
            aria-label="导入 CSV / 截图 / 粘贴"
            onClick={onReimport}
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <nav className="gf-nav" aria-label="Portfolio navigation">
        <a href="#portfolio" className="is-active">
          Portfolio
        </a>
        <a href="#holdings">Holdings</a>
        <a href="#allocation">Allocation</a>
        <a href="#exposure">Exposure</a>
      </nav>

      <div className="gf-shell" id="portfolio">
        <aside className="gf-left-rail" aria-label="Portfolio lists">
          <div className="gf-left-heading">
            <h2>Lists</h2>
            <button onClick={() => setAddOpen(true)} aria-label="添加列表项目">
              <Plus size={16} />
            </button>
          </div>
          <div className="gf-left-group">
            <h3>Portfolio</h3>
            <button className="is-selected">
              <span>All holdings</span>
              <strong>{formatMoney(total, baseCurrency)}</strong>
            </button>
            {layerRows.map((row) => (
              <button key={row.layer}>
                <span>{LAYER_META[row.layer].label}</span>
                <strong>{formatPercent(row.weight)}</strong>
              </button>
            ))}
          </div>
          <div className="gf-left-group">
            <h3>Top symbols</h3>
            {aggregated.slice(0, 8).map((holding) => (
              <button key={holding.ticker}>
                <span>{holding.ticker}</span>
                <strong>{formatPercent(holding.weight)}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="gf-main">
          <section className="gf-overview">
            <div className="gf-overview-top">
              <div>
                <h1>Portfolio</h1>
                <p>行情更新 {formatDateTime(quoteUpdatedAt)}</p>
              </div>
              <button className="gf-primary-action" onClick={() => setAddOpen(true)}>
                <Plus size={17} />
                添加股票
              </button>
            </div>
            <div className="gf-total-value">{formatMoney(total, baseCurrency)}</div>
            <div className="gf-stat-row">
              <span>{aggregated.length} securities</span>
              <span>{brokers} brokers</span>
              <span>Base {baseCurrency}</span>
              <span>{concentrationLabel(hhi)}</span>
            </div>
            <div className="gf-allocation-strip" aria-label="Portfolio allocation">
              {layerRows.map((row) =>
                row.weight > 0 ? (
                  <div
                    key={row.layer}
                    className="gf-allocation-segment"
                    style={{
                      width: `${row.weight * 100}%`,
                      background: LAYER_META[row.layer].color,
                    }}
                    title={`${LAYER_META[row.layer].label} ${formatPercent(row.weight)}`}
                  >
                    <span>{LAYER_META[row.layer].label}</span>
                    <strong>{formatPercent(row.weight)}</strong>
                  </div>
                ) : null,
              )}
            </div>
          </section>

          <section className="gf-section" id="holdings">
            <div className="gf-section-header">
              <h2>Your portfolio</h2>
              <button className="gf-text-action" onClick={() => setEditorOpen(true)}>
                管理账户明细
              </button>
            </div>
            <div className="gf-table-wrap">
              <table className="gf-holdings-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="numeric">Value</th>
                    <th className="numeric">Weight</th>
                    <th>Layer</th>
                    <th className="numeric">Qty</th>
                    <th className="numeric">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.map((holding) => (
                    <FinanceHoldingRow
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
          </section>

          <div className="gf-two-column" id="allocation">
            <section className="gf-section">
              <div className="gf-section-header">
                <h2>Top holdings</h2>
              </div>
              <div className="gf-ranked-list">
                {topRows.map((holding, index) => (
                  <div className="gf-ranked-row" key={holding.ticker}>
                    <span className="gf-rank">{index + 1}</span>
                    <span className="gf-ranked-name" title={holding.name}>
                      {holding.name}
                    </span>
                    <span className="gf-bar-track">
                      <span
                        className="gf-bar-fill"
                        style={{
                          width: `${Math.max(
                            Math.min((holding.weight / topBarMax) * 100, 100),
                            2,
                          )}%`,
                        }}
                      />
                    </span>
                    <strong>{formatPercent(holding.weight)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="gf-section">
              <div className="gf-section-header">
                <h2>Layers</h2>
              </div>
              <div className="gf-layer-list">
                {layerRows.map((row) => (
                  <div className="gf-layer-item" key={row.layer}>
                    <span
                      className="gf-layer-dot"
                      style={{ background: LAYER_META[row.layer].color }}
                    />
                    <div>
                      <strong>{LAYER_META[row.layer].label}</strong>
                      <span>{LAYER_META[row.layer].description}</span>
                    </div>
                    <b>{formatPercent(row.weight)}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="gf-section" id="exposure">
            <div className="gf-section-header">
              <h2>Exposure</h2>
              <div className="gf-tabs" role="tablist" aria-label="风险暴露维度">
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
            <div className="gf-exposure-list">
              {exposureRows.slice(0, 8).map((row) => (
                <div className="gf-exposure-row" key={row.label}>
                  <span title={row.label}>{row.label}</span>
                  <div className="gf-bar-track">
                    <div
                      className="gf-bar-fill"
                      style={{ width: `${row.weight * 100}%` }}
                    />
                  </div>
                  <strong>{formatPercent(row.weight)}</strong>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="gf-sidebar">
          <section className="gf-side-card">
            <div className="gf-side-title">
              <Layers3 size={18} />
              <h2>Manage portfolio</h2>
            </div>
            <button className="gf-side-action" onClick={() => setAddOpen(true)}>
              <Plus size={17} />
              添加股票
            </button>
            <button className="gf-side-action" onClick={onReimport}>
              <RefreshCcw size={17} />
              上传 CSV / 截图 / 粘贴
            </button>
            <button
              className="gf-side-action"
              onClick={() => setEditorOpen((open) => !open)}
            >
              <ChevronRight size={17} />
              修改数量和平均成本
            </button>
          </section>

          <section className="gf-side-card">
            <h2>Structure health</h2>
            <div className="gf-health-line">
              <span>最大持仓</span>
              <strong>{formatPercent(largest)}</strong>
            </div>
            <div className="gf-health-line">
              <span>Top 5</span>
              <strong>{formatPercent(topFive)}</strong>
            </div>
            <div className="gf-health-line">
              <span>集中度分数</span>
              <strong>{Math.round(hhi * 100)}</strong>
            </div>
            <p>仅用于组合结构体检，不提供买卖建议。</p>
          </section>

          <section className="gf-side-card">
            <h2>Shortcuts</h2>
            <a
              href="https://github.com/halftokyo/portfolio/blob/main/docs/methodology.zh.md"
              target="_blank"
              rel="noreferrer"
            >
              查看组合方法论
            </a>
            <button
              className="gf-danger-action"
              onClick={onClear}
            >
              <Trash2 size={15} />
              清除全部本地数据
            </button>
          </section>
        </aside>
      </div>

      {addOpen ? (
        <div className="gf-modal-backdrop" role="presentation">
          <form className="gf-add-modal" onSubmit={submitManualHolding}>
            <div className="gf-modal-header">
              <h2>添加股票</h2>
              <button type="button" onClick={() => setAddOpen(false)}>
                取消
              </button>
            </div>
            <div className="gf-add-grid">
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
                      {LAYER_META[layer].label}
                    </option>
                  ))}
                </select>
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
            </div>
            <button className="gf-submit" type="submit">
              添加到组合
            </button>
          </form>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="gf-modal-backdrop" role="presentation">
          <section className="gf-editor-modal">
            <div className="gf-modal-header">
              <div>
                <h2>账户明细</h2>
                <p>修改账户级数量、平均成本和当前价。</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)}>
                完成
              </button>
            </div>
            <div className="gf-editor-table-wrap">
              <table className="gf-editor-table">
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
        </div>
      ) : null}
    </main>
  );
}

function FinanceHoldingRow({
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
  const firstAccount = holding.accounts[0];
  return (
    <>
      <tr className="gf-symbol-row" onClick={onToggle}>
        <td>
          <button className="gf-symbol-cell">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="gf-symbol-logo">{holding.ticker.slice(0, 1)}</span>
            <span>
              <strong>{holding.ticker}</strong>
              <small>{holding.name}</small>
            </span>
          </button>
        </td>
        <td className="numeric">{formatMoney(holding.marketValueBase, baseCurrency)}</td>
        <td className="numeric gf-positive">{formatPercent(holding.weight)}</td>
        <td>
          <span
            className="gf-layer-chip"
            style={{
              color: LAYER_META[holding.layer].color,
              background: LAYER_META[holding.layer].pale,
            }}
          >
            {LAYER_META[holding.layer].label}
          </span>
        </td>
        <td className="numeric">{holding.quantity.toLocaleString('zh-CN')}</td>
        <td className="numeric">
          {firstAccount?.marketPrice == null
            ? '—'
            : formatMoney(firstAccount.marketPrice, holding.currency)}
        </td>
      </tr>
      {expanded
        ? holding.accounts.map((account) => (
            <tr className="gf-account-row" key={account.id}>
              <td colSpan={2}>
                {account.broker}
                {account.account ? ` · ${account.account}` : ''}
              </td>
              <td className="numeric">{formatPercent((account.valueInBase ?? 0) / Math.max(holding.marketValueBase, 1))}</td>
              <td>{account.theme || '未分类'}</td>
              <td className="numeric">{account.quantity.toLocaleString('zh-CN')}</td>
              <td className="numeric">
                {formatMoney(account.valueInBase ?? 0, baseCurrency)}
              </td>
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
    <tr className="gf-editor-row">
      <td>
        <div className="gf-editor-security">
          <strong>{holding.ticker || holding.name}</strong>
          <span>{holding.name || holding.ticker}</span>
        </div>
      </td>
      <td>
        <div className="gf-editor-security">
          <strong>{holding.broker || '未识别券商'}</strong>
          <span>{holding.account || holding.sourceType}</span>
        </div>
      </td>
      <td>
        <select
          className="gf-compact-select"
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
          className="gf-compact-number"
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
          className="gf-compact-number"
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
          className="gf-compact-number"
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
        <span className="gf-editor-currency">{holding.currency}</span>
      </td>
      <td className="numeric">
        <button
          className="gf-row-delete"
          aria-label={`删除 ${holding.ticker || holding.name}`}
          onClick={() => void onRemove(holding.id)}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
