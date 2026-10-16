import { useMemo } from 'react';
import {
  Globe2,
  Layers,
  LayoutGrid,
  Sparkles,
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
  formatExactMoney,
  formatMoney,
  formatPercent,
  LAYER_META,
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

const PALETTE = [
  '#2563eb', // Blue (Primary)
  '#0d9488', // Teal
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#64748b', // Slate
];

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
  totalValue,
  baseCurrency,
}: PortfolioPanoramaProps) {
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

  // 2. Asset Class & Estimated Dividend / Yield Stream (Shadcn dividend-income pattern)
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

  // 4. Theme & Layer Matrix Groups (主题与四层矩阵树图)
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

  const totalEstimatedAnnualYield = useMemo(
    () => assetClassGroups.reduce((s, g) => s + g.annualCashflow, 0),
    [assetClassGroups],
  );

  return (
    <section className="flex flex-col gap-6" id="panorama">
      {/* Row 1: Country/Regional Exposure + Asset Vehicles & Yield (Side-by-side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 1: Underlying Country & Economic Exposure */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe2 className="size-4 text-primary" />
              <span>国别与地区敞口</span>
            </CardTitle>
            <CardDescription>
              穿透 ETF 与基金至底层挂钩国家与经济体
            </CardDescription>
            <CardAction>
              <Badge variant="outline">底层穿透</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={geoChartConfig} className="h-[210px] w-full">
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
                <Bar dataKey="percentNum" name="底层权重" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {marketGroups.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <Separator />

            <ItemGroup className="gap-2">
              {marketGroups.map((group) => (
                <Item key={group.label} variant="muted" className="py-2 px-3">
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
                    <div className="text-xs font-bold tabular-nums text-foreground">
                      {formatPercent(group.weight)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {formatMoney(group.value, baseCurrency)}
                    </div>
                  </div>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground border-t pt-3">
            按底层资产实际经营与挂钩经济体归集，穿透离岸上市包装
          </CardFooter>
        </Card>

        {/* Card 2: Asset Class & Dividend Cashflow */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" />
              <span>资产形态与分红现金流</span>
            </CardTitle>
            <CardDescription>
              ETF、个股与公募基金分布及预估年度分红
            </CardDescription>
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

      {/* Row 2: Theme Matrix Dedicated Full-Width Row */}
      <Card className="w-full flex flex-col justify-between">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="size-4 text-primary" />
            <span>投资主题分布</span>
          </CardTitle>
          <CardDescription>
            按战略投资主题穿透细分权重构成与个股归集
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{themeGroups.length} 个战略主题</Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {/* Proportional Segmented Matrix Bar */}
          <div
            className="flex h-7 w-full overflow-hidden rounded-lg border gap-0.5"
            aria-label="主题占比矩阵条"
          >
            {themeGroups.map((tg) =>
              tg.weight > 0.005 ? (
                <div
                  key={`${tg.layer}-${tg.label}`}
                  style={{
                    width: `${tg.weight * 100}%`,
                    background: tg.color,
                  }}
                  className="flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden whitespace-nowrap px-1"
                  title={`${LAYER_META[tg.layer].label} · ${tg.label}: ${formatPercent(tg.weight)} (${formatMoney(tg.value, baseCurrency)})`}
                >
                  {tg.weight >= 0.05 ? `${tg.label.split(' ')[0]} ${formatPercent(tg.weight, 0)}` : ''}
                </div>
              ) : null,
            )}
          </div>

          {/* Theme Cards Grid in Spacious 4-Col Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {themeGroups.map((tg) => (
              <div
                key={`${tg.layer}-${tg.label}`}
                className="rounded-xl border bg-card p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-foreground/20 transition-colors"
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
                      {LAYER_META[tg.layer].label.split(' ')[0]}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {formatMoney(tg.value, baseCurrency)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <strong className="text-xs font-semibold text-foreground line-clamp-1" title={tg.label}>
                      {tg.label}
                    </strong>
                    <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
                      {formatPercent(tg.weight)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 border-t border-dashed pt-2">
                  {tg.sortedItems.slice(0, 3).map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between text-[11px] text-muted-foreground"
                    >
                      <span className="truncate max-w-[140px] text-foreground/90" title={item.name}>
                        {item.name}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatPercent(item.weight)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            单一主题上限建议不超过 25%（防止行业周期共振回撤）
          </span>
          <span>涵盖全部 {holdings.length} 笔底层仓位明细</span>
        </CardFooter>
      </Card>
    </section>
  );
}
