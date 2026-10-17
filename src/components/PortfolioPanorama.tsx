import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Cpu,
  DollarSign,
  Filter,
  Globe2,
  Layers,
  LayoutGrid,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  assetClassFromHolding,
  calculateAggregatedPnL,
  canonicalThemeFromHolding,
  dualEngineFromHolding,
  formatMoney,
  formatPercent,
  fxExposureFromHolding,
  LAYER_META,
  underlyingMarketFromHolding,
} from '../lib/portfolio';
import { SINGLE_SECURITY_CAP, SINGLE_THEME_CAP } from '../lib/rebalance';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
} from '../types';

export interface PanoramaFilter {
  dimension: 'layer' | 'theme' | 'market' | 'fx' | 'ticker' | 'engine';
  value: string;
  label: string;
}

interface PortfolioPanoramaProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  activeFilter?: PanoramaFilter | null;
  onSelectFilter?: (filter: PanoramaFilter | null) => void;
}

const PALETTE = [
  '#2563eb', // Blue (Core)
  '#7c3aed', // Violet (Satellite)
  '#0d9488', // Teal (Defensive)
  '#4f46e5', // Indigo
  '#0284c7', // Sky
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#64748b', // Slate (Cash)
];

const ENGINE_META: Record<
  ReturnType<typeof dualEngineFromHolding>,
  { color: string; bg: string; border: string; badge: string }
> = {
  '美股 AI 算力与科技生态': {
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.06)',
    border: 'rgba(37, 99, 235, 0.25)',
    badge: 'bg-blue-500/10 text-blue-700 border-blue-200',
  },
  '中国智能电车与平台经济': {
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.06)',
    border: 'rgba(124, 58, 237, 0.25)',
    badge: 'bg-violet-500/10 text-violet-700 border-violet-200',
  },
  '全球宽基与固收缓冲': {
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.06)',
    border: 'rgba(13, 148, 136, 0.25)',
    badge: 'bg-teal-500/10 text-teal-700 border-teal-200',
  },
  '战术卫星与新兴市场': {
    color: '#4f46e5',
    bg: 'rgba(79, 70, 229, 0.06)',
    border: 'rgba(79, 70, 229, 0.25)',
    badge: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
  },
  '多币种流动性储备': {
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.06)',
    border: 'rgba(100, 116, 139, 0.25)',
    badge: 'bg-slate-500/10 text-slate-700 border-slate-200',
  },
};

