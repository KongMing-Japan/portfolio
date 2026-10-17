import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  canonicalThemeFromHolding,
  formatExactMoney,
  formatMoney,
  formatPercent,
  getCleanSecurityName,
  LAYER_META,
} from '../lib/portfolio';
import {
  calculateFullRebalance,
  calculateInflowRebalance,
  calculateLayerDrift,
  CORRIDOR_BAND_ABSOLUTE,
  CORRIDOR_BAND_RELATIVE,
  SINGLE_SECURITY_CAP,
  SINGLE_THEME_CAP,
} from '../lib/rebalance';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  LayerTargetConfig,
} from '../types';

interface ClassicRebalanceAnalyticsProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  rawAggregated?: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
}

const PRESETS: Record<
  'crossBorder' | 'standard' | 'defensive',
  { label: string; desc: string; targets: LayerTargetConfig }
> = {
  crossBorder: {
    label: '核心-卫星标准 (60 / 20 / 15 / 5)',
    desc: '60% 核心资产压舱 + 20% 卫星成长 + 15% 防守固收 + 5% 机动现金',
    targets: { Core: 0.60, Satellite: 0.20, Defensive: 0.15, Cash: 0.05 },
  },
  standard: {
    label: '稳健均衡 (55 / 15 / 20 / 10)',
    desc: '提高国债与宽基防守垫至 20%，保留 10% 机动现金',
    targets: { Core: 0.55, Satellite: 0.15, Defensive: 0.20, Cash: 0.10 },
  },
  defensive: {
    label: '防守优先 (45 / 10 / 30 / 15)',
    desc: '收缩高波动卫星敞口，提升固收与现金安全垫',
    targets: { Core: 0.45, Satellite: 0.10, Defensive: 0.30, Cash: 0.15 },
  },
};

