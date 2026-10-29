import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Landmark,
  Layers3,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { extractImagePositions, extractTextPositions } from '../lib/api';
import { parseCsvFile, parseHoldingsText } from '../lib/csv';
import { UpsertReviewModal } from './UpsertReviewModal';
import type { UpsertResult } from '../lib/upsert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  aggregateHoldings,
  canonicalThemeFromHolding,
  dualEngineFromHolding,
  formatDateTime,
  formatEditableNumber,
  formatExactMoney,
  formatMoney,
  formatPercent,
  fxExposureFromHolding,
  getCleanSecurityName,
  isDailyMemoAccount,
  LAYER_META,
  POPULAR_BROKERS,
  suggestCurrencyFromTicker,
  underlyingMarketFromHolding,
} from '../lib/portfolio';
import { SINGLE_SECURITY_CAP } from '../lib/rebalance';
import { getAuthenticatedUsername } from '../lib/auth';
import { BrokerAccountsCard } from './BrokerAccountsCard';
import { HoldingsCompositionCard } from './HoldingsCompositionCard';
import { PortfolioPanorama } from './PortfolioPanorama';
import { ClassicRebalanceAnalytics } from './ClassicRebalanceAnalytics';
import { AccountVaultSection } from './AccountVaultSection';
import { UserAuthModal } from './UserAuthModal';
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
  isOwnerUnlocked?: boolean;
  onUnlockOwner?: () => void;
  onLockOwner?: () => void;
  onResetOwnerBaseline?: () => void;
  onClear: () => void;
  onCurrencyChange?: (currency: BaseCurrency) => void;
  onAddHolding: (input: ManualHoldingInput) => Promise<void>;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
  onRemoveHolding: (id: string) => Promise<void>;
  onReplaceHoldings?: (nextHoldings: Holding[]) => Promise<void>;
  onUpsertHoldings?: (incoming: Holding[]) => Promise<UpsertResult['summary']>;
  onRefreshQuotes?: () => Promise<void>;
  onSave?: () => Promise<void> | void;
  onFiles: (files: File[]) => void;
  onJsonImport: (file: File) => Promise<void>;
  onManualImport: (text: string) => Promise<void>;
  onSample: () => void;
  onResume: () => void;
  onRestoreSnapshot?: (snapshot: ReviewSnapshot) => void;
}

type ImportMode = 'upload' | 'paste';
type WorkspaceView = 'portfolio' | 'superinvestors';

const LAYERS = Object.keys(LAYER_META) as Layer[];
const CURRENCIES = ['USD', 'JPY', 'CNY', 'HKD'] as const;
const ACCEPTED = '.csv,.png,.jpg,.jpeg,.webp';

