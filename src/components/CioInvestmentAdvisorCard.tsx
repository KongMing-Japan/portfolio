import { useMemo } from 'react';
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

  // Selected Representative Holdings for focused commentary (Concise, no emoji, list format)
  const representativeHoldings = useMemo(() => {
    return [
      {
        name: 'NuScale Power',
        ticker: 'SMR (美股)',
        layer: '卫星仓',
        weight: '2.1%',
        statusText: '浮亏 -51% · 低位震荡',
        badgeVariant: 'secondary' as const,
        action: '底仓卧倒，不盲目补仓',
        commentary:
          '小型模块化核反应堆契合科技巨头 AI 云端电力的长期刚需，但商业化交付周期长，前期股价深幅回调后在低位构筑整理平台。2.1% 占比已充分锁死风险暴露，无需在底部恐慌割肉，亦不建议主动加仓摊平成本，耐心等待商业合同催化脉冲反弹。',
      },
      {
        name: '纳指100 ETF & 英伟达',
        ticker: '2845.T / NVDA',
        layer: '核心仓',
        weight: '16.5%',
        statusText: '浮盈 +19% · 多头趋势',
        badgeVariant: 'outline' as const,
        action: '核心压舱石，逢急跌低吸',
        commentary:
          'Blackwell 架构芯片进入批量出货期，北美头部云厂商资本开支维持强劲增长，整体走势上行通道完好。作为组合核心财富增值引擎，切勿盲目恐高止盈；若纳指出现 6%~8% 的技术性急跌，可动用闲置现金分批低吸增配。',
      },
      {
        name: '萨莉亚',
        ticker: '7581.T (日股)',
        layer: '核心仓',
        weight: '4.5%',
        statusText: '浮盈 +45% · 稳健走高',
        badgeVariant: 'outline' as const,
        action: '优质实体底仓，无需变动',
        commentary:
          '日本平价消费龙头与抗通胀代表，本土客流与海外亚洲门店翻台率持续超预期，高 ROE 且日元经营现金流极度充沛。4.5% 的配置比例适中，提供稳固的安全垫，无需任何调仓，长期持有享受分红与稳健估值溢价。',
      },
      {
        name: '美债对冲 ETF',
        ticker: '1482.T (日股)',
        layer: '防守仓',
        weight: '4.0%',
        statusText: '浮亏 -7% · 估值低位',
        badgeVariant: 'secondary' as const,
        action: '分批定投回补，夯实防守',
        commentary:
          '受美联储降息节奏反复扰动短期承压，但日元汇率对冲机制完全阻断了日元升值的汇兑风险，具备强逆周期避险价值。防守仓（23.9%）距 30% 目标线尚有缺口，当前价格处于年内底部价值区间，是后续配置闲置现金的首选去处。',
      },
      {
        name: '小米集团 & 腾讯控股',
        ticker: '01810 / 00700 (港股)',
        layer: '核心仓',
        weight: '12.8%',
        statusText: '小米 +42% · 腾讯 -27%',
        badgeVariant: 'outline' as const,
        action: '小米阶梯止盈，腾讯耐心守望',
        commentary:
          '小米人车家新车交付超预期带动估值重塑，可对高位浮盈设置移动止盈线防范回撤；腾讯稳健高额分红与百亿回购对冲港股流动性折价，维持核心底仓静待估值修复。',
      },
    ];
  }, []);

  return (
    <Card className="shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            10 月底复盘
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-0.5">
            基于 10 月末实盘数据、仓位偏离度与宏观走势的月度研判与操作建议
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* 1. 10 月份总体总结（一段话，结构清晰自然） */}
        <div className="p-4 rounded-xl bg-muted/40 border border-border/80">
          <p className="text-sm text-foreground/90 leading-relaxed">
            10 月末组合整体保持攻守兼备的稳健哑铃结构：核心仓（{formatPercent(metrics.coreWeight, 0)}）由高景气科技与高现金流实体消费双轮驱动，卫星仓（{formatPercent(metrics.satWeight, 0)}）处于安全阈值内；投资账户内可用现金约 {formatMoney(metrics.cashVal, baseCurrency)}（占比 {formatPercent(metrics.cashWeight, 0)}），流动性储备极为充沛。鉴于防守仓（{formatPercent(metrics.defWeight, 0)}）距离 30% 目标线尚有缺口，建议 11 月保持「核心重仓耐心持有、弱势期权不盲目加码抄底、利用闲置资金逢低分批补足防守对冲（如 1482.T / 2563.T）」的操作主线。
          </p>
        </div>

        {/* 2. 代表性个股列表（简洁 List 形式，无多余 emoji） */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            重点个股点评与操作建议
          </h4>

          <div className="rounded-xl border border-border divide-y divide-border/60 bg-card overflow-hidden">
            {representativeHoldings.map((item) => (
              <div key={item.name} className="p-3.5 space-y-1.5 hover:bg-muted/20 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{item.ticker}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {item.layer} · {item.weight}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {item.action}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {item.statusText}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                  {item.commentary}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
