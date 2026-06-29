import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import type { Holding, Layer } from '../types';
import { LAYER_META } from '../lib/portfolio';

interface ReviewScreenProps {
  holdings: Holding[];
  onUpdate: (id: string, patch: Partial<Holding>) => void;
  onRemove: (id: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const LAYERS = Object.keys(LAYER_META) as Layer[];

const LEGACY_REVIEW_REASONS: Record<string, string> = {
  '缺少证券代码': 'Missing ticker',
  '缺少币种': 'Missing currency',
  '数量异常': 'Invalid quantity',
  '截图识别置信度较低': 'Low OCR confidence',
  '未获取到最新行情': 'Latest quote unavailable',
  '可能重复导入': 'Possible duplicate import',
};

function displayReason(reason: string) {
  return LEGACY_REVIEW_REASONS[reason] ?? reason;
}

export function ReviewScreen({
  holdings,
  onUpdate,
  onRemove,
  onConfirm,
  onBack,
}: ReviewScreenProps) {
  const issues = holdings.filter((holding) => holding.needsReview);
  const groups = new Map<string, Holding[]>();
  for (const holding of issues) {
    const key = holding.broker || 'Unknown broker';
    groups.set(key, [...(groups.get(key) ?? []), holding]);
  }

  return (
    <main className="review-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to portfolio
      </button>
      <div className="review-heading">
        <div>
          <h1>Review imported positions</h1>
          <p>
            {holdings.length} positions found. Review the {issues.length} items that need attention.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={onConfirm}
          disabled={holdings.length === 0}
        >
          Open portfolio
          <ArrowRight size={17} />
        </button>
      </div>

      {issues.length === 0 ? (
        <div className="review-empty">
          <h2>No issues found</h2>
          <p>Symbols, quantities, currencies, and market prices are ready.</p>
        </div>
      ) : (
        <div className="review-groups">
          {[...groups.entries()].map(([broker, rows]) => (
            <section className="review-group" key={broker}>
              <div className="review-group-title">
                <h2>{broker}</h2>
                <span>{rows.length} to review</span>
              </div>
              <div className="review-table-wrap">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th>Security</th>
                      <th>Ticker</th>
                      <th>Currency</th>
                      <th className="numeric">Quantity</th>
                      <th className="numeric">Price</th>
                      <th>Layer</th>
                      <th>Issue</th>
                      <th aria-label="Delete" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((holding) => (
                      <tr key={holding.id}>
                        <td>
                          <input
                            value={holding.name}
                            aria-label="Security name"
                            onChange={(event) =>
                              onUpdate(holding.id, { name: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={holding.ticker}
                            aria-label="Ticker"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                ticker: event.target.value.trim(),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="short-input"
                            value={holding.currency}
                            aria-label="Currency"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                currency: event.target.value.toUpperCase(),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="number-input"
                            type="number"
                            value={holding.quantity}
                            aria-label="Quantity"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                quantity: Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="number-input"
                            type="number"
                            value={holding.marketPrice ?? ''}
                            placeholder="Confirm price"
                            aria-label="Current price"
                            onChange={(event) => {
                              const price = event.target.value
                                ? Number(event.target.value)
                                : null;
                              onUpdate(holding.id, {
                                marketPrice: price,
                                marketValue:
                                  price == null ? null : price * holding.quantity,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={holding.layer}
                            aria-label="Layer"
                            onChange={(event) =>
                              onUpdate(holding.id, {
                                layer: event.target.value as Layer,
                              })
                            }
                          >
                            {LAYERS.map((layer) => (
                              <option key={layer} value={layer}>
                                {LAYER_META[layer].label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="reason-list">
                            {holding.reviewReasons.map((reason) => (
                              <span key={reason}>{displayReason(reason)}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button
                            className="row-delete"
                            aria-label={`Delete ${holding.name}`}
                            onClick={() => onRemove(holding.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