const COPY = {
  addStock: '新增标的',
  yourPortfolio: '持仓明细',
  manageAccounts: '批量管理全表',
  symbol: '标的',
  value: '市值',
  weight: '权重',
  layer: '分层',
  qty: '持股数',
  price: '单价',
  importPositions: '上传 CSV / 截图 / 粘贴',
  emptyTitle: '暂无持仓数据',
  emptyBody: '上传持仓 CSV 或截图即可生成组合全景。',
  importTitle: '导入持仓',
  uploadFile: '上传单张截图 / CSV',
  paste: '粘贴文本 (AI 识别)',
  drop: '拖拽单张持仓截图到此处 (限制 1 张)',
  choose: '选择文件',
  pasteHint: '可直接粘贴券商交易记录、微信持仓文字、或自定义表格文字',
  generate: 'AI 智能提取并预览',
  sample: '加载伯克希尔 13F 示例',
  json: '导入 JSON 备份',
  resume: '恢复上次保存的组合',
  accountDetails: '全量账户明细编辑',
  editDetails: '支持直接修改各账户持仓数量、单价、分层或删除记录',
  done: '完成',
  name: '名称',
  quantity: '持股数量',
  averageCost: '建仓均价 (选填)',
  currentPrice: '当前单价',
  defaultAverageCost: '留空则默认使用均价',
  currency: '计价币种',
  broker: '所属券商 / 账户',
  manual: '例如：乐天证券 / SBI 証券 / Interactive Brokers',
  cancel: '取消',
  clear: '清空数据',
  delete: '删除',
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

export function FinanceReportScreen({
  holdings,
  baseCurrency,
  fx,
  quoteUpdatedAt,
  hasSavedPortfolio,
  isOwnerUnlocked,
  onUnlockOwner,
  onLockOwner,
  onResetOwnerBaseline,
  onClear,
  onCurrencyChange,
  onAddHolding,
  onUpdateHolding,
  onRemoveHolding,
  onReplaceHoldings,
  onUpsertHoldings,
  onRefreshQuotes,
  onSave,
  onFiles,
  onJsonImport,
  onManualImport,
  onSample,
  onResume,
}: FinanceReportScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mergeEquivalent, setMergeEquivalent] = useState(true);
  const [layerFilter, setLayerFilter] = useState<'ALL' | Layer>('ALL');
  const [holdingSearch, setHoldingSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('upload');
  const [dragging, setDragging] = useState(false);
  const [manualText, setManualText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<Holding[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingNotice, setAnalyzingNotice] = useState('AI 正在分析...');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExportingImg, setIsExportingImg] = useState(false);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() => {
    if (window.location.hash.startsWith('#superinvestors')) return 'superinvestors';
    return 'portfolio';
  });
  const [draft, setDraft] = useState<ManualHoldingInput>({
    ...EMPTY_DRAFT,
    currency: 'USD',
  });
  const t = COPY;

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => {
      setSaveToast(null);
    }, 3500);
  };

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      if (onSave) {
        await onSave();
      }
      setSaveStatus('saved');
      showToast('持仓修改已保存到本地存储。');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    } catch {
      setSaveStatus('idle');
    }
  };

  const handleTriggerRefreshQuotes = async () => {
    if (!onRefreshQuotes || isRefreshingQuotes) return;
    setIsRefreshingQuotes(true);
    try {
      await onRefreshQuotes();
      showToast('已同步最新市场单价与汇率。');
    } finally {
      setIsRefreshingQuotes(false);
    }
  };

  const handleExportJson = () => {
    setExportMenuOpen(false);
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
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-snapshot-${baseCurrency}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    const headers = [
      'Ticker',
      'Name',
      'Layer',
      'Broker',
      'Account',
      'Currency',
      'Quantity',
      'MarketPrice',
      `Value(${baseCurrency})`,
      'Weight(%)',
    ];
    const rows = activeHoldings.map((h) => {
      const val = h.valueInBase ?? 0;
      const weight = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
      const escapeCsv = (str: string | number | null | undefined) => {
        const s = String(str ?? '');
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      return [
        escapeCsv(h.ticker),
        escapeCsv(getCleanSecurityName(h.ticker, h.name)),
        escapeCsv(LAYER_META[h.layer]?.label || h.layer),
        escapeCsv(h.broker),
        escapeCsv(h.account),
        escapeCsv(h.currency),
        escapeCsv(h.quantity),
        escapeCsv(h.marketPrice ?? h.costPerUnit ?? ''),
        escapeCsv(Math.round(val)),
        escapeCsv(weight),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-holdings-${baseCurrency}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash.startsWith('#superinvestors')) {
        setWorkspaceView('superinvestors');
      } else if (
        window.location.hash === '#portfolio' ||
        window.location.hash === '#holdings' ||
        window.location.hash === '#allocation'
      ) {
        setWorkspaceView('portfolio');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Investment portfolio strictly excludes daily living/payment accounts
  const activeHoldings = useMemo(
    () => holdings.filter((h) => !isDailyMemoAccount(h)),
    [holdings],
  );

  const aggregated = useMemo(
    () => aggregateHoldings(activeHoldings, { mergeEquivalent }),
    [activeHoldings, mergeEquivalent],
  );
  const rawAggregated = useMemo(
    () => aggregateHoldings(activeHoldings, { mergeEquivalent: false }),
    [activeHoldings],
  );
  const total = useMemo(
    () => aggregated.reduce((sum, item) => sum + item.marketValueBase, 0),
    [aggregated],
  );
  const brokers = useMemo(
    () => new Set(activeHoldings.map((item) => item.broker).filter(Boolean)).size,
    [activeHoldings],
  );

  const filteredHoldings = useMemo(() => {
    const q = holdingSearch.trim().toLowerCase();
    return aggregated.filter((item) => {
      if (layerFilter !== 'ALL' && item.layer !== layerFilter) return false;
      if (!q) return true;
      const cleanName = getCleanSecurityName(item.ticker, item.name).toLowerCase();
      const brokerList = item.accounts.map((a) => a.broker.toLowerCase()).join(' ');
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        cleanName.includes(q) ||
        item.theme.toLowerCase().includes(q) ||
        brokerList.includes(q)
      );
    });
  }, [aggregated, layerFilter, holdingSearch]);

  const layerRows = useMemo(
    () =>
      LAYERS.map((layer) => {
        const rows = aggregated.filter((item) => item.layer === layer);
        const value = rows.reduce((sum, item) => sum + item.marketValueBase, 0);
        return {
          layer,
          rows,
          value,
          weight: total > 0 ? value / total : 0,
        };
      }),
    [aggregated, total],
  );

  const submitManualHolding = async (event: FormEvent) => {
    event.preventDefault();
    const unitPrice = draft.marketPrice ?? draft.averagePrice;
    if (!draft.ticker.trim() || draft.quantity <= 0 || unitPrice <= 0) {
      return;
    }
    await onAddHolding({
      ...draft,
      averagePrice: draft.averagePrice > 0 ? draft.averagePrice : unitPrice,
      marketPrice: unitPrice,
    });
    setDraft({ ...EMPTY_DRAFT, currency: baseCurrency === 'CNY' ? 'CNY' : 'USD' });
    setAddOpen(false);
  };

  const processFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const valid = files.filter((file) =>
      /\.(csv|png|jpe?g|webp)$/i.test(file.name),
    );
    if (!valid.length) {
      setLocalError('只支持 PNG、JPG、WebP 截图或 CSV 格式文件。');
      return;
    }
    if (files.length > 1) {
      showToast('每次限制导入 1 张截图分析，已自动为您选取第 1 张图片进行分析。');
    }
    const targetFile = valid[0];
    setLocalError(null);
    setIsAnalyzing(true);
    try {
      if (/\.csv$/i.test(targetFile.name)) {
        setAnalyzingNotice('正在解析 CSV 持仓数据...');
        const parsed = await parseCsvFile(targetFile);
        if (!parsed.length) throw new Error('CSV 文件中未找到有效持仓标的。');
        setExtractedPreview(parsed);
        setImportOpen(false);
      } else {
        setAnalyzingNotice('AI 正在分析截图中的代码与最新持仓数...');
        const parsed = await extractImagePositions(targetFile);
        if (!parsed.length) {
          throw new Error('截图中未识别到投资标的，请尝试更清晰的截图或使用文本粘贴。');
        }
        setExtractedPreview(parsed);
        setImportOpen(false);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '持仓识别失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAiTextExtract = async () => {
    if (!manualText.trim()) {
      setLocalError('请先输入或粘贴持仓文本。');
      return;
    }
    setLocalError(null);
    setIsAnalyzing(true);
    setAnalyzingNotice('AI 正在智能识别文本中的标的代码与持股数...');
    try {
      const parsed = await extractTextPositions(manualText);
      if (!parsed.length) {
        throw new Error('未在文本中识别到有效投资标的，请检查内容。');
      }
      setExtractedPreview(parsed);
      setImportOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '文本 AI 识别失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCsvTextExtract = async () => {
    if (!manualText.trim()) {
      setLocalError('请先输入或粘贴 CSV 文本。');
      return;
    }
    setLocalError(null);
    try {
      const parsed = parseHoldingsText(manualText, 'Manual text');
      if (!parsed.length) {
        throw new Error('未能按 CSV 格式解析出有效持仓。');
      }
      setExtractedPreview(parsed);
      setImportOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'CSV 解析失败');
    }
  };

  const handleConfirmUpsert = async (reviewedItems: Holding[]) => {
    if (onUpsertHoldings) {
      const summary = await onUpsertHoldings(reviewedItems);
      showToast(
        `✅ AI 识别更新成功：已直接保存至云端数据库（更新 ${summary.updatedCount} 笔 · 新增 ${summary.addedCount} 笔）！无需重新发布。`,
      );
    } else if (onReplaceHoldings) {
      await onReplaceHoldings(reviewedItems);
      showToast('✅ 持仓已成功导入并更新至云端！');
    }
    setExtractedPreview(null);
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
        <div className="gf-topbar-inner">
          <button
            className="gf-brand"
            onClick={() => {
              setImportOpen(false);
              openWorkspace('portfolio');
            }}
          >
            Portfolio
          </button>
          <nav className="gf-nav-tabs" aria-label="视图导航">
            {!isOwnerUnlocked ? (
              <button
                className={`gf-nav-tab ${workspaceView === 'portfolio' ? 'is-active' : ''}`}
                onClick={() => openWorkspace('portfolio')}
              >
                <Briefcase size={14} />
                <span>公开示例</span>
              </button>
            ) : (
              <button
                className={`gf-nav-tab ${workspaceView === 'portfolio' ? 'is-active' : ''}`}
                onClick={() => openWorkspace('portfolio')}
              >
                <Briefcase size={14} />
                <span>我的组合</span>
              </button>
            )}
            <button
              className={`gf-nav-tab ${workspaceView === 'superinvestors' ? 'is-active' : ''}`}
              onClick={() => openWorkspace('superinvestors')}
            >
              <Landmark size={14} />
              <span>投资大师</span>
            </button>
          </nav>
          <div className="gf-topbar-user-area" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isOwnerUnlocked ? (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="账户管理 / 锁定退出"
              >
                <span className="size-1.5 rounded-full bg-primary inline-block" />
                <span>{getAuthenticatedUsername() || 'owner'}</span>
                <Unlock size={12} className="text-muted-foreground" />
              </button>
            ) : (
              <button
                type="button"
                className="gf-text-action"
                onClick={() => setAuthModalOpen(true)}
                style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '5px' }}
                title="登录解锁个人真实持仓"
              >
                <Lock size={12} />
                <span>私享登录</span>
              </button>
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
          <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">正在加载投资大师档案...</div>}>
            <SuperinvestorsScreen />
          </Suspense>
        </section>
      ) : (
        <div className="nova-shell space-y-6" id="portfolio">
          {/* Minimalist Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {isOwnerUnlocked ? '我的组合' : '组合示例'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                共 {aggregated.length} 项投资标的（分布于 {brokers} 个投资账户）
                {quoteUpdatedAt ? ` · 行情更新于 ${formatDateTime(quoteUpdatedAt)}` : ''}
              </p>
            </div>

            {/* Clean Action Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="nova-currency-toggle" role="group" aria-label="基准币种切换">
                <button
                  type="button"
                  className={`nova-currency-btn ${baseCurrency === 'JPY' ? 'is-active' : ''}`}
                  onClick={() => onCurrencyChange?.('JPY')}
                >
                  JPY ¥
                </button>
                <button
                  type="button"
                  className={`nova-currency-btn ${baseCurrency === 'USD' ? 'is-active' : ''}`}
                  onClick={() => onCurrencyChange?.('USD')}
                >
                  USD $
                </button>
              </div>

              {onRefreshQuotes && (
                <button
                  type="button"
                  className="gf-text-action"
                  onClick={() => void handleTriggerRefreshQuotes()}
                  disabled={isRefreshingQuotes}
                  title="自动抓取最新市场单价与汇率"
                >
                  <RefreshCcw size={13} className={isRefreshingQuotes ? 'spin' : ''} />
                  <span>{isRefreshingQuotes ? '刷新中...' : '刷新行情'}</span>
                </button>
              )}

              <button
                type="button"
                className="gf-text-action"
                onClick={() => setImportOpen(true)}
              >
                <Upload size={13} />
                <span>导入</span>
              </button>

              <button
                type="button"
                className="gf-text-action"
                onClick={() => void handleManualSave()}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saved' ? (
                  <>
                    <Check size={13} />
                    <span>已保存</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>保存</span>
                  </>
                )}
              </button>

              <div className="nova-export-dropdown" ref={exportMenuRef}>
                <button
                  type="button"
                  className="gf-primary-action"
                  onClick={() => setExportMenuOpen((prev) => !prev)}
                  aria-expanded={exportMenuOpen}
                  aria-haspopup="menu"
                >
                  <Download size={13} />
                  <span>导出</span>
                  <ChevronDown size={12} />
                </button>

                {exportMenuOpen && (
                  <div className="nova-export-menu" role="menu">
                    <button
                      type="button"
                      className="nova-export-item"
                      role="menuitem"
                      onClick={() => void handleExportImage()}
                      disabled={isExportingImg}
                    >
                      <span className="nova-export-item-icon">
                        <FileImage size={15} />
                      </span>
                      <div className="nova-export-item-text">
                        <div className="nova-export-item-title">
                          {isExportingImg ? '正在渲染长图...' : '导出组合长图 (PNG)'}
                        </div>
                        <div className="nova-export-item-desc">高清组合全景图</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="nova-export-item"
                      role="menuitem"
                      onClick={handleExportPdf}
                    >
                      <span className="nova-export-item-icon">
                        <FileText size={15} />
                      </span>
                      <div className="nova-export-item-text">
                        <div className="nova-export-item-title">导出投资报告 (PDF)</div>
                        <div className="nova-export-item-desc">A4 标准排版打印</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="nova-export-item"
                      role="menuitem"
                      onClick={handleExportCsv}
                    >
                      <span className="nova-export-item-icon">
                        <FileSpreadsheet size={15} />
                      </span>
                      <div className="nova-export-item-text">
                        <div className="nova-export-item-title">导出持仓数据 (CSV)</div>
                        <div className="nova-export-item-desc">Excel 兼容表格</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="nova-export-item"
                      role="menuitem"
                      onClick={handleExportJson}
                    >
                      <span className="nova-export-item-icon">
                        <Download size={15} />
                      </span>
                      <div className="nova-export-item-text">
                        <div className="nova-export-item-title">导出 JSON 备份文件</div>
                        <div className="nova-export-item-desc">完整配置备份</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Card KPI Summary Grid (Shadcn b7Br6guwa style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card size="sm">
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-medium">投资组合净值</CardDescription>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    {baseCurrency}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                  {formatMoney(total, baseCurrency)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                  {formatExactMoney(total, baseCurrency)}
                </div>
              </CardContent>
            </Card>

            {(() => {
              const row = layerRows.find((r) => r.layer === 'Core') || { weight: 0, value: 0, rows: [] };
              return (
                <Card size="sm">
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs font-medium flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-primary" />
                        核心仓 (Core)
                      </CardDescription>
                      <span className="text-[11px] text-muted-foreground tabular-nums">目标 60%</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                      {formatPercent(row.weight)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                      {formatMoney(row.value, baseCurrency)} · {row.rows.length} 项
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {(() => {
              const row = layerRows.find((r) => r.layer === 'Satellite') || { weight: 0, value: 0, rows: [] };
              return (
                <Card size="sm">
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs font-medium flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-chart-4" />
                        卫星仓 (Satellite)
                      </CardDescription>
                      <span className="text-[11px] text-muted-foreground tabular-nums">目标 20%</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                      {formatPercent(row.weight)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                      {formatMoney(row.value, baseCurrency)} · {row.rows.length} 项
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {(() => {
              const defRow = layerRows.find((r) => r.layer === 'Defensive') || { weight: 0, value: 0, rows: [] };
              const cashRow = layerRows.find((r) => r.layer === 'Cash') || { weight: 0, value: 0, rows: [] };
              const combinedWeight = defRow.weight + cashRow.weight;
              const combinedValue = defRow.value + cashRow.value;
              return (
                <Card size="sm">
                  <CardHeader className="pb-1">
                    <div className="flex items-center justify-between">
                      <CardDescription className="text-xs font-medium flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-chart-3" />
                        防守与现金
                      </CardDescription>
                      <span className="text-[11px] text-muted-foreground tabular-nums">目标 20%</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                      {formatPercent(combinedWeight)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                      防守 {formatPercent(defRow.weight, 0)} · 现金 {formatPercent(cashRow.weight, 0)} ({formatMoney(combinedValue, baseCurrency)})
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* =====================================================================
              70% CORE: Holdings Panorama, Accounts & Direct-Edit Holdings Ledger
             ===================================================================== */}
          {aggregated.length > 0 && (
            <PortfolioPanorama
              holdings={activeHoldings}
              aggregated={aggregated}
              totalValue={total}
              baseCurrency={baseCurrency}
            />
          )}

          {activeHoldings.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <BrokerAccountsCard
                holdings={activeHoldings}
                totalValue={total}
                baseCurrency={baseCurrency}
              />
              <HoldingsCompositionCard
                aggregated={aggregated}
                totalValue={total}
                baseCurrency={baseCurrency}
                onSelectTicker={(ticker) => {
                  setExpandedTicker((prev) => (prev === ticker ? null : ticker));
                }}
              />
            </div>
          )}

          {/* Direct-Edit Holdings Ledger Table */}
          <Card id="holdings" className="perf-contain-section">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t.yourPortfolio}</CardTitle>
                  <CardDescription>
                    直接在表内修改「持股数」或「单价」即可完成调仓并实时更新组合权重（多账户合并项点击即可展开修改）
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="gf-text-action text-xs font-medium"
                    onClick={() => setMergeEquivalent((prev) => !prev)}
                  >
                    <Layers3 size={13} />
                    <span>同源归并: {mergeEquivalent ? '开' : '关'}</span>
                  </button>
                  <button
                    type="button"
                    className="gf-primary-action text-xs font-medium"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus size={13} />
                    <span>{t.addStock}</span>
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Layer Filter Pills & Search Toolbar */}
              <div className="nova-holdings-toolbar">
                <div className="nova-filter-pills" role="tablist" aria-label="按资产层级筛选">
                  <button
                    type="button"
                    className={`nova-filter-pill ${layerFilter === 'ALL' ? 'is-active' : ''}`}
                    onClick={() => setLayerFilter('ALL')}
                  >
                    <span>全部</span>
                    <span className="nova-filter-count">{aggregated.length}</span>
                  </button>
                  {LAYERS.map((layer) => {
                    const count = aggregated.filter((item) => item.layer === layer).length;
                    return (
                      <button
                        key={layer}
                        type="button"
                        className={`nova-filter-pill ${layerFilter === layer ? 'is-active' : ''}`}
                        onClick={() => setLayerFilter(layer)}
                      >
                        <span className="nova-dot" style={{ background: LAYER_META[layer].color }} />
                        <span>{LAYER_META[layer].label}</span>
                        <span className="nova-filter-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="nova-search-box">
                  <Search size={13} className="nova-search-icon" />
                  <input
                    type="search"
                    value={holdingSearch}
                    onChange={(event) => setHoldingSearch(event.target.value)}
                    placeholder="搜索代码、名称或券商..."
                    className="nova-search-input"
                  />
                  {holdingSearch && (
                    <button
                      type="button"
                      className="nova-search-clear"
                      onClick={() => setHoldingSearch('')}
                      aria-label="清空搜索"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.symbol}</TableHead>
                    <TableHead className="text-right">{t.value}</TableHead>
                    <TableHead className="text-right">{t.weight}</TableHead>
                    <TableHead className="text-center">{t.layer}</TableHead>
                    <TableHead className="text-right">{t.qty}</TableHead>
                    <TableHead className="text-right">{t.price}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHoldings.length ? (
                    filteredHoldings.map((holding) => (
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
                        onUpdateHolding={onUpdateHolding}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                          <strong className="text-foreground">
                            {holdingSearch || layerFilter !== 'ALL'
                              ? '未找到匹配的持仓标的'
                              : t.emptyTitle}
                          </strong>
                          <span>
                            {holdingSearch || layerFilter !== 'ALL'
                              ? '请尝试切换分层或清空搜索条件。'
                              : t.emptyBody}
                          </span>
                          {holdingSearch || layerFilter !== 'ALL' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setLayerFilter('ALL');
                                setHoldingSearch('');
                              }}
                              className="gf-text-action mt-1"
                            >
                              重置筛选条件
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setImportOpen(true)}
                              className="gf-primary-action mt-1"
                            >
                              <Upload size={14} />
                              <span>{t.importPositions}</span>
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* =====================================================================
              30% STRATEGY & REBALANCE: Unified Corridor & Share Reference Card
             ===================================================================== */}
          {aggregated.length > 0 && (
            <ClassicRebalanceAnalytics
              holdings={activeHoldings}
              aggregated={aggregated}
              rawAggregated={rawAggregated}
              totalValue={total}
              baseCurrency={baseCurrency}
            />
          )}

          {/* =====================================================================
              INDEPENDENT BOTTOM SECTION: Daily Financial Accounts Memo
             ===================================================================== */}
          <AccountVaultSection
            allHoldings={holdings}
            baseCurrency={baseCurrency}
            fx={fx}
            onUpdateHolding={onUpdateHolding}
          />

          {/* Minimalist Footer Action Row */}
          <div className="flex items-center justify-between flex-wrap gap-4 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href="https://github.com/KongMing-Japan/portfolio/blob/main/docs/methodology.zh.md"
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:underline font-medium"
              >
                详细方法论
              </a>
              <span>·</span>
              <span>数据来源: Yahoo Finance · SEC EDGAR</span>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Trash2 size={12} />
              <span>{t.clear}</span>
            </button>
          </div>
        </div>
      )}

      <footer className="w-full max-w-7xl mx-auto mt-16 pt-8 pb-12 border-t border-border px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div>
          <span>© 2026 KongMing LLC · 孔明合同会社</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="opacity-75">KongMing Network:</span>
          <a href="https://kongmingjapan.com/" target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground transition-colors">
            KongMing
          </a>
          <span>·</span>
          <a href="https://radar.kongmingjapan.com/" target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground transition-colors">
            Radar
          </a>
          <span>·</span>
          <a href="https://lab.kongmingjapan.com/" target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground transition-colors">
            Lab
          </a>
          <span>·</span>
          <a href="https://kodomo.fyi/" target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground transition-colors">
            Kodomo Go!
          </a>
          <span>·</span>
          <a href="https://tax.kongmingjapan.com/" target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground transition-colors">
            Tax
          </a>
          <span>·</span>
          <a href="https://planner.kongmingjapan.com/" target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground transition-colors">
            Planner
          </a>
          <span>·</span>
          <a href="https://portfolio.kongmingjapan.com/" target="_blank" rel="noreferrer" className="font-semibold text-foreground">
            Portfolio
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

            {isAnalyzing ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="animate-spin text-primary" size={28} />
                <p className="text-sm font-semibold text-foreground">{analyzingNotice}</p>
                <p className="text-xs text-muted-foreground">正在调用 AI 智能识别代码、标的名称与最新持仓数量...</p>
              </div>
            ) : importMode === 'upload' ? (
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
                  void processFiles(event.dataTransfer.files);
                }}
              >
                <Upload size={30} strokeWidth={1.6} />
                <strong>拖拽单张持仓截图到此处 (限制 1 张)</strong>
                <span>支持 PNG / JPG / WebP（AI 识别代码与持仓数）或 CSV</span>
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  {t.choose}
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept={ACCEPTED}
                  onChange={(event) => void processFiles(event.target.files)}
                />
              </div>
            ) : (
              <div className="gf-paste-panel">
                <p className="text-xs text-muted-foreground mb-2">
                  直接粘贴任意格式文本（微信聊天记录、券商账单、持仓文字截取、或自定义表格文字）。AI 将自动识别股票代码与最新持仓数。
                </p>
                <textarea
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  spellCheck={false}
                  placeholder={`可直接粘贴任意文本：\n今天在乐天证券买入 1482.T 100股 现价 2050日元\nNVDA 50股 现价 140美元\n腾讯控股 00700 200股\n\n或表格格式：\nAAPL, Apple, USD, 100, 200, Demo Broker\nCash_USD, USD Cash, USD, 50000, 1, Demo Broker`}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => void handleAiTextExtract()}
                  >
                    <Sparkles size={13} />
                    <span>AI 智能识别持仓并预览</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                    onClick={() => void handleCsvTextExtract()}
                  >
                    <span>标准 CSV 直接解析</span>
                  </button>
                </div>
              </div>
            )}

            <div className="gf-import-actions">
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 font-semibold"
              >
                <Lock size={13} />
                我的持仓 (PIN登录)
              </button>
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

      <UpsertReviewModal
        isOpen={Boolean(extractedPreview)}
        incoming={extractedPreview ?? []}
        existingHoldings={holdings}
        baseCurrency={baseCurrency}
        onConfirm={handleConfirmUpsert}
        onClose={() => setExtractedPreview(null)}
      />

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
                <span>{t.currentPrice}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft.marketPrice ?? ''}
                  onChange={(event) => {
                    const num = event.target.value === '' ? null : Number(event.target.value);
                    setDraft((current) => ({
                      ...current,
                      marketPrice: num,
                      averagePrice: num ?? current.averagePrice,
                    }));
                  }}
                  required
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
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {POPULAR_BROKERS.map((brokerName) => (
                    <button
                      key={brokerName}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({ ...current, broker: brokerName }))
                      }
                      className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors cursor-pointer ${
                        draft.broker === brokerName
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:text-foreground'
                      }`}
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



      <UserAuthModal
        isOpen={authModalOpen}
        isUnlocked={Boolean(isOwnerUnlocked)}
        onClose={() => setAuthModalOpen(false)}
        onUnlockSuccess={() => {
          onUnlockOwner?.();
        }}
        onLockVault={() => {
          onLockOwner?.();
        }}
        onResetToVerifiedBaseline={() => {
          onResetOwnerBaseline?.();
        }}
      />

      <datalist id="popular-brokers-list">
        {POPULAR_BROKERS.map((brokerName) => (
          <option key={brokerName} value={brokerName} />
        ))}
      </datalist>

      {saveToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2"
        >
          <Check size={14} />
          <span>{saveToast}</span>
        </div>
      )}
    </main>
  );
}

function FinanceHoldingRow({
  holding,
  baseCurrency,
  expanded,
  onToggle,
  onUpdateHolding,
}: {
  holding: AggregatedHolding;
  baseCurrency: BaseCurrency;
  expanded: boolean;
  onToggle: () => void;
  onUpdateHolding: (id: string, patch: Partial<Holding>) => Promise<void>;
}) {
  const firstAccount = holding.accounts[0];
  const isMultiAccount = holding.accounts.length > 1;
  const isPureCash =
    holding.layer === 'Cash' ||
    holding.ticker.startsWith('Cash') ||
    holding.ticker.startsWith('CASH_');

  return (
    <>
      <TableRow
        onClick={onToggle}
        className="cursor-pointer hover:bg-muted/40 transition-colors"
      >
        <TableCell>
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="size-7 rounded-lg bg-muted text-foreground flex items-center justify-center font-semibold text-xs shrink-0 border border-border">
              {holding.ticker.slice(0, 1)}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-xs font-semibold text-foreground">
                {getCleanSecurityName(holding.ticker, holding.name)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {holding.ticker}
              </span>
              {isMultiAccount && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                  {holding.accounts.length} 笔合并
                </Badge>
              )}
              {holding.weight > SINGLE_SECURITY_CAP && holding.layer !== 'Cash' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                  &gt;15%
                </Badge>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="text-right font-semibold tabular-nums text-xs text-foreground">
          {formatMoney(holding.marketValueBase, baseCurrency)}
        </TableCell>

        <TableCell className="text-right font-semibold tabular-nums text-xs text-foreground">
          {formatPercent(holding.weight)}
        </TableCell>

        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
          <select
            aria-label={`${holding.ticker} 资产分层`}
            value={holding.layer}
            onChange={(event) => {
              const targetLayer = event.target.value as Layer;
              holding.accounts.forEach((acc) => {
                void onUpdateHolding(acc.id, { layer: targetLayer });
              });
            }}
            className="h-6 px-2 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            {LAYERS.map((layer) => (
              <option key={layer} value={layer}>
                {LAYER_META[layer].label}
              </option>
            ))}
          </select>
        </TableCell>

        {/* Direct Inline Edit for Quantity on Single-Account Rows */}
        <TableCell className="text-right tabular-nums text-xs" onClick={(e) => e.stopPropagation()}>
          {!isMultiAccount && firstAccount ? (
            <div className="inline-flex items-center justify-end gap-1">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                aria-label={`${holding.ticker} 持股数`}
                value={firstAccount.quantity}
                onChange={(event) =>
                  void onUpdateHolding(firstAccount.id, {
                    quantity: Number(event.target.value),
                  })
                }
                className="w-24 h-7 px-2 text-right text-xs tabular-nums rounded-md border border-border bg-background hover:border-foreground/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                title="直接修改持股数或金额"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline cursor-pointer"
            >
              展开 {holding.accounts.length} 笔修改
            </button>
          )}
        </TableCell>

        {/* Direct Inline Edit for Unit Price on Single-Account Rows */}
        <TableCell className="text-right tabular-nums text-xs" onClick={(e) => e.stopPropagation()}>
          {!isMultiAccount && firstAccount ? (
            isPureCash && (firstAccount.marketPrice === 1 || firstAccount.marketPrice == null) ? (
              <span className="text-xs text-muted-foreground">{firstAccount.currency}</span>
            ) : (
              <div className="inline-flex items-center justify-end gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  aria-label={`${holding.ticker} 单价`}
                  placeholder={firstAccount.marketPrice == null ? '输入现价' : undefined}
                  value={formatEditableNumber(firstAccount.marketPrice)}
                  onChange={(event) =>
                    void onUpdateHolding(firstAccount.id, {
                      marketPrice:
                        event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                  className="w-24 h-7 px-2 text-right text-xs tabular-nums rounded-md border border-border bg-background hover:border-foreground/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                  title={`直接修改单价 (${firstAccount.currency})`}
                />
                <span className="text-[10px] text-muted-foreground w-7 text-left">
                  {firstAccount.currency}
                </span>
              </div>
            )
          ) : (
            <span className="text-xs text-muted-foreground">多账户净值</span>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Sub-Account Rows (for Multi-Account or Detail Inspection) */}
      {expanded &&
        holding.accounts.map((account) => {
          const accountIsPureCash =
            account.layer === 'Cash' ||
            account.ticker.startsWith('Cash') ||
            account.ticker.startsWith('CASH_');

          return (
            <TableRow
              key={account.id}
              className="bg-muted/20"
              onClick={(e) => e.stopPropagation()}
            >
              <TableCell className="pl-10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {account.broker}
                    </span>
                    {account.account && (
                      <span className="text-[11px] text-muted-foreground">
                        · {account.account}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">
                      {account.ticker}
                    </Badge>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-right text-xs tabular-nums font-medium text-foreground">
                {formatMoney(account.valueInBase ?? 0, baseCurrency)}
              </TableCell>

              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                {formatPercent((account.valueInBase ?? 0) / Math.max(holding.marketValueBase, 1))}
              </TableCell>

              <TableCell className="text-center">
                <span className="text-xs text-muted-foreground font-medium">
                  {LAYER_META[account.layer]?.label ?? account.layer}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={account.quantity}
                  onChange={(event) =>
                    void onUpdateHolding(account.id, {
                      quantity: Number(event.target.value),
                    })
                  }
                  className="w-24 h-7 px-2 text-right text-xs tabular-nums rounded-md border border-border bg-background focus:border-primary focus:outline-none"
                  title="修改持股数量或余额"
                />
              </TableCell>

              <TableCell className="text-right">
                {accountIsPureCash && (account.marketPrice === 1 || account.marketPrice == null) ? (
                  <span className="text-xs text-muted-foreground">{account.currency}</span>
                ) : (
                  <div className="inline-flex items-center justify-end gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder={account.marketPrice == null ? '输入现价' : undefined}
                      value={formatEditableNumber(account.marketPrice)}
                      onChange={(event) =>
                        void onUpdateHolding(account.id, {
                          marketPrice:
                            event.target.value === '' ? null : Number(event.target.value),
                        })
                      }
                      className="w-24 h-7 px-2 text-right text-xs tabular-nums rounded-md border border-border bg-background focus:border-primary focus:outline-none font-medium"
                      title={`修改单价 (${account.currency})`}
                    />
                    <span className="text-[10px] text-muted-foreground w-7 text-left">
                      {account.currency}
                    </span>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
