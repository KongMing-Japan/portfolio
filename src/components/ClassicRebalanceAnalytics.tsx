import * as React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Crosshair,
  Gauge,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  estimateAssetVolatility,
  formatExactMoney,
  formatMoney,
  isJpyHedgedAsset,
  LAYER_META,
} from '../lib/portfolio';
import { SINGLE_SECURITY_CAP } from '../lib/rebalance';
import type {
  AggregatedHolding,
  BaseCurrency,
  Holding,
  Layer,
  RebalanceTradeItem,
} from '../types';

export type ClassicModelKey = 'coreSatellite' | 'swensen' | 'allWeather' | 'barbell';
export type RebalanceAlgorithmKey = 'cashFlow' | 'corridor' | 'riskParity';

interface ClassicModelSpec {
  key: ClassicModelKey;
  name: string;
  shortName: string;
  scholar: string;
  subtitle: string;
  targets: Record<Layer, number>;
  corridorBand: number;
  rationale: string;
}

export const CLASSIC_MODELS: Record<ClassicModelKey, ClassicModelSpec> = {
  coreSatellite: {
    key: 'coreSatellite',
    name: 'Vanguard 核心-卫星标准模型 (60/20/12/8)',
    shortName: '核心-卫星 (60/20/12/8)',
    scholar: 'Vanguard / BlackRock Institutional',
    subtitle: '以 60% 全球宽基与护城河龙头为锚，20% 高赔率卫星获取 Alpha，12% 固收缓冲，8% 交易子弹',
    targets: { Core: 0.60, Satellite: 0.20, Defensive: 0.12, Cash: 0.08 },
    corridorBand: 0.05,
    rationale:
      '适合长期净流入型投资者：用低成本宽基锁定市场 Beta，将高波动个股严格限制在 20% 卫星预算内。',
  },
  swensen: {
    key: 'swensen',
    name: '耶鲁捐赠基金模型 (David Swensen 50/25/15/10)',
    shortName: '耶鲁斯文森 (50/25/15/10)',
    scholar: 'David Swensen (Yale Endowment)',
    subtitle: '偏重权益与跨市场高成长资产，搭配 15% 主权国债与基建抗通胀，保留 10% 纪律性再平衡流动性',
    targets: { Core: 0.50, Satellite: 0.25, Defensive: 0.15, Cash: 0.10 },
    corridorBand: 0.05,
    rationale:
      '斯文森定理核心在于「股权偏好 + 多国别低相关资产 + 纪律性逆向再平衡」，与您当前中美日越四国布局高度契合。',
  },
  allWeather: {
    key: 'allWeather',
    name: '桥水全天候风险平价模型 (Dalio All-Weather 42/18/30/10)',
    shortName: '全天候风险平价 (42/18/30/10)',
    scholar: 'Ray Dalio / Edward Qian (Risk Parity)',
    subtitle: '按波动率倒数分配风险预算，大幅提升美债与高现金流公共事业（东京地铁等）防守权重至 30%',
    targets: { Core: 0.42, Satellite: 0.18, Defensive: 0.30, Cash: 0.10 },
    corridorBand: 0.04,
    rationale:
      '解决传统组合「90%波动来自股票」的结构缺陷，在滞胀或衰退去杠杆周期具备极强的回撤保护能力。',
  },
  barbell: {
    key: 'barbell',
    name: '巴菲特-塔勒布杠铃模型 (Barbell 55/15/15/15)',
    shortName: '反脆弱杠铃 (55/15/15/15)',
    scholar: 'Warren Buffett & Nassim Taleb',
    subtitle: '一端是 85% 极度安全的指数、现金与基建（55+15+15），另一端是 15% 极高赔率的硬科技与加密期权',
    targets: { Core: 0.55, Satellite: 0.15, Defensive: 0.15, Cash: 0.15 },
    corridorBand: 0.05,
    rationale:
      '杜绝平庸中等风险资产：保留充裕现金子弹等待极端暴跌抄底，同时用 15% 仓位博取 AI 算力、SMR 核能与链上金融非线性赔率。',
  },
};

interface ClassicRebalanceAnalyticsProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  rawAggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  excludeDailyAccounts: boolean;
  onToggleExcludeDaily: (exclude: boolean) => void;
  dailyAccountsStats: {
    count: number;
    totalValue: number;
  };
  onOpenRebalanceCockpit: () => void;
  onOpenAccountVault: () => void;
  onApplyRebalanceTrades?: (trades: RebalanceTradeItem[]) => Promise<void> | void;
}

