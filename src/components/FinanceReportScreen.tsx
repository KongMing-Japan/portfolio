import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Layers3,
  PieChart,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
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
import { LifeOsNextSteps } from './LifeOsNextSteps';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  Locale,
  ManualHoldingInput,
  PortfolioSnapshot,
} from '../types';

const SuperinvestorsScreen = lazy(() =>
  import('./SuperinvestorsScreen').then((module) => ({
    default: module.SuperinvestorsScreen,
  })),
);

interface FinanceReportScreenProps {
  holdings: Holding[];
  baseCurrency: BaseCurrency;
  fx: Record<string, number>;
  quoteUpdatedAt: string | null;
  locale: Locale;
  hasSavedPortfolio: boolean;
  onLocaleChange: (locale: Locale) => void;
  onClear: () => void;
  onAddHolding: (input: ManualHoldingInput) => Promise<void>;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
  onRemoveHolding: (id: string) => Promise<void>;
  onFiles: (files: File[]) => void;
  onJsonImport: (file: File) => Promise<void>;
  onManualImport: (text: string) => Promise<void>;
  onSample: () => void;
  onResume: () => void;
}

type ExposureMode = 'currency' | 'theme' | 'broker';
type ImportMode = 'upload' | 'paste';
type WorkspaceView = 'portfolio' | 'superinvestors';

const LAYERS = Object.keys(LAYER_META) as Layer[];
const CURRENCIES = ['USD', 'JPY', 'CNY', 'HKD'] as const;
const ACCEPTED = '.csv,.png,.jpg,.jpeg,.webp';

