import { ArrowLeft, Check, FileSearch, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ProcessingStatus } from '../types';

interface ProcessingScreenProps {
  status: ProcessingStatus;
  error: string | null;
  onBack: () => void;
}

const STEPS = [
  { key: 'parsing', label: 'Read files', description: 'Parse accounts and position data' },
  { key: 'matching', label: 'Match securities', description: 'Normalize symbols, currencies, and layers' },
  { key: 'quotes', label: 'Fetch market data', description: 'Update prices and exchange rates' },
] as const;

export function ProcessingScreen({
  status,
  error,
  onBack,
}: ProcessingScreenProps) {
  return (
    <main className="processing-page">
      <div className="processing-mark">
        {error ? <FileSearch size={28} /> : <RefreshCw size={28} />}
      </div>
      <h1>{error ? 'Import not completed' : 'Building your portfolio'}</h1>
      <p className="processing-message">{status.message}</p>
      <div className="processing-list">
        {STEPS.map((item) => {
          const state = status[item.key];
          return (
            <div className={`processing-row is-${state}`} key={item.key}>
              <div className="processing-state">
                {state === 'done' ? <Check size={17} /> : null}
                {state === 'active' ? (
                  <LoaderCircle className="spin" size={18} />
                ) : null}
                {state === 'pending' ? <span /> : null}
                {state === 'error' ? <span>!</span> : null}
              </div>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <button className="secondary-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to portfolio
        </button>
      ) : null}
    </main>
  );
}
