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
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  Landmark,
  Layers3,
  PieChart,
  Plus,
  RefreshCcw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  aggregateHoldings,
  concentrationLabel,
  concentrationScore,
  formatDateTime,
  formatMoney,
  formatPercent,
  LAYER_META,
  POPULAR_BROKERS,
  suggestCurrencyFromTicker,
} from '../lib/portfolio';
import { PortfolioAreaChart } from './PortfolioAreaChart';
import { HoldingsCompositionCard } from './HoldingsCompositionCard';
import { PortfolioPanorama } from './PortfolioPanorama';
import { NovaRebalanceAdviceCard } from './NovaRebalanceAdviceCard';
import { RebalanceCockpitModal } from './RebalanceCockpitModal';
import { ReviewTimelineModal } from './ReviewTimelineModal';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  ManualHoldingInput,
  PortfolioSnapshot,
  ReviewSnapshot,
} from '../types';

const SuperinvestorsScreen = lazy(() =>
  import('./SuperinvestorsScreen').then((m) => ({ default: m.SuperinvestorsScreen })),
);

interface FinanceReportScreenProps {
  holdings: Holding[];
  baseCurrency: BaseCurrency;
  fx: Record<string, number>;
  quoteUpdatedAt: string | null;
  hasSavedPortfolio: boolean;
  onClear: () => void;
  onCurrencyChange?: (currency: BaseCurrency) => void;
  onAddHolding: (input: ManualHoldingInput) => Promise<void>;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
  onRemoveHolding: (id: string) => Promise<void>;
  onFiles: (files: File[]) => void;
  onJsonImport: (file: File) => Promise<void>;
  onManualImport: (text: string) => Promise<void>;
  onSample: () => void;
  onResume: () => void;
  onRestoreSnapshot?: (snapshot: ReviewSnapshot) => void;
}

type ExposureMode = 'currency' | 'theme' | 'broker';
type ImportMode = 'upload' | 'paste';
type WorkspaceView = 'portfolio' | 'superinvestors';

const LAYERS = Object.keys(LAYER_META) as Layer[];
const CURRENCIES = ['USD', 'JPY', 'CNY', 'HKD'] as const;
const ACCEPTED = '.csv,.png,.jpg,.jpeg,.webp';

