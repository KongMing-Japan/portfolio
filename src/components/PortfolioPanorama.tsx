import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Coins,
  Eye,
  FileSpreadsheet,
  Globe2,
  Landmark,
  LayoutGrid,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  assetClassFromHolding,
  formatExactMoney,
  formatMoney,
  formatPercent,
  fxExposureFromHolding,
  isJpyHedgedAsset,
  LAYER_META,
  marketFromTicker,
  underlyingMarketFromHolding,
} from '../lib/portfolio';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
} from '../types';

interface PortfolioPanoramaProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
}

type PanoramaDimension = 'themeTreemap' | 'market' | 'currency' | 'broker' | 'assetClass';
type ChartType = 'bar' | 'donut';
type ExposurePerspective = 'lookthrough' | 'surface';

const PALETTE = [
  '#2563eb', // Blue (Primary)
  '#0d9488', // Teal
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#64748b', // Slate
];

interface PanoramaTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      value: number;
      weight: number;
      count: number;
      items: string[];
      color: string;
      nativeSummary?: string;
    };
  }>;
  baseCurrency: BaseCurrency;
}

function PanoramaChartTooltip({ active, payload, baseCurrency }: PanoramaTooltipProps) {
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
        <span>权重占比</span>
        <strong>{formatPercent(data.weight)}</strong>
      </div>
      <div className="shadcn-chart-tooltip-row">
        <span>评估市值</span>
        <strong>{formatExactMoney(data.value, baseCurrency)}</strong>
      </div>
      {data.nativeSummary && (
        <div className="shadcn-chart-tooltip-row">
          <span>原币种小计</span>
          <strong>{data.nativeSummary}</strong>
        </div>
      )}
      <div className="shadcn-chart-tooltip-row">
        <span>包含明细</span>
        <span>{data.count} 笔持仓</span>
      </div>
    </div>
  );
}