const COPY: Record<Locale, Record<string, string>> = {
  zh: {
    search: '搜索或添加股票',
    lists: '列表',
    portfolio: 'Portfolio',
    superinvestors: '投资大师',
    holdings: '持仓',
    allocation: '结构',
    exposure: '暴露',
    allHoldings: '全部持仓',
    layers: '分层',
    topSymbols: '主要证券',
    updated: '行情更新',
    noUpdate: '未更新',
    addStock: '添加股票',
    securities: '只证券',
    securitySingular: '只证券',
    brokers: '个券商',
    brokerSingular: '个券商',
    base: '基准',
    yourPortfolio: '我的持仓',
    manageAccounts: '管理账户明细',
    symbol: 'Symbol',
    value: 'Value',
    weight: 'Weight',
    layer: 'Layer',
    qty: 'Qty',
    price: 'Price',
    topHoldings: '主要持仓',
    managePortfolio: '管理组合',
    importPositions: '上传 CSV / 截图 / 粘贴',
    editCost: '修改数量和平均成本',
    structureHealth: '结构体检',
    largest: '最大持仓',
    top5: 'Top 5',
    concentration: '集中度分数',
    healthNote: '仅用于组合结构体检，不提供买卖建议。',
    shortcuts: '快捷入口',
    methodology: '查看组合方法论',
    clear: '清除全部本地数据',
    importTitle: '导入持仓',
    uploadFile: '上传文件',
    paste: '手写 / 粘贴',
    drop: '拖入 CSV 或截图',
    choose: '选择文件',
    sample: '使用 Berkshire 示例',
    json: '导入 Portfolio JSON',
    resume: '打开已保存组合',
    pasteHint: '支持 CSV 表头，也支持一行一个简写：Ticker, 名称, 币种, 数量, 价格, 券商, 分层, 主题',
    generate: '生成 dashboard',
    cancel: '取消',
    done: '完成',
    accountDetails: '账户明细',
    editDetails: '修改账户级数量、平均成本和当前价。',
    emptyTitle: '还没有持仓',
    emptyBody: '从右侧导入 CSV、截图或粘贴数据，dashboard 会直接在这里生成。',
    other: '其他',
    exportJson: '导出 JSON',
    exposureDimension: '风险暴露维度',
    delete: '删除',
    name: '名称',
    quantity: '数量',
    averageCost: '平均成本',
    currentPrice: '当前价',
    currency: '币种',
    broker: '券商',
    manual: '手动添加',
    defaultAverageCost: '默认同平均成本',
  },
  ja: {
    search: '銘柄を検索または追加',
    lists: 'リスト',
    portfolio: 'ポートフォリオ',
    superinvestors: '著名投資家',
    holdings: '保有銘柄',
    allocation: '配分',
    exposure: 'エクスポージャー',
    allHoldings: 'すべての保有',
    layers: 'レイヤー',
    topSymbols: '主要銘柄',
    updated: '更新',
    noUpdate: '未更新',
    addStock: '銘柄を追加',
    securities: '銘柄',
    securitySingular: '銘柄',
    brokers: '証券会社',
    brokerSingular: '証券会社',
    base: '基準',
    yourPortfolio: 'ポートフォリオ',
    manageAccounts: '口座明細を編集',
    symbol: '銘柄',
    value: '評価額',
    weight: '比率',
    layer: '分類',
    qty: '数量',
    price: '価格',
    topHoldings: '上位保有',
    managePortfolio: 'ポートフォリオ管理',
    importPositions: 'CSV / 画像 / 貼り付け',
    editCost: '数量と平均単価を編集',
    structureHealth: '構造チェック',
    largest: '最大保有',
    top5: '上位5銘柄',
    concentration: '集中度',
    healthNote: '構造確認のみで、売買助言ではありません。',
    shortcuts: 'ショートカット',
    methodology: '方法論を見る',
    clear: 'ローカルデータを削除',
    importTitle: '保有データを取り込む',
    uploadFile: 'ファイル',
    paste: '入力 / 貼り付け',
    drop: 'CSVまたは画像をドロップ',
    choose: 'ファイルを選択',
    sample: 'Berkshireサンプル',
    json: 'Portfolio JSONを取り込む',
    resume: '保存済みを開く',
    pasteHint: 'CSVヘッダー、または1行形式：Ticker, 名前, 通貨, 数量, 価格, 証券会社, 分類, テーマ',
    generate: 'Dashboardを生成',
    cancel: 'キャンセル',
    done: '完了',
    accountDetails: '口座明細',
    editDetails: '口座ごとの数量、平均単価、現在価格を編集します。',
    emptyTitle: '保有データがありません',
    emptyBody: '右側からCSV、画像、貼り付けで取り込むと、ここにdashboardが生成されます。',
    other: 'その他',
    exportJson: 'JSONを書き出す',
    exposureDimension: 'エクスポージャー分類',
    delete: '削除',
    name: '名称',
    quantity: '数量',
    averageCost: '平均単価',
    currentPrice: '現在価格',
    currency: '通貨',
    broker: '証券会社',
    manual: '手動追加',
    defaultAverageCost: '平均単価と同じ',
  },
  en: {
    search: 'Search or add a security',
    lists: 'Lists',
    portfolio: 'Portfolio',
    superinvestors: 'Superinvestors',
    holdings: 'Holdings',
    allocation: 'Allocation',
    exposure: 'Exposure',
    allHoldings: 'All holdings',
    layers: 'Layers',
    topSymbols: 'Top symbols',
    updated: 'Market data',
    noUpdate: 'Not updated',
    addStock: 'Add stock',
    securities: 'securities',
    securitySingular: 'security',
    brokers: 'brokers',
    brokerSingular: 'broker',
    base: 'Base',
    yourPortfolio: 'Your portfolio',
    manageAccounts: 'Edit positions',
    symbol: 'Symbol',
    value: 'Value',
    weight: 'Weight',
    layer: 'Layer',
    qty: 'Qty',
    price: 'Price',
    topHoldings: 'Top holdings',
    managePortfolio: 'Manage portfolio',
    importPositions: 'Import positions',
    editCost: 'Edit shares and cost basis',
    structureHealth: 'Structure health',
    largest: 'Largest holding',
    top5: 'Top 5',
    concentration: 'Concentration score',
    healthNote: 'For portfolio structure only. Not investment advice.',
    shortcuts: 'Shortcuts',
    methodology: 'View methodology',
    clear: 'Clear all local data',
    importTitle: 'Import positions',
    uploadFile: 'Upload files',
    paste: 'Type / paste',
    drop: 'Drop CSV files or screenshots here',
    choose: 'Choose files',
    sample: 'Use Berkshire sample',
    json: 'Import Portfolio JSON',
    resume: 'Open saved portfolio',
    pasteHint: 'CSV headers supported, or one line each: Ticker, Name, Currency, Quantity, Price, Broker, Layer, Theme',
    generate: 'Generate dashboard',
    cancel: 'Cancel',
    done: 'Done',
    accountDetails: 'Account details',
    editDetails: 'Edit account-level quantity, average cost, and current price.',
    emptyTitle: 'No holdings yet',
    emptyBody: 'Import a CSV, screenshot, or pasted list to build your portfolio dashboard.',
    other: 'Other',
    exportJson: 'Export JSON',
    exposureDimension: 'Exposure dimension',
    delete: 'Delete',
    name: 'Name',
    quantity: 'Quantity',
    averageCost: 'Average cost',
    currentPrice: 'Current price',
    currency: 'Currency',
    broker: 'Broker',
    manual: 'Manual',
    defaultAverageCost: 'Defaults to average cost',
  },
};

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
          ? holding.theme || 'Uncategorized'
          : holding.broker || 'Unknown broker';
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

