import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { fetchBundledPrices, fetchQuotes, extractImagePositions } from './lib/api';
import {
  markDuplicates,
  parseCsvFile,
  parseHoldingsCsv,
  parseHoldingsText,
} from './lib/csv';
import {
  applyQuotes,
  makeId,
  marketFromTicker,
  normalizeLayer,
  recalculateBaseValues,
  suggestBaseCurrency,
} from './lib/portfolio';
import { upsertHoldings } from './lib/upsert';
import {
  clearSnapshot,
  isOwnerSessionUnlocked,
  loadOwnerSnapshot,
  loadSnapshot,
  saveOwnerSnapshot,
  saveSnapshot,
  setOwnerSessionUnlocked,
} from './lib/storage';
import { INITIAL_SAMPLE_HOLDINGS, INITIAL_FX, INITIAL_UPDATED_AT } from './lib/initialData';
import {
  REAL_PORTFOLIO_FX,
  REAL_PORTFOLIO_HOLDINGS,
  REAL_PORTFOLIO_SNAPSHOT,
  REAL_PORTFOLIO_UPDATED_AT,
} from './lib/realPortfolioData';
import { ProcessingScreen } from './components/ProcessingScreen';
import { FinanceReportScreen } from './components/FinanceReportScreen';
import { ReviewScreen } from './components/ReviewScreen';
import type {
  AppStep,
  BaseCurrency,
  Holding,
  ManualHoldingInput,
  PortfolioSnapshot,
  ProcessingStatus,
  QuoteResponse,
  ReviewSnapshot,
} from './types';

const SuperinvestorDetailPage = lazy(() =>
  import('./components/SuperinvestorsScreen').then((m) => ({ default: m.SuperinvestorDetailPage })),
);

const INITIAL_STATUS: ProcessingStatus = {
  parsing: 'pending',
  matching: 'pending',
  quotes: 'pending',
  message: '准备解析持仓数据',
};

