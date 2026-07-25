import { ArrowRight, ReceiptText, Route } from 'lucide-react';
import { formatMoney } from '../lib/portfolio';
import type { BaseCurrency, Locale } from '../types';

interface LifeOsNextStepsProps {
  locale: Locale;
  total: number;
  baseCurrency: BaseCurrency;
}

const COPY = {
  zh: {
    label: 'LifeOS 下一步',
    title: '让这份持仓服务于人生目标',
    value: '当前组合资产',
    planner: '放入 LifeOS Planner',
    plannerBody: '带入当前资产，查看它能否支撑住房、教育与退休计划。',
    tax: '检查 LifeOS Tax 影响',
    taxBody: '打开证券所得输入，估算卖出、分红等情景的税后影响。',
  },
  ja: {
    label: 'LifeOS 次のステップ',
    title: '保有資産を人生目標につなぐ',
    value: '現在のポートフォリオ',
    planner: 'LifeOS Plannerに反映',
    plannerBody: '現在資産を引き継ぎ、住宅・教育・退職計画を支えられるか確認します。',
    tax: 'LifeOS Taxへの影響を確認',
    taxBody: '証券所得の入力を開き、売却・配当シナリオの税引後影響を試算します。',
  },
  en: {
    label: 'LifeOS next step',
    title: 'Connect this portfolio to your life goals',
    value: 'Current portfolio',
    planner: 'Use in LifeOS Planner',
    plannerBody: 'Carry over current assets and test housing, education, and retirement plans.',
    tax: 'Check the LifeOS Tax impact',
    taxBody: 'Open securities income and estimate after-tax outcomes for sales or dividends.',
  },
} as const;

export function LifeOsNextSteps({ locale, total, baseCurrency }: LifeOsNextStepsProps) {
  const text = COPY[locale];
  const plannerParams = new URLSearchParams({
    source: 'portfolio',
    assets: String(Math.round(total)),
  });
  const taxLocale = locale === 'zh' ? 'zh-CN' : locale;
  const taxParams = new URLSearchParams({
    source: 'portfolio',
    incomes: 'securities',
  });

  return (
    <section className="gf-side-card gf-lifeos-card">
      <span className="gf-lifeos-label">{text.label}</span>
      <h2>{text.title}</h2>
      <div className="gf-lifeos-value">
        <span>{text.value}</span>
        <strong>{formatMoney(total, baseCurrency)}</strong>
      </div>
      <a href={`https://planner.kongmingjapan.com/?${plannerParams}`}>
        <Route aria-hidden="true" />
        <span><strong>{text.planner}</strong><small>{text.plannerBody}</small></span>
        <ArrowRight aria-hidden="true" />
      </a>
      <a href={`https://tax.kongmingjapan.com/${taxLocale}/?${taxParams}`}>
        <ReceiptText aria-hidden="true" />
        <span><strong>{text.tax}</strong><small>{text.taxBody}</small></span>
        <ArrowRight aria-hidden="true" />
      </a>
    </section>
  );
}
