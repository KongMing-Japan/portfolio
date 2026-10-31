import { useMemo } from 'react';
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Compass,
  ArrowRightLeft,
  CircleDollarSign,
  AlertCircle,
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

  // Selected Representative Holdings for focused commentary
  const representativeHoldings = useMemo(() => {
    return [
      {
        name: 'NuScale Power',
        ticker: 'SMR (美股)',
        layer: '卫星仓',
        weight: '2.1%',
        statusTag: '浮亏 -51% · 探底整理',
        statusColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        fundamentals:
          '小型模块化核反应堆 (SMR) 契合科技巨头 AI 云端电力的长线刚需，但商业化交付周期长，前期股价深幅回调后在低位震荡筑底。',
        cioAction: '🟢 底仓卧倒，不盲目补仓',
        actionDesc:
          '2.1% 占比已严格锁定下行风险。坚决不在底部恐慌割肉，亦不建议主动加仓摊平成本，耐心等待商业合同催化脉冲反弹。',
      },
      {
        name: '纳指100 & 英伟达',
        ticker: '2845.T / NVDA',
        layer: '核心仓',
        weight: '16.5%',
        statusTag: '主升浪龙头 · 浮盈 +19%',
        statusColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        fundamentals:
          'Blackwell 架构芯片出货放量，北美四大云厂商 AI 资本开支强劲增长，整体走势多头趋势完好。',
        cioAction: '🔵 核心压舱石，逢大跌低吸',
        actionDesc:
          '首要财富增值动力源，切勿恐高盲目止盈。若纳指出现 6%~8% 的技术性急跌，可动用闲置现金分批低吸增配。',
      },
      {
        name: '萨莉亚',
        ticker: '7581.T (日股)',
        layer: '核心仓',
        weight: '4.5%',
        statusTag: '现金流标杆 · 浮盈 +45%',
        statusColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        fundamentals:
          '日本抗通胀极致平价消费代表，本土及亚洲海外门店翻台率持续超预期，高 ROE 且日元经营现金流极充沛。',
        cioAction: '🛡️ 稳健实体底仓，无需变动',
        actionDesc:
          '4.5% 的配置极其科学，兼具高防守性与抗通胀属性，无需任何调仓，长期持有享受分红与稳健估值溢价。',
      },
      {
        name: '美债对冲 ETF',
        ticker: '1482.T (日股)',
        layer: '防守仓',
        weight: '4.0%',
        statusTag: '汇率对冲防守 · 浮亏 -7%',
        statusColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        fundamentals:
          '受美联储降息节奏反复扰动短期承压，但日元汇率对冲完全阻断了日元升值的汇兑风险，具备强逆周期避险价值。',
        cioAction: '🟡 分批定投回补，夯实防守',
        actionDesc:
          '防守仓（23.9%）距离 30% 目标线尚有缺口，当前价格处于年内估值底部，是后续配置闲置现金的首选去处。',
      },
      {
        name: '小米集团 & 腾讯控股',
        ticker: '01810 / 00700 (港股)',
        layer: '核心仓',
        weight: '12.8%',
        statusTag: '人车家生态 & 高额回购',
        statusColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
        fundamentals:
          '小米 SU7 新车放量加速重塑估值（浮盈 +42%）；腾讯高现金流与百亿回购对冲港股流动性折价。',
        cioAction: '⚖️ 小米设阶梯止盈，腾讯耐心守望',
        actionDesc:
          '小米可对高位浮盈设置移动止盈线防范回撤；腾讯继续作为核心底仓享受高回购与估值修复。',
      },
    ];
  }, []);

  return (
    <Card className="shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  AI 首席投资官 (CIO) 月度投资诊断与个股点评
                </CardTitle>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                  10 月末复盘
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                基于现代资产组合理论与风控准则，为组合结构与代表性个股提供操作策略
              </CardDescription>
            </div>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <span>组合诊断总值：</span>
            <span className="font-semibold text-foreground tabular-nums ml-1">
              {formatMoney(totalValue, baseCurrency)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* 1. 总体月末建议 (Macro / Asset Allocation Advice) */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            <h4 className="text-xs font-semibold text-foreground">10 月末组合总体结构诊断与策略建议</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="space-y-0.5">
              <span className="font-medium text-foreground block">① 结构兼具进攻与韧性</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                核心仓（{formatPercent(metrics.coreWeight, 0)}）由高景气科技与高现金流实体双轮驱动；卫星仓（{formatPercent(metrics.satWeight, 0)}）处于安全阈值内，杠铃两端平衡良好。
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="font-medium text-foreground block">② 现金弹药极为充足</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                投资账户内可用现金约 {formatMoney(metrics.cashVal, baseCurrency)}（占比 {formatPercent(metrics.cashWeight, 0)}），提供了极高的流动性安全垫与未来逢低出手的战略自由度。
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="font-medium text-foreground block">③ 11 月再平衡主线</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                防守仓（{formatPercent(metrics.defWeight, 0)}）略低于 30% 基准。建议保持「核心股耐心持有、弱势期权不盲目抄底、后续增量资金优先补足防守对冲（1482.T/2563.T）」。
              </p>
            </div>
          </div>
        </div>

        {/* 2. 代表性个股点评与操作建议 (Representative Stock Commentary) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Compass size={13} className="text-primary" />
              <span>重点代表性个股深度点评与操作策略</span>
            </h4>
            <span className="text-[11px] text-muted-foreground">结合基本面 · 近期走势 · 当前持仓</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {representativeHoldings.map((stock) => (
              <div
                key={stock.name}
                className="p-3 rounded-lg border border-border/80 bg-card hover:border-border transition-colors text-xs flex flex-col justify-between space-y-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-foreground truncate">{stock.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border bg-background shrink-0 text-muted-foreground">
                      占比 {stock.weight}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2">
                    <span>{stock.ticker}</span>
                    <span>·</span>
                    <span>{stock.layer}</span>
                  </div>

                  <div className="mb-2">
                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${stock.statusColor}`}>
                      {stock.statusTag}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {stock.fundamentals}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 bg-muted/20 -mx-3 -mb-3 p-3 rounded-b-lg space-y-1">
                  <div className="font-semibold text-foreground text-[11px]">
                    {stock.cioAction}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    {stock.actionDesc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