function App() {
  const [step, setStep] = useState<AppStep>('report');
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState<boolean>(() =>
    isOwnerSessionUnlocked(),
  );
  const [holdings, setHoldings] = useState<Holding[]>(() =>
    isOwnerSessionUnlocked() ? REAL_PORTFOLIO_HOLDINGS : INITIAL_SAMPLE_HOLDINGS,
  );
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>(() =>
    isOwnerSessionUnlocked() ? 'JPY' : 'USD',
  );
  const [fx, setFx] = useState<Record<string, number>>(() =>
    isOwnerSessionUnlocked() ? REAL_PORTFOLIO_FX : INITIAL_FX,
  );
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<string | null>(() =>
    isOwnerSessionUnlocked() ? REAL_PORTFOLIO_UPDATED_AT : INITIAL_UPDATED_AT,
  );
  const [processing, setProcessing] =
    useState<ProcessingStatus>(INITIAL_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedPortfolio, setHasSavedPortfolio] = useState(false);

  // Hash-based route: #superinvestors/:id -> standalone detail page
  const [superinvestorId, setSuperinvestorId] = useState<string | null>(() => {
    const match = window.location.hash.match(/^#superinvestors\/([^/]+)$/);
    return match?.[1] || null;
  });

  useEffect(() => {
    const syncRoute = () => {
      const match = window.location.hash.match(/^#superinvestors\/([^/]+)$/);
      setSuperinvestorId(match?.[1] || null);
    };
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
      sessionStorage.setItem('portfolio-current-step', step);
    } catch {}
  }, [step]);

  useEffect(() => {
    document.documentElement.lang = 'zh-CN';
    document.title = 'Portfolio';
  }, []);

  const persist = useCallback(
    async (
      nextHoldings: Holding[],
      nextCurrency = baseCurrency,
      nextFx = fx,
      nextUpdatedAt = quoteUpdatedAt,
      ownerMode = isOwnerUnlocked,
    ) => {
      const snapshot: PortfolioSnapshot = {
        version: 1,
        holdings: nextHoldings,
        baseCurrency: nextCurrency,
        fx: nextFx,
        quoteUpdatedAt: nextUpdatedAt,
        savedAt: new Date().toISOString(),
      };
      if (ownerMode) {
        await saveOwnerSnapshot(snapshot);
      } else {
        await saveSnapshot(snapshot);
        setHasSavedPortfolio(true);
      }
    },
    [baseCurrency, fx, isOwnerUnlocked, quoteUpdatedAt],
  );

  const finishImport = useCallback(
    async (parsed: Holding[]) => {
      if (!parsed.length) throw new Error('No valid positions were found.');
      const deduped = markDuplicates(parsed);
      const suggestedCurrency = suggestBaseCurrency(deduped);
      setBaseCurrency(suggestedCurrency);
      setProcessing({
        parsing: 'done',
        matching: 'done',
        quotes: 'active',
        message: '正在获取最新行情价格与汇率',
      });

      let quoteResponse: QuoteResponse;
      try {
        quoteResponse = await fetchQuotes(deduped);
      } catch {
        quoteResponse = await fetchBundledPrices().catch(() => ({
          quotes: [],
          fx: { JPY: 1, USD: 150.4, HKD: 19.4, CNY: 21.1 },
          fetchedAt: new Date().toISOString(),
        }));
      }

      const nextFx = { JPY: 1, ...quoteResponse.fx };
      const enriched = applyQuotes(deduped, quoteResponse, suggestedCurrency);
      setHoldings(enriched);
      setFx(nextFx);
      setQuoteUpdatedAt(quoteResponse.fetchedAt);
      setProcessing({
        parsing: 'done',
        matching: 'done',
        quotes: 'done',
        message: '投资组合已就绪',
      });
      await persist(
        enriched,
        suggestedCurrency,
        nextFx,
        quoteResponse.fetchedAt,
      );
      setStep(enriched.some((item) => item.needsReview) ? 'review' : 'report');
    },
    [persist],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      setStep('processing');
      setProcessing({
        parsing: 'active',
        matching: 'pending',
        quotes: 'pending',
        message: '正在读取上传文件与截图',
      });
      try {
        const csvFiles = files.filter((file) => /\.csv$/i.test(file.name));
        const imageFiles = files.filter((file) =>
          /\.(png|jpe?g|webp)$/i.test(file.name),
        );
        const [csvGroups, imageGroups] = await Promise.all([
          Promise.all(csvFiles.map(parseCsvFile)),
          Promise.all(imageFiles.map(extractImagePositions)),
        ]);
        setProcessing({
          parsing: 'done',
          matching: 'active',
          quotes: 'pending',
          message: '正在规范化代码格式、币种与资产分层',
        });
        await finishImport([...csvGroups.flat(), ...imageGroups.flat()]);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : '文件解析处理失败。';
        setError(message);
        setProcessing((current) => ({
          ...current,
          parsing: current.parsing === 'active' ? 'error' : current.parsing,
          matching: current.matching === 'active' ? 'error' : current.matching,
          quotes: current.quotes === 'active' ? 'error' : current.quotes,
          message,
        }));
      }
    },
    [finishImport],
  );

  const handleSample = useCallback(async () => {
    setError(null);
    setOwnerSessionUnlocked(false);
    setIsOwnerUnlocked(false);
    setHoldings(INITIAL_SAMPLE_HOLDINGS);
    setBaseCurrency('USD');
    setFx(INITIAL_FX);
    const now = new Date().toISOString();
    setQuoteUpdatedAt(now);
    setStep('report');
    await persist(INITIAL_SAMPLE_HOLDINGS, 'USD', INITIAL_FX, now, false);
  }, [persist]);

  const handleUnlockOwner = useCallback(async () => {
    setError(null);
    setOwnerSessionUnlocked(true);
    setIsOwnerUnlocked(true);
    try {
      const savedOwner = await loadOwnerSnapshot();
      if (savedOwner?.holdings?.length) {
        const nextBase: BaseCurrency =
          savedOwner.baseCurrency === 'USD' ? 'USD' : 'JPY';
        // Ensure values are recalculated with saved FX & baseCurrency
        const recalculated = recalculateBaseValues(
          savedOwner.holdings,
          savedOwner.fx,
          nextBase,
        );
        setHoldings(recalculated);
        setBaseCurrency(nextBase);
        setFx(savedOwner.fx);
        setQuoteUpdatedAt(savedOwner.quoteUpdatedAt);
      } else {
        await saveOwnerSnapshot(REAL_PORTFOLIO_SNAPSHOT);
        setHoldings(REAL_PORTFOLIO_HOLDINGS);
        setBaseCurrency('JPY');
        setFx(REAL_PORTFOLIO_FX);
        setQuoteUpdatedAt(REAL_PORTFOLIO_UPDATED_AT);
      }
    } catch {
      setHoldings(REAL_PORTFOLIO_HOLDINGS);
      setBaseCurrency('JPY');
      setFx(REAL_PORTFOLIO_FX);
      setQuoteUpdatedAt(REAL_PORTFOLIO_UPDATED_AT);
    }
    setStep('report');
  }, []);

  const handleLockOwner = useCallback(async () => {
    setError(null);
    setOwnerSessionUnlocked(false);
    setIsOwnerUnlocked(false);
    try {
      const guestSnapshot = await loadSnapshot();
      if (guestSnapshot?.holdings?.length) {
        const nextBase: BaseCurrency =
          guestSnapshot.baseCurrency === 'JPY' ? 'JPY' : 'USD';
        setHoldings(
          recalculateBaseValues(
            guestSnapshot.holdings,
            guestSnapshot.fx,
            nextBase,
          ),
        );
        setBaseCurrency(nextBase);
        setFx(guestSnapshot.fx);
        setQuoteUpdatedAt(guestSnapshot.quoteUpdatedAt);
      } else {
        setHoldings(INITIAL_SAMPLE_HOLDINGS);
        setBaseCurrency('USD');
        setFx(INITIAL_FX);
        setQuoteUpdatedAt(INITIAL_UPDATED_AT);
      }
    } catch {
      setHoldings(INITIAL_SAMPLE_HOLDINGS);
      setBaseCurrency('USD');
      setFx(INITIAL_FX);
      setQuoteUpdatedAt(INITIAL_UPDATED_AT);
    }
    setStep('report');
  }, []);

  const handleResetOwnerBaseline = useCallback(async () => {
    setError(null);
    setOwnerSessionUnlocked(true);
    setIsOwnerUnlocked(true);
    await saveOwnerSnapshot(REAL_PORTFOLIO_SNAPSHOT).catch(() => {});
    setHoldings(REAL_PORTFOLIO_HOLDINGS);
    setBaseCurrency('JPY');
    setFx(REAL_PORTFOLIO_FX);
    setQuoteUpdatedAt(REAL_PORTFOLIO_UPDATED_AT);
    setStep('report');
  }, []);

  useEffect(() => {
    let active = true;
    if (isOwnerSessionUnlocked()) {
      loadOwnerSnapshot()
        .then((snapshot) => {
          if (!active) return;
          if (snapshot?.holdings?.length) {
            const nextBase: BaseCurrency =
              snapshot.baseCurrency === 'USD' ? 'USD' : 'JPY';
            setHoldings(
              recalculateBaseValues(
                snapshot.holdings,
                snapshot.fx,
                nextBase,
              ),
            );
            setBaseCurrency(nextBase);
            setFx(snapshot.fx);
            setQuoteUpdatedAt(snapshot.quoteUpdatedAt);
          } else {
            void saveOwnerSnapshot(REAL_PORTFOLIO_SNAPSHOT);
            setHoldings(REAL_PORTFOLIO_HOLDINGS);
            setBaseCurrency('JPY');
            setFx(REAL_PORTFOLIO_FX);
            setQuoteUpdatedAt(REAL_PORTFOLIO_UPDATED_AT);
          }
          setStep('report');
        })
        .catch(() => {});
    } else {
      loadSnapshot()
        .then((snapshot) => {
          if (!active) return;
          if (snapshot?.holdings?.length) {
            const nextBase: BaseCurrency =
              snapshot.baseCurrency === 'JPY' ? 'JPY' : 'USD';
            setHasSavedPortfolio(true);
            setHoldings(
              recalculateBaseValues(
                snapshot.holdings,
                snapshot.fx,
                nextBase,
              ),
            );
            setBaseCurrency(nextBase);
            setFx(snapshot.fx);
            setQuoteUpdatedAt(snapshot.quoteUpdatedAt);
            setStep('report');
          }
        })
        .catch(() => {
          // Keep initial sample state if storage lookup fails
        });
    }
    return () => {
      active = false;
    };
  }, []);

  const handleCurrencyChange = useCallback(
    async (nextCurrency: BaseCurrency) => {
      setBaseCurrency(nextCurrency);
      const updated = recalculateBaseValues(holdings, fx, nextCurrency);
      setHoldings(updated);
      await persist(updated, nextCurrency, fx, quoteUpdatedAt);
    },
    [holdings, fx, quoteUpdatedAt, persist],
  );

  const handleManualImport = useCallback(
    async (text: string) => {
      setError(null);
      setStep('processing');
      setProcessing({
        parsing: 'active',
        matching: 'pending',
        quotes: 'pending',
        message: 'Reading pasted positions',
      });
      try {
        const parsed = parseHoldingsText(text, 'Manual import');
        setProcessing({
          parsing: 'done',
          matching: 'active',
          quotes: 'pending',
          message: 'Matching symbols, currencies, and portfolio layers',
        });
        await finishImport(parsed);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'The pasted positions could not be parsed.';
        setError(message);
        setProcessing({
          parsing: 'error',
          matching: 'pending',
          quotes: 'pending',
          message,
        });
      }
    },
    [finishImport],
  );

  const handleJsonImport = useCallback(async (file: File) => {
    const snapshot = JSON.parse(await file.text()) as PortfolioSnapshot;
    if (snapshot.version !== 1 || !Array.isArray(snapshot.holdings)) {
      throw new Error('This is not a valid Portfolio file.');
    }
    setHoldings(snapshot.holdings);
    setBaseCurrency(snapshot.baseCurrency);
    setFx(snapshot.fx);
    setQuoteUpdatedAt(snapshot.quoteUpdatedAt);
    await saveSnapshot(snapshot);
    setHasSavedPortfolio(true);
    setStep('report');
  }, []);

  const resumeSaved = useCallback(async () => {
    const snapshot = await loadSnapshot();
    if (!snapshot) return;
    setHoldings(snapshot.holdings);
    setBaseCurrency(snapshot.baseCurrency);
    setFx(snapshot.fx);
    setQuoteUpdatedAt(snapshot.quoteUpdatedAt);
    setStep('report');
  }, []);

  const updateHolding = useCallback((id: string, patch: Partial<Holding>) => {
    setHoldings((current) =>
      current.map((holding) =>
        holding.id === id ? { ...holding, ...patch } : holding,
      ),
    );
  }, []);

  const removeHolding = useCallback((id: string) => {
    setHoldings((current) => current.filter((holding) => holding.id !== id));
  }, []);

  const saveReportHoldings = useCallback(
    async (
      nextHoldings: Holding[],
      nextFx: Record<string, number> = fx,
      nextCurrency: BaseCurrency = baseCurrency,
    ) => {
      const recalculated = recalculateBaseValues(
        nextHoldings,
        nextFx,
        nextCurrency,
      );
      setHoldings(recalculated);
      setFx(nextFx);
      await persist(recalculated, nextCurrency, nextFx);
    },
    [baseCurrency, fx, persist],
  );

  const addManualHolding = useCallback(
    async (input: ManualHoldingInput) => {
      const ticker = input.ticker.trim().toUpperCase();
      const name = input.name.trim() || ticker;
      const currency = input.currency.trim().toUpperCase() || baseCurrency;
      const price =
        input.marketPrice != null && input.marketPrice > 0
          ? input.marketPrice
          : input.averagePrice;
      const nextFx: Record<string, number> = { JPY: 1, ...fx };
      if (nextFx[currency] == null) {
        nextFx[currency] =
          currency === baseCurrency ? (nextFx[baseCurrency] ?? 1) : 1;
      }
      const holding: Holding = {
        id: makeId(),
        ticker,
        name,
        broker: input.broker.trim() || 'Manual',
        account: input.account.trim(),
        market: marketFromTicker(ticker),
        currency,
        quantity: input.quantity,
        costPerUnit: input.averagePrice,
        importedMarketValue: null,
        marketPrice: price,
        marketValue: price * input.quantity,
        valueInBase: null,
        layer: normalizeLayer(input.layer, ticker, name, input.theme),
        theme: input.theme.trim() || 'Uncategorized',
        sourceType: 'manual',
        confidence: 1,
        needsReview: false,
        reviewReasons: [],
        targetWeight: null,
        investmentThesis: '',
      };
      await saveReportHoldings([...holdings, holding], nextFx);
    },
    [baseCurrency, fx, holdings, saveReportHoldings],
  );

  const updateReportHolding = useCallback(
    async (id: string, patch: Partial<Holding>) => {
      const nextHoldings = holdings.map((holding) => {
        if (holding.id !== id) return holding;
        const updated = { ...holding, ...patch };
        if (updated.marketPrice == null && updated.costPerUnit != null) {
          updated.marketPrice = updated.costPerUnit;
        }
        if (patch.quantity != null || patch.marketPrice != null) {
          const unitPrice = updated.marketPrice ?? updated.costPerUnit ?? 1;
          updated.marketValue = updated.quantity * unitPrice;
          updated.importedMarketValue = updated.marketValue;
        }
        updated.market =
          patch.ticker != null ? marketFromTicker(updated.ticker) : updated.market;
        updated.layer = normalizeLayer(
          updated.layer,
          updated.ticker,
          updated.name,
          updated.theme,
        );
        return updated;
      });
      await saveReportHoldings(nextHoldings);
    },
    [holdings, saveReportHoldings],
  );

  const handleRefreshQuotes = useCallback(async () => {
    if (!holdings.length) return;
    let quoteResponse: QuoteResponse;
    try {
      quoteResponse = await fetchQuotes(holdings);
    } catch {
      quoteResponse = await fetchBundledPrices().catch(() => ({
        quotes: [],
        fx,
        fetchedAt: new Date().toISOString(),
      }));
    }
    const nextFx = { JPY: 1, ...fx, ...quoteResponse.fx };
    const enriched = applyQuotes(holdings, quoteResponse, baseCurrency);
    setHoldings(enriched);
    setFx(nextFx);
    setQuoteUpdatedAt(quoteResponse.fetchedAt);
    await persist(enriched, baseCurrency, nextFx, quoteResponse.fetchedAt);
  }, [baseCurrency, fx, holdings, persist]);

  const removeReportHolding = useCallback(
    async (id: string) => {
      await saveReportHoldings(holdings.filter((holding) => holding.id !== id));
    },
    [holdings, saveReportHoldings],
  );

  const confirmReview = useCallback(async () => {
    const confirmed = holdings.map((holding) => ({
      ...holding,
      needsReview: false,
      reviewReasons: [],
      confidence: Math.max(holding.confidence, 0.9),
    }));
    setHoldings(confirmed);
    await persist(confirmed);
    setStep('report');
  }, [holdings, persist]);

  const resetToDashboard = useCallback(() => {
    setError(null);
    setStep('report');
  }, []);

  const clearAll = useCallback(async () => {
    await clearSnapshot();
    setHoldings([]);
    setFx({ JPY: 1 });
    setQuoteUpdatedAt(null);
    setHasSavedPortfolio(false);
    setStep('report');
  }, []);

  const handleRestoreSnapshot = useCallback(
    async (snapshot: ReviewSnapshot) => {
      setHoldings(snapshot.holdings);
      setBaseCurrency(snapshot.baseCurrency);
      await persist(
        snapshot.holdings,
        snapshot.baseCurrency,
      );
    },
    [persist],
  );

  const handleUpsertHoldings = useCallback(
    async (incoming: Holding[]) => {
      if (!incoming.length) throw new Error('未识别到有效持仓标的。');

      const { updatedHoldings, summary } = upsertHoldings(holdings, incoming);

      let quoteResponse: QuoteResponse;
      try {
        quoteResponse = await fetchQuotes(updatedHoldings);
      } catch {
        quoteResponse = await fetchBundledPrices().catch(() => ({
          quotes: [],
          fx: fx || { JPY: 1, USD: 150.4, HKD: 19.4, CNY: 21.1 },
          fetchedAt: new Date().toISOString(),
        }));
      }

      const nextFx = { JPY: 1, ...quoteResponse.fx };
      const enriched = applyQuotes(updatedHoldings, quoteResponse, baseCurrency);
      setHoldings(enriched);
      setFx(nextFx);
      setQuoteUpdatedAt(quoteResponse.fetchedAt);
      await persist(enriched, baseCurrency, nextFx, quoteResponse.fetchedAt);

      return summary;
    },
    [holdings, baseCurrency, fx, persist],
  );

  const handleManualSave = useCallback(async () => {
    await persist(holdings, baseCurrency, fx, quoteUpdatedAt);
  }, [holdings, baseCurrency, fx, quoteUpdatedAt, persist]);

  const appContent = useMemo(() => {
    if (step === 'processing') {
      return (
        <ProcessingScreen
          status={processing}
          error={error}
          onBack={resetToDashboard}
        />
      );
    }
    if (step === 'review') {
      return (
        <ReviewScreen
          holdings={holdings}
          onUpdate={updateHolding}
          onRemove={removeHolding}
          onConfirm={confirmReview}
          onBack={resetToDashboard}
        />
      );
    }
    return (
      <FinanceReportScreen
        holdings={holdings}
        baseCurrency={baseCurrency}
        fx={fx}
        quoteUpdatedAt={quoteUpdatedAt}
        hasSavedPortfolio={hasSavedPortfolio}
        isOwnerUnlocked={isOwnerUnlocked}
        onUnlockOwner={handleUnlockOwner}
        onLockOwner={handleLockOwner}
        onResetOwnerBaseline={handleResetOwnerBaseline}
        onClear={clearAll}
        onCurrencyChange={handleCurrencyChange}
        onAddHolding={addManualHolding}
        onUpdateHolding={updateReportHolding}
        onRemoveHolding={removeReportHolding}
        onReplaceHoldings={saveReportHoldings}
        onUpsertHoldings={handleUpsertHoldings}
        onRefreshQuotes={handleRefreshQuotes}
        onSave={handleManualSave}
        onFiles={handleFiles}
        onJsonImport={handleJsonImport}
        onManualImport={handleManualImport}
        onSample={handleSample}
        onResume={resumeSaved}
        onRestoreSnapshot={handleRestoreSnapshot}
      />
    );
  }, [
    baseCurrency,
    clearAll,
    confirmReview,
    error,
    fx,
    handleCurrencyChange,
    handleFiles,
    handleJsonImport,
    handleLockOwner,
    handleManualImport,
    handleManualSave,
    handleRefreshQuotes,
    handleResetOwnerBaseline,
    handleRestoreSnapshot,
    handleSample,
    handleUnlockOwner,
    handleUpsertHoldings,
    hasSavedPortfolio,
    holdings,
    isOwnerUnlocked,
    addManualHolding,
    processing,
    quoteUpdatedAt,
    removeHolding,
    removeReportHolding,
    resetToDashboard,
    resumeSaved,
    saveReportHoldings,
    step,
    updateReportHolding,
    updateHolding,
  ]);

  return (
    <div className="app-shell">
      {superinvestorId ? (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">正在加载投资大师档案...</div>}>
          <SuperinvestorDetailPage investorId={superinvestorId} />
        </Suspense>
      ) : (
        <>
          {error && step !== 'processing' ? (
            <div className="global-error" role="alert">
              <AlertCircle size={17} />
              {error}
            </div>
          ) : null}
          {appContent}
        </>
      )}
    </div>
  );
}

export default App;