const riskBudgetChartConfig = {
  capitalPct: {
    label: '资金权重 (Capital %)',
    color: 'var(--chart-2)',
  },
  riskPct: {
    label: '波动风险贡献 (Risk MCTR %)',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

const deltaChartConfig = {
  deltaAmount: {
    label: '调仓增减金额',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

const scatterChartConfig = {
  vol: {
    label: '年化波动率 (%)',
    color: 'var(--chart-1)',
  },
  weight: {
    label: '持仓权重 (%)',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function ClassicRebalanceAnalytics({
  holdings,
  aggregated,
  rawAggregated,
  totalValue,
  baseCurrency,
  excludeDailyAccounts,
  onToggleExcludeDaily,
  dailyAccountsStats,
  onOpenRebalanceCockpit,
  onOpenAccountVault,
  onApplyRebalanceTrades,
}: ClassicRebalanceAnalyticsProps) {
  const [modelKey, setModelKey] = React.useState<ClassicModelKey>('swensen');
  const [algoKey, setAlgoKey] = React.useState<RebalanceAlgorithmKey>('cashFlow');
  const [cashDeployRatio, setCashDeployRatio] = React.useState<number[]>([75]);

  const activeModel = CLASSIC_MODELS[modelKey];

  // 1. Layer actuals vs targets + 5/25 Corridor Drift (Bullet Chart Data)
  const layerAnalysis = React.useMemo(() => {
    const layers: Layer[] = ['Core', 'Defensive', 'Satellite', 'Cash'];
    return layers.map((layer) => {
      const items = aggregated.filter((h) => h.layer === layer);
      const value = items.reduce((s, h) => s + h.marketValueBase, 0);
      const actualWeight = totalValue > 0 ? value / totalValue : 0;
      const targetWeight = activeModel.targets[layer];
      const drift = actualWeight - targetWeight;
      // Swensen / Vanguard 5/25 rule: trigger when abs(drift) > min(5%, 25% * targetWeight)
      const corridorHalfWidth = Math.min(activeModel.corridorBand, targetWeight * 0.25);
      const lowerBound = Math.max(0, targetWeight - corridorHalfWidth);
      const upperBound = Math.min(1, targetWeight + corridorHalfWidth);
      const status: 'under' | 'over' | 'ok' =
        actualWeight < lowerBound ? 'under' : actualWeight > upperBound ? 'over' : 'ok';
      const deltaValue = (targetWeight - actualWeight) * totalValue;

      return {
        layer,
        label: LAYER_META[layer].label.split(' ')[0],
        fullLabel: LAYER_META[layer].label,
        color: LAYER_META[layer].color,
        value,
        actualWeight,
        targetWeight,
        actualPct: Math.round(actualWeight * 1000) / 10,
        targetPct: Math.round(targetWeight * 1000) / 10,
        drift,
        driftPct: Math.round(drift * 1000) / 10,
        corridorHalfWidth,
        lowerBound,
        upperBound,
        status,
        deltaValue,
      };
    });
  }, [aggregated, totalValue, activeModel]);

  // 2. Markowitz Risk Budgeting & Marginal Contribution to Risk (MCTR / PCR)
  const riskBudgetStats = React.useMemo(() => {
    const bucketMap = new Map<
      string,
      {
        category: string;
        capitalValue: number;
        weightedVolSum: number;
        weightedReturnSum: number;
        count: number;
      }
    >();

    let totalWeightedVol = 0;
    let totalWeightedReturn = 0;
    let hhiSum = 0;

    for (const item of rawAggregated) {
      const w = totalValue > 0 ? item.marketValueBase / totalValue : 0;
      hhiSum += w * w;
      const metrics = estimateAssetVolatility({
        ticker: item.ticker,
        name: item.name,
        layer: item.layer,
        theme: item.theme,
      });

      const riskScore = w * metrics.annualVol * Math.max(0.25, Math.abs(metrics.beta));
      totalWeightedVol += riskScore;
      totalWeightedReturn += w * metrics.expectedReturn;

      const cur = bucketMap.get(metrics.riskCategory) ?? {
        category: metrics.riskCategory,
        capitalValue: 0,
        weightedVolSum: 0,
        weightedReturnSum: 0,
        count: 0,
      };
      cur.capitalValue += item.marketValueBase;
      cur.weightedVolSum += riskScore;
      cur.weightedReturnSum += w * metrics.expectedReturn;
      cur.count += 1;
      bucketMap.set(metrics.riskCategory, cur);
    }

    const rows = [...bucketMap.values()]
      .map((b) => {
        const capitalWeight = totalValue > 0 ? b.capitalValue / totalValue : 0;
        const riskContribution =
          totalWeightedVol > 0 ? b.weightedVolSum / totalWeightedVol : 0;
        return {
          category: b.category,
          capitalValue: b.capitalValue,
          capitalWeight,
          riskContribution,
          capitalPct: Math.round(capitalWeight * 1000) / 10,
          riskPct: Math.round(riskContribution * 1000) / 10,
          ratio: capitalWeight > 0.005 ? riskContribution / capitalWeight : 0,
        };
      })
      .sort((a, b) => b.riskPct - a.riskPct);

    // Diversification benefit factor (~0.78 correlation dampening across US/JP/CN/Bonds/Cash)
    const portfolioAnnualVol = totalWeightedVol * 0.82;
    const riskFreeRate = baseCurrency === 'JPY' ? 0.01 : 0.04;
    const sharpeRatio =
      portfolioAnnualVol > 0.001
        ? (totalWeightedReturn - riskFreeRate) / portfolioAnnualVol
        : 0;
    const effectiveN = hhiSum > 0 ? 1 / hhiSum : 0;

    // JPY Hedged Carry Cost calculation
    const jpyHedgedValue = holdings
      .filter((h) => isJpyHedgedAsset(h))
      .reduce((s, h) => s + (h.valueInBase ?? 0), 0);
    const annualCarryDragValue = jpyHedgedValue * 0.041; // ~4.1% US-JP short rate spread

    return {
      rows,
      portfolioAnnualVol,
      expectedAnnualReturn: totalWeightedReturn,
      sharpeRatio,
      effectiveN,
      jpyHedgedValue,
      annualCarryDragValue,
    };
  }, [rawAggregated, holdings, totalValue, baseCurrency]);

  // 3. Rebalancing Execution Waterfall (Cash-Flow Zero-Sell vs 5/25 Corridor vs Inverse-Vol Risk Parity)
  const rebalanceSimulation = React.useMemo(() => {
    const cashHoldings = rawAggregated.filter((h) => h.layer === 'Cash');
    const totalCashPool = cashHoldings.reduce((s, h) => s + h.marketValueBase, 0);
    const deployRatio = (cashDeployRatio[0] ?? 75) / 100;
    const deployableCash = totalCashPool * deployRatio;

    const nonCashItems = rawAggregated.filter((h) => h.layer !== 'Cash');

    interface SimActionItem {
      ticker: string;
      shortName: string;
      layer: Layer;
      broker: string;
      currency: string;
      unitPrice: number | null;
      currentValue: number;
      currentWeight: number;
      targetWeight: number;
      deltaAmount: number;
      suggestedShares: number;
      action: 'BUY' | 'SELL' | 'DEPLOY';
      reason: string;
    }

    const actions: SimActionItem[] = [];

    if (algoKey === 'cashFlow') {
      // Zero-Sell Cash-Flow Rebalancing: only buy underweight Core/Defensive/Satellite using deployableCash
      const positiveLayerDeficits = layerAnalysis.filter(
        (l) => l.layer !== 'Cash' && l.deltaValue > 0,
      );
      const totalDeficit = positiveLayerDeficits.reduce((s, l) => s + l.deltaValue, 0);
      const budgetToUse = totalDeficit > 0 ? Math.min(deployableCash, totalDeficit * 1.15) : deployableCash;

      for (const layerInfo of positiveLayerDeficits) {
        const layerShare =
          totalDeficit > 0 ? (layerInfo.deltaValue / totalDeficit) * budgetToUse : 0;
        const candidates = nonCashItems
          .filter(
            (h) =>
              h.layer === layerInfo.layer &&
              h.ticker !== '1571.T' &&
              !h.ticker.startsWith('CRYPTO'),
          )
          .sort((a, b) => b.marketValueBase - a.marketValueBase);

        const candTotal = candidates.reduce((s, c) => s + c.marketValueBase, 0);
        for (const cand of candidates) {
          const wInLayer = candTotal > 0 ? cand.marketValueBase / candTotal : 1 / candidates.length;
          const allocAmt = layerShare * wInLayer;
          if (allocAmt < totalValue * 0.003) continue;
          const firstAcc = cand.accounts[0];
          const unitPrice = firstAcc?.marketPrice ?? firstAcc?.costPerUnit ?? null;
          const priceBase =
            cand.quantity > 0 ? cand.marketValueBase / cand.quantity : cand.marketValueBase;
          const rawShares = priceBase > 0 ? allocAmt / priceBase : 0;
          const isLumpSum =
            cand.ticker === 'EMAXIS_SP500' || cand.ticker === 'CN_QDII_VN';
          const shares = isLumpSum ? 1 : Math.max(1, Math.round(rawShares));

          actions.push({
            ticker: cand.ticker,
            shortName: (cand.name || cand.ticker).slice(0, 14),
            layer: cand.layer,
            broker: firstAcc?.broker || '券商账户',
            currency: cand.currency,
            unitPrice,
            currentValue: cand.marketValueBase,
            currentWeight: cand.weight,
            targetWeight: cand.weight + allocAmt / Math.max(totalValue, 1),
            deltaAmount: Math.round(allocAmt),
            suggestedShares: shares,
            action: 'BUY',
            reason: `零卖出补齐${LAYER_META[cand.layer].label.split(' ')[0]}缺口`,
          });
        }
      }

      if (budgetToUse > 0) {
        actions.push({
          ticker: 'Cash·子弹调拨',
          shortName: '动用机动现金池',
          layer: 'Cash',
          broker: '多券商现金池',
          currency: baseCurrency,
          unitPrice: 1,
          currentValue: totalCashPool,
          currentWeight: totalValue > 0 ? totalCashPool / totalValue : 0,
          targetWeight:
            totalValue > 0 ? Math.max(0, totalCashPool - budgetToUse) / totalValue : 0,
          deltaAmount: -Math.round(budgetToUse),
          suggestedShares: 1,
          action: 'DEPLOY',
          reason: `动用 ${(deployRatio * 100).toFixed(0)}% 现金子弹分批定投低配资产`,
        });
      }
    } else if (algoKey === 'corridor') {
      // Swensen 5/25 Corridor Mean-Reversion
      for (const layerInfo of layerAnalysis) {
        if (layerInfo.layer === 'Cash') continue;
        const candidates = nonCashItems
          .filter((h) => h.layer === layerInfo.layer)
          .sort((a, b) => b.marketValueBase - a.marketValueBase);
        const candTotal = candidates.reduce((s, c) => s + c.marketValueBase, 0);

        for (const cand of candidates) {
          const wInLayer = candTotal > 0 ? cand.marketValueBase / candTotal : 0;
          const targetVal = totalValue * layerInfo.targetWeight * wInLayer;
          // Enforce canonical 15% single-security cap
          const cappedTargetVal = Math.min(targetVal, totalValue * SINGLE_SECURITY_CAP);
          const delta = cappedTargetVal - cand.marketValueBase;
          if (Math.abs(delta) < totalValue * 0.008) continue;

          const firstAcc = cand.accounts[0];
          const unitPrice = firstAcc?.marketPrice ?? firstAcc?.costPerUnit ?? null;
          const priceBase =
            cand.quantity > 0 ? cand.marketValueBase / cand.quantity : cand.marketValueBase;
          const shares = Math.max(1, Math.round(Math.abs(delta) / Math.max(priceBase, 1)));

          actions.push({
            ticker: cand.ticker,
            shortName: (cand.name || cand.ticker).slice(0, 14),
            layer: cand.layer,
            broker: firstAcc?.broker || '券商账户',
            currency: cand.currency,
            unitPrice,
            currentValue: cand.marketValueBase,
            currentWeight: cand.weight,
            targetWeight: cappedTargetVal / Math.max(totalValue, 1),
            deltaAmount: Math.round(delta),
            suggestedShares: shares,
            action: delta >= 0 ? 'BUY' : 'SELL',
            reason:
              delta >= 0
                ? '低于 5/25 走廊下限，均值回归增持'
                : cand.weight > SINGLE_SECURITY_CAP
                  ? `触发单票 ${(SINGLE_SECURITY_CAP * 100).toFixed(0)}% 机构上限，逢高锁利修剪`
                  : '高于走廊上限，均值回归减仓',
          });
        }
      }
    } else {
      // Inverse-Volatility Risk Parity (按波动率倒数 1/σ 分配非现金仓位)
      const investableTotal = totalValue * (1 - activeModel.targets.Cash);
      const invVolScores = nonCashItems.map((item) => {
        const m = estimateAssetVolatility({
          ticker: item.ticker,
          name: item.name,
          layer: item.layer,
          theme: item.theme,
        });
        // Inverse vol weighted by current conviction
        const invVol = (1 / Math.max(0.08, m.annualVol)) * Math.sqrt(Math.max(0.01, item.weight));
        return { item, invVol, vol: m.annualVol };
      });
      const sumInvVol = invVolScores.reduce((s, x) => s + x.invVol, 0);

      for (const { item, invVol, vol } of invVolScores) {
        const rpTargetVal = sumInvVol > 0 ? (invVol / sumInvVol) * investableTotal : 0;
        const delta = rpTargetVal - item.marketValueBase;
        if (Math.abs(delta) < totalValue * 0.008) continue;

        const firstAcc = item.accounts[0];
        const unitPrice = firstAcc?.marketPrice ?? firstAcc?.costPerUnit ?? null;
        const priceBase =
          item.quantity > 0 ? item.marketValueBase / item.quantity : item.marketValueBase;
        const shares = Math.max(1, Math.round(Math.abs(delta) / Math.max(priceBase, 1)));

        actions.push({
          ticker: item.ticker,
          shortName: (item.name || item.ticker).slice(0, 14),
          layer: item.layer,
          broker: firstAcc?.broker || '券商账户',
          currency: item.currency,
          unitPrice,
          currentValue: item.marketValueBase,
          currentWeight: item.weight,
          targetWeight: rpTargetVal / Math.max(totalValue, 1),
          deltaAmount: Math.round(delta),
          suggestedShares: shares,
          action: delta >= 0 ? 'BUY' : 'SELL',
          reason:
            delta >= 0
              ? `低波动资产 (σ=${(vol * 100).toFixed(0)}%)，风险平价增配`
              : `高波动敞口 (σ=${(vol * 100).toFixed(0)}%)，削减尾部波动预算`,
        });
      }
    }

    const sorted = actions.sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount));
    return {
      totalCashPool,
      deployableCash,
      chartItems: sorted.slice(0, 8),
      allActions: sorted,
    };
  }, [rawAggregated, layerAnalysis, algoKey, cashDeployRatio, totalValue, baseCurrency, activeModel]);

  // 4. Risk-Return & Weight Scatter Matrix Data
  const scatterData = React.useMemo(() => {
    return aggregated
      .filter((h) => h.layer !== 'Cash' && h.marketValueBase > 0)
      .map((h) => {
        const m = estimateAssetVolatility({
          ticker: h.ticker,
          name: h.name,
          layer: h.layer,
          theme: h.theme,
        });
        return {
          ticker: h.ticker,
          name: h.name,
          layer: h.layer,
          layerLabel: LAYER_META[h.layer].label.split(' ')[0],
          vol: Math.round(m.annualVol * 1000) / 10,
          weight: Math.round(h.weight * 1000) / 10,
          expectedReturn: Math.round(m.expectedReturn * 1000) / 10,
          value: h.marketValueBase,
          color: LAYER_META[h.layer].color,
        };
      });
  }, [aggregated]);

  const handleApplySimulated = () => {
    if (!onApplyRebalanceTrades) return;
    const tradeItems: RebalanceTradeItem[] = rebalanceSimulation.allActions
      .filter((a) => a.action === 'BUY' || a.action === 'SELL')
      .map((a) => ({
        ticker: a.ticker,
        name: a.shortName,
        layer: a.layer,
        broker: a.broker,
        action: a.action === 'SELL' ? 'SELL' : 'BUY',
        currentShares: 0,
        suggestedShares: a.suggestedShares,
        currentWeight: a.currentWeight,
        projectedWeight: a.targetWeight,
        priceInBase: a.suggestedShares > 0 ? Math.abs(a.deltaAmount) / a.suggestedShares : 1,
        amountInBase: Math.abs(a.deltaAmount),
        currency: a.currency,
        priceInCurrency: a.unitPrice,
        urgency: 'medium',
        reason: a.reason,
      }));
    void onApplyRebalanceTrades(tradeItems);
  };

  return (
    <section className="flex flex-col gap-6 perf-contain-section" id="classic-rebalance-analytics">
      {/* Top Control & Scope Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Compass className="size-4 text-primary" />
                <CardTitle className="text-base">
                  资产配置与量化再平衡 (30% 策略风控引擎)
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  5/25 走廊子弹图 · 风险预算 · 零卖出调仓
                </Badge>
              </div>
            </div>

            {/* Scope Toggle: Pure Investment Portfolio vs Full Household Assets */}
            {dailyAccountsStats.count > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="inline-flex items-center rounded-lg border bg-muted p-0.5 text-xs"
                  role="group"
                  aria-label="资产口径"
                >
                  <button
                    type="button"
                    onClick={() => onToggleExcludeDaily(true)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      excludeDailyAccounts
                        ? 'bg-background text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    投资组合口径
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleExcludeDaily(false)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      !excludeDailyAccounts
                        ? 'bg-background text-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    全量家庭资产 (含日常备忘)
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenAccountVault}
                  className="text-xs h-7"
                >
                  日常账户备忘 ({formatMoney(dailyAccountsStats.totalValue, baseCurrency)})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-primary" />
                选择对标的经典金融配置模型：
              </span>
              <ToggleGroup
                value={[modelKey]}
                onValueChange={(val) => {
                  if (val[0]) setModelKey(val[0] as ClassicModelKey);
                }}
                variant="outline"
                spacing={1}
                className="flex-wrap"
              >
                {(Object.keys(CLASSIC_MODELS) as ClassicModelKey[]).map((k) => (
                  <ToggleGroupItem key={k} value={k} className="text-xs px-2.5 h-7">
                    {CLASSIC_MODELS[k].shortName}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground border-t pt-2.5">
              <div>
                <strong className="text-foreground">{activeModel.name}</strong> · {activeModel.subtitle}
              </div>
              <span className="shrink-0 font-mono text-[11px] text-primary font-semibold">
                学术/机构来源: {activeModel.scholar}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 1: 5/25 Tolerance Corridor Bullet Chart AND Markowitz Risk Budgeting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card A: 5/25 Tolerance Corridor Bullet Chart */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="size-4 text-primary" />
              <span>5/25 容忍走廊子弹图 (Tolerance Corridor Bullet Chart)</span>
            </CardTitle>
            <CardDescription>
              阴影带为免交易容忍走廊 [下限–上限]，竖线为模型目标锚点，实心条为当前实盘权重
            </CardDescription>
            <CardAction>
              <Badge variant="outline">5/25 走廊</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/* Legend */}
            <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-5 rounded-xs bg-primary/15 border border-primary/30" />
                  <span>免调仓容忍走廊</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-0.5 bg-foreground" />
                  <span>模型目标锚点</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-4 rounded-full bg-primary" />
                  <span>当前实盘占比</span>
                </span>
              </div>
              <span className="font-mono">Scale: 0% – 80%</span>
            </div>

            {/* Swensen 5/25 Corridor Bullet Items */}
            <ItemGroup className="gap-3">
              {layerAnalysis.map((row) => {
                // Scale bullet chart against max 80% width so bars are roomy and legible
                const maxScale = 0.80;
                const lowerLeftPct = Math.min(100, (row.lowerBound / maxScale) * 100);
                const corridorWidthPct = Math.min(
                  100 - lowerLeftPct,
                  ((row.upperBound - row.lowerBound) / maxScale) * 100,
                );
                const targetLeftPct = Math.min(100, (row.targetWeight / maxScale) * 100);
                const actualWidthPct = Math.min(100, (row.actualWeight / maxScale) * 100);

                return (
                  <Item key={row.layer} variant="muted" className="flex-col items-stretch py-3 px-3.5">
                    <ItemContent className="gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ background: row.color }}
                          />
                          <ItemTitle className="text-xs font-bold">{row.fullLabel}</ItemTitle>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            目标 {row.targetPct.toFixed(0)}% · 走廊 [{(row.lowerBound * 100).toFixed(1)}%–{(row.upperBound * 100).toFixed(1)}%]
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold font-mono tabular-nums">
                            {row.actualPct.toFixed(1)}%
                          </span>
                          <Badge
                            variant={row.status === 'ok' ? 'secondary' : 'outline'}
                            className={
                              row.status === 'over'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 text-[10px]'
                                : row.status === 'under'
                                  ? 'border-blue-300 bg-blue-50 text-blue-700 text-[10px]'
                                  : 'bg-emerald-50 text-emerald-700 text-[10px]'
                            }
                          >
                            {row.status === 'over'
                              ? `超配 +${row.driftPct.toFixed(1)}%`
                              : row.status === 'under'
                                ? `低配 ${row.driftPct.toFixed(1)}%`
                                : '走廊内稳健'}
                          </Badge>
                        </div>
                      </div>

                      {/* Bullet Track */}
                      <div className="relative h-5 w-full rounded-md bg-background border overflow-hidden">
                        {/* Shaded Tolerance Corridor Zone */}
                        <div
                          className="absolute top-0 bottom-0 bg-primary/12 border-x border-primary/35"
                          style={{
                            left: `${lowerLeftPct}%`,
                            width: `${corridorWidthPct}%`,
                          }}
                          title={`容忍走廊: ${(row.lowerBound * 100).toFixed(1)}% - ${(row.upperBound * 100).toFixed(1)}%`}
                        />

                        {/* Actual Weight Bullet Bar */}
                        <div
                          className="absolute top-1.5 bottom-1.5 left-0 rounded-r-full transition-all duration-300"
                          style={{
                            width: `${actualWidthPct}%`,
                            background: row.color,
                          }}
                        />

                        {/* Target Anchor Vertical Tick */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
                          style={{
                            left: `${targetLeftPct}%`,
                          }}
                          title={`目标锚点: ${row.targetPct.toFixed(1)}%`}
                        />
                      </div>
                    </ItemContent>

                    <ItemFooter className="pt-1.5 text-[11px]">
                      <span className="text-muted-foreground font-mono tabular-nums">
                        当前市值: {formatMoney(row.value, baseCurrency)}
                      </span>
                      <span
                        className={`font-semibold font-mono tabular-nums ${
                          row.deltaValue > 0
                            ? 'text-blue-600'
                            : row.deltaValue < 0
                              ? 'text-amber-700'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {row.deltaValue >= 0
                          ? `距目标需增配 +${formatMoney(row.deltaValue, baseCurrency)}`
                          : `距目标需收敛/调拨 ${formatMoney(row.deltaValue, baseCurrency)}`}
                      </span>
                    </ItemFooter>
                  </Item>
                );
              })}
            </ItemGroup>
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground border-t pt-3">
            {activeModel.rationale}
          </CardFooter>
        </Card>

        {/* Card B: Markowitz Mean-Variance Risk Budgeting & MCTR Decomposition */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4 text-primary" />
              <span>风险预算与波动贡献</span>
            </CardTitle>
            <CardDescription>
              对比各资产资金权重与边际风险贡献 (MCTR)
            </CardDescription>
            <CardAction>
              <Badge variant="outline">风险预算</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={riskBudgetChartConfig} className="h-[245px] w-full">
              <BarChart
                data={riskBudgetStats.rows}
                layout="vertical"
                margin={{ top: 6, right: 24, left: 8, bottom: 6 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'dataMax + 6']}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tickLine={false}
                  axisLine={false}
                  width={128}
                  tick={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 500 }}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar
                  dataKey="capitalPct"
                  name="capitalPct"
                  fill="var(--color-capitalPct)"
                  radius={[0, 4, 4, 0]}
                  barSize={11}
                />
                <Bar
                  dataKey="riskPct"
                  name="riskPct"
                  fill="var(--color-riskPct)"
                  radius={[0, 4, 4, 0]}
                  barSize={11}
                />
              </BarChart>
            </ChartContainer>

            <Separator />

            {/* 4 Quantitative Financial KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <Item variant="muted" className="flex-col items-stretch py-2.5 px-3">
                <ItemContent className="gap-0.5">
                  <ItemDescription className="text-[11px] font-medium tracking-wider">
                    组合年化波动率 (σ)
                  </ItemDescription>
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {(riskBudgetStats.portfolioAnnualVol * 100).toFixed(1)}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    预期年化回报 ≈ {(riskBudgetStats.expectedAnnualReturn * 100).toFixed(1)}%
                  </span>
                </ItemContent>
              </Item>

              <Item variant="muted" className="flex-col items-stretch py-2.5 px-3">
                <ItemContent className="gap-0.5">
                  <ItemDescription className="text-[11px] font-medium tracking-wider">
                    夏普比率与有效分散度
                  </ItemDescription>
                  <span className="text-xl font-bold tabular-nums text-primary">
                    Sharpe {riskBudgetStats.sharpeRatio.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    有效标的数 N_eff = {riskBudgetStats.effectiveN.toFixed(1)}
                  </span>
                </ItemContent>
              </Item>
            </div>

            {/* Carry Drag Alert */}
            {riskBudgetStats.jpyHedgedValue > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>日元对冲利差损耗：</strong>
                  当前持有 <strong>{formatMoney(riskBudgetStats.jpyHedgedValue, baseCurrency)}</strong> 日元对冲资产（1482/2563/2845），受美日利差影响年化对冲成本约{' '}
                  <strong>{formatMoney(riskBudgetStats.annualCarryDragValue, baseCurrency)}/年 (~4.1%)</strong>。新增资金优先配置无对冲投信或直接持有原生资产。
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between">
            <span>浅蓝条 = 资金权重 · 深蓝条 = 风险贡献</span>
            <span className="font-mono text-[11px]">Risk Parity</span>
          </CardFooter>
        </Card>
      </div>

      {/* Row 2: Rebalancing Execution Waterfall + Risk-Weight Quadrant Scatter Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card C: Rebalancing Simulation */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  <span>调仓算法推演</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {onApplyRebalanceTrades && rebalanceSimulation.allActions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApplySimulated}
                      className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/5"
                      title="将当前算法推演出的买卖指令一键写入持仓并联动扣减券商现金"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>一键应用推演指令</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={onOpenRebalanceCockpit} className="h-7 text-xs gap-1">
                    <span>调仓驾驶舱</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                对比现金流补仓法、5/25 走廊回归与逆波动率风险平价，支持一键落盘执行
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/* Algorithm Switcher */}
            <ToggleGroup
              value={[algoKey]}
              onValueChange={(val) => {
                if (val[0]) setAlgoKey(val[0] as RebalanceAlgorithmKey);
              }}
              variant="outline"
              spacing={1}
              className="w-full flex-wrap"
            >
              <ToggleGroupItem value="cashFlow" className="text-xs flex-1">
                ① 零卖出·现金流补仓法 (推荐)
              </ToggleGroupItem>
              <ToggleGroupItem value="corridor" className="text-xs flex-1">
                ② 5/25 走廊均值回归法
              </ToggleGroupItem>
              <ToggleGroupItem value="riskParity" className="text-xs flex-1">
                ③ 逆波动率风险平价法
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Interactive Cash Bullet Slider (Shadcn payout-threshold pattern) */}
            {algoKey === 'cashFlow' && rebalanceSimulation.totalCashPool > 0 && (
              <div className="rounded-lg border bg-muted/40 p-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-foreground">
                    本次动用机动现金池比例 ({cashDeployRatio[0]}%)
                  </span>
                  <span className="text-base font-bold tabular-nums text-primary">
                    {formatMoney(rebalanceSimulation.deployableCash, baseCurrency)}
                  </span>
                </div>
                <Slider
                  value={cashDeployRatio}
                  onValueChange={(val) =>
                    setCashDeployRatio(Array.isArray(val) ? [...val] : [val])
                  }
                  min={10}
                  max={100}
                  step={5}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>10% 保守定投</span>
                  <span>可用现金池总额: {formatMoney(rebalanceSimulation.totalCashPool, baseCurrency)}</span>
                  <span>100% 全额投放</span>
                </div>
              </div>
            )}

            {/* Diverging Delta BarChart */}
            <ChartContainer config={deltaChartConfig} className="h-[220px] w-full">
              <BarChart
                data={rebalanceSimulation.chartItems}
                layout="vertical"
                margin={{ top: 6, right: 24, left: 8, bottom: 6 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatMoney(Number(v), baseCurrency)}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  tickLine={false}
                  axisLine={false}
                  width={116}
                  tick={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 500 }}
                />
                <ReferenceLine x={0} stroke="var(--foreground)" strokeOpacity={0.35} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatExactMoney(Number(value), baseCurrency)}
                    />
                  }
                />
                <Bar dataKey="deltaAmount" name="调仓金额" radius={[4, 4, 4, 4]} barSize={14}>
                  {rebalanceSimulation.chartItems.map((entry) => (
                    <Cell
                      key={entry.ticker}
                      fill={
                        entry.action === 'BUY'
                          ? '#2563eb'
                          : entry.action === 'DEPLOY'
                            ? '#0d9488'
                            : '#f59e0b'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <Separator />

            {/* Actionable Order List */}
            <ItemGroup className="gap-2">
              {rebalanceSimulation.chartItems.slice(0, 5).map((order) => (
                <Item key={order.ticker} variant="muted" className="py-2 px-3">
                  <ItemContent className="gap-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          order.action === 'BUY'
                            ? 'border-blue-300 bg-blue-50 text-blue-700 text-[10px]'
                            : order.action === 'DEPLOY'
                              ? 'border-teal-300 bg-teal-50 text-teal-800 text-[10px]'
                              : 'border-amber-300 bg-amber-50 text-amber-800 text-[10px]'
                        }
                      >
                        {order.action === 'BUY'
                          ? 'BUY 买入'
                          : order.action === 'DEPLOY'
                            ? 'DEPLOY 动用现金'
                            : 'TRIM 减持'}
                      </Badge>
                      <ItemTitle className="text-xs font-semibold">
                        {order.shortName} ({order.ticker})
                      </ItemTitle>
                    </div>
                    <ItemDescription className="text-[11px]">
                      {order.broker} · {order.reason}
                    </ItemDescription>
                  </ItemContent>
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold tabular-nums ${
                        order.deltaAmount >= 0 ? 'text-blue-600' : 'text-amber-700'
                      }`}
                    >
                      {order.deltaAmount >= 0 ? '+' : ''}
                      {formatMoney(order.deltaAmount, baseCurrency)}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {order.action === 'DEPLOY'
                        ? '免税零摩擦调拨'
                        : order.ticker === 'EMAXIS_SP500' || order.ticker === 'CN_QDII_VN'
                          ? '按金额申购'
                          : `约 ${order.suggestedShares != null && Number.isFinite(order.suggestedShares) ? order.suggestedShares.toLocaleString('en-US') : '0'} 股/份`}
                    </div>
                  </div>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between">
            <span>零卖出调仓可规避日本特定口座 ~20.315% 资本利得税摩擦</span>
            <button
              type="button"
              onClick={onOpenRebalanceCockpit}
              className="text-primary font-semibold hover:underline cursor-pointer bg-transparent border-0 p-0 text-xs"
            >
              查看全部 {rebalanceSimulation.allActions.length} 笔测算 →
            </button>
          </CardFooter>
        </Card>

        {/* Card D: Risk-Weight Scatter Matrix */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crosshair className="size-4 text-primary" />
              <span>风险与权重四象限</span>
            </CardTitle>
            <CardDescription>
              横轴为标的年化波动率 (σ)，纵轴为持仓权重 (Weight %)
            </CardDescription>
            <CardAction>
              <Badge variant="outline">四象限矩阵</Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={scatterChartConfig} className="h-[250px] w-full">
              <ScatterChart margin={{ top: 12, right: 20, bottom: 12, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="vol"
                  name="年化波动率"
                  unit="%"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 68]}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="weight"
                  name="组合权重"
                  unit="%"
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'dataMax + 3']}
                  tick={{ fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="value" range={[70, 420]} name="市值" />
                <ReferenceLine
                  x={28}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: '波动率分界 σ=28%', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
                />
                <ReferenceLine
                  y={15}
                  stroke="#e11d48"
                  strokeDasharray="4 4"
                  label={{ value: '单票上限 15%', position: 'insideTopLeft', fontSize: 10, fill: '#be123c' }}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                        <div className="font-semibold text-foreground mb-1">
                          {pt.ticker} · {pt.name}
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>持仓权重:</span>
                          <strong className="text-foreground tabular-nums">{pt.weight}%</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>预估年化波动率 (σ):</span>
                          <strong className="text-foreground tabular-nums">{pt.vol}%</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>预期年化回报 (μ):</span>
                          <strong className="text-emerald-600 tabular-nums">{pt.expectedReturn}%</strong>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>当前市值:</span>
                          <strong className="text-foreground tabular-nums">
                            {formatMoney(pt.value, baseCurrency)}
                          </strong>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter name="Holdings" data={scatterData}>
                  {scatterData.map((entry) => (
                    <Cell key={entry.ticker} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ChartContainer>

            <Separator />

            {/* Four Quadrant Financial Interpretation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Item variant="muted" className="py-2.5 px-3 flex-col items-stretch">
                <ItemContent className="gap-1">
                  <div className="flex items-center justify-between">
                    <ItemTitle className="text-xs font-semibold text-blue-700">
                      左上象限 · 低波重仓压舱石 (σ&lt;28%, W≥10%)
                    </ItemTitle>
                    <ShieldCheck className="size-3.5 text-blue-600" />
                  </div>
                  <ItemDescription className="text-[11px] leading-relaxed">
                    纳指100 (2845.T)、标普500同源合并仓位：承担组合核心复利引擎，适合长期定投持有。
                  </ItemDescription>
                </ItemContent>
              </Item>

              <Item variant="muted" className="py-2.5 px-3 flex-col items-stretch">
                <ItemContent className="gap-1">
                  <div className="flex items-center justify-between">
                    <ItemTitle className="text-xs font-semibold text-amber-800">
                      右上象限 · 高波重仓风控区 (σ≥28%, W≥8%)
                    </ItemTitle>
                    <Activity className="size-3.5 text-amber-600" />
                  </div>
                  <ItemDescription className="text-[11px] leading-relaxed">
                    小米 (01810.HK)、恒生科技 (513130)：港股科技弹性大，建议遵循 15% 单一证券风控红线。
                  </ItemDescription>
                </ItemContent>
              </Item>

              <Item variant="muted" className="py-2.5 px-3 flex-col items-stretch">
                <ItemContent className="gap-1">
                  <div className="flex items-center justify-between">
                    <ItemTitle className="text-xs font-semibold text-teal-700">
                      左下象限 · 低波防守缓冲池 (σ&lt;25%, W&lt;10%)
                    </ItemTitle>
                  </div>
                  <ItemDescription className="text-[11px] leading-relaxed">
                    东京地铁 (9023.T)、美债 ETF (1482.T)、萨莉亚/共立：低 Beta 抗跌资产，提供大盘回调时的换仓筹码。
                  </ItemDescription>
                </ItemContent>
              </Item>

              <Item variant="muted" className="py-2.5 px-3 flex-col items-stretch">
                <ItemContent className="gap-1">
                  <div className="flex items-center justify-between">
                    <ItemTitle className="text-xs font-semibold text-violet-700">
                      右下象限 · 高赔率非线性期权 (σ&gt;40%, W&lt;5%)
                    </ItemTitle>
                    <TrendingUp className="size-3.5 text-violet-600" />
                  </div>
                  <ItemDescription className="text-[11px] leading-relaxed">
                    Circle (CRCL)、英伟达 (NVDA)、NuScale (SMR)、DataSection：单票严控在 2%~4%，触发 +30% 止盈 / -15% 止损。
                  </ItemDescription>
                </ItemContent>
              </Item>
            </div>
          </CardContent>

          <CardFooter className="text-xs text-muted-foreground border-t pt-3">
            气泡面积代表持仓市值大小，颜色对应核心(皇家蓝)/防守(青色)/卫星(紫罗兰)分层
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
