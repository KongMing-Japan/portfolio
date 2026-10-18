import { useMemo } from 'react';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  canonicalThemeFromHolding,
  dualEngineFromHolding,
  formatMoney,
  formatPercent,
  fxExposureFromHolding,
  getCleanSecurityName,
  isJpyHedgedAsset,
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
}

const CHART_SCALE = [
  'var(--primary)',
  'var(--chart-4)',
  'var(--chart-3)',
  'var(--chart-2)',
  'var(--chart-1)',
];

const geoChartConfig = {
  percentNum: {
    label: '底层国别权重 (%)',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

const fxChartConfig = {
  percentNum: {
    label: '真实汇率权重 (%)',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

export function PortfolioPanorama({
  holdings,
  aggregated,
  totalValue,
  baseCurrency,
}: PortfolioPanoramaProps) {

  // 1. Layer x Security Proportional Matrix
  const layerGroups = useMemo(() => {
    const layers: Layer[] = ['Core', 'Satellite', 'Defensive', 'Cash'];
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
          items: items.map((item) => ({
            ...item,
            shareOfLayer: layerValue > 0 ? item.marketValueBase / layerValue : 0,
            isOverCap: item.weight > SINGLE_SECURITY_CAP && item.layer !== 'Cash',
          })),
        };
      })
      .filter((g) => g.value > 0);
  }, [aggregated, totalValue]);

  // 2. Strategic Theme Groups
  const themeGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        value: number;
        engine: string;
        items: Array<{ ticker: string; name: string; value: number; weight: number }>;
      }
    >();

    for (const item of aggregated) {
      const repAccount = item.accounts[0];
      const themeName = repAccount
        ? canonicalThemeFromHolding(repAccount)
        : item.theme || '未分类主题';
      const engineName = repAccount
        ? dualEngineFromHolding(repAccount)
        : '全球宽基与固收缓冲';

      const cur = map.get(themeName) ?? {
        value: 0,
        engine: engineName,
        items: [],
      };
      cur.value += item.marketValueBase;
      cur.items.push({
        ticker: item.ticker,
        name: getCleanSecurityName(item.ticker, item.name),
        value: item.marketValueBase,
        weight: item.weight,
      });
      map.set(themeName, cur);
    }

    return [...map.entries()]
      .map(([theme, d], idx) => ({
        theme,
        engine: d.engine,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        isOverCap: totalValue > 0 && d.value / totalValue > SINGLE_THEME_CAP,
        items: d.items.sort((a, b) => b.value - a.value),
        color: CHART_SCALE[idx % CHART_SCALE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [aggregated, totalValue]);

  // 3. Underlying Geography & True FX Exposure
  const marketGroups = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const h of holdings) {
      const market = underlyingMarketFromHolding(h);
      const val = h.valueInBase ?? 0;
      const cur = map.get(market) ?? { value: 0, count: 0 };
      cur.value += val;
      cur.count += 1;
      map.set(market, cur);
    }
    return [...map.entries()]
      .map(([label, d], idx) => ({
        label,
        value: d.value,
        weight: totalValue > 0 ? d.value / totalValue : 0,
        percentNum: totalValue > 0 ? Number(((d.value / totalValue) * 100).toFixed(1)) : 0,
        count: d.count,
        color: CHART_SCALE[idx % CHART_SCALE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const fxStats = useMemo(() => {
    const map = new Map<string, number>();
    let jpyHedgedValue = 0;

    for (const h of holdings) {
      const val = h.valueInBase ?? 0;
      const fxCat = fxExposureFromHolding(h);
      map.set(fxCat, (map.get(fxCat) ?? 0) + val);
      if (isJpyHedgedAsset(h)) {
        jpyHedgedValue += val;
      }
    }

    const rows = [...map.entries()]
      .map(([label, value], idx) => ({
        label,
        value,
        weight: totalValue > 0 ? value / totalValue : 0,
        percentNum: totalValue > 0 ? Number(((value / totalValue) * 100).toFixed(1)) : 0,
        color: CHART_SCALE[idx % CHART_SCALE.length],
      }))
      .sort((a, b) => b.value - a.value);

    return {
      rows,
      jpyHedgedValue,
      jpyHedgedRatio: totalValue > 0 ? jpyHedgedValue / totalValue : 0,
    };
  }, [holdings, totalValue]);

  if (totalValue <= 0) return null;

  return (
    <Card id="panorama">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">持仓全景结构</CardTitle>
        <CardDescription>
          按真实市值比例穿透展示资产分层、战略主题与国别汇率敞口
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="treemap" className="w-full">
          <TabsList variant="line" className="mb-3">
            <TabsTrigger value="treemap" className="text-xs">
              四层 × 标的矩阵
            </TabsTrigger>
            <TabsTrigger value="themes" className="text-xs">
              战略主题分布
            </TabsTrigger>
            <TabsTrigger value="geo-fx" className="text-xs">
              底层国别与汇率敞口
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Four-Layer Proportional Treemap Matrix */}
          <TabsContent value="treemap" className="space-y-3">
            <div className="flex flex-col lg:flex-row w-full gap-2.5 min-h-[260px]">
              {layerGroups.map((group) => {
                const flexGrow = Math.max(group.weight * 100, 14);

                return (
                  <div
                    key={group.layer}
                    style={{ flex: `${flexGrow} 1 0%` }}
                    className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-1.5 text-left w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: group.meta.color }}
                        />
                        <span className="text-xs font-semibold text-foreground truncate">
                          {group.meta.label}
                        </span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">
                        {formatPercent(group.weight)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 flex-1 content-start">
                      {group.items.map((item) => {
                        const itemFlex = Math.max(Math.round(item.shareOfLayer * 100), 18);

                        return (
                          <div
                            key={item.ticker}
                            style={{
                              flex: `${itemFlex} 1 ${item.shareOfLayer > 0.35 ? '46%' : '28%'}`,
                              minHeight: item.shareOfLayer > 0.35 ? '72px' : '56px',
                            }}
                            className="rounded-lg border border-border bg-card p-2 text-left flex flex-col justify-between"
                          >
                            <div className="flex items-start justify-between gap-1 w-full">
                              <span className="text-xs font-semibold text-foreground truncate leading-tight">
                                {getCleanSecurityName(item.ticker, item.name)}
                              </span>
                              {item.isOverCap && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-3.5 shrink-0 font-normal"
                                >
                                  &gt;15%
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1.5 flex items-baseline justify-between gap-1 w-full">
                              <span className="text-xs font-semibold tabular-nums text-foreground">
                                {formatPercent(item.weight)}
                              </span>
                              <span className="text-[10px] tabular-nums text-muted-foreground truncate">
                                {formatMoney(item.marketValueBase, baseCurrency)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 2: Strategic Themes */}
          <TabsContent value="themes" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {themeGroups.map((tg) => (
                <div
                  key={tg.theme}
                  className="rounded-xl border border-border bg-card p-3 text-left flex flex-col justify-between gap-2"
                >
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {tg.theme}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-foreground shrink-0">
                        {formatPercent(tg.weight)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate">{tg.engine}</span>
                      <span className="tabular-nums shrink-0">
                        {formatMoney(tg.value, baseCurrency)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, tg.weight * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-border/60 w-full">
                    {tg.items.slice(0, 4).map((it) => (
                      <Badge
                        key={it.ticker}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 font-normal"
                      >
                        {it.name} {formatPercent(it.weight, 0)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: Geography & FX Exposure */}
          <TabsContent value="geo-fx">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Underlying Geography */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    底层真实市场暴露（穿透 ETF / QDII 包装）
                  </span>
                </div>
                <ChartContainer config={geoChartConfig} className="h-[190px] w-full">
                  <BarChart
                    accessibilityLayer
                    data={marketGroups}
                    layout="vertical"
                    margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      className="text-xs font-medium fill-foreground"
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
                      maxBarSize={20}
                    >
                      {marketGroups.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>

              {/* Right: True FX Exposure - Matched simplicity with Left */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    真实汇率敞口（区分日元对冲与无对冲外币）
                  </span>
                  {fxStats.jpyHedgedValue > 0 && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      日元对冲占比 {formatPercent(fxStats.jpyHedgedRatio)}
                    </Badge>
                  )}
                </div>
                <ChartContainer config={fxChartConfig} className="h-[190px] w-full">
                  <BarChart
                    accessibilityLayer
                    data={fxStats.rows}
                    layout="vertical"
                    margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="label"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={75}
                      className="text-xs font-medium fill-foreground"
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
                      name="汇率权重"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={20}
                    >
                      {fxStats.rows.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