const COPY = {
  search: '搜索或添加标的',
  lists: '列表',
  portfolio: '投资组合',
  superinvestors: '投资大师',
  holdings: '持仓列表',
  allocation: '资产分层',
  exposure: '风险暴露',
  allHoldings: '全部持仓',
  layers: '四层结构',
  topSymbols: '主要重仓',
  updated: '行情更新于',
  noUpdate: '未更新',
  addStock: '添加标的',
  securities: '只标的',
  securitySingular: '只标的',
  brokers: '个券商账户',
  brokerSingular: '个券商账户',
  base: '基准币种',
  yourPortfolio: '我的投资组合',
  manageAccounts: '管理账户明细',
  symbol: '代码 / 标的',
  value: '评估市值',
  weight: '权重占比',
  layer: '资产分层',
  qty: '持仓数量',
  price: '当前单价',
  topHoldings: '主要持仓',
  managePortfolio: '管理投资组合',
  importPositions: '上传 CSV / 截图 / 粘贴',
  editCost: '修改数量与平均成本',
  structureHealth: '组合健康度与集中度',
  largest: '第一大重仓',
  top5: '前五大重仓',
  concentration: '集中度指数 (HHI)',
  healthNote: '仅用于资产结构偏离度与风险敞口分析，不构成投资买卖建议。',
  shortcuts: '快捷入口',
  methodology: '查看组合方法论',
  clear: '清除全部本地数据',
  importTitle: '导入持仓数据',
  uploadFile: '上传文件',
  paste: '手动输入 / 粘贴',
  drop: '拖拽 CSV 或券商截图至此处',
  choose: '选择文件',
  sample: '加载伯克希尔示例',
  json: '导入 JSON 备份',
  resume: '打开上次保存的组合',
  pasteHint: '支持标准 CSV 表头，或每行格式：代码, 名称, 币种, 数量, 成本价, 券商, 分层, 主题',
  generate: '生成投资组合看板',
  cancel: '取消',
  done: '完成',
  accountDetails: '账户持仓明细',
  editDetails: '直接编辑各账户的持仓数量、成本均价与当前单价。',
  emptyTitle: '暂无持仓数据',
  emptyBody: '导入 CSV、券商截图或粘贴持仓列表，即可建立你的专属资产管理看板。',
  other: '其他标的',
  exportJson: '导出 Excel (CSV)',
  exposureDimension: '暴露透视维度',
  delete: '删除',
  name: '标的名称',
  quantity: '持仓数量',
  averageCost: '平均成本',
  currentPrice: '当前价格',
  currency: '币种',
  broker: '券商 / 机构',
  manual: '手动添加',
  defaultAverageCost: '默认与成本价一致',
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

function exportExcel(
  holdings: Holding[],
  baseCurrency: BaseCurrency,
) {
  const total = holdings.reduce((acc, h) => acc + (h.valueInBase ?? 0), 0);

  const headers = [
    '代码 (Ticker)',
    '标的名称',
    '券商/账户',
    '资产分层',
    '主题板块',
    '持仓数量',
    '成本均价',
    '当前单价',
    '原币种',
    `评估市值 (${baseCurrency})`,
    '持仓占比 (%)',
  ];

  const rows = holdings.map((item) => {
    const val = item.valueInBase ?? 0;
    const weightPct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
    return [
      `"${(item.ticker || '').replace(/"/g, '""')}"`,
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${(item.broker || '').replace(/"/g, '""')}"`,
      `"${item.layer}"`,
      `"${(item.theme || '').replace(/"/g, '""')}"`,
      item.quantity,
      item.costPerUnit ?? '',
      item.marketPrice ?? '',
      item.currency,
      val.toFixed(2),
      weightPct,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio-rebalance-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

function OverviewDonutTooltip({
  active,
  payload,
  baseCurrency,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      layer: Layer;
      label: string;
      value: number;
      weight: number;
      color: string;
      count: number;
      target: string;
    };
  }>;
  baseCurrency: BaseCurrency;
}) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="shadcn-chart-tooltip">
      <div className="shadcn-chart-tooltip-header">
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: data.color,
            display: 'inline-block',
          }}
        />
        <span>{data.label}</span>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>当前权重</span>
        <strong>{formatPercent(data.weight)}</strong>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>建议配置</span>
        <span>{data.target}</span>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>评估市值</span>
        <strong>{formatMoney(data.value, baseCurrency)}</strong>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>标的数量</span>
        <span>{data.count} 只标的</span>
      </div>
    </div>
  );
}

