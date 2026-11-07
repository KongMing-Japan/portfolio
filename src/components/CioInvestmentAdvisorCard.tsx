import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { AggregatedHolding, BaseCurrency, Holding } from '../types';
import { formatExactMoney, formatPercent } from '../lib/portfolio';

interface CioInvestmentAdvisorCardProps {
  holdings: Holding[];
  aggregated: AggregatedHolding[];
  totalValue: number;
  baseCurrency: BaseCurrency;
  isOwnerUnlocked?: boolean;
}

const BUFFETT_SAMPLE_HOLDINGS_REVIEW = [
  {
    name: '苹果',
    ticker: 'AAPL · 美股',
    layer: '核心仓',
    weight: '26.0%',
    statusText: '长线压舱石 · 持续分红回购',
    action: '核心底仓卧倒，高估值期从容减持兑现',
    commentary:
      '伯克希尔第一大重仓股，拥有无可撼动的消费电子与全球闭环生态护城河。巴菲特在年内锁定部分利润增厚现金储备，但依然将苹果视为最核心的消费特许企业。',
  },
  {
    name: '美国运通',
    ticker: 'AXP · 美股',
    layer: '核心仓',
    weight: '20.6%',
    statusText: '浮盈数十倍 · 30年复利传奇',
    action: '长线坚定持有，享受网络效应红利',
    commentary:
      '高端持卡人净利息与年费收入韧性极高，全球高净值商旅支付闭环构筑了无法撼动的网络效应，是典型不受短期宏观周期侵蚀的长期现金奶牛。',
  },
  {
    name: '可口可乐',
    ticker: 'KO · 美股',
    layer: '核心仓',
    weight: '13.6%',
    statusText: '永续分红机器 · 跨世纪抗通胀',
    action: '永久持有，稳定享受现金股息',
    commentary:
      '自 1988 年建仓以来持股超 35 年，每年收到的现金股息早已数倍超越初始投资本金，是价值投资护城河与抗通胀资产的教科书级典范。',
  },
  {
    name: '西方石油 / 雪佛龙',
    ticker: 'OXY / CVX · 美股',
    layer: '防守仓',
    weight: '14.5%',
    statusText: '传统能源压舱石 · 高自由现金流',
    action: '战略能源对冲，逢低估值区间增配',
    commentary:
      '巴菲特近年来持续逆周期增持的传统能源资产，拥有极佳的资产回报率与自由现金流分红，作为全球通胀波动与地缘动荡的长期战略对冲。',
  },
];