export function ClassicRebalanceAnalytics({
  holdings,
  aggregated,
  rawAggregated,
  totalValue,
  baseCurrency,
}: ClassicRebalanceAnalyticsProps) {
  const [presetKey, setPresetKey] = useState<'crossBorder' | 'standard' | 'defensive'>('crossBorder');
  const [rebalanceMode, setRebalanceMode] = useState<'inflow' | 'full'>('inflow');

  const defaultInflow = baseCurrency === 'JPY' ? 3_000_000 : 20_000;
  const maxInflow = baseCurrency === 'JPY' ? 20_000_000 : 150_000;
  const stepInflow = baseCurrency === 'JPY' ? 500_000 : 5_000;

  const [inflowAmount, setInflowAmount] = useState<number>(defaultInflow);
  const activeTargets = PRESETS[presetKey].targets;

  const orderBookHoldings = rawAggregated && rawAggregated.length > 0 ? rawAggregated : aggregated;

  // 1. 4-Layer Corridor Drift Analysis
  const layerDrifts = useMemo(
    () => calculateLayerDrift(aggregated, totalValue, activeTargets),
    [aggregated, totalValue, activeTargets],
  );

  // 2. Concentration & Theme Cap Check
  const concentrationAlerts = useMemo(() => {
    const overSecurities = aggregated.filter(
      (h) => h.layer !== 'Cash' && h.weight > SINGLE_SECURITY_CAP,
    );

    const themeMap = new Map<string, number>();
    for (const h of holdings) {
      if (h.layer === 'Cash') continue;
      const t = canonicalThemeFromHolding(h);
      themeMap.set(t, (themeMap.get(t) ?? 0) + (h.valueInBase ?? 0));
    }
    const overThemes = [...themeMap.entries()]
      .map(([theme, val]) => ({
        theme,
        weight: totalValue > 0 ? val / totalValue : 0,
      }))
      .filter((t) => t.weight > SINGLE_THEME_CAP);

    return { overSecurities, overThemes };
  }, [aggregated, holdings, totalValue]);

  // 3. Rebalance Reference Calculation
  const inflowResult = useMemo(
    () => calculateInflowRebalance(orderBookHoldings, inflowAmount, activeTargets, totalValue),
    [orderBookHoldings, inflowAmount, activeTargets, totalValue],
  );

  const fullResult = useMemo(
    () => calculateFullRebalance(orderBookHoldings, activeTargets, totalValue, SINGLE_SECURITY_CAP),
    [orderBookHoldings, activeTargets, totalValue],
  );

  const activeTrades = rebalanceMode === 'inflow' ? inflowResult.trades : fullResult.trades;

  if (totalValue <= 0) return null;

  return (
    <Card id="rebalance-analytics">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base">结构诊断与再平衡参考</CardTitle>
            <CardDescription>
              基于 5/25 容忍走廊检验四层配置偏离度，并提供目标股数参考（需要调仓时直接在上方持仓表修改持股数即可）
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPresetKey(key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  presetKey === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {PRESETS[key].label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="corridor" className="w-full">
          <TabsList variant="line" className="mb-3">
            <TabsTrigger value="corridor" className="text-xs">
              四层走廊与集中度诊断
            </TabsTrigger>
            <TabsTrigger value="reference" className="text-xs">
              再平衡股数参考 ({activeTrades.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: 4-Layer Corridor & Concentration Check */}
          <TabsContent value="corridor" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {layerDrifts.map((d) => {
                const band = Math.min(CORRIDOR_BAND_ABSOLUTE, d.targetWeight * CORRIDOR_BAND_RELATIVE);
                const lower = Math.max(0, d.targetWeight - band);
                const upper = Math.min(1, d.targetWeight + band);
                const deltaValue = (d.targetWeight - d.currentWeight) * totalValue;

                return (
                  <div
                    key={d.layer}
                    className="rounded-xl border border-border p-3.5 space-y-2 bg-card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: LAYER_META[d.layer as Layer].color }}
                        />
                        <span className="text-xs font-semibold text-foreground">
                          {LAYER_META[d.layer as Layer].label}
                        </span>
                        <Badge
                          variant={d.status === 'ok' ? 'secondary' : 'outline'}
                          className="text-[10px] px-1.5 py-0 font-normal"
                        >
                          {d.status === 'ok'
                            ? '走廊内'
                            : d.status === 'over'
                              ? `超配 +${formatPercent(d.driftAbsolute)}`
                              : `低配 ${formatPercent(d.driftAbsolute)}`}
                        </Badge>
                      </div>
                      <div className="text-xs tabular-nums">
                        <span className="font-semibold text-foreground">
                          {formatPercent(d.currentWeight)}
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          / 目标 {formatPercent(d.targetWeight, 0)}
                        </span>
                      </div>
                    </div>

                    {/* Bullet Corridor Bar */}
                    <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      {/* Tolerance Corridor Zone */}
                      <div
                        className="absolute top-0 bottom-0 bg-foreground/10"
                        style={{
                          left: `${lower * 100}%`,
                          width: `${(upper - lower) * 100}%`,
                        }}
                        title={`容忍走廊: ${formatPercent(lower, 0)} ~ ${formatPercent(upper, 0)}`}
                      />
                      {/* Target Marker Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
                        style={{ left: `${d.targetWeight * 100}%` }}
                      />
                      {/* Actual Weight Bar */}
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, d.currentWeight * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>
                        容忍区间 {formatPercent(lower, 0)}–{formatPercent(upper, 0)}
                      </span>
                      <span>
                        {Math.abs(deltaValue) < totalValue * 0.005
                          ? '无需调整'
                          : deltaValue > 0
                            ? `距目标需增配 +${formatMoney(deltaValue, baseCurrency)}`
                            : `距目标超出 ${formatMoney(Math.abs(deltaValue), baseCurrency)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Concise Single-Line Risk Summary */}
            <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">集中度检验：</span>
                {concentrationAlerts.overSecurities.length > 0 ? (
                  <span>
                    单一标的超 15% 上限：
                    {concentrationAlerts.overSecurities
                      .map((s) => `${getCleanSecurityName(s.ticker, s.name)} (${formatPercent(s.weight)})`)
                      .join('、')}
                  </span>
                ) : (
                  <span>全部单一标的均在 15% 上限以内</span>
                )}
              </div>
              {concentrationAlerts.overThemes.length > 0 && (
                <span>
                  主题超 35% 上限：
                  {concentrationAlerts.overThemes
                    .map((t) => `${t.theme} (${formatPercent(t.weight)})`)
                    .join('、')}
                </span>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: Rebalance Share Reference */}
          <TabsContent value="reference" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRebalanceMode('inflow')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rebalanceMode === 'inflow'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground border border-border'
                  }`}
                >
                  增量资金补仓（只买不卖）
                </button>
                <button
                  type="button"
                  onClick={() => setRebalanceMode('full')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rebalanceMode === 'full'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground border border-border'
                  }`}
                >
                  存量目标再平衡（含超配减仓）
                </button>
              </div>

              {rebalanceMode === 'inflow' && (
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    拟投入新资金:
                  </span>
                  <Slider
                    value={[inflowAmount]}
                    min={stepInflow}
                    max={maxInflow}
                    step={stepInflow}
                    onValueChange={(vals) => {
                      const next = Array.isArray(vals) ? vals[0] : vals;
                      if (typeof next === 'number') setInflowAmount(next);
                    }}
                    className="flex-1"
                  />
                  <span className="text-xs font-semibold tabular-nums text-foreground whitespace-nowrap">
                    {formatMoney(inflowAmount, baseCurrency)}
                  </span>
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标的</TableHead>
                  <TableHead>账户</TableHead>
                  <TableHead>方向</TableHead>
                  <TableHead className="text-right">当前权重 → 调后</TableHead>
                  <TableHead className="text-right">参考变动金额</TableHead>
                  <TableHead className="text-right">参考变动股数 → 目标总股数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTrades.length > 0 ? (
                  activeTrades.map((t) => {
                    const targetTotalShares =
                      t.action === 'BUY'
                        ? t.currentShares + t.suggestedShares
                        : Math.max(0, t.currentShares - t.suggestedShares);
                    return (
                      <TableRow key={`${t.ticker}-${t.broker}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground">
                              {getCleanSecurityName(t.ticker, t.name)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {t.ticker}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.broker}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.action === 'BUY' ? 'default' : 'outline'}
                            className="text-[10px] px-1.5 py-0 font-normal"
                          >
                            {t.action === 'BUY' ? '建议增配' : '建议减配'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatPercent(t.currentWeight)} →{' '}
                          <span className="font-semibold text-foreground">
                            {formatPercent(t.projectedWeight)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium text-foreground">
                          {t.action === 'BUY' ? '+' : '-'}
                          {formatMoney(t.amountInBase, baseCurrency)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          <span className="text-muted-foreground">
                            {t.action === 'BUY' ? '+' : '-'}
                            {t.suggestedShares.toLocaleString('en-US')}
                          </span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <strong className="text-foreground">
                            {targetTotalShares.toLocaleString('en-US')} 股/份
                          </strong>
                          {t.priceInCurrency != null && t.priceInCurrency > 0 && (
                            <span className="block text-[10px] text-muted-foreground">
                              按单价 {formatExactMoney(t.priceInCurrency, t.currency as BaseCurrency)} 折算
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                      当前配置已处于目标走廊内，无需额外调仓。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