export function FinanceReportScreen({
  holdings,
  baseCurrency,
  fx,
  quoteUpdatedAt,
  hasSavedPortfolio,
  onClear,
  onCurrencyChange,
  onAddHolding,
  onUpdateHolding,
  onRemoveHolding,
  onFiles,
  onJsonImport,
  onManualImport,
  onSample,
  onResume,
  onRestoreSnapshot,
}: FinanceReportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [exposureMode, setExposureMode] = useState<ExposureMode>('currency');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('upload');
  const [dragging, setDragging] = useState(false);
  const [manualText, setManualText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() =>
    window.location.hash.startsWith('#superinvestors')
      ? 'superinvestors'
      : 'portfolio',
  );
  const [draft, setDraft] = useState<ManualHoldingInput>({
    ...EMPTY_DRAFT,
    currency: baseCurrency === 'CNY' ? 'CNY' : 'USD',
  });
  const t = COPY;

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  const handleExportImage = async () => {
    setIsExportingImg(true);
    try {
      const { toPng } = await import('html-to-image');
      const node = document.getElementById('portfolio');
      if (!node) throw new Error('未找到组合视图');

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (domNode: HTMLElement) => {
          if (domNode.classList?.contains('nova-export-menu')) return false;
          return true;
        },
      });

      const link = document.createElement('a');
      link.download = `portfolio-overview-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image:', err);
      alert('长图生成失败，建议您使用“导出 PDF”或“导出 CSV”。');
    } finally {
      setIsExportingImg(false);
      setExportMenuOpen(false);
    }
  };

  const handleExportPdf = () => {
    setExportMenuOpen(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportCsv = () => {
    setExportMenuOpen(false);
    exportExcel(holdings, baseCurrency);
  };

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
        title: `持仓过重: ${topHolding.ticker || topHolding.name} (${(topHolding.weight * 100).toFixed(1)}%)`,
        detail: '单一标的打破机构风控上限 (20%)，建议分批减仓锁定阶段收益。',
      });
    }

    const coreLayer = layerRows.find((r) => r.layer === 'Core');
    const coreWeight = coreLayer?.weight ?? 0;
    if (coreWeight < 0.40) {
      list.push({
        type: 'warning',
        title: `大盘基石偏低: Core 核心仓 (${(coreWeight * 100).toFixed(1)}%)`,
        detail: '机构标准宽基指数（如 S&P 500/VTI）建议占 50%-60%。抗波动能力偏弱。',
      });
    } else {
      list.push({
        type: 'success',
        title: `核心资产结构稳健 (Core ${(coreWeight * 100).toFixed(1)}%)`,
        detail: '符合长期机构大盘配比基准，基石仓位充足。',
      });
    }

    const themeRows = groupExposure(holdings, 'theme', total);
    const topTheme = themeRows[0];
    if (topTheme && topTheme.label !== '未分类' && topTheme.label !== 'Uncategorized' && topTheme.weight > 0.40) {
      list.push({
        type: 'info',
        title: `赛道敞口预警: ${topTheme.label} (${(topTheme.weight * 100).toFixed(1)}%)`,
        detail: '单一赛道暴露过高，建议适度做跨行业分散调仓。',
      });
    }

    return list;
  }, [aggregated, holdings, layerRows, total]);

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
      setLocalError('只支持 CSV、PNG、JPG 和 WebP 格式文件。');
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
      setLocalError(error instanceof Error ? error.message : '导入失败');
    }
  };

  const importJsonFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLocalError(null);
      await onJsonImport(file);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'JSON 导入失败');
    }
  };

  const overviewDonutData = useMemo(() => {
    const TARGETS: Record<Layer, string> = {
      Core: '50% - 60%',
      Satellite: '20% - 30%',
      Defensive: '10% - 15%',
      Cash: '5% - 10%',
    };
    return layerRows
      .filter((row) => row.value > 0 || total === 0)
      .map((row) => ({
        layer: row.layer,
        label: LAYER_META[row.layer].label,
        value: row.value,
        weight: row.weight,
        color: LAYER_META[row.layer].color,
        count: row.rows.length,
        target: TARGETS[row.layer],
      }));
  }, [layerRows, total]);

  const openWorkspace = (view: WorkspaceView, section?: string) => {
    setWorkspaceView(view);
    if (view === 'superinvestors') {
      window.location.hash = 'superinvestors';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = section || 'portfolio';
    window.location.hash = target;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="gf-page">
      <header className="gf-topbar">
        <div className="gf-topbar-left">
          <button
            className="gf-brand"
            onClick={() => {
              setImportOpen(false);
              openWorkspace('portfolio');
            }}
          >
            Portfolio 调仓
          </button>
          <nav className="gf-nav-tabs" aria-label="视图导航">
            <button
              className={`gf-nav-tab ${workspaceView === 'portfolio' ? 'is-active' : ''}`}
              onClick={() => openWorkspace('portfolio')}
            >
              <Briefcase size={14} />
              <span>我的投资组合</span>
            </button>
            <button
              className={`gf-nav-tab ${workspaceView === 'superinvestors' ? 'is-active' : ''}`}
              onClick={() => openWorkspace('superinvestors')}
            >
              <Landmark size={14} />
              <span>投资大师</span>
            </button>
          </nav>
        </div>

        <div className="gf-top-actions">
          {/* Currency Switcher: USD vs JPY */}
          <div className="nova-currency-toggle" role="group" aria-label="基准币种切换">
            <button
              type="button"
              className={`nova-currency-btn ${baseCurrency === 'USD' ? 'is-active' : ''}`}
              onClick={() => onCurrencyChange?.('USD')}
              title="切换为美元 (USD) 计价"
            >
              USD $
            </button>
            <button
              type="button"
              className={`nova-currency-btn ${baseCurrency === 'JPY' ? 'is-active' : ''}`}
              onClick={() => onCurrencyChange?.('JPY')}
              title="切换为日元 (JPY) 计价"
            >
              JPY ¥
            </button>
          </div>

          <button
            className="gf-text-action"
            onClick={() => setRebalanceOpen(true)}
            style={{ fontSize: '12px', padding: '5px 11px' }}
          >
            <Scale size={14} color="#16a34a" />
            <span>再平衡</span>
          </button>

          <button
            className="gf-text-action"
            onClick={() => setImportOpen(true)}
            style={{ fontSize: '12px', padding: '5px 11px' }}
          >
            <Upload size={14} />
            <span>导入</span>
          </button>

          {/* Export Dropdown Menu (PNG / PDF / CSV) */}
          <div className="nova-export-dropdown" ref={exportMenuRef}>
            <button
              type="button"
              className="gf-primary-action"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              style={{ fontSize: '12px', padding: '5px 12px' }}
            >
              <Download size={14} />
              <span>导出</span>
              <ChevronDown
                size={12}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: exportMenuOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {exportMenuOpen && (
              <div className="nova-export-menu" role="menu">
                <button
                  type="button"
                  className="nova-export-item"
                  role="menuitem"
                  onClick={handleExportImage}
                  disabled={isExportingImg}
                >
                  <span className="nova-export-item-icon">🖼️</span>
                  <div className="nova-export-item-text">
                    <div className="nova-export-item-title">
                      {isExportingImg ? '正在渲染长图...' : '导出组合长图 (PNG)'}
                    </div>
                    <div className="nova-export-item-desc">高清资产穿透大图，适合分享与保存</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="nova-export-item"
                  role="menuitem"
                  onClick={handleExportPdf}
                >
                  <span className="nova-export-item-icon">📄</span>
                  <div className="nova-export-item-text">
                    <div className="nova-export-item-title">导出投资报告 (PDF)</div>
                    <div className="nova-export-item-desc">A4 标准矢量排版，打印或存为 PDF</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="nova-export-item"
                  role="menuitem"
                  onClick={handleExportCsv}
                >
                  <span className="nova-export-item-icon">📊</span>
                  <div className="nova-export-item-text">
                    <div className="nova-export-item-title">导出持仓数据 (CSV)</div>
                    <div className="nova-export-item-desc">Excel 兼容，包含单价与换算市值</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {workspaceView === 'superinvestors' ? (
        <section
          className="gf-full-superinvestors"
          id="superinvestors"
          style={{ width: 'min(1160px, calc(100% - 3rem))', margin: '2rem auto 0' }}
        >
          <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>正在加载投资大师档案...</div>}>
            <SuperinvestorsScreen />
          </Suspense>
        </section>
      ) : (
        <>
          <div className="nova-shell" id="portfolio">
            {/* Shadcn Dashboard Header */}
            <div className="nova-page-header">
              <div>
                <h1 className="nova-page-title">资产总览与驾驶舱</h1>
                <p className="nova-page-desc">
                  {quoteUpdatedAt ? `行情更新于 ${formatDateTime(quoteUpdatedAt)}` : '行情未更新'} · 基准币种 {baseCurrency}
                </p>
              </div>
              <div className="nova-page-badges">
                <span className="nova-meta-badge">
                  <strong>{aggregated.length}</strong> 只标的
                </span>
                <span className="nova-meta-badge">
                  <strong>{brokers}</strong> 个券商账户
                </span>
                <span
                  className={`nova-meta-badge ${
                    hhi > 0.25 ? 'is-danger' : hhi > 0.15 ? 'is-warning' : 'is-success'
                  }`}
                >
                  {concentrationLabel(hhi)}
                </span>
              </div>
            </div>

            {/* Shadcn 4-Card KPI Grid */}
            <div className="nova-kpi-grid">
              {/* Card 1: Total Net Worth */}
              <div className="nova-kpi-card">
                <div className="nova-kpi-header">
                  <span className="nova-kpi-title">
                    <Landmark size={14} />
                    组合总资产 (Net Worth)
                  </span>
                  <span className="nova-kpi-chip">估值基准</span>
                </div>
                <div className="nova-kpi-value">{formatMoney(total, baseCurrency)}</div>
                <div className="nova-kpi-desc">
                  <span>全量资产汇总</span>
                  <span>{aggregated.length} 只标的 · {brokers} 个账户</span>
                </div>
              </div>

              {/* Card 2: Core Layer */}
              {(() => {
                const row = layerRows.find((r) => r.layer === 'Core') || { weight: 0, value: 0, rows: [] };
                const isOver = row.weight > 0.60;
                const isUnder = row.weight < 0.50;
                return (
                  <div className="nova-kpi-card">
                    <div className="nova-kpi-header">
                      <span className="nova-kpi-title">
                        <span className="nova-dot" style={{ background: LAYER_META.Core.color }} />
                        核心基石 (Core)
                      </span>
                      <span className={`nova-status-badge ${isOver ? 'is-over' : isUnder ? 'is-under' : 'is-ok'}`}>
                        {isOver ? '偏高' : isUnder ? '偏低' : '稳健'}
                      </span>
                    </div>
                    <div className="nova-kpi-value">{formatPercent(row.weight)}</div>
                    <div className="nova-kpi-desc">
                      <span>目标 50-60%</span>
                      <span>{formatMoney(row.value, baseCurrency)} ({row.rows.length}只)</span>
                    </div>
                  </div>
                );
              })()}

              {/* Card 3: Satellite Layer */}
              {(() => {
                const row = layerRows.find((r) => r.layer === 'Satellite') || { weight: 0, value: 0, rows: [] };
                const isOver = row.weight > 0.30;
                const isUnder = row.weight < 0.20;
                return (
                  <div className="nova-kpi-card">
                    <div className="nova-kpi-header">
                      <span className="nova-kpi-title">
                        <span className="nova-dot" style={{ background: LAYER_META.Satellite.color }} />
                        进攻卫星 (Satellite)
                      </span>
                      <span className={`nova-status-badge ${isOver ? 'is-over' : isUnder ? 'is-under' : 'is-ok'}`}>
                        {isOver ? '偏高' : isUnder ? '偏低' : '稳健'}
                      </span>
                    </div>
                    <div className="nova-kpi-value">{formatPercent(row.weight)}</div>
                    <div className="nova-kpi-desc">
                      <span>目标 20-30%</span>
                      <span>{formatMoney(row.value, baseCurrency)} ({row.rows.length}只)</span>
                    </div>
                  </div>
                );
              })()}

              {/* Card 4: Defensive & Cash Layer */}
              {(() => {
                const defRow = layerRows.find((r) => r.layer === 'Defensive') || { weight: 0, value: 0, rows: [] };
                const cashRow = layerRows.find((r) => r.layer === 'Cash') || { weight: 0, value: 0, rows: [] };
                const combinedWeight = defRow.weight + cashRow.weight;
                const combinedValue = defRow.value + cashRow.value;
                const combinedCount = defRow.rows.length + cashRow.rows.length;
                const isOver = combinedWeight > 0.25;
                const isUnder = combinedWeight < 0.15;
                return (
                  <div className="nova-kpi-card">
                    <div className="nova-kpi-header">
                      <span className="nova-kpi-title">
                        <span className="nova-dot" style={{ background: LAYER_META.Defensive.color }} />
                        防守与现金 (Defensive)
                      </span>
                      <span className={`nova-status-badge ${isOver ? 'is-over' : isUnder ? 'is-under' : 'is-ok'}`}>
                        {isOver ? '偏高' : isUnder ? '偏低' : '稳健'}
                      </span>
                    </div>
                    <div className="nova-kpi-value">{formatPercent(combinedWeight)}</div>
                    <div className="nova-kpi-desc">
                      <span>目标 15-25%</span>
                      <span>{formatMoney(combinedValue, baseCurrency)} ({combinedCount}只)</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Seamless Allocation Strip */}
            <div className="gf-allocation-strip" aria-label="Portfolio allocation" style={{ marginTop: '-0.25rem' }}>
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
                  />
                ) : null,
              )}
            </div>

            {aggregated.length > 0 && (
              <div className="nova-grid-2">
                <HoldingsCompositionCard
                  aggregated={aggregated}
                  totalValue={total}
                  baseCurrency={baseCurrency}
                  onSelectTicker={(ticker) => {
                    setExpandedTicker((prev) => (prev === ticker ? null : ticker));
                  }}
                />
                <NovaRebalanceAdviceCard
                  layerRows={layerRows}
                  total={total}
                  baseCurrency={baseCurrency}
                  aggregated={aggregated}
                  rebalancingSignals={rebalancingSignals}
                  hhi={hhi}
                  onOpenRebalance={() => setRebalanceOpen(true)}
                  onOpenTimeline={() => setTimelineOpen(true)}
                />
              </div>
            )}

            {aggregated.length > 0 && (
              <PortfolioAreaChart
                totalValue={total}
                baseCurrency={baseCurrency}
                layerRows={layerRows}
              />
            )}

            {aggregated.length > 0 && (
              <PortfolioPanorama
                holdings={holdings}
                aggregated={aggregated}
                totalValue={total}
                baseCurrency={baseCurrency}
              />
            )}

            <section className="gf-section" id="holdings">
              <div className="gf-section-header">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground" style={{ margin: 0 }}>
                    {t.yourPortfolio}
                  </h2>
                  <p className="text-sm text-muted-foreground" style={{ margin: '4px 0 0' }}>
                    全量多券商持仓明细与资产分层管理
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button className="gf-text-action text-xs font-medium" onClick={() => setEditorOpen(true)}>
                    {t.manageAccounts}
                  </button>
                  <button className="gf-primary-action text-xs font-medium" onClick={() => setAddOpen(true)}>
                    <Plus size={13} />
                    <span>{t.addStock}</span>
                  </button>
                </div>
              </div>

              <div className="gf-table-wrap">
                <table className="gf-holdings-table">
                  <thead>
                    <tr>
                      <th>{t.symbol}</th>
                      <th className="numeric">{t.value}</th>
                      <th className="numeric">{t.weight}</th>
                      <th className="text-center">{t.layer}</th>
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

            {/* Methodology & FAQ Card */}
            <section className="gf-methodology-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <ShieldCheck size={16} color="var(--primary)" />
                <h2 className="text-sm font-semibold tracking-tight text-foreground" style={{ margin: 0 }}>
                  持仓分析方法论与风控说明
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '0.25rem' }}>
                <div>
                  <h3 className="text-xs font-semibold text-foreground" style={{ margin: '0 0 4px' }}>
                    四层资产金字塔原则
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed" style={{ margin: 0 }}>
                    机构标准将资产划分为核心基石（Core 50-60%）、卫星进攻（Satellite 20-30%）、防守缓冲（Defensive 10-15%）与现金（Cash 5-10%），分散黑天鹅冲击。
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground" style={{ margin: '0 0 4px' }}>
                    单一标的权重风控（20% 上限）
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed" style={{ margin: 0 }}>
                    当单一持仓超过 20% 时，个股回调将大幅挤占组合整体收益。系统以 ⚠️ 标记过重标的，提示分批减仓锁利。
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-foreground" style={{ margin: '0 0 4px' }}>
                    HHI 集中度指数说明
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed" style={{ margin: 0 }}>
                    HHI 衡量持仓分散程度。分数越低越分散（&lt; 15 优秀），越高越集中（&gt; 25 高风险），帮助量化组合健康度。
                  </p>
                </div>
              </div>
              <div style={{ marginTop: '0.5rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <a
                    href="https://github.com/KongMing-Japan/portfolio/blob/main/docs/methodology.zh.md"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}
                  >
                    详细方法论
                  </a>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>数据来源: Yahoo Finance · SEC EDGAR</span>
                </div>
                <button
                  onClick={onClear}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--muted-foreground)',
                    borderRadius: 'calc(var(--radius) * 0.8)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 500,
                  }}
                >
                  <Trash2 size={12} />
                  {t.clear}
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      <footer className="gf-footer">
        <p style={{ margin: '0 0 0.35rem', fontWeight: 600, color: 'var(--foreground)' }}>Portfolio 调仓 · 独立多券商资产配置与再平衡系统</p>
        <p style={{ margin: '0 0 0.6rem' }}>© 2026 KongMing LLC · 孔明合同会社</p>
        <div className="gf-footer-links">
          <a href="https://kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            KongMing
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://radar.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Radar
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://lab.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Select China
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://kodomo.fyi/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Kodomo Go!
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://money.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Money OS
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://citylog.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            CityLog
          </a>
        </div>
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
                  onChange={(event) => {
                    const val = event.target.value;
                    const autoCurr = suggestCurrencyFromTicker(val, draft.name);
                    setDraft((current) => ({
                      ...current,
                      ticker: val,
                      currency: autoCurr,
                    }));
                  }}
                  placeholder="AAPL / 7203.T / 510300"
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
                  placeholder="Apple / Toyota / 沪深300"
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
              <label style={{ gridColumn: '1 / -1' }}>
                <span>{t.broker}</span>
                <input
                  list="popular-brokers-list"
                  value={draft.broker}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      broker: event.target.value,
                    }))
                  }
                  placeholder={t.manual}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                  {POPULAR_BROKERS.map((brokerName) => (
                    <button
                      key={brokerName}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({ ...current, broker: brokerName }))
                      }
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        borderRadius: '12px',
                        border: '1px solid #dadce0',
                        background: draft.broker === brokerName ? '#e8f0fe' : '#ffffff',
                        color: draft.broker === brokerName ? '#1a73e8' : '#3c4043',
                        cursor: 'pointer',
                        fontWeight: draft.broker === brokerName ? 600 : 400,
                      }}
                    >
                      {brokerName}
                    </button>
                  ))}
                </div>
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

      <RebalanceCockpitModal
        isOpen={rebalanceOpen}
        onClose={() => setRebalanceOpen(false)}
        holdings={aggregated}
        totalValue={total}
        baseCurrency={baseCurrency}
      />

      <ReviewTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        currentHoldings={holdings}
        aggregatedHoldings={aggregated}
        totalValue={total}
        baseCurrency={baseCurrency}
        onRestoreSnapshot={onRestoreSnapshot}
      />

      <datalist id="popular-brokers-list">
        {POPULAR_BROKERS.map((brokerName) => (
          <option key={brokerName} value={brokerName} />
        ))}
      </datalist>
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
          <div className="gf-symbol-cell">
            <span className="gf-symbol-chevron">
              {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
            <span className="gf-symbol-logo">{holding.ticker.slice(0, 1)}</span>
            <div className="gf-symbol-meta">
              <div className="gf-symbol-title-row">
                <span className="gf-symbol-ticker">{holding.ticker}</span>
                {holding.weight > 0.20 && (
                  <span className="gf-risk-tag" title="单一标的过重 (高于 20% 机构风控线)">
                    ⚠️ 过重
                  </span>
                )}
              </div>
              <span className="gf-symbol-name" title={holding.name}>
                {holding.name}
              </span>
            </div>
          </div>
        </td>
        <td className="numeric font-semibold">{formatMoney(holding.marketValueBase, baseCurrency)}</td>
        <td className="numeric font-semibold">{formatPercent(holding.weight)}</td>
        <td className="text-center">
          <span
            className="gf-layer-chip"
            style={{
              color: LAYER_META[holding.layer].color,
              background: LAYER_META[holding.layer].pale,
              borderColor: `color-mix(in oklch, ${LAYER_META[holding.layer].color} 25%, transparent)`,
            }}
          >
            {LAYER_META[holding.layer].label}
          </span>
        </td>
        <td className="numeric secondary-num">{holding.quantity.toLocaleString('en-US')}</td>
        <td className="numeric secondary-num">
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
          <input
            list="popular-brokers-list"
            value={holding.broker || ''}
            onChange={(event) =>
              void onUpdate(holding.id, { broker: event.target.value })
            }
            placeholder="券商/机构"
            style={{
              fontSize: '12px',
              padding: '4px 6px',
              borderRadius: '6px',
              border: '1px solid #dadce0',
              width: '100%',
              maxWidth: '130px',
              background: '#fff',
            }}
          />
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
