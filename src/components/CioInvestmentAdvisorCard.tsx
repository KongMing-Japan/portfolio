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
  quoteUpdatedAt?: string | null;
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
  quoteUpdatedAt,
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
        name: '萨莉亚',
        ticker: '7581.T · 日股',
        layer: '卫星仓',
        weight: '4.4%',
        statusText: '浮盈 +55.21% (+¥187.4万) · 全场领跑',
        action: '超额收益核心标杆，长线继续持有',
        commentary:
          '600 股底仓，成本 5,657 日元，现价飙升至 8,780 日元，单票贡献浮盈超 187 万日元。日本平价餐饮绝对龙头，抗通胀韧性与亚洲海外扩张形成双轮驱动，高 ROE 且自由现金流极其充沛，无需任何减仓动作，长线享受稳健分红与品牌壁垒溢价。',
      },
      {
        name: '纳斯达克100 ETF',
        ticker: '2845.T · 日股',
        layer: '核心仓',
        weight: '14.8%',
        statusText: '双账户合计 5,422 份 · 浮盈超 +¥205万',
        action: '宽基主干仓位，长线坚定压舱',
        commentary:
          '横跨乐天证券（3,422 份，成本 2,910 → 3,300，+13.4%）与 au 账户（2,000 份，成本 2,865 → 3,225，+12.6%），合计持仓达 5,422 份（市值约 1,774 万日元）。汇聚全球科技顶尖龙头，享受 AI 生产力周期长线红利，遇大盘急跌可动用闲置现金继续分批补配。',
      },
      {
        name: '共立维护',
        ticker: '9616.T · 日股',
        layer: '卫星仓',
        weight: '4.3%',
        statusText: '浮盈 +33.86% (+¥131.0万) · 稳步上行',
        action: '文旅酒店龙头，坐享基本面复苏',
        commentary:
          '现持仓 1,400 股（6 月分红后部分调减），成本 2,764 日元，现价稳步走高至 3,700 日元，单票浮盈超 131 万日元。Dormy Inn 商务与度假酒店入住率与客单价双升，受益于日本入境游爆发，现金流与盈利确定性强，保持底仓卧倒。',
      },
      {
        name: '东京地下铁',
        ticker: '9023.T · 日股',
        layer: '防守仓',
        weight: '6.6%',
        statusText: '浮亏 -7.3% (-¥62.5万) · 特许垄断公用',
        action: '底仓高息防守，耐心持有收息',
        commentary:
          'au 账户持仓 5,300 股，成本 1,608 日元，现价 1,490 日元。作为东京核心地铁路网的特许经营垄断资产，经营现金流极度充沛，下行空间被稳健的分红回报深度锁死，属于典型的逆周期防守压舱标的，静待估值均值回归。',
      },
      {
        name: 'Data Section',
        ticker: '3905.T · 日股',
        layer: '核心仓',
        weight: '1.9%',
        statusText: '浮亏 -13.1% (-¥35.2万) · 仓位已适度收缩',
        action: '控制风险敞口，不盲目加码抄底',
        commentary:
          'au 账户持仓 1,500 股（此前 2,000 股已完成适度收缩），成本 1,790 日元，现价 1,555 日元。属于高弹性日本 AI 数据中心与算力概念，在基本面兑现前需严格控制总仓位在 2% 以内，避免在下行调整中盲目摊平成本。',
      },
      {
        name: '英伟达',
        ticker: 'NVDA · 美股',
        layer: '核心仓',
        weight: '2.4%',
        statusText: 'App实盘盈亏 +$12,643.35 (含已实现)',
        action: '100股底仓长持，此前已大举落袋',
        commentary:
          'Tiger 账户现存 100 股底仓（均价 $171.19 → $179.18）。系统特别标明：Tiger App 显示的 +$12,643.35 包含此前大涨高位减持落袋的丰厚已实现利润。当前 100 股底仓作为长期观察哨与 AI 芯片主线参与者，长期陪伴龙头成长。',
      },
      {
        name: '小米集团',
        ticker: '01810 · 港股',
        layer: '核心仓',
        weight: '5.0%',
        statusText: 'App实盘盈亏 +HK$226,768.98 (含已实现)',
        action: '19,600股底仓稳坐，此前波段大赚',
        commentary:
          'Tiger 账户持仓 19,600 股（均价 HK$31.322 → HK$30.10）。虽然现存持仓现价略低于均价，但 Tiger App 显示累计盈亏超 +22.6 万港币，主要由此前波段高位兑现的巨额已实现利润贡献。智能手机高端化稳固，智能纯电车爆发式交付，基本面扎实。',
      },
      {
        name: '腾讯控股',
        ticker: '00700 · 港股',
        layer: '核心仓',
        weight: '2.8%',
        statusText: '浮亏 -20.6% (-HK$7.97万) · 千亿回购筑底',
        action: '耐心坚守，享受高频回购与分红',
        commentary:
          'Tiger 账户持仓 800 股（均价 HK$526.849 → HK$418.40）。国内互联网社交金融平台绝对壁垒，常态化千亿级回购与高额股息提供了极强的下行安全垫，估值处于历史中低分位，耐心等待中国资产流动性拐点。',
      },
      {
        name: 'NuScale Power',
        ticker: 'SMR · 美股',
        layer: '核心仓',
        weight: '2.2%',
        statusText: '持仓 3,000 股 · 浮亏 -53.0% (-$15,433)',
        action: '3,000股卧倒观望，不追加风险敞口',
        commentary:
          '小型模块化核反应堆（SMR）长线契合 AI 云端电力硬约束刚需，但商业化落地周期长、股价波动剧烈。持仓 3,000 股（均价 $11.56 → $5.43），当前已处于深幅调整低位，严格约束仓位不继续摊平，静待商业合同催化脉冲。',
      },
      {
        name: 'Circle',
        ticker: 'CRCL · 美股',
        layer: '卫星仓',
        weight: '3.6%',
        statusText: '持仓 400 股 · 浮亏 -35.1% (-$14,644)',
        action: '严格约束卫星仓位，耐心等待合规红利',
        commentary:
          'Tiger 美元账户持仓 400 股（均价 $104.41 → $67.80）。作为 USDC 发行方与跨境合规稳定币链上基础设施核心，具备高赔率期权属性，严格遵守卫星仓纪律，不进行盲目加仓。',
      },
    ];
  }, []);

  const latestDateInfo = useMemo(() => {
    let d = new Date();
    if (quoteUpdatedAt) {
      const parsed = new Date(quoteUpdatedAt);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      monthKey: `${year}-${month}`,
      dateFormatted: `${year}-${month}-${day}`,
      displayFull: `${year}年${Number(month)}月${Number(day)}日`,
      monthNum: Number(month),
    };
  }, [quoteUpdatedAt]);

  const nextMonthNum = latestDateInfo.monthNum === 12 ? 1 : latestDateInfo.monthNum + 1;

  const activeHoldingsReview = isOwnerUnlocked ? representativeHoldings : BUFFETT_SAMPLE_HOLDINGS_REVIEW;

  const titleText = isOwnerUnlocked
    ? `${latestDateInfo.monthNum} 月底复盘与投资建议 (${latestDateInfo.dateFormatted} 更新)`
    : `${latestDateInfo.monthNum} 月底复盘 · 伯克希尔 (巴菲特) 示范组合深度诊断`;

  const summaryText = isOwnerUnlocked ? (
    `${latestDateInfo.monthNum} 月末组合最新实盘已完成全券商精确对账：乐天证券（¥28,256,050，浮盈 +21.8%）由萨莉亚（+55.2% 全场领跑）与共立维护（+33.9%）构筑超额利润基石；au 账户（现物7808，证券+现金共 ¥18,546,500）稳步布局东京地铁与纳指主干；Tiger 证券（美股 $61,328 + 港股 HK$924,680）实盘口径忠实还原了 NVDA 与小米前期大举落袋的丰厚已实现利润。组合整体保持攻守兼备的稳健哑铃结构：核心仓（${formatPercent(metrics.coreWeight, 0)}）由高景气科技与高现金流实体双轮驱动，卫星仓（${formatPercent(metrics.satWeight, 0)}）严格约束在安全阈值内；投资账户可用现金约 ${formatExactMoney(metrics.cashVal, baseCurrency)}（占比 ${formatPercent(metrics.cashWeight, 0)}）。在核算上，严格秉持「双轨独立」原则：个人工资每月补充的 50 万日元现金作为外部储蓄本金独立建账，不混入持仓投资收益率（保持二级市场纯收益 +120.8% 的纯粹性）。这笔持续注入的现金流构建起坚韧的自我造血干火药引擎，建议后续继续保持「核心重仓耐心持有、弱势标的不盲目加码抄底、利用每月新补入的 50 万工资现金活水逢低分批补足防守对冲（如 2563.T / eMAXIS Slim）」的操作主线。`
  ) : (
    `${latestDateInfo.monthNum} 月末伯克希尔·哈撒韦公开持仓整体展现极高壁垒与流动性堡垒特征：核心权益持仓（${formatPercent(metrics.coreWeight, 0)}）高度聚焦于拥有极致品牌垄断与高自由现金流的企业（苹果、美国运通、可口可乐）；同时组合手握超过 3,200 亿美元的防守现金与短期美国国债，构筑了极深的流动性安全垫与极端风暴下的战略扫货弹药。建议个人投资者借鉴巴菲特「在别人贪婪时恐惧、手握充沛流动性耐心等待安全边际」的跨周期防御配置哲学。`
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