export function CioInvestmentAdvisorCard({
  aggregated,
  totalValue,
  baseCurrency,
  isOwnerUnlocked = false,
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

  // Selected Representative Holdings - separated individually, no emojis, clean list
  const representativeHoldings = useMemo(() => {
    return [
      {
        name: 'NuScale Power',
        ticker: 'SMR · 美股',
        layer: '卫星仓',
        weight: '2.1%',
        statusText: '浮亏 -51% · 低位震荡',
        action: '底仓卧倒，不盲目补仓',
        commentary:
          '小型模块化核反应堆契合科技巨头 AI 云端电力的长期刚需，但商业化交付周期长，前期股价深幅回调后在低位构筑整理平台。2.1% 占比已充分锁死风险暴露，无需在底部恐慌割肉，亦不建议主动加仓摊平成本，耐心等待商业合同催化脉冲反弹。',
      },
      {
        name: '英伟达',
        ticker: 'NVDA · 美股',
        layer: '核心仓',
        weight: '2.5%',
        statusText: '浮盈 +20% · 趋势强劲',
        action: '核心压舱石，逢急跌低吸',
        commentary:
          'Blackwell 架构芯片进入批量出货期，北美头部云厂商资本开支持续超预期，长期多头形态完好。作为核心财富增值引擎，切勿盲目恐高止盈，若遇市场情绪大幅杀跌可逢低增配。',
      },
      {
        name: '日经纳指100 ETF',
        ticker: '2845.T · 日股',
        layer: '核心仓',
        weight: '14.0%',
        statusText: '浮盈 +18% · 上升通道',
        action: '宽基主干仓位，长线坚定持有',
        commentary:
          '汇聚全球顶尖科技巨头的核心资产底盘，享受全球数字化与 AI 生产力红利。若纳指出现 6%~8% 的技术性急跌，可动用闲置现金分批定投低吸。',
      },
      {
        name: '萨莉亚',
        ticker: '7581.T · 日股',
        layer: '核心仓',
        weight: '4.5%',
        statusText: '浮盈 +45% · 稳健走高',
        action: '优质实体底仓，无需变动',
        commentary:
          '日本平价消费龙头与抗通胀代表，本土客流与海外亚洲门店翻台率持续超预期，高 ROE 且日元经营现金流极度充沛。4.5% 的配置比例适中，提供稳固的安全垫，无需任何调仓，长期持有享受分红与稳健估值溢价。',
      },
      {
        name: '美债对冲 ETF',
        ticker: '1482.T · 日股',
        layer: '防守仓',
        weight: '4.0%',
        statusText: '浮亏 -7% · 估值低位',
        action: '分批定投回补，夯实防守',
        commentary:
          '受美联储降息节奏反复扰动短期承压，但日元汇率对冲机制完全阻断了日元升值的汇兑风险，具备强逆周期避险价值。防守仓（23.9%）距 30% 目标线尚有缺口，当前价格处于年内底部价值区间，是后续配置闲置现金的首选去处。',
      },
      {
        name: '小米集团',
        ticker: '01810 · 港股',
        layer: '核心仓',
        weight: '8.0%',
        statusText: '浮盈 +42% · 估值重塑',
        action: '设移动止盈，锁定部分利润',
        commentary:
          '人车家全生态战略推进顺利，新车交付放量加速驱动盈利与估值修复。持股浮盈丰厚，建议对高位利润设置阶梯移动止盈线，防范港股短期波动回撤。',
      },
      {
        name: '腾讯控股',
        ticker: '00700 · 港股',
        layer: '核心仓',
        weight: '4.8%',
        statusText: '浮亏 -27% · 扎实筑底',
        action: '耐心守望，享受高额回购',
        commentary:
          '游戏主业与混元大模型生态稳健，百亿级高频回购与分红提供了扎实的下行保护。当前估值处于历史中低分位，维持核心底仓静待港股流动性拐点。',
      },
    ];
  }, []);

  const activeHoldingsReview = isOwnerUnlocked ? representativeHoldings : BUFFETT_SAMPLE_HOLDINGS_REVIEW;

  const titleText = isOwnerUnlocked
    ? '10 月底复盘'
    : '10 月底复盘 · 伯克希尔 (巴菲特) 示范组合深度诊断';

  const summaryText = isOwnerUnlocked ? (
    `10 月末组合整体保持攻守兼备的稳健哑铃结构：核心仓（${formatPercent(metrics.coreWeight, 0)}）由高景气科技与高现金流实体双轮驱动，卫星仓（${formatPercent(metrics.satWeight, 0)}）严格约束在安全阈值内；投资账户内可用现金约 ${formatExactMoney(metrics.cashVal, baseCurrency)}（占比 ${formatPercent(metrics.cashWeight, 0)}），流动性储备极为充沛。鉴于防守仓（${formatPercent(metrics.defWeight, 0)}）距离 30% 目标线尚有缺口，建议 11 月保持「核心重仓耐心持有、弱势期权不盲目加码抄底、利用闲置资金逢低分批补足防守对冲（如 1482.T / 2563.T）」的操作主线。`
  ) : (
    `10 月末伯克希尔·哈撒韦公开持仓整体展现极高壁垒与流动性堡垒特征：核心权益持仓（${formatPercent(metrics.coreWeight, 0)}）高度聚焦于拥有极致品牌垄断与高自由现金流的企业（苹果、美国运通、可口可乐）；同时组合手握超过 3,200 亿美元的防守现金与短期美国国债，构筑了极深的流动性安全垫与极端风暴下的战略扫货弹药。建议个人投资者借鉴巴菲特「在别人贪婪时恐惧、手握充沛流动性耐心等待安全边际」的跨周期防御配置哲学。`
  );

  return (
    <Card className="shadow-xs overflow-hidden">
      {/* 简洁无多余嵌套的 CardHeader：标题 + 10月末总体复盘文字，不套额外灰色卡片 */}
      <CardHeader className="pb-3 border-b border-border/50 space-y-2">
        <CardTitle className="text-base font-semibold text-foreground">
          {titleText}
        </CardTitle>
        <p className="text-sm text-foreground/90 leading-relaxed">
          {summaryText}
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          {isOwnerUnlocked ? '重点个股点评与操作建议' : '伯克希尔重仓个股点评与投资哲学'}
        </h4>

        {/* 干净列表形式，每只股票独立分开，无多余嵌套，无 emoji */}
        <div className="rounded-xl border border-border divide-y divide-border/60 bg-card overflow-hidden">
          {activeHoldingsReview.map((item) => (
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
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
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
      </CardContent>
    </Card>
  );
}
