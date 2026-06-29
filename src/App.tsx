import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { clearSnapshot, loadSnapshot, saveSnapshot } from './lib/storage';
import { ProcessingScreen } from './components/ProcessingScreen';
import { FinanceReportScreen } from './components/FinanceReportScreen';
import { ReviewScreen } from './components/ReviewScreen';
import type {
  AppStep,
  BaseCurrency,
  Holding,
  Locale,
  ManualHoldingInput,
  PortfolioSnapshot,
  ProcessingStatus,
  QuoteResponse,
} from './types';

const INITIAL_STATUS: ProcessingStatus = {
  parsing: 'pending',
  matching: 'pending',
  quotes: 'pending',
  message: 'Ready to process your files',
};

const LOCALE_STORAGE_KEY = 'portfolio-locale-v2';

function App() {
  const [step, setStep] = useState<AppStep>('report');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<BaseCurrency>('JPY');
  const [locale, setLocale] = useState<Locale>(
    () => (localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null) ?? 'en',
  );
  const [fx, setFx] = useState<Record<string, number>>({ JPY: 1 });
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<string | null>(null);
  const [processing, setProcessing] =
    useState<ProcessingStatus>(INITIAL_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedPortfolio, setHasSavedPortfolio] = useState(false);

  useEffect(() => {
    let active = true;
    loadSnapshot()
      .then((snapshot) => {
        if (!active || !snapshot?.holdings.length) return;
        setHasSavedPortfolio(true);
        setHoldings(snapshot.holdings);
        setBaseCurrency(snapshot.baseCurrency);
        setFx(snapshot.fx);
        setQuoteUpdatedAt(snapshot.quoteUpdatedAt);
        setStep('report');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    sessionStorage.setItem('portfolio-current-step', step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang =
      locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja' : 'en';
  }, [locale]);

  const persist = useCallback(
    async (
      nextHoldings: Holding[],
      nextCurrency = baseCurrency,
      nextFx = fx,
      nextUpdatedAt = quoteUpdatedAt,
    ) => {
      const snapshot: PortfolioSnapshot = {
        version: 1,
        holdings: nextHoldings,
        baseCurrency: nextCurrency,
        fx: nextFx,
        quoteUpdatedAt: nextUpdatedAt,
        savedAt: new Date().toISOString(),
      };
      await saveSnapshot(snapshot);
      setHasSavedPortfolio(true);
    },
    [baseCurrency, fx, quoteUpdatedAt],
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
        message: 'Fetching market prices and exchange rates',
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
        message: 'Your portfolio is ready',
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
        message: 'Reading uploaded files',
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
          message: 'Matching symbols, currencies, and portfolio layers',
        });
        await finishImport([...csvGroups.flat(), ...imageGroups.flat()]);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'File processing failed.';
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
    setStep('processing');
    setProcessing({
      parsing: 'active',
      matching: 'pending',
      quotes: 'pending',
      message: 'Loading the sample portfolio',
    });
    try {
      const response = await fetch('/sample-positions.csv');
      if (!response.ok) throw new Error('The sample portfolio is unavailable.');
      const parsed = parseHoldingsCsv(await response.text(), 'Sample portfolio');
      setProcessing({
        parsing: 'done',
        matching: 'active',
        quotes: 'pending',
        message: 'Matching symbols, currencies, and portfolio layers',
      });
      await finishImport(parsed);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'The sample portfolio could not be loaded.';
      setError(message);
      setProcessing({
        parsing: 'error',
        matching: 'pending',
        quotes: 'pending',
        message,
      });
    }
  }, [finishImport]);

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
        const costChanged = Object.prototype.hasOwnProperty.call(
          patch,
          'costPerUnit',
        );
        const priceChanged = Object.prototype.hasOwnProperty.call(
          patch,
          'marketPrice',
        );
        if (
          costChanged &&
          !priceChanged &&
          holding.sourceType === 'manual' &&
          holding.marketPrice === holding.costPerUnit
        ) {
          updated.marketPrice = updated.costPerUnit;
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
        locale={locale}
        hasSavedPortfolio={hasSavedPortfolio}
        onLocaleChange={setLocale}
        onClear={clearAll}
        onAddHolding={addManualHolding}
        onUpdateHolding={updateReportHolding}
        onRemoveHolding={removeReportHolding}
        onFiles={handleFiles}
        onJsonImport={handleJsonImport}
        onManualImport={handleManualImport}
        onSample={handleSample}
        onResume={resumeSaved}
      />
    );
  }, [
    baseCurrency,
    clearAll,
    confirmReview,
    error,
    fx,
    handleFiles,
    handleJsonImport,
    handleManualImport,
    handleSample,
    hasSavedPortfolio,
    holdings,
    addManualHolding,
    locale,
    processing,
    quoteUpdatedAt,
    removeHolding,
    removeReportHolding,
    resetToDashboard,
    resumeSaved,
    step,
    updateReportHolding,
    updateHolding,
  ]);

  return (
    <div className="app-shell">
      {error && step !== 'processing' ? (
        <div className="global-error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      ) : null}
      {appContent}
    </div>
  );
}

export default App;