const geoChartConfig = {
  percentNum: {
    label: '底层国别权重 (%)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

const miniYieldChartConfig = {
  value: {
    label: '季度现金流分布',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function PortfolioPanorama({
  holdings,
  aggregated,
  totalValue,
  baseCurrency,
  activeFilter,
  onSelectFilter,
}: PortfolioPanoramaProps) {
  const [heroDimension, setHeroDimension] = useState<'treemap' | 'dualEngine' | 'fxHedge'>('treemap');

  const toggleFilter = (next: PanoramaFilter) => {
    if (!onSelectFilter) return;
    if (
      activeFilter &&
      activeFilter.dimension === next.dimension &&
      activeFilter.value === next.value
    ) {
      onSelectFilter(null);
    } else {
      onSelectFilter(next);
    }
  };

  // 0. Layer x Security Proportional Treemap Data
  const layerTreemapGroups = useMemo(() => {
    const layers: Layer[] = ['Core', 'Defensive', 'Satellite', 'Cash'];
    return layers
      .map((layer) => {
        const items = aggregated
          .filter((a) => a.layer === layer && a.marketValueBase > 0)
          .sort((a, b) => b.marketValueBase - a.marketValueBase);
        const layerValue = items.reduce((s, i) => s + i.marketValueBase, 0);
        const layerWeight = totalValue > 0 ? layerValue / totalValue : 0;
        return {
          layer,
          meta: LAYER_META[layer],
          value: layerValue,
          weight: layerWeight,
          items: items.map((item) => {
            const pnl = calculateAggregatedPnL(item);
            return {
              ...item,
              pnl,
              shareOfLayer: layerValue > 0 ? item.marketValueBase / layerValue : 0,
              isOverCap: item.weight > SINGLE_SECURITY_CAP && item.layer !== 'Cash',
            };
          }),
        };
      })
      .filter((g) => g.value > 0);
  }, [aggregated, totalValue]);

  // 1. Underlying Geography Look-Through (穿透 ETF/QDII 包装至底层真实经济体)
  const marketGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const market = underlyingMarketFromHolding(h);
      const val = h.valueInBase ?? 0;
      const cur = map.get(market) ?? { value: 0, count: 0, items: [] };
      cur.value += val;
      cur.count += 1;
      const labelItem = h.name || h.ticker;
      if (!cur.items.includes(labelItem)) {
        cur.items.push(labelItem);
      }
      map.set(market, cur);
    }
    return [...map.entries()]
      .map(([label, d], idx) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        percentNum: totalValue > 0 ? Math.round((d.value / totalValue) * 1000) / 10 : 0,
        count: d.count,
        items: d.items,
        color: PALETTE[idx % PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 2. True Currency & FX Hedge Look-Through (真实汇率风险敞口 vs 日元对冲)
  const fxExposureGroups = useMemo(() => {
    const map = new Map<
      string,
      { value: number; count: number; items: string[]; isHedgedOrJpy: boolean }
    >();
    for (const h of holdings) {
      const fxType = fxExposureFromHolding(h);
      const val = h.valueInBase ?? 0;
      const cur = map.get(fxType) ?? {
        value: 0,
        count: 0,
        items: [],
        isHedgedOrJpy: fxType.startsWith('JPY'),
      };
      cur.value += val;
      cur.count += 1;
      const labelItem = h.name || h.ticker;
      if (!cur.items.includes(labelItem)) {
        cur.items.push(labelItem);
      }
      map.set(fxType, cur);
    }
    const colors: Record<string, string> = {
      'JPY 日元及对冲资产 (无汇率风险)': '#0d9488',
      'USD 美元敞口 (未对冲)': '#2563eb',
      'CNY 人民币敞口': '#7c3aed',
      'HKD 港币敞口 (联系汇率)': '#4f46e5',
    };
    return [...map.entries()]
      .map(([label, d], idx) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        percentNum: totalValue > 0 ? Math.round((d.value / totalValue) * 1000) / 10 : 0,
        count: d.count,
        items: d.items,
        isHedgedOrJpy: d.isHedgedOrJpy,
        color: colors[label] ?? PALETTE[idx % PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 3. Asset Class & Estimated Dividend / Yield Stream
  const assetClassGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        value: number;
        count: number;
        items: string[];
        estYieldRate: number;
        quarterlyProfile: number[];
      }
    >();

    for (const h of holdings) {
      const cls = assetClassFromHolding(h.ticker, h.name, h.theme);
      const label =
        cls === 'ETF'
          ? 'ETF 基金'
          : cls === 'Equity'
            ? '股票'
            : cls === 'Fund'
              ? '公募基金'
              : '现金储备';

      const estYieldRate =
        cls === 'ETF'
          ? h.ticker.includes('1482')
            ? 0.036
            : 0.014
          : cls === 'Equity'
            ? h.ticker.includes('9023')
              ? 0.026
              : h.ticker.includes('00700') || h.ticker.includes('7581') || h.ticker.includes('9616')
                ? 0.012
                : 0.005
            : cls === 'Fund'
              ? 0.008
              : 0.018;

      const val = h.valueInBase ?? 0;
      const cur = map.get(label) ?? {
        value: 0,
        count: 0,
        items: [] as string[],
        estYieldRate,
        quarterlyProfile:
          cls === 'ETF'
            ? [22, 28, 24, 26]
            : cls === 'Equity'
              ? [18, 34, 16, 32]
              : cls === 'Fund'
                ? [25, 25, 25, 25]
                : [24, 25, 25, 26],
      };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.name || h.ticker)) {
        cur.items.push(h.name || h.ticker);
      }
      map.set(label, cur);
    }

    return [...map.entries()]
      .map(([label, d], idx) => {
        const weight = totalValue > 0 ? d.value / totalValue : 0;
        const annualCashflow = d.value * d.estYieldRate;
        return {
          label,
          value: d.value,
          weight,
          percentNum: Math.round(weight * 1000) / 10,
          count: d.count,
          items: d.items,
          annualCashflow,
          estYieldRate: d.estYieldRate,
          color: PALETTE[idx % PALETTE.length],
          sparkData: d.quarterlyProfile.map((qVal, qIdx) => ({
            q: `Q${qIdx + 1}`,
            value: Math.round((annualCashflow * qVal) / 100),
          })),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 4. Canonical Theme & US-China Dual Engine Matrix (7大标准战略主题与中美双主线)
  const canonicalThemeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        theme: string;
        engine: ReturnType<typeof dualEngineFromHolding>;
        primaryLayer: Layer;
        value: number;
        count: number;
        holdingsMap: Map<string, { ticker: string; name: string; value: number; layer: Layer }>;
      }
    >();

    for (const h of holdings) {
      const theme = canonicalThemeFromHolding(h);
      const engine = dualEngineFromHolding(h);
      const val = h.valueInBase ?? 0;
      const cur = map.get(theme) ?? {
        theme,
        engine,
        primaryLayer: h.layer,
        value: 0,
        count: 0,
        holdingsMap: new Map(),
      };
      cur.value += val;
      cur.count += 1;
      const sym = h.ticker || h.name;
      const prevSym = cur.holdingsMap.get(sym) ?? {
        ticker: h.ticker,
        name: h.name || sym,
        value: 0,
        layer: h.layer,
      };
      prevSym.value += val;
      cur.holdingsMap.set(sym, prevSym);
      map.set(theme, cur);
    }

    return [...map.values()]
      .map((d) => {
        const sortedItems = [...d.holdingsMap.values()]
          .sort((a, b) => b.value - a.value)
          .map((info) => ({
            symbol: info.ticker,
            name: info.name,
            value: info.value,
            layer: info.layer,
            weight: totalValue > 0 ? info.value / totalValue : 0,
          }));
        const topLayer = sortedItems[0]?.layer ?? d.primaryLayer;
        const weight = totalValue > 0 ? d.value / totalValue : 0;
        return {
          label: d.theme,
          engine: d.engine,
          layer: topLayer,
          value: d.value,
          weight,
          isOverCap: weight > SINGLE_THEME_CAP && topLayer !== 'Cash',
          count: d.count,
          sortedItems,
          color: LAYER_META[topLayer].color,
          pale: LAYER_META[topLayer].pale,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const dualEngineSummary = useMemo(() => {
    const map = new Map<
      ReturnType<typeof dualEngineFromHolding>,
      { value: number; count: number; items: string[] }
    >();
    for (const h of holdings) {
      const engine = dualEngineFromHolding(h);
      const val = h.valueInBase ?? 0;
      const cur = map.get(engine) ?? { value: 0, count: 0, items: [] };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.name || h.ticker)) {
        cur.items.push(h.name || h.ticker);
      }
      map.set(engine, cur);
    }
    return [...map.entries()]
      .map(([engine, info]) => ({
        engine,
        value: info.value,
        weight: totalValue > 0 ? info.value / totalValue : 0,
        count: info.count,
        items: info.items,
        meta: ENGINE_META[engine],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const totalEstimatedAnnualYield = useMemo(
    () => assetClassGroups.reduce((s, g) => s + g.annualCashflow, 0),
    [assetClassGroups],
  );

  return (
    <section className="flex flex-col gap-6 perf-contain-section" id="panorama">
      {/* Interactive Brushing Status Banner */}
      {activeFilter && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">当前联动筛选视图：</span>
            <Badge variant="default" className="text-xs font-semibold">
              {activeFilter.label}
            </Badge>
            <span className="text-muted-foreground hidden sm:inline">
              （下方持仓明细表已同步过滤，再次点击图表块或右侧按钮可恢复全量）
            </span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onSelectFilter?.(null)}
            className="h-7 gap-1 text-xs font-semibold text-primary hover:text-primary"
          >
            <X className="size-3.5" />
            清除筛选
          </Button>
        </div>
      )}

      {/* HERO CARD (70% Core Visual): Interactive Multi-Dimensional Proportional Treemap */}
      <Card className="w-full overflow-hidden border-border/80 shadow-xs">
        <CardHeader className="border-b bg-muted/20 pb-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="size-4 text-primary" />
                <span>持仓全景透视矩阵 (Interactive Allocation Matrix)</span>
                <Badge variant="outline" className="text-[10px] font-medium">
                  点击任意色块联动筛选明细
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                面积严格对应资产真实市值权重 · 单一证券风控红线 {(SINGLE_SECURITY_CAP * 100).toFixed(0)}% · 单一主题上限 {(SINGLE_THEME_CAP * 100).toFixed(0)}%
              </p>
            </div>

            {/* Dimension Switcher */}
            <div className="inline-flex items-center rounded-lg border bg-background p-0.5 shadow-2xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setHeroDimension('treemap')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  heroDimension === 'treemap'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                四层 × 标的树图
              </button>
              <button
                type="button"
                onClick={() => setHeroDimension('dualEngine')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  heroDimension === 'dualEngine'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                中美双主线 × 主题
              </button>
              <button
                type="button"
                onClick={() => setHeroDimension('fxHedge')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  heroDimension === 'fxHedge'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                汇率对冲 × 国别
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 flex flex-col gap-5">
          {/* VIEW 1: 4-Layer x Individual Holdings Proportional Nested Treemap */}
          {heroDimension === 'treemap' && (
            <div className="flex flex-col gap-4">
              {/* Top Proportional Layer Strip */}
              <div className="flex h-8 w-full overflow-hidden rounded-lg border p-0.5 gap-1 bg-muted/30">
                {layerTreemapGroups.map((lg) => {
                  const isLayerSelected =
                    activeFilter?.dimension === 'layer' && activeFilter.value === lg.layer;
                  return (
                    <button
                      key={lg.layer}
                      type="button"
                      onClick={() =>
                        toggleFilter({
                          dimension: 'layer',
                          value: lg.layer,
                          label: `${lg.meta.label}`,
                        })
                      }
                      style={{
                        width: `${Math.max(4, lg.weight * 100)}%`,
                        background: lg.meta.color,
                      }}
                      className={`flex items-center justify-center gap-1 rounded text-[11px] font-semibold text-white transition-all cursor-pointer hover:opacity-90 overflow-hidden whitespace-nowrap px-1.5 ${
                        isLayerSelected ? 'ring-2 ring-offset-1 ring-foreground' : ''
                      }`}
                      title={`点击筛选 ${lg.meta.label}: ${formatPercent(lg.weight)} (${formatMoney(lg.value, baseCurrency)})`}
                    >
                      <span>{lg.meta.label.split(' ')[0]}</span>
                      <span className="font-mono opacity-90">{formatPercent(lg.weight, 0)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nested Treemap Blocks per Layer */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {layerTreemapGroups.map((lg) => {
                  // Span proportional to weight on large screens (min 3 cols, max 6 cols)
                  const colSpanClass =
                    lg.weight >= 0.35
                      ? 'lg:col-span-6'
                      : lg.weight >= 0.18
                        ? 'lg:col-span-6'
                        : 'lg:col-span-6';
                  const isLayerSelected =
                    activeFilter?.dimension === 'layer' && activeFilter.value === lg.layer;

                  return (
                    <div
                      key={lg.layer}
                      className={`${colSpanClass} rounded-xl border p-3.5 flex flex-col gap-3 transition-all ${
                        isLayerSelected ? 'ring-2 ring-primary bg-primary/[0.02]' : 'bg-card'
                      }`}
                      style={{
                        borderTop: `3px solid ${lg.meta.color}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            toggleFilter({
                              dimension: 'layer',
                              value: lg.layer,
                              label: lg.meta.label,
                            })
                          }
                          className="flex items-center gap-2 text-left group cursor-pointer"
                        >
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ background: lg.meta.color }}
                          />
                          <strong className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                            {lg.meta.label}
                          </strong>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {lg.items.length} 项
                          </Badge>
                        </button>
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono tabular-nums text-foreground">
                            {formatPercent(lg.weight)}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono tabular-nums ml-1.5">
                            {formatMoney(lg.value, baseCurrency)}
                          </span>
                        </div>
                      </div>

                      {/* Proportional Flex-Wrap Treemap Tiles inside this Layer */}
                      <div className="flex flex-wrap gap-1.5">
                        {lg.items.map((item) => {
                          const flexBasisPct = Math.max(
                            22,
                            Math.min(100, Math.round(item.shareOfLayer * 100)),
                          );
                          const isTickerSelected =
                            activeFilter?.dimension === 'ticker' &&
                            activeFilter.value === item.ticker;

                          return (
                            <button
                              key={item.ticker}
                              type="button"
                              onClick={() =>
                                toggleFilter({
                                  dimension: 'ticker',
                                  value: item.ticker,
                                  label: `${item.name} (${item.ticker})`,
                                })
                              }
                              style={{
                                flex: `${Math.max(1, Math.round(item.shareOfLayer * 100))} 1 ${flexBasisPct}%`,
                                background: isTickerSelected ? lg.meta.color : lg.meta.pale,
                                borderColor: item.isOverCap
                                  ? '#e11d48'
                                  : isTickerSelected
                                    ? lg.meta.color
                                    : 'rgba(15, 23, 42, 0.08)',
                              }}
                              className={`group relative rounded-lg border p-2.5 text-left transition-all cursor-pointer hover:shadow-xs min-w-[125px] ${
                                isTickerSelected ? 'text-white shadow-xs' : 'text-foreground'
                              }`}
                              title={`${item.name} (${item.ticker}) · 占总资产 ${formatPercent(item.weight)} · ${formatMoney(item.marketValueBase, baseCurrency)}`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span
                                  className={`text-xs font-bold leading-tight line-clamp-1 ${
                                    isTickerSelected ? 'text-white' : 'text-foreground'
                                  }`}
                                >
                                  {item.name}
                                </span>
                                {item.isOverCap && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1 py-0.2 text-[9px] font-bold text-rose-600 shrink-0"
                                    title="突破单一证券 15% 风控上限"
                                  >
                                    <ShieldAlert className="size-2.5" />
                                    超限
                                  </span>
                                )}
                              </div>

                              <div className="mt-1.5 flex items-baseline justify-between gap-1">
                                <span
                                  className={`text-xs font-extrabold font-mono tabular-nums ${
                                    isTickerSelected ? 'text-white' : 'text-foreground'
                                  }`}
                                >
                                  {formatPercent(item.weight)}
                                </span>
                                <span
                                  className={`text-[10px] font-mono tabular-nums ${
                                    isTickerSelected ? 'text-white/85' : 'text-muted-foreground'
                                  }`}
                                >
                                  {formatMoney(item.marketValueBase, baseCurrency)}
                                </span>
                              </div>

                              {item.pnl.hasCost && Math.abs(item.pnl.returnPct ?? 0) > 0.0005 && (
                                <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
                                  <span
                                    className={
                                      isTickerSelected
                                        ? 'text-white/90'
                                        : (item.pnl.returnPct ?? 0) >= 0
                                          ? 'text-emerald-600 font-semibold'
                                          : 'text-rose-600 font-semibold'
                                    }
                                  >
                                    {(item.pnl.returnPct ?? 0) >= 0 ? '+' : ''}
                                    {((item.pnl.returnPct ?? 0) * 100).toFixed(2)}%
                                  </span>
                                  {item.pnl.satelliteDiscipline === 'take_profit' && (
                                    <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-bold text-emerald-700">
                                      +30%止盈线
                                    </span>
                                  )}
                                  {item.pnl.satelliteDiscipline === 'stop_loss' && (
                                    <span className="rounded bg-rose-500/15 px-1 text-[9px] font-bold text-rose-700">
                                      -15%止损线
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: US-China Dual Engine & Canonical Themes */}
          {heroDimension === 'dualEngine' && (
            <div className="flex flex-col gap-5">
              {/* Dual-Engine Top Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {dualEngineSummary.map((eng) => {
                  const isSelected =
                    activeFilter?.dimension === 'engine' && activeFilter.value === eng.engine;
                  return (
                    <button
                      key={eng.engine}
                      type="button"
                      onClick={() =>
                        toggleFilter({
                          dimension: 'engine',
                          value: eng.engine,
                          label: eng.engine,
                        })
                      }
                      style={{
                        background: eng.meta.bg,
                        borderColor: isSelected ? eng.meta.color : eng.meta.border,
                      }}
                      className={`rounded-xl border p-3 text-left transition-all cursor-pointer hover:shadow-xs flex flex-col justify-between gap-2 ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-xs font-bold leading-snug line-clamp-1"
                          style={{ color: eng.meta.color }}
                        >
                          {eng.engine}
                        </span>
                        <ArrowUpRight className="size-3.5 shrink-0 opacity-60" />
                      </div>
                      <div>
                        <div className="text-lg font-extrabold font-mono tabular-nums text-foreground">
                          {formatPercent(eng.weight)}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                          {formatMoney(eng.value, baseCurrency)} · {eng.count} 笔
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Canonical Theme Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {canonicalThemeGroups.map((tg) => {
                  const isSelected =
                    activeFilter?.dimension === 'theme' && activeFilter.value === tg.label;
                  return (
                    <div
                      key={tg.label}
                      onClick={() =>
                        toggleFilter({
                          dimension: 'theme',
                          value: tg.label,
                          label: `主题：${tg.label}`,
                        })
                      }
                      className={`rounded-xl border bg-card p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-primary/50 transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-primary bg-primary/[0.02]' : ''
                      }`}
                      style={{
                        borderTop: `3px solid ${tg.color}`,
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: tg.pale,
                              color: tg.color,
                            }}
                          >
                            {tg.engine}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums font-mono">
                            {formatMoney(tg.value, baseCurrency)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <strong
                            className="text-xs font-semibold text-foreground line-clamp-1"
                            title={tg.label}
                          >
                            {tg.label}
                          </strong>
                          <span className="text-sm font-bold font-mono tabular-nums text-foreground shrink-0">
                            {formatPercent(tg.weight)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 border-t border-dashed pt-2">
                        {tg.sortedItems.slice(0, 4).map((item) => (
                          <div
                            key={item.symbol}
                            className="flex items-center justify-between text-[11px] text-muted-foreground"
                          >
                            <span
                              className="truncate max-w-[145px] text-foreground/90"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <span className="font-mono font-medium tabular-nums">
                              {formatPercent(item.weight)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 3: FX Hedge Exposure & Underlying Geography */}
          {heroDimension === 'fxHedge' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Left: True FX Exposure & Hedge Breakdown */}
              <div className="rounded-xl border p-4 flex flex-col justify-between gap-4 bg-muted/10">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <DollarSign className="size-4 text-primary" />
                      真实汇率风险敞口 (穿透日元对冲型 ETF)
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      点击筛选汇率敞口
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    自动识别 1482.T / 2563.T / 2845.T 等日元对冲工具，将其归入无汇率风险的日元本位池，精准测算未对冲外汇敞口。
                  </p>

                  {/* Segmented Bar */}
                  <div className="flex h-6 w-full overflow-hidden rounded-lg border gap-0.5 mb-4">
                    {fxExposureGroups.map((fg) => (
                      <div
                        key={fg.label}
                        style={{
                          width: `${Math.max(3, fg.weight * 100)}%`,
                          background: fg.color,
                        }}
                        className="flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden whitespace-nowrap px-1"
                        title={`${fg.label}: ${formatPercent(fg.weight)}`}
                      >
                        {fg.weight >= 0.08 ? `${formatPercent(fg.weight, 0)}` : ''}
                      </div>
                    ))}
                  </div>

                  <ItemGroup className="gap-2">
                    {fxExposureGroups.map((fg) => {
                      const isSelected =
                        activeFilter?.dimension === 'fx' && activeFilter.value === fg.label;
                      return (
                        <Item
                          key={fg.label}
                          variant="muted"
                          onClick={() =>
                            toggleFilter({
                              dimension: 'fx',
                              value: fg.label,
                              label: fg.label,
                            })
                          }
                          className={`py-2.5 px-3 cursor-pointer transition-all hover:border-primary/40 ${
                            isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                          }`}
                        >
                          <ItemContent className="gap-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full shrink-0"
                                style={{ background: fg.color }}
                              />
                              <ItemTitle className="text-xs font-semibold">{fg.label}</ItemTitle>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {fg.count} 笔
                              </Badge>
                            </div>
                            <ItemDescription className="text-[11px] line-clamp-1">
                              {fg.items.slice(0, 5).join(' · ')}
                            </ItemDescription>
                          </ItemContent>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold font-mono tabular-nums text-foreground">
                              {formatPercent(fg.weight)}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                              {formatMoney(fg.value, baseCurrency)}
                            </div>
                          </div>
                        </Item>
                      );
                    })}
                  </ItemGroup>
                </div>
              </div>

              {/* Right: Underlying Country Exposure */}
              <div className="rounded-xl border p-4 flex flex-col justify-between gap-4 bg-muted/10">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-bold flex items-center gap-1.5">
                      <Globe2 className="size-4 text-primary" />
                      底层经济体国别敞口 (Look-Through)
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      点击筛选国别
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    将东交所美股 ETF (2563.T/2845.T) 与 A 股 QDII (513500.SS) 还原至美国底层市场。
                  </p>

                  <ItemGroup className="gap-2">
                    {marketGroups.map((group) => {
                      const isSelected =
                        activeFilter?.dimension === 'market' && activeFilter.value === group.label;
                      return (
                        <Item
                          key={group.label}
                          variant="muted"
                          onClick={() =>
                            toggleFilter({
                              dimension: 'market',
                              value: group.label,
                              label: `底层市场：${group.label}`,
                            })
                          }
                          className={`py-2.5 px-3 cursor-pointer transition-all hover:border-primary/40 ${
                            isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                          }`}
                        >
                          <ItemContent className="gap-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2.5 rounded-full shrink-0"
                                style={{ background: group.color }}
                              />
                              <ItemTitle className="text-xs font-semibold">{group.label}</ItemTitle>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {group.count} 笔
                              </Badge>
                            </div>
                            <ItemDescription className="text-[11px] line-clamp-1">
                              {group.items.slice(0, 4).join(' · ')}
                              {group.items.length > 4 ? ` 等 ${group.items.length} 项` : ''}
                            </ItemDescription>
                          </ItemContent>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold font-mono tabular-nums text-foreground">
                              {formatPercent(group.weight)}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                              {formatMoney(group.value, baseCurrency)}
                            </div>
                          </div>
                        </Item>
                      );
                    })}
                  </ItemGroup>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            机构级风控标准：单一证券上限 {(SINGLE_SECURITY_CAP * 100).toFixed(0)}% · 单一主题上限 {(SINGLE_THEME_CAP * 100).toFixed(0)}% · 卫星仓 +30% 止盈 / -15% 止损
          </span>
          <span>涵盖当前口径 {holdings.length} 笔底层仓位明细</span>
        </CardFooter>
      </Card>

      {/* Row 2: Country/Regional Exposure Bar + Asset Vehicles & Yield (Side-by-side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 1: Underlying Country & Economic Exposure */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe2 className="size-4 text-primary" />
              <span>底层国别与汇率结构对比</span>
            </CardTitle>
            <CardAction>
              <Badge variant="outline">底层穿透</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={geoChartConfig} className="h-[195px] w-full">
              <BarChart
                data={marketGroups}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'dataMax + 8']}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={150}
                  tick={{ fontSize: 11.5, fill: 'var(--foreground)', fontWeight: 500 }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(val, _name, item) =>
                        `${val}% (${formatMoney(item.payload.value, baseCurrency)})`
                      }
                    />
                  }
                />
                <Bar
                  dataKey="percentNum"
                  name="底层权重"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={22}
                  onClick={(data) => {
                    const itemLabel = (data as { label?: string; payload?: { label?: string } })?.label ??
                      (data as { payload?: { label?: string } })?.payload?.label;
                    if (itemLabel) {
                      toggleFilter({
                        dimension: 'market',
                        value: itemLabel,
                        label: `底层市场：${itemLabel}`,
                      });
                    }
                  }}
                  className="cursor-pointer"
                >
                  {marketGroups.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <Separator />

            {/* Dual-Engine Compact Breakdown */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-primary" />
                  中美科技双主线 & 真实汇率敞口速览
                </span>
                <span className="text-[11px] text-muted-foreground">点击标签快速过滤</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fxExposureGroups.map((fg) => {
                  const isSelected =
                    activeFilter?.dimension === 'fx' && activeFilter.value === fg.label;
                  return (
                    <button
                      key={fg.label}
                      type="button"
                      onClick={() =>
                        toggleFilter({
                          dimension: 'fx',
                          value: fg.label,
                          label: fg.label,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-muted/40 hover:bg-muted text-foreground'
                      }`}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: isSelected ? '#fff' : fg.color }}
                      />
                      <span>{fg.label.split(' ')[0]}</span>
                      <span className="font-mono font-bold">{formatPercent(fg.weight)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground border-t pt-3">
            点击任意国别条形或汇率敞口胶囊，下方持仓总表将自动过滤对应资产
          </CardFooter>
        </Card>

        {/* Card 2: Asset Class & Dividend Cashflow */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" />
              <span>资产形态与分红现金流</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ItemGroup className="gap-3">
              {assetClassGroups.map((group) => (
                <Item key={group.label} variant="muted" className="py-2.5 px-3">
                  <ItemContent className="gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: group.color }}
                      />
                      <ItemTitle className="text-xs font-semibold">{group.label}</ItemTitle>
                    </div>
                    <ItemDescription className="text-[11px]">
                      占比 {formatPercent(group.weight)} · {formatMoney(group.value, baseCurrency)} ({group.count}笔)
                    </ItemDescription>
                    <Progress value={Math.min(100, group.percentNum)} className="h-1.5 mt-1" />
                  </ItemContent>
                  <ChartContainer
                    config={miniYieldChartConfig}
                    className="hidden h-9 w-20 sm:block shrink-0"
                  >
                    <BarChart
                      data={group.sparkData}
                      margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
                    >
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar
                        dataKey="value"
                        fill={group.color}
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                  <div className="text-right shrink-0 ml-1">
                    <div className="text-xs font-bold tabular-nums text-emerald-600">
                      +{formatMoney(group.annualCashflow, baseCurrency)}/年
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      股息/票息率 ~{(group.estYieldRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t pt-3 text-xs">
            <span className="text-muted-foreground">预估年度被动分红与利息总流入</span>
            <strong className="text-sm font-bold text-emerald-600 tabular-nums">
              +{formatMoney(totalEstimatedAnnualYield, baseCurrency)} / 年
            </strong>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