export function PortfolioPanorama({
  holdings,
  totalValue,
  baseCurrency,
}: PortfolioPanoramaProps) {
  const [dimension, setDimension] = useState<PanoramaDimension>('themeTreemap');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [perspective, setPerspective] = useState<ExposurePerspective>('lookthrough');

  // Detect JPY-Hedged US ETFs total (1482.T, 2563.T, 2845.T)
  const jpyHedgedStats = useMemo(() => {
    const hedgedHoldings = holdings.filter((h) => isJpyHedgedAsset(h));
    const value = hedgedHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    const weight = totalValue > 0 ? value / totalValue : 0;
    const tickers = [...new Set(hedgedHoldings.map((h) => h.ticker))];
    return { value, weight, tickers, count: hedgedHoldings.length };
  }, [holdings, totalValue]);

  // 0. Theme & Layer Matrix Groups (主题与四层矩阵树图)
  const themeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        theme: string;
        layer: Layer;
        value: number;
        count: number;
        holdingsMap: Map<string, { name: string; value: number }>;
      }
    >();

    for (const h of holdings) {
      const theme = h.theme?.trim() || '未分类主题';
      const key = `${h.layer}::${theme}`;
      const val = h.valueInBase ?? 0;
      const cur = map.get(key) ?? {
        theme,
        layer: h.layer,
        value: 0,
        count: 0,
        holdingsMap: new Map(),
      };
      cur.value += val;
      cur.count += 1;
      const sym = h.ticker || h.name;
      const prevSym = cur.holdingsMap.get(sym) ?? { name: h.name || sym, value: 0 };
      prevSym.value += val;
      cur.holdingsMap.set(sym, prevSym);
      map.set(key, cur);
    }

    return [...map.values()]
      .map((d) => {
        const sortedItems = [...d.holdingsMap.entries()]
          .sort((a, b) => b[1].value - a[1].value)
          .map(([sym, info]) => ({
            symbol: sym,
            name: info.name,
            value: info.value,
            weight: totalValue > 0 ? info.value / totalValue : 0,
          }));
        return {
          label: d.theme,
          layer: d.layer,
          value: d.value,
          weight: totalValue > 0 ? d.value / totalValue : 0,
          count: d.count,
          items: sortedItems.map((i) => i.symbol),
          sortedItems,
          color: LAYER_META[d.layer].color,
          pale: LAYER_META[d.layer].pale,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 1. Group by Market / Geography (Supports Look-Through vs Surface)
  const marketGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const market =
        perspective === 'lookthrough'
          ? underlyingMarketFromHolding(h)
          : marketFromTicker(h.ticker, h.name);
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
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, perspective, totalValue]);

  // 2. Group by Broker / Institution (17 Accounts reconciliation)
  const brokerGroups = useMemo(() => {
    const map = new Map<
      string,
      { value: number; count: number; items: string[]; nativeMap: Map<string, number> }
    >();
    for (const h of holdings) {
      const broker = h.broker?.trim() || '未标注机构';
      const val = h.valueInBase ?? 0;
      const localVal = h.marketValue ?? h.importedMarketValue ?? 0;
      const cur = map.get(broker) ?? {
        value: 0,
        count: 0,
        items: [] as string[],
        nativeMap: new Map<string, number>(),
      };
      cur.value += val;
      cur.count += 1;
      cur.nativeMap.set(h.currency, (cur.nativeMap.get(h.currency) ?? 0) + localVal);
      if (!cur.items.includes(h.name || h.ticker)) {
        cur.items.push(h.name || h.ticker);
      }
      map.set(broker, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => {
        const nativeParts = [...d.nativeMap.entries()].map(([curr, amt]) =>
          formatExactMoney(amt, curr),
        );
        return {
          label,
          value: d.value,
          weight: totalValue > 0 ? d.value / totalValue : 0,
          count: d.count,
          items: d.items,
          nativeSummary: nativeParts.join(' + '),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 3. Group by Asset Class (Equity, ETF, Fund, Cash)
  const assetClassGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number; items: string[] }>();
    for (const h of holdings) {
      const cls = assetClassFromHolding(h.ticker, h.name, h.theme);
      const label =
        cls === 'Equity'
          ? '股票个股 (Equity)'
          : cls === 'ETF'
            ? '交易所 ETF'
            : cls === 'Fund'
              ? '公募基金 / 投信 / 数字资产'
              : '银行存款 / 货币基金 / 现金';

      const val = h.valueInBase ?? 0;
      const cur = map.get(label) ?? { value: 0, count: 0, items: [] as string[] };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.name || h.ticker)) {
        cur.items.push(h.name || h.ticker);
      }
      map.set(label, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 4. Group by Currency (Look-Through FX/Hedge vs Surface Ledger Currency)
  const currencyGroups = useMemo(() => {
    const map = new Map<
      string,
      { value: number; count: number; items: string[]; nativeTotal: number; nativeCurrency: string }
    >();
    for (const h of holdings) {
      const curKey =
        perspective === 'lookthrough'
          ? fxExposureFromHolding(h)
          : h.currency?.trim() || baseCurrency;
      const val = h.valueInBase ?? 0;
      const localVal = h.marketValue ?? h.importedMarketValue ?? 0;
      const cur = map.get(curKey) ?? {
        value: 0,
        count: 0,
        items: [] as string[],
        nativeTotal: 0,
        nativeCurrency: h.currency || baseCurrency,
      };
      cur.value += val;
      cur.count += 1;
      cur.nativeTotal += localVal;
      if (!cur.items.includes(h.name || h.ticker)) {
        cur.items.push(h.name || h.ticker);
      }
      map.set(curKey, cur);
    }
    return [...map.entries()]
      .map(([label, d]) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        count: d.count,
        items: d.items,
        nativeSummary:
          perspective === 'surface'
            ? formatExactMoney(d.nativeTotal, d.nativeCurrency)
            : undefined,
      }))
      .sort((a, b) => b.value - a.value);
  }, [baseCurrency, holdings, perspective, totalValue]);

  const activeGroups = useMemo(() => {
    const list =
      dimension === 'market'
        ? marketGroups
        : dimension === 'broker'
          ? brokerGroups
          : dimension === 'assetClass'
            ? assetClassGroups
            : dimension === 'currency'
              ? currencyGroups
              : themeGroups;
    return list.map((item, idx) => ({
      ...item,
      color:
        'color' in item && typeof item.color === 'string'
          ? item.color
          : PALETTE[idx % PALETTE.length],
      percentNum: Math.round(item.weight * 1000) / 10,
    }));
  }, [dimension, marketGroups, brokerGroups, assetClassGroups, currencyGroups, themeGroups]);

  const dimensionTitle =
    dimension === 'themeTreemap'
      ? '四层架构 × 投资主题穿透矩阵 (Theme & Layer Matrix)'
      : dimension === 'market'
        ? perspective === 'lookthrough'
          ? '底层真实国别与经济体敞口 (穿透 ETF/QDII 包装)'
          : '账面挂牌交易市场分布 (Surface Market)'
        : dimension === 'broker'
          ? `账户与机构沉淀对账单 (共 ${brokerGroups.length} 个账户)`
          : dimension === 'assetClass'
            ? '资产载体透视 (股票 / ETF / 基金 / 现金存款)'
            : perspective === 'lookthrough'
              ? '底层真实汇率与对冲暴露 (区分日元对冲 vs 无对冲美元)'
              : '账面计价币种核对汇总 (JPY / CNY / HKD / USD)';

  return (
    <section className="nova-card gf-panorama-section" id="panorama">
      {/* Top Header & Controls */}
      <div className="gf-chart-card-header">
        <div className="gf-chart-title-group">
          <h3>
            <Globe2 size={16} color="var(--primary)" />
            <span>{dimensionTitle}</span>
          </h3>
          <p>
            支持「底层穿透视角（识别日股中的美债/纳指/标普对冲ETF与QDII）」与「账面核对视角」一键切换
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Look-Through vs Surface Perspective Toggle */}
          {(dimension === 'market' || dimension === 'currency') && (
            <div
              style={{
                display: 'inline-flex',
                background: '#eff6ff',
                borderRadius: 'calc(var(--radius) * 0.8)',
                padding: '3px',
                gap: '2px',
                border: '1px solid #bfdbfe',
              }}
              role="group"
              aria-label="穿透视角切换"
            >
              <button
                type="button"
                onClick={() => setPerspective('lookthrough')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 9px',
                  border: 'none',
                  borderRadius: 'calc(var(--radius) * 0.6)',
                  background: perspective === 'lookthrough' ? '#2563eb' : 'transparent',
                  color: perspective === 'lookthrough' ? '#ffffff' : '#1e40af',
                  fontWeight: 600,
                  fontSize: '0.73rem',
                  cursor: 'pointer',
                }}
              >
                <Eye size={12} />
                <span>底层穿透视角</span>
              </button>
              <button
                type="button"
                onClick={() => setPerspective('surface')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 9px',
                  border: 'none',
                  borderRadius: 'calc(var(--radius) * 0.6)',
                  background: perspective === 'surface' ? '#2563eb' : 'transparent',
                  color: perspective === 'surface' ? '#ffffff' : '#1e40af',
                  fontWeight: 600,
                  fontSize: '0.73rem',
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={12} />
                <span>账面挂牌核对</span>
              </button>
            </div>
          )}

          {/* Dimension Tabs */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--muted)',
              borderRadius: 'calc(var(--radius) * 0.8)',
              padding: '3px',
              gap: '2px',
              border: '1px solid var(--border)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => setDimension('themeTreemap')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                border: 'none',
                borderRadius: 'calc(var(--radius) * 0.6)',
                background: dimension === 'themeTreemap' ? 'var(--background)' : 'transparent',
                color: dimension === 'themeTreemap' ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: dimension === 'themeTreemap' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: dimension === 'themeTreemap' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <LayoutGrid size={13} />
              <span>主题树图</span>
            </button>
            <button
              type="button"
              onClick={() => setDimension('market')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                border: 'none',
                borderRadius: 'calc(var(--radius) * 0.6)',
                background: dimension === 'market' ? 'var(--background)' : 'transparent',
                color: dimension === 'market' ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: dimension === 'market' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: dimension === 'market' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <Globe2 size={13} />
              <span>国别敞口</span>
            </button>
            <button
              type="button"
              onClick={() => setDimension('currency')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                border: 'none',
                borderRadius: 'calc(var(--radius) * 0.6)',
                background: dimension === 'currency' ? 'var(--background)' : 'transparent',
                color: dimension === 'currency' ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: dimension === 'currency' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: dimension === 'currency' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <Coins size={13} />
              <span>汇率与对冲</span>
            </button>
            <button
              type="button"
              onClick={() => setDimension('broker')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                border: 'none',
                borderRadius: 'calc(var(--radius) * 0.6)',
                background: dimension === 'broker' ? 'var(--background)' : 'transparent',
                color: dimension === 'broker' ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: dimension === 'broker' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: dimension === 'broker' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <Landmark size={13} />
              <span>机构对账 ({brokerGroups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDimension('assetClass')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                border: 'none',
                borderRadius: 'calc(var(--radius) * 0.6)',
                background: dimension === 'assetClass' ? 'var(--background)' : 'transparent',
                color: dimension === 'assetClass' ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: dimension === 'assetClass' ? 600 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: dimension === 'assetClass' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <PieChartIcon size={13} />
              <span>资产载体</span>
            </button>
          </div>

          {/* Chart View Toggle (Bar vs Donut) when not in Treemap mode */}
          {dimension !== 'themeTreemap' && (
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--muted)',
                borderRadius: 'calc(var(--radius) * 0.8)',
                padding: '3px',
                gap: '2px',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => setChartType('bar')}
                title="水平条形图"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  border: 'none',
                  borderRadius: 'calc(var(--radius) * 0.6)',
                  background: chartType === 'bar' ? 'var(--background)' : 'transparent',
                  color: chartType === 'bar' ? 'var(--foreground)' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}
              >
                <BarChart3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setChartType('donut')}
                title="环形分布图"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  border: 'none',
                  borderRadius: 'calc(var(--radius) * 0.6)',
                  background: chartType === 'donut' ? 'var(--background)' : 'transparent',
                  color: chartType === 'donut' ? 'var(--foreground)' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}
              >
                <PieChartIcon size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FX Hedge Carry Alert Banner when JPY-hedged ETFs exist */}
      {jpyHedgedStats.value > 0 && (dimension === 'currency' || dimension === 'market' || dimension === 'themeTreemap') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <strong>底层汇率对冲穿透提示（為替ヘッジあり）：</strong>
              您持有 <strong>{formatMoney(jpyHedgedStats.value, baseCurrency)}</strong>（占总资产{' '}
              <strong>{formatPercent(jpyHedgedStats.weight)}</strong>）的日元对冲型美国资产（
              {jpyHedgedStats.tickers.join(' / ')}）。虽然以日元计价，但底层为美国股债且每年承担约 3.5%~4.5% 的日美利差对冲损耗。
            </div>
          </div>
        </div>
      )}

      {/* Dimension View Content */}
      {dimension === 'themeTreemap' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Visual Proportional Segmented Matrix Bar by Theme */}
          <div
            style={{
              display: 'flex',
              height: '28px',
              width: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              gap: '2px',
              border: '1px solid var(--border)',
            }}
            aria-label="主题占比条"
          >
            {themeGroups.map((tg) =>
              tg.weight > 0.005 ? (
                <div
                  key={`${tg.layer}-${tg.label}`}
                  style={{
                    width: `${tg.weight * 100}%`,
                    background: tg.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    padding: '0 4px',
                  }}
                  title={`${LAYER_META[tg.layer].label} · ${tg.label}: ${formatPercent(tg.weight)} (${formatMoney(tg.value, baseCurrency)})`}
                >
                  {tg.weight >= 0.06 ? `${tg.label.split(' ')[0]} ${formatPercent(tg.weight, 0)}` : ''}
                </div>
              ) : null,
            )}
          </div>

          {/* Proportional Treemap Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {themeGroups.map((tg) => (
              <div
                key={`${tg.layer}-${tg.label}`}
                style={{
                  border: `1px solid color-mix(in oklch, ${tg.color} 28%, var(--border))`,
                  borderTop: `3.5px solid ${tg.color}`,
                  borderRadius: '10px',
                  padding: '0.9rem 1rem',
                  background: 'var(--card)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: tg.pale,
                        color: tg.color,
                      }}
                    >
                      {LAYER_META[tg.layer].label}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                      {tg.sortedItems.length} 项标的 · {tg.count} 笔
                    </span>
                  </div>
                  <strong
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--foreground)',
                      display: 'block',
                    }}
                  >
                    {tg.label}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    borderBottom: '1px dashed var(--border)',
                    paddingBottom: '0.5rem',
                  }}
                >
                  <strong
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      color: 'var(--foreground)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatPercent(tg.weight)}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--muted-foreground)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatMoney(tg.value, baseCurrency)}
                  </span>
                </div>

                {/* Constituent breakdown pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {tg.sortedItems.slice(0, 4).map((item) => (
                    <div
                      key={item.symbol}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.73rem',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '175px',
                          color: 'var(--foreground)',
                          fontWeight: 500,
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatPercent(item.weight)}
                      </span>
                    </div>
                  ))}
                  {tg.sortedItems.length > 4 && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)' }}>
                      + 其余 {tg.sortedItems.length - 4} 项账户明细
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Main Interactive Recharts Section */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) * 0.8)',
              background: 'color-mix(in oklch, var(--muted) 35%, transparent)',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            {chartType === 'bar' ? (
              <div
                style={{
                  width: '100%',
                  height:
                    activeGroups.length === 1
                      ? 68
                      : Math.max(120, Math.min(activeGroups.length * 34, 420)),
                }}
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{
                    width: 800,
                    height:
                      activeGroups.length === 1
                        ? 68
                        : Math.max(120, Math.min(activeGroups.length * 34, 420)),
                  }}
                >
                  <BarChart
                    data={activeGroups}
                    layout="vertical"
                    margin={{ top: 8, right: 36, left: 10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickFormatter={(val) => `${val}%`}
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      width={165}
                      tick={{ fontSize: 11.5, fill: 'var(--foreground)', fontWeight: 500 }}
                    />
                    <Tooltip
                      content={<PanoramaChartTooltip baseCurrency={baseCurrency} />}
                      cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                    />
                    <Bar
                      dataKey="percentNum"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={20}
                      isAnimationActive={false}
                    >
                      {activeGroups.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ width: '100%', height: 230, display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 400, height: 230 }}
                >
                  <PieChart>
                    <Tooltip content={<PanoramaChartTooltip baseCurrency={baseCurrency} />} />
                    <Pie
                      data={activeGroups}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={3}
                      cornerRadius={4}
                      stroke="#ffffff"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {activeGroups.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Pie>
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#0f172a"
                      fontSize={16}
                      fontWeight={700}
                    >
                      {formatMoney(totalValue, baseCurrency)}
                    </text>
                    <text
                      x="50%"
                      y="58%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#64748b"
                      fontSize={11}
                      fontWeight={500}
                    >
                      透视总值
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Group Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                activeGroups.length === 1
                  ? 'minmax(280px, 360px)'
                  : 'repeat(auto-fill, minmax(225px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {activeGroups.map((group) => {
              const nativeSummary =
                'nativeSummary' in group && typeof group.nativeSummary === 'string'
                  ? group.nativeSummary
                  : null;
              return (
                <div
                  key={group.label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'calc(var(--radius) * 0.8)',
                    padding: '0.875rem 1rem',
                    background: 'var(--card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: group.color,
                          flexShrink: 0,
                        }}
                      />
                      <strong
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: 'var(--foreground)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={group.label}
                      >
                        {group.label}
                      </strong>
                    </div>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--muted-foreground)',
                        background: 'var(--muted)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontWeight: 500,
                        flexShrink: 0,
                      }}
                    >
                      {group.count} 笔
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginTop: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        letterSpacing: '-0.025em',
                        color: 'var(--foreground)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatPercent(group.weight)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted-foreground)',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                      }}
                      title={formatExactMoney(group.value, baseCurrency)}
                    >
                      {formatMoney(group.value, baseCurrency)}
                    </span>
                  </div>

                  {nativeSummary && (
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#2563eb',
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      原币小计: {nativeSummary}
                    </div>
                  )}

                  {/* Sample holdings list snippet */}
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                    }}
                    title={group.items.join(', ')}
                  >
                    {group.items.slice(0, 3).join(' · ')}
                    {group.items.length > 3 ? ` 等${group.items.length}项` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
