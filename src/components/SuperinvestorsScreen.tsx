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
  '#2f67d8',
  '#4c7ee0',
  '#6994e7',
  '#86aaed',
  '#a6c1f2',
  '#c7d8f6',
  '#e7edf7',
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
  return new Intl.NumberFormat('en-US', {
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
  return `${prefix}${points.toFixed(1)} pp`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatQuarter(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

function statusLabel(status: SuperinvestorHoldingStatus) {
  if (status === 'new') return 'New';
  if (status === 'increased') return 'Increased';
  if (status === 'decreased') return 'Reduced';
  if (status === 'exited') return 'Exited';
  return 'Unchanged';
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
    ...(otherWeight > 0 ? [{ name: 'Other', value: otherWeight }] : []),
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
      aria-label={`${investor.name} portfolio allocation. Largest reported holding is ${topLabel} at ${formatPercent(investor.holdings[0]?.weight || 0)}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius="57%"
            outerRadius="92%"
            paddingAngle={1.1}
            stroke="#ffffff"
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
        alt={`${investor.name} illustrated portrait`}
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
              {formatPercent(change, true)} 13F value
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
          Filed {formatDate(investor.filedAt)} · {investor.positionCount} positions
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
        All superinvestors
      </button>

      <section className="si-detail-hero">
        <div className="si-detail-identity">
          <img src={investor.portrait} alt={`${investor.name} illustrated portrait`} />
          <div>
            <span>{formatQuarter(investor.reportDate)} 13F</span>
            <h1>{investor.name}</h1>
            <p>{investor.firm}</p>
          </div>
        </div>
        <div className="si-detail-stats">
          <div>
            <span>Reported value</span>
            <strong>{formatUsd(investor.totalValue)}</strong>
          </div>
          <div>
            <span>Positions</span>
            <strong>{investor.positionCount}</strong>
          </div>
          <div>
            <span>Quarterly reported value change</span>
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
              <h2>Portfolio composition</h2>
              <p>Top six reported positions and all remaining holdings.</p>
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
              <h2>Quarterly moves</h2>
              <p>Largest changes in reported portfolio weight.</p>
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
            <h2>Reported holdings</h2>
            <p>Sorted by current 13F market value.</p>
          </div>
          <a href={investor.filingUrl} target="_blank" rel="noreferrer">
            SEC filing <ExternalLink size={14} />
          </a>
        </div>
        <div className="si-table-wrap">
          <table className="si-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Security</th>
                <th className="numeric">Value</th>
                <th>Portfolio weight</th>
                <th className="numeric">Shares</th>
                <th>Quarter</th>
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
            {showAll ? 'Show top 24' : `Show all ${investor.holdings.length} positions`}
          </button>
        ) : null}
      </section>

      <footer className="si-source-note">
        <CalendarDays size={17} />
        <p>
          Report period {formatDate(investor.reportDate)}; filed {formatDate(investor.filedAt)}.
          {' '}{caveat}
        </p>
        <a href={investor.secEntityUrl} target="_blank" rel="noreferrer">
          View on SEC.gov <ExternalLink size={13} />
        </a>
      </footer>
    </div>
  );
}

function selectedInvestorFromHash() {
  const match = window.location.hash.match(/^#superinvestors\/([^/]+)$/);
  return match?.[1] || null;
}

export function SuperinvestorsScreen() {
  const [data, setData] = useState<SuperinvestorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedInvestorFromHash,
  );

  useEffect(() => {
    let active = true;
    fetch('/data/superinvestors.json')
      .then((response) => {
        if (!response.ok) throw new Error('Quarterly filings are unavailable.');
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
              : 'Quarterly filings are unavailable.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncHash = () => setSelectedId(selectedInvestorFromHash());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const selected = data?.investors.find((investor) => investor.id === selectedId);

  const openInvestor = (investor: Superinvestor) => {
    setSelectedId(investor.id);
    window.location.hash = `superinvestors/${investor.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeInvestor = () => {
    setSelectedId(null);
    window.location.hash = 'superinvestors';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (error) {
    return (
      <section className="si-state">
        <RefreshCw size={22} />
        <h1>Superinvestors</h1>
        <p>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="si-state" aria-live="polite">
        <RefreshCw className="spin" size={22} />
        <h1>Loading quarterly filings</h1>
        <p>Reading the latest SEC 13F portfolio disclosures.</p>
      </section>
    );
  }

  if (selected) {
    return (
      <InvestorDetail investor={selected} caveat={data.caveat} onBack={closeInvestor} />
    );
  }

  return (
    <section className="si-index">
      <header className="si-index-header">
        <div>
          <span className="si-eyebrow">SEC 13F · Quarterly</span>
          <h1>Superinvestors</h1>
          <p>
            Explore the latest reported U.S. equity portfolios of widely followed investors.
          </p>
        </div>
        <div className="si-source-status">
          <CalendarDays size={17} />
          <span>
            Latest source update
            <b>{formatDate(data.sourceUpdatedAt)}</b>
          </span>
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