function topHoldingsWithOther(aggregated: AggregatedHolding[], otherLabel: string) {
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
      name: `${otherLabel} (${others.length})`,
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
  locale,
  hasSavedPortfolio,
  onLocaleChange,
  onClear,
  onAddHolding,
  onUpdateHolding,
  onRemoveHolding,
  onFiles,
  onJsonImport,
  onManualImport,
  onSample,
  onResume,
}: FinanceReportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [exposureMode, setExposureMode] = useState<ExposureMode>('currency');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('upload');
  const [dragging, setDragging] = useState(false);
  const [manualText, setManualText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() =>
    window.location.hash.startsWith('#superinvestors')
      ? 'superinvestors'
      : 'portfolio',
  );
  const [draft, setDraft] = useState<ManualHoldingInput>({
    ...EMPTY_DRAFT,
    currency: baseCurrency === 'CNY' ? 'CNY' : 'USD',
  });
  const t = COPY[locale];

  useEffect(() => {
    const syncHash = () => {
      setWorkspaceView(
        window.location.hash.startsWith('#superinvestors')
          ? 'superinvestors'
          : 'portfolio',
      );
    };
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

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
  const themeRows = useMemo(
    () => groupExposure(holdings, 'theme', total),
    [holdings, total],
  );
  const topRows = useMemo(
    () => topHoldingsWithOther(aggregated, t.other),
    [aggregated, t.other],
  );
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

  const rebalancingSignals = useMemo(() => {
    const list: Array<{ type: 'warning' | 'info' | 'success'; title: string; detail: string }> = [];
    if (!aggregated.length) return list;

    const topHolding = aggregated[0];
    if (topHolding && topHolding.weight > 0.20) {
      list.push({
        type: 'warning',
        title: locale === 'zh' ? `持仓过重: ${topHolding.ticker || topHolding.name} (${(topHolding.weight * 100).toFixed(1)}%)` : `High Concentration: ${topHolding.ticker || topHolding.name} (${(topHolding.weight * 100).toFixed(1)}%)`,
        detail: locale === 'zh' ? '单一标的打破机构风控上限 (20%)，建议分批减仓锁定阶段收益。' : 'Single position exceeds institutional risk limit (20%). Consider rebalancing.',
      });
    }

    const coreLayer = layerRows.find((r) => r.layer === 'Core');
    const coreWeight = coreLayer?.weight ?? 0;
    if (coreWeight < 0.40) {
      list.push({
        type: 'warning',
        title: locale === 'zh' ? `大盘基石偏低: Core 核心仓 (${(coreWeight * 100).toFixed(1)}%)` : `Core Foundation Low: ${(coreWeight * 100).toFixed(1)}%`,
        detail: locale === 'zh' ? '机构标准宽基指数（如 S&P 500/VTI）建议占 50%-60%。抗波动能力偏弱。' : 'Institutional baseline recommends 50-60% in broad index ETFs for lower volatility.',
      });
    } else {
      list.push({
        type: 'success',
        title: locale === 'zh' ? `核心资产结构稳健 (Core ${(coreWeight * 100).toFixed(1)}%)` : `Robust Core Allocation (${(coreWeight * 100).toFixed(1)}%)`,
        detail: locale === 'zh' ? '符合长期机构大盘配比基准，基石仓位充足。' : 'Meets long-term institutional allocation benchmarks.',
      });
    }

    const themeRows = groupExposure(holdings, 'theme', total);
    const topTheme = themeRows[0];
    if (topTheme && topTheme.label !== '未分类' && topTheme.label !== 'Uncategorized' && topTheme.weight > 0.40) {
      list.push({
        type: 'info',
        title: locale === 'zh' ? `赛道敞口预警: ${topTheme.label} (${(topTheme.weight * 100).toFixed(1)}%)` : `Theme Exposure: ${topTheme.label} (${(topTheme.weight * 100).toFixed(1)}%)`,
        detail: locale === 'zh' ? '单一赛道暴露过高，建议适度做跨行业分散调仓。' : 'High thematic concentration. Consider diversifying across uncorrelated sectors.',
      });
    }

    return list;
  }, [aggregated, holdings, layerRows, locale, total]);

  const submitManualHolding = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.ticker.trim() || draft.quantity <= 0 || draft.averagePrice <= 0) {
      return;
    }
    await onAddHolding(draft);
    setDraft({ ...EMPTY_DRAFT, currency: baseCurrency === 'CNY' ? 'CNY' : 'USD' });
    setAddOpen(false);
  };

  const processFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const valid = files.filter((file) =>
      /\.(csv|png|jpe?g|webp)$/i.test(file.name),
    );
    if (valid.length !== files.length) {
      setLocalError('Only CSV, PNG, JPG and WebP files are supported.');
      return;
    }
    setLocalError(null);
    onFiles(valid);
  };

  const importManualText = async () => {
    try {
      setLocalError(null);
      await onManualImport(manualText);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Import failed');
    }
  };

  const importJsonFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLocalError(null);
      await onJsonImport(file);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'JSON import failed');
    }
  };

  const openWorkspace = (view: WorkspaceView, section?: string) => {
    setWorkspaceView(view);
    if (view === 'superinvestors') {
      window.location.hash = 'superinvestors';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = section || 'portfolio';
    window.location.hash = target;
    window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  return (
    <main className="gf-page">
      <header className="gf-topbar">
        <button
          className="gf-brand"
          onClick={() => {
            setImportOpen(false);
            openWorkspace('portfolio');
          }}
        >
          LifeOS Portfolio
        </button>
        <button className="gf-search" onClick={() => setAddOpen(true)}>
          <Search size={18} />
          <span>{t.search}</span>
        </button>
        <div className="gf-top-actions">
          <label className="gf-language">
            <span className="visually-hidden">Language</span>
            <select
              value={locale}
              onChange={(event) => onLocaleChange(event.target.value as Locale)}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
            </select>
          </label>
          <button
            className="gf-icon-button"
            aria-label={t.exportJson}
            onClick={() =>
              downloadJson(holdings, baseCurrency, fx, quoteUpdatedAt)
            }
          >
            <Download size={18} />
          </button>
          <button
            className="gf-icon-button"
            aria-label={t.importPositions}
            onClick={() => setImportOpen(true)}
          >
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      <div className="gf-shell" id="portfolio">
        <section className="gf-main">
          <section className="gf-overview">
            <div className="gf-overview-top">
              <div>
                <h1>{t.portfolio}</h1>
                <p>{t.updated} {quoteUpdatedAt ? formatDateTime(quoteUpdatedAt) : t.noUpdate}</p>
              </div>
              <button className="gf-primary-action" onClick={() => setAddOpen(true)}>
                <Plus size={17} />
                {t.addStock}
              </button>
            </div>
            <div className="gf-total-value">{formatMoney(total, baseCurrency)}</div>
            <div className="gf-stat-row">
              <span>
                {aggregated.length}{' '}
                {aggregated.length === 1 ? t.securitySingular : t.securities}
              </span>
              <span>{brokers} {brokers === 1 ? t.brokerSingular : t.brokers}</span>
              <span>{t.base} {baseCurrency}</span>
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
              <h2>{t.yourPortfolio}</h2>
              <button className="gf-text-action" onClick={() => setEditorOpen(true)}>
                {t.manageAccounts}
              </button>
            </div>
            <div className="gf-table-wrap">
              <table className="gf-holdings-table">
                <thead>
                  <tr>
                    <th>{t.symbol}</th>
                    <th className="numeric">{t.value}</th>
                    <th className="numeric">{t.weight}</th>
                    <th>{t.layer}</th>
                    <th className="numeric">{t.qty}</th>
                    <th className="numeric">{t.price}</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.length ? (
                    aggregated.map((holding) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="gf-empty-state">
                          <strong>{t.emptyTitle}</strong>
                          <span>{t.emptyBody}</span>
                          <button onClick={() => setImportOpen(true)}>
                            <Upload size={16} />
                            {t.importPositions}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </section>

        <aside className="gf-sidebar">
          <section className="gf-side-card">
            <div className="gf-side-title">
              <Layers3 size={18} />
              <h2>{locale === 'zh' ? '四层资产配比与目标偏离' : locale === 'en' ? 'Layer Allocation & Target Status' : '層別配分と目標偏離'}</h2>
            </div>
            <p style={{ margin: '0.2rem 0 0.8rem', fontSize: '0.78rem', color: '#64748b' }}>
              {locale === 'zh' ? '机构风控基准偏离度 (红/黄/绿状态标注)' : 'Institutional benchmark deviation status'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {layerRows.map((row) => {
                let status: 'ok' | 'under' | 'over' = 'ok';
                let minTarget = 0.50;
                let maxTarget = 0.60;
                let targetText = '50-60%';

                if (row.layer === 'Satellite') {
                  minTarget = 0.20;
                  maxTarget = 0.30;
                  targetText = '20-30%';
                } else if (row.layer === 'Defensive') {
                  minTarget = 0.10;
                  maxTarget = 0.15;
                  targetText = '10-15%';
                } else if (row.layer === 'Cash') {
                  minTarget = 0.05;
                  maxTarget = 0.10;
                  targetText = '5-10%';
                }

                if (row.weight > maxTarget) status = 'over';
                else if (row.weight < minTarget) status = 'under';

                return (
                  <div key={row.layer} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: LAYER_META[row.layer].color }} />
                        <strong style={{ color: '#1e293b' }}>{LAYER_META[row.layer].label}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({targetText})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <strong style={{ color: '#0f172a' }}>{formatPercent(row.weight)}</strong>
                        {status === 'over' ? (
                          <span className="gf-target-badge is-over">超标</span>
                        ) : status === 'under' ? (
                          <span className="gf-target-badge is-under">偏低</span>
                        ) : (
                          <span className="gf-target-badge is-ok">合规</span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(row.weight * 100, 100)}%`,
                          background: status === 'over' ? '#ef4444' : status === 'under' ? '#f59e0b' : LAYER_META[row.layer].color,
                          borderRadius: '99px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="gf-side-card">
            <div className="gf-side-title">
              <PieChart size={18} />
              <h2>{locale === 'zh' ? '赛道与主题暴露分布' : locale === 'en' ? 'Theme & Sector Exposure' : 'セクター・テーマ露出'}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {themeRows.slice(0, 5).map((row) => (
                <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#334155' }}>
                    <span style={{ fontWeight: 500 }} title={row.label}>{row.label}</span>
                    <strong style={{ color: '#0f172a' }}>{formatPercent(row.weight)}</strong>
                  </div>
                  <div style={{ height: '5px', width: '100%', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(row.weight * 100, 100)}%`, background: '#3b82f6', borderRadius: '99px' }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="gf-side-card">
            <div className="gf-side-title">
              <ShieldCheck size={18} />
              <h2>{t.structureHealth}</h2>
            </div>
            <div className="gf-health-line">
              <span>{t.largest}</span>
              <strong>{formatPercent(largest)}</strong>
            </div>
            <div className="gf-health-line">
              <span>{t.top5}</span>
              <strong>{formatPercent(topFive)}</strong>
            </div>
            <div className="gf-health-line">
              <span>{t.concentration}</span>
              <strong>{Math.round(hhi * 100)}</strong>
            </div>
            <p style={{ marginTop: '0.6rem', fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>{t.healthNote}</p>
          </section>
        </aside>
      </div>

      <section className="gf-bottom-section" style={{ width: 'min(1440px, calc(100% - 48px))', margin: '2.5rem auto 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <LifeOsNextSteps locale={locale} total={total} baseCurrency={baseCurrency} />

        <div className="gf-seo-faq-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.8rem 2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem' }}>
            {locale === 'zh' ? '持仓分析方法论与常见问题 (FAQ)' : locale === 'en' ? 'Portfolio Rebalancing Methodology & FAQ' : 'ポートフォリオ調整方法論・FAQ'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', margin: '0 0 0.4rem' }}>
                📌 什么是持仓四层金字塔（Core / Satellite）？
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                机构投资标准通常将资产划分为核心基石（Core: S&P 500/宽基 ETF，50-60%）、卫星进攻（Satellite: 高成长的个股/赛道，20-30%）、防守缓冲（Defensive: 债券/固收，10-15%）与现金（Cash: 5-10%），以规避单一点位的黑天鹅冲击。
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', margin: '0 0 0.4rem' }}>
                ⚖️ 为什么要限制单一标的权重不超过 20%？
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                在机构风控体系中，当单一持仓超过总资产 20% 时，其个别回调风险将大幅挤占组合阿尔法收益。系统通过黄色/红色勋章提示触发阶段分批调仓减仓。
              </p>
            </div>
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <a
                href={
                  locale === 'en'
                    ? 'https://github.com/KongMing-Japan/portfolio/blob/main/docs/methodology.en.md'
                    : 'https://github.com/KongMing-Japan/portfolio/blob/main/docs/methodology.zh.md'
                }
                target="_blank"
                rel="noreferrer"
                style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
              >
                📖 查阅详细计算方法论 (Methodology) →
              </a>
            </div>
            <button
              className="gf-danger-action"
              onClick={onClear}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Trash2 size={13} />
              {t.clear}
            </button>
          </div>
        </div>
      </section>

      <section className="gf-full-superinvestors" id="superinvestors" style={{ width: '100%', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e4e9f0' }}>
        <Suspense fallback={<div className="si-state"><p>Loading quarterly filings...</p></div>}>
          <SuperinvestorsScreen />
        </Suspense>
      </section>

      <footer className="gf-footer" style={{ width: '100%', marginTop: '3.5rem', paddingTop: '1.8rem', paddingBottom: '2.5rem', borderTop: '1px solid #e4e9f0', textAlign: 'center', fontSize: '0.75rem', color: '#7a8798', opacity: 0.78 }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <span>KongMing Network: </span>
          <a href="https://kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Studio</a> ·{' '}
          <a href="https://radar.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Radar</a> ·{' '}
          <a href="https://lab.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Lab</a> ·{' '}
          <a href="https://kids.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Kids</a> ·{' '}
          <a href="https://tax.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Tax</a> ·{' '}
          <a href="https://planner.kongmingjapan.com/" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Planner</a> ·{' '}
          <a href="https://portfolio.kongmingjapan.com/" style={{ color: 'inherit', fontWeight: 600 }}>Portfolio</a>
        </div>
        <p style={{ margin: 0 }}>© 2026 KongMing LLC. All rights reserved.</p>
      </footer>

      {importOpen ? (
        <div className="gf-modal-backdrop" role="presentation">
          <section className="gf-import-modal">
            <div className="gf-modal-header">
              <h2>{t.importTitle}</h2>
              <button type="button" onClick={() => setImportOpen(false)}>
                {t.cancel}
              </button>
            </div>
            <div className="gf-import-tabs" role="tablist" aria-label="Import mode">
              <button
                className={importMode === 'upload' ? 'is-active' : ''}
                onClick={() => setImportMode('upload')}
                role="tab"
                aria-selected={importMode === 'upload'}
              >
                <Upload size={16} />
                {t.uploadFile}
              </button>
              <button
                className={importMode === 'paste' ? 'is-active' : ''}
                onClick={() => setImportMode('paste')}
                role="tab"
                aria-selected={importMode === 'paste'}
              >
                <ClipboardList size={16} />
                {t.paste}
              </button>
            </div>

            {importMode === 'upload' ? (
              <div
                className={`gf-drop-zone ${dragging ? 'is-dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  processFiles(event.dataTransfer.files);
                }}
              >
                <Upload size={30} strokeWidth={1.6} />
                <strong>{t.drop}</strong>
                <span>CSV / PNG / JPG / WebP</span>
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  {t.choose}
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept={ACCEPTED}
                  multiple
                  onChange={(event) => processFiles(event.target.files)}
                />
              </div>
            ) : (
              <div className="gf-paste-panel">
                <p>{t.pasteHint}</p>
                <textarea
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  spellCheck={false}
                  placeholder={`AAPL, Apple, USD, 100, 200, Demo Broker, Core, Technology\nCash_USD, USD Cash, USD, 50000, 1, Demo Broker, Cash, Liquidity`}
                />
                <button type="button" onClick={() => void importManualText()}>
                  {t.generate}
                </button>
              </div>
            )}

            <div className="gf-import-actions">
              <button type="button" onClick={onSample}>{t.sample}</button>
              <button type="button" onClick={() => jsonInputRef.current?.click()}>
                {t.json}
              </button>
              {hasSavedPortfolio ? (
                <button type="button" onClick={onResume}>{t.resume}</button>
              ) : null}
              <input
                ref={jsonInputRef}
                className="visually-hidden"
                type="file"
                accept=".json,application/json"
                onChange={(event) => void importJsonFile(event.target.files?.[0])}
              />
            </div>
            {localError ? <p className="inline-error studio-error">{localError}</p> : null}
          </section>
        </div>
      ) : null}

      {addOpen ? (
        <div className="gf-modal-backdrop" role="presentation">
          <form className="gf-add-modal" onSubmit={submitManualHolding}>
            <div className="gf-modal-header">
              <h2>{t.addStock}</h2>
              <button type="button" onClick={() => setAddOpen(false)}>
                {t.cancel}
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
                <span>{t.name}</span>
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
                <span>{t.quantity}</span>
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
                <span>{t.averageCost}</span>
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
                <span>{t.currentPrice}</span>
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
                  placeholder={t.defaultAverageCost}
                />
              </label>
              <label>
                <span>{t.currency}</span>
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
                <span>{t.layer}</span>
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
                <span>{t.broker}</span>
                <input
                  value={draft.broker}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      broker: event.target.value,
                    }))
                  }
                  placeholder={t.manual}
                />
              </label>
            </div>
            <button className="gf-submit" type="submit">
              {t.addStock}
            </button>
          </form>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="gf-modal-backdrop" role="presentation">
          <section className="gf-editor-modal">
            <div className="gf-modal-header">
              <div>
                <h2>{t.accountDetails}</h2>
                <p>{t.editDetails}</p>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)}>
                {t.done}
              </button>
            </div>
            <div className="gf-editor-table-wrap">
              <table className="gf-editor-table">
                <thead>
                  <tr>
                    <th>{t.symbol}</th>
                    <th>{t.broker}</th>
                    <th>{t.layer}</th>
                    <th className="numeric">{t.qty}</th>
                    <th className="numeric">{t.averageCost}</th>
                    <th className="numeric">{t.price}</th>
                    <th className="numeric">{t.value}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => (
                    <EditableHoldingRow
                      key={holding.id}
                      holding={holding}
                      baseCurrency={baseCurrency}
                      deleteLabel={t.delete}
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
              <strong>
                {holding.ticker}
                {holding.weight > 0.20 ? (
                  <span className="gf-risk-tag" title="单一标的过重 (高于 20% 机构风控线)">
                    ⚠️ 过重
                  </span>
                ) : null}
              </strong>
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
        <td className="numeric">{holding.quantity.toLocaleString('en-US')}</td>
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
              <td>{account.theme || 'Uncategorized'}</td>
              <td className="numeric">{account.quantity.toLocaleString('en-US')}</td>
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
  deleteLabel,
  onUpdate,
  onRemove,
}: {
  holding: Holding;
  baseCurrency: BaseCurrency;
  deleteLabel: string;
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
          <strong>{holding.broker || 'Unknown broker'}</strong>
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
          aria-label={`${deleteLabel} ${holding.ticker || holding.name}`}
          onClick={() => void onRemove(holding.id)}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
