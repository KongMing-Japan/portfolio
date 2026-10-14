import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type {
  Superinvestor,
  SuperinvestorData,
  SuperinvestorHolding,
  SuperinvestorHoldingStatus,
} from '../types';

const DONUT_COLORS = [
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
  '#bfdbfe',
  '#dbeafe',
  '#f1f5f9',
];

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercent(value: number, signed = false) {
  const percentage = value * 100;
  const prefix = signed && percentage > 0 ? '+' : '';
  return `${prefix}${percentage.toFixed(1)}%`;
}

function formatWeightChange(value: number) {
  const points = value * 100;
  const prefix = points > 0 ? '+' : '';
  return `${prefix}${points.toFixed(1)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatQuarter(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return `${date.getUTCFullYear()} 年 Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function statusLabel(status: SuperinvestorHoldingStatus) {
  if (status === 'new') return '新进';
  if (status === 'increased') return '增持';
  if (status === 'decreased') return '减持';
  if (status === 'exited') return '清仓';
  return '持平';
}

function statusTone(status: SuperinvestorHoldingStatus) {
  if (status === 'new' || status === 'increased') return 'positive';
  if (status === 'decreased' || status === 'exited') return 'negative';
  return 'neutral';
}

function donutRows(holdings: SuperinvestorHolding[]) {
  const top = holdings.slice(0, 6);
  const otherWeight = holdings
    .slice(6)
    .reduce((sum, holding) => sum + holding.weight, 0);
  return [
    ...top.map((holding) => ({
      name: holding.ticker,
      value: holding.weight,
    })),
    ...(otherWeight > 0 ? [{ name: '其他标的', value: otherWeight }] : []),
  ];
}

function InvestorDonut({
  investor,
  compact = false,
}: {
  investor: Superinvestor;
  compact?: boolean;
}) {
  const rows = useMemo(() => donutRows(investor.holdings), [investor.holdings]);
  const topLabel = investor.holdings[0]?.ticker || '—';
  return (
    <div
      className={`si-donut ${compact ? 'is-compact' : ''}`}
      role="img"
      aria-label={`${investor.name} 投资组合配置。第一大重仓为 ${topLabel}，占比 ${formatPercent(investor.holdings[0]?.weight || 0)}。`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: compact ? 100 : 200, height: compact ? 100 : 200 }}
      >
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={compact ? 30 : 54}
            outerRadius={compact ? 48 : 88}
            paddingAngle={1.5}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {rows.map((row, index) => (
              <Cell
                key={row.name}
                fill={DONUT_COLORS[index] || DONUT_COLORS.at(-1)}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <img
        className="si-portrait"
        src={investor.portrait}
        alt={`${investor.name} 头像`}
      />
    </div>
  );
}

function InvestorCard({
  investor,
  onOpen,
}: {
  investor: Superinvestor;
  onOpen: () => void;
}) {
  const change = investor.totalValueChange;
  return (
    <button className="si-card" onClick={onOpen}>
      <div className="si-card-copy">
        <span className="si-quarter">{formatQuarter(investor.reportDate)}</span>
        <h2>{investor.name}</h2>
        <p className="si-firm">{investor.firm}</p>
        <div className="si-value-line">
          <strong>{formatUsd(investor.totalValue)}</strong>
          {change != null ? (
            <span className={change >= 0 ? 'is-positive' : 'is-negative'}>
              {formatPercent(change, true)} 13F 市值
            </span>
          ) : null}
        </div>
        <div className="si-card-moves">
          {investor.topMoves.slice(0, 2).map((move) => (
            <span key={`${move.ticker}-${move.status}`}>
              <b>{move.ticker}</b>
              <em className={`is-${statusTone(move.status)}`}>
                {statusLabel(move.status)} {formatWeightChange(move.weightChange)}
              </em>
            </span>
          ))}
        </div>
        <small>
          申报于 {formatDate(investor.filedAt)} · 共 {investor.positionCount} 只标的
        </small>
      </div>
      <div className="si-card-visual">
        <InvestorDonut investor={investor} compact />
        <div className="si-ticker-key" aria-hidden="true">
          {investor.holdings.slice(0, 3).map((holding) => (
            <span key={holding.cusip}>{holding.ticker}</span>
          ))}
        </div>
      </div>
      <ArrowUpRight className="si-card-arrow" size={18} />
    </button>
  );
}

function InvestorDetail({
  investor,
  caveat,
  onBack,
}: {
  investor: Superinvestor;
  caveat: string;
  onBack: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleHoldings = showAll
    ? investor.holdings
    : investor.holdings.slice(0, 24);

  return (
    <div className="si-detail">
      <button className="si-back" onClick={onBack}>
        <ArrowLeft size={17} />
        返回投资大师列表
      </button>

      <section className="si-detail-hero">
        <div className="si-detail-identity">
          <img src={investor.portrait} alt={`${investor.name} 头像`} />
          <div>
            <span>{formatQuarter(investor.reportDate)} 13F 披露</span>
            <h1>{investor.name}</h1>
            <p>{investor.firm}</p>
          </div>
        </div>
        <div className="si-detail-stats">
          <div>
            <span>披露总市值</span>
            <strong>{formatUsd(investor.totalValue)}</strong>
          </div>
          <div>
            <span>持仓标的数</span>
            <strong>{investor.positionCount}</strong>
          </div>
          <div>
            <span>季度披露市值变动</span>
            <strong
              className={
                (investor.totalValueChange || 0) >= 0
                  ? 'is-positive'
                  : 'is-negative'
              }
            >
              {investor.totalValueChange == null
                ? '—'
                : formatPercent(investor.totalValueChange, true)}
            </strong>
          </div>
        </div>
      </section>

      <div className="si-detail-grid">
        <section className="si-panel si-composition-panel">
          <div className="si-panel-header">
            <div>
              <h2>持仓配置构成</h2>
              <p>前六大重仓标的与其余持仓组合。</p>
            </div>
          </div>
          <div className="si-composition-body">
            <InvestorDonut investor={investor} />
            <div className="si-legend">
              {donutRows(investor.holdings).map((row, index) => (
                <div key={row.name}>
                  <span
                    className="si-legend-dot"
                    style={{ background: DONUT_COLORS[index] }}
                  />
                  <b>{row.name}</b>
                  <strong>{formatPercent(row.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="si-panel">
          <div className="si-panel-header">
            <div>
              <h2>季度调仓动态</h2>
              <p>报告期内权重变化幅度最大的标的。</p>
            </div>
          </div>
          <div className="si-move-list">
            {investor.topMoves.map((move) => (
              <div key={`${move.ticker}-${move.status}`}>
                <span className="si-security-mark">{move.ticker.slice(0, 1)}</span>
                <span>
                  <b>{move.ticker}</b>
                  <small>{move.issuer}</small>
                </span>
                <em className={`is-${statusTone(move.status)}`}>
                  {statusLabel(move.status)}
                </em>
                <strong>{formatWeightChange(move.weightChange)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="si-panel si-holdings-panel">
        <div className="si-panel-header">
          <div>
            <h2>披露持仓明细</h2>
            <p>按当前 13F 申报市值降序排列。</p>
          </div>
          <a href={investor.filingUrl} target="_blank" rel="noreferrer">
            SEC 原始申报 <ExternalLink size={14} />
          </a>
        </div>
        <div className="si-table-wrap">
          <table className="si-table">
            <thead>
              <tr>
                <th>#</th>
                <th>标的 / 发行公司</th>
                <th className="numeric">申报市值</th>
                <th>组合权重</th>
                <th className="numeric">持股数</th>
                <th>调仓动态</th>
              </tr>
            </thead>
            <tbody>
              {visibleHoldings.map((holding, index) => (
                <tr key={holding.cusip}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="si-table-security">
                      <b>{holding.ticker}</b>
                      <small>{holding.issuer}</small>
                    </span>
                  </td>
                  <td className="numeric">{formatUsd(holding.value)}</td>
                  <td>
                    <span className="si-weight-row">
                      <span>
                        <i style={{ width: `${Math.max(holding.weight * 100, 1)}%` }} />
                      </span>
                      <b>{formatPercent(holding.weight)}</b>
                    </span>
                  </td>
                  <td className="numeric">{formatNumber(holding.shares)}</td>
                  <td>
                    <span className={`si-status is-${statusTone(holding.status)}`}>
                      {statusLabel(holding.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {investor.holdings.length > 24 ? (
          <button className="si-show-all" onClick={() => setShowAll((value) => !value)}>
            {showAll ? '仅展示前 24 只标的' : `展示全部 ${investor.holdings.length} 只标的`}
          </button>
        ) : null}
      </section>

      <footer className="si-source-note">
        <CalendarDays size={17} />
        <p>
          报告期 {formatDate(investor.reportDate)}；申报日 {formatDate(investor.filedAt)}。
          {' '}{caveat}
        </p>
        <a href={investor.secEntityUrl} target="_blank" rel="noreferrer">
          在 SEC.gov 查看 <ExternalLink size={13} />
        </a>
      </footer>
    </div>
  );
}

/**
 * List-only component: renders the 4 investor quick-entrance cards.
 * Card clicks trigger hash navigation — the App handles the detail page.
 */
export function SuperinvestorsScreen() {
  const [data, setData] = useState<SuperinvestorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/data/superinvestors.json')
      .then((response) => {
        if (!response.ok) throw new Error('季度 13F 申报数据暂不可用。');
        return response.json() as Promise<SuperinvestorData>;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : '季度 13F 申报数据暂不可用。',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const openInvestor = (investor: Superinvestor) => {
    window.location.hash = `superinvestors/${investor.id}`;
  };

  if (error) {
    return (
      <section className="si-state">
        <RefreshCw size={22} />
        <h1>投资大师持仓标杆</h1>
        <p>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="si-state" aria-live="polite">
        <RefreshCw className="spin" size={22} />
        <h1>正在加载 13F 申报数据</h1>
        <p>正在读取最新的机构公开披露组合...</p>
      </section>
    );
  }

  return (
    <section className="si-index">
      <header className="si-index-header" style={{ marginBottom: '1.2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>投资大师持仓标杆</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            参考巴菲特（Berkshire Hathaway）等知名机构的季度公开持仓与配置比例。
          </p>
        </div>
      </header>
      <div className="si-card-grid">
        {data.investors.map((investor) => (
          <InvestorCard
            key={investor.id}
            investor={investor}
            onOpen={() => openInvestor(investor)}
          />
        ))}
      </div>
      <p className="si-index-caveat">{data.caveat}</p>
    </section>
  );
}

/**
 * Standalone detail page: fetches data and renders the selected investor.
 * Rendered at the App level when hash matches `#superinvestors/:id`.
 */
export function SuperinvestorDetailPage({ investorId }: { investorId: string }) {
  const [data, setData] = useState<SuperinvestorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/data/superinvestors.json')
      .then((response) => {
        if (!response.ok) throw new Error('季度 13F 申报数据暂不可用。');
        return response.json() as Promise<SuperinvestorData>;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : '季度 13F 申报数据暂不可用。',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [investorId]);

  const goBack = () => {
    window.location.hash = 'superinvestors';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <main className="gf-page">
        <section className="si-state">
          <RefreshCw size={22} />
          <h1>投资大师持仓标杆</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="gf-page">
        <section className="si-state" aria-live="polite">
          <RefreshCw className="spin" size={22} />
          <h1>正在加载 13F 申报数据</h1>
          <p>正在读取最新的机构公开披露组合...</p>
        </section>
      </main>
    );
  }

  const investor = data.investors.find((i) => i.id === investorId);
  if (!investor) {
    return (
      <main className="gf-page">
        <section className="si-state">
          <h1>未找到该投资大师</h1>
          <button className="si-back" onClick={goBack}>
            <ArrowLeft size={17} />
            返回投资大师列表
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="gf-page">
      <InvestorDetail investor={investor} caveat={data.caveat} onBack={goBack} />
      <footer className="gf-footer" style={{ width: 'min(1100px, calc(100% - 48px))', margin: '3.5rem auto 0', paddingTop: '1.8rem', paddingBottom: '2.5rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        <p style={{ margin: '0 0 0.35rem', fontWeight: 600, color: '#0f172a' }}>Portfolio 调仓 · 独立多券商资产配置与再平衡系统</p>
        <p style={{ margin: '0 0 0.6rem' }}>© 2026 KongMing LLC · 孔明合同会社</p>
        <div className="gf-footer-links">
          <a href="https://kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            KongMing
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://radar.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Radar
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://lab.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Select China
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://kodomo.fyi/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Kodomo Go!
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://money.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            Money OS
          </a>
          <span className="gf-footer-sep">·</span>
          <a href="https://citylog.kongmingjapan.com/" target="_blank" rel="noreferrer" className="gf-footer-link">
            CityLog
          </a>
        </div>
      </footer>
    </main>
  );
}
