import { useMemo } from 'react';
import {
  AlertTriangle,
  Coins,
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
  Label,
  Pie,
  PieChart,
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
  fxExposureFromHolding,
  isJpyHedgedAsset,
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

const fxChartConfig = {
  value: {
    label: '汇率敞口市值',
    color: 'var(--chart-2)',
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
  // Detect JPY-Hedged US ETFs total (1482.T, 2563.T, 2845.T)
  const jpyHedgedStats = useMemo(() => {
    const hedgedHoldings = holdings.filter((h) => isJpyHedgedAsset(h));
    const value = hedgedHoldings.reduce((sum, h) => sum + (h.valueInBase ?? 0), 0);
    const weight = totalValue > 0 ? value / totalValue : 0;
    const tickers = [...new Set(hedgedHoldings.map((h) => h.ticker))];
    return { value, weight, tickers, count: hedgedHoldings.length };
  }, [holdings, totalValue]);

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

  // 2. Underlying FX & Hedge Exposure Look-Through
  const currencyGroups = useMemo(() => {
    const map = new Map<
      string,
      { value: number; count: number; items: string[] }
    >();
    for (const h of holdings) {
      const curKey = fxExposureFromHolding(h);
      const val = h.valueInBase ?? 0;
      const cur = map.get(curKey) ?? {
        value: 0,
        count: 0,
        items: [] as string[],
      };
      cur.value += val;
      cur.count += 1;
      if (!cur.items.includes(h.name || h.ticker)) {
        cur.items.push(h.name || h.ticker);
      }
      map.set(curKey, cur);
    }
    return [...map.entries()]
      .map(([label, d], idx) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        percentNum: totalValue > 0 ? Math.round((d.value / totalValue) * 1000) / 10 : 0,
        count: d.count,
        items: d.items,
        fill: PALETTE[idx % PALETTE.length],
        color: PALETTE[idx % PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  // 3. Asset Class & Estimated Dividend / Yield Stream (Shadcn dividend-income pattern)
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
      {/* Row 1: Underlying Geography Look-Through + Underlying FX & Hedge Exposure (Both Visible!) */}
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
            按底层资产实际经营与挂钩经济体归集，剔除上市交易所表面假象
          </CardFooter>
        </Card>

        {/* Card 2: Currency & FX Hedge Exposure */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="size-4 text-primary" />
              <span>汇率与对冲敞口</span>
            </CardTitle>
            <CardDescription>
              区分日元对冲资产与原生外币资产的汇率敞口
            </CardDescription>
            <CardAction>
              <Badge variant="outline">汇率透视</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ChartContainer
              config={fxChartConfig}
              className="mx-auto aspect-square max-h-[210px] w-full"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(val, name) =>
                        `${name}: ${formatExactMoney(Number(val), baseCurrency)}`
                      }
                    />
                  }
                />
                <Pie
                  data={currencyGroups}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={64}
                  outerRadius={90}
                  paddingAngle={2}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  {currencyGroups.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        const topFx = currencyGroups[0];
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 10}
                              className="fill-foreground text-lg font-bold"
                            >
                              {topFx ? formatPercent(topFx.weight) : '100%'}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 12}
                              className="fill-muted-foreground text-[11px]"
                            >
                              最大敞口: {topFx ? topFx.label.split(' ')[0] : ''}
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            {jpyHedgedStats.value > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                <span>
                  <strong>日元对冲仓位占比 {formatPercent(jpyHedgedStats.weight)}</strong>（{formatMoney(jpyHedgedStats.value, baseCurrency)} · {jpyHedgedStats.tickers.join('/')}），受日美短端利差影响存在年化 ~4% 对冲损耗。
                </span>
              </div>
            )}

            <Separator />

            <ItemGroup className="gap-2">
              {currencyGroups.map((group) => (
                <Item key={group.label} variant="muted" className="py-2 px-3">
                  <ItemContent className="gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: group.color }}
                      />
                      <ItemTitle className="text-xs font-semibold">{group.label}</ItemTitle>
                    </div>
                    <ItemDescription className="text-[11px] line-clamp-1">
                      {group.items.slice(0, 3).join(' · ')}
                      {group.items.length > 3 ? ` 等 ${group.items.length} 项` : ''}
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
            当日元大幅升值时，1482/2563/2845 对冲仓位可免疫美元贬值冲击
          </CardFooter>
        </Card>
      </div>

      {/* Row 2: Asset Vehicles & Yield + Theme Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 5 cols: Asset Class & Dividend Cashflow Card */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
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

        {/* Right 7 cols: Theme & Layer Proportional Matrix */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="size-4 text-primary" />
              <span>投资主题穿透</span>
            </CardTitle>
            <CardDescription>
              按战略投资主题展示细分权重构成
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">{themeGroups.length} 个主题</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/* Proportional Segmented Matrix Bar */}
            <div
              className="flex h-6 w-full overflow-hidden rounded-lg border gap-0.5"
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
                    {tg.weight >= 0.07 ? `${tg.label.split(' ')[0]} ${formatPercent(tg.weight, 0)}` : ''}
                  </div>
                ) : null,
              )}
            </div>

            {/* Theme Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {themeGroups.slice(0, 9).map((tg) => (
                <div
                  key={`${tg.layer}-${tg.label}`}
                  className="rounded-xl border bg-card p-3 flex flex-col justify-between gap-2 shadow-2xs"
                  style={{
                    borderTop: `3px solid ${tg.color}`,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 mb-1">
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

                  <div className="flex flex-col gap-1 border-t border-dashed pt-1.5">
                    {tg.sortedItems.slice(0, 3).map((item) => (
                      <div
                        key={item.symbol}
                        className="flex items-center justify-between text-[11px] text-muted-foreground"
                      >
                        <span className="truncate max-w-[130px] text-foreground/90" title={item.name}>
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

          <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              单一主题上限风控线：25%（防止行业周期共振回撤）
            </span>
            <span>共涵盖 {holdings.length} 笔底层仓位</span>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
