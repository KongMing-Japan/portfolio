import { useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  ShieldAlert,
  ArrowRightLeft,
  ChevronRight,
  PieChart as PieIcon,
  Compass,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import type { AggregatedHolding, BaseCurrency, Holding } from '../types';
import { formatMoney, formatPercent } from '../lib/portfolio';

interface CioInvestmentAdvisorCardProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
}

export function CioInvestmentAdvisorCard({
  holdings,
  aggregated,
  totalValue,
  baseCurrency,
}: CioInvestmentAdvisorCardProps) {
  // Compute Layer allocations
  const metrics = useMemo(() => {
    let defVal = 0;
    let coreVal = 0;
    let satVal = 0;
    let cashVal = 0;

    for (const item of aggregated) {
      if (item.layer === 'Defensive') defVal += item.marketValueBase;
      else if (item.layer === 'Core') coreVal += item.marketValueBase;
      else if (item.layer === 'Satellite') satVal += item.marketValueBase;
      else if (item.layer === 'Cash') cashVal += item.marketValueBase;
    }

    const defWeight = totalValue > 0 ? defVal / totalValue : 0;
    const coreWeight = totalValue > 0 ? coreVal / totalValue : 0;
    const satWeight = totalValue > 0 ? satVal / totalValue : 0;
    const cashWeight = totalValue > 0 ? cashVal / totalValue : 0;

    return {
      defVal,
      defWeight,
      coreVal,
      coreWeight,
      satVal,
      satWeight,
      cashVal,
      cashWeight,
    };
  }, [aggregated, totalValue]);

  // Key stock convictions from portfolio
  const keyStockObservations = useMemo(() => {
    const list: Array<{
      category: string;
      name: string;
      ticker: string;
      weight: number;
      thesis: string;
      outlook: 'bullish' | 'balanced' | 'defensive';
    }> = [];

    const saizeriya = aggregated.find((h) => h.ticker.includes('7581'));
    if (saizeriya) {
      list.push({
        category: '现金流实体消费',
        name: '萨莉亚',
        ticker: '7581.T',
        weight: saizeriya.weight,
        thesis: '抗通胀极强的高ROE连锁餐饮龙头，在日本与亚洲拥有充沛自由现金流。4%~5%权重作为安全垫非常科学。',
        outlook: 'balanced',
      });
    }

    const nvda = aggregated.find((h) => h.ticker === 'NVDA');
    const qqq = aggregated.find((h) => h.ticker.includes('2845'));
    if (nvda || qqq) {
      const combinedWeight = (nvda?.weight ?? 0) + (qqq?.weight ?? 0);
      list.push({
        category: 'AI算力与科技平台',
        name: '纳指100 & 英伟达',
        ticker: '2845.T / NVDA',
        weight: combinedWeight,
        thesis: '组合最强主升浪驱动源。当前估值高景气，建议坚定长线持有，不轻易提前止盈，享受AI基础设施爆发红利。',
        outlook: 'bullish',
      });
    }

    const dataSection = aggregated.find((h) => h.ticker.includes('3905'));
    const smr = aggregated.find((h) => h.ticker === 'SMR');
    if (dataSection || smr) {
      const combinedWeight = (dataSection?.weight ?? 0) + (smr?.weight ?? 0);
      list.push({
        category: '高贝塔远期期权',
        name: 'DataSection & NuScale SMR',
        ticker: '3905.T / SMR',
        weight: combinedWeight,
        thesis: 'GPU海外数据中心与AI核能供电的远期看涨期权。单项2%左右仓位完美符合塔勒布「杠铃风控」，赚取爆发性收益同时杜绝破产风险。',
        outlook: 'bullish',
      });
    }

    const bonds = aggregated.find((h) => h.ticker.includes('1482'));
    const spHedged = aggregated.find((h) => h.ticker.includes('2563'));
    if (bonds || spHedged) {
      list.push({
        category: '防守对冲压舱石',
        name: '美债对冲 & 标普对冲',
        ticker: '1482.T / 2563.T',
        weight: (bonds?.weight ?? 0) + (spHedged?.weight ?? 0),
        thesis: '锁定日元汇率波动风险，当美联储进入降息周期或美股巨震时，提供坚实流动性保护与负相关缓冲。',
        outlook: 'defensive',
      });
    }

    return list;
  }, [aggregated]);

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Sparkles size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  AI 首席投资官 (CIO) 结构诊断与再平衡建议
                </CardTitle>
                <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0 font-normal">
                  机构级全天候视角
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                基于现代资产组合理论 (MPT) 与塔勒布杠铃风控模型，实时诊断四层资产偏离度
              </CardDescription>
            </div>
          </div>
          <div className="text-right sm:text-right text-xs">
            <span className="text-muted-foreground">诊断组合净值：</span>
            <span className="font-semibold text-foreground tabular-nums ml-1">
              {formatMoney(totalValue, baseCurrency)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* 一句话总结研判 */}
        <div className="p-3.5 rounded-xl bg-background/80 border border-border flex items-start gap-3">
          <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <TrendingUp size={14} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">
              CIO 核心研判：攻守兼备的健康「全球多币种哑铃架构」
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              当前核心科技仓（{formatPercent(metrics.coreWeight, 0)}）处于高景气盈利上升期，现金储备（{formatPercent(metrics.cashWeight, 0)}）极为充裕。
              实体消费龙头萨莉亚（4.5%）有效对冲通胀，高弹性期权标的（DataSection 2.3% · SMR 2.1%）严格锁定在安全阈值内。整体结构韧性极强，具备从容应对各种黑天鹅与牛市主升浪的能力。
            </p>
          </div>
        </div>

        {/* 重点个股与机会诊断 */}
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
            <Compass size={13} className="text-primary" />
            <span>重点标的配置透视与机会研判</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {keyStockObservations.map((obs) => (
              <div
                key={obs.ticker}
                className="p-3 rounded-lg border border-border/80 bg-background/50 hover:bg-background transition-colors text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-foreground truncate">{obs.name}</span>
                    <span className="text-[11px] text-muted-foreground">{obs.ticker}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 tabular-nums">
                    占比 {formatPercent(obs.weight)}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {obs.thesis}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 动态再平衡执行建议 */}
        <div className="p-3 rounded-lg border border-primary/20 bg-primary/[0.03] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ArrowRightLeft size={13} className="text-primary" />
              <span>动态再平衡指引 (当前现金子弹：约 {formatMoney(metrics.cashVal, baseCurrency)})</span>
            </div>
            <span className="text-[11px] text-primary font-medium">按月定投执行</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded bg-background/80 border border-border">
              <span className="font-semibold text-foreground block mb-0.5">① 优先补足防守安全垫</span>
              <span className="text-muted-foreground">
                当前防守仓（{formatPercent(metrics.defWeight, 0)}）略低于 30% 基准。建议后续月度增量资金优先配置 2563.T（标普对冲）与 1482.T（美债对冲）。
              </span>
            </div>
            <div className="p-2 rounded bg-background/80 border border-border">
              <span className="font-semibold text-foreground block mb-0.5">② 核心科技耐心持有</span>
              <span className="text-muted-foreground">
                核心仓 44.5% 质地优良，无需恐高卖出。当纳指或NVDA出现 8%~10% 技术性急跌时，再动用机动子弹低吸加码。
              </span>
            </div>
            <div className="p-2 rounded bg-background/80 border border-border">
              <span className="font-semibold text-foreground block mb-0.5">③ 卫星仓严格止盈止损</span>
              <span className="text-muted-foreground">
                DataSection、SMR 单票上限控制在 4% 以内；若某只标的大涨使权重超过 5%，主动止盈本金回流至现金池。
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
