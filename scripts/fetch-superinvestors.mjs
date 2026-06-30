import fs from 'node:fs/promises';

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ||
  'Portfolio Dashboard hello@kongmingjapan.com';

const INVESTORS = [
  {
    id: 'warren-buffett',
    name: 'Warren Buffett',
    firm: 'Berkshire Hathaway',
    cik: '0001067983',
    portrait: '/investors/warren-buffett.jpg',
    accent: '#2f5ea8',
  },
  {
    id: 'bill-ackman',
    name: 'Bill Ackman',
    firm: 'Pershing Square Capital Management',
    cik: '0001336528',
    portrait: '/investors/bill-ackman.jpg',
    accent: '#6d4fc2',
  },
  {
    id: 'david-tepper',
    name: 'David Tepper',
    firm: 'Appaloosa LP',
    cik: '0001656456',
    portrait: '/investors/david-tepper.jpg',
    accent: '#b46a28',
  },
  {
    id: 'cathie-wood',
    name: 'Cathie Wood',
    firm: 'ARK Investment Management',
    cik: '0001697748',
    portrait: '/investors/cathie-wood.jpg',
    accent: '#287a65',
  },
];

const CUSIP_TO_TICKER = {
  '007903107': 'AMD',
  '01609W102': 'BABA',
  '02005N100': 'ALLY',
  '02079K107': 'GOOG',
  '02079K305': 'GOOGL',
  '023135106': 'AMZN',
  '02376R102': 'AAL',
  '025816109': 'AXP',
  '037833100': 'AAPL',
  '060505104': 'BAC',
  '11271J107': 'BN',
  '14040H105': 'COF',
  '169656105': 'CMG',
  '166764100': 'CVX',
  '171232101': 'CB',
  '172573107': 'CRCL',
  '191216100': 'KO',
  '19260Q107': 'COIN',
  '21036P108': 'STZ',
  '247361702': 'DAL',
  '23918K108': 'DVA',
  '25754A201': 'DPZ',
  '26142V105': 'DKNG',
  '30303M102': 'META',
  '43300A203': 'HLT',
  '458140100': 'INTC',
  '500754106': 'KHC',
  '500767306': 'KWEB',
  '501044101': 'KR',
  '526057104': 'LEN',
  '530909100': 'LLYVA',
  '530909308': 'LLYVK',
  '546347105': 'LPX',
  '594918104': 'MSFT',
  '595112103': 'MU',
  '615369105': 'MCO',
  '650111107': 'NYT',
  '654106103': 'NKE',
  '67066G104': 'NVDA',
  '670346105': 'NUE',
  '674599105': 'OXY',
  '69608A108': 'PLTR',
  '73278L105': 'POOL',
  '76131D103': 'QSR',
  '770700102': 'HOOD',
  '771049103': 'RBLX',
  '77543R102': 'ROKU',
  '82509L107': 'SHOP',
  '82968B103': 'SIRI',
  '829933100': 'SIRI',
  '874039100': 'TSM',
  '88160R101': 'TSLA',
  '90138F102': 'TWLO',
  '90353T100': 'UBER',
  '90364P105': 'PATH',
  '92343E102': 'VRSN',
  '92826C839': 'V',
  '92840M102': 'VST',
  H17182108: 'CRSP',
  H1467J104: 'CB',
  '11135F101': 'AVGO',
};

const headers = {
  'User-Agent': SEC_USER_AGENT,
  Accept: 'application/json, application/xml, text/xml;q=0.9, */*;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchSec(url, type) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`SEC request failed (${response.status}): ${url}`);
  }
  await delay(140);
  return type === 'json' ? response.json() : response.text();
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .trim();
}

function tagValue(block, tag) {
  const match = block.match(
    new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i'),
  );
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '')) : '';
}

function parseInformationTable(xml) {
  const rows = [];
  const blocks = xml.match(
    /<(?:[\w-]+:)?infoTable[^>]*>[\s\S]*?<\/(?:[\w-]+:)?infoTable>/gi,
  );
  for (const block of blocks || []) {
    const cusip = tagValue(block, 'cusip').toUpperCase();
    const value = Number(tagValue(block, 'value').replaceAll(',', ''));
    const shares = Number(tagValue(block, 'sshPrnamt').replaceAll(',', ''));
    if (!cusip || !Number.isFinite(value)) continue;
    rows.push({
      cusip,
      issuer: tagValue(block, 'nameOfIssuer'),
      classTitle: tagValue(block, 'titleOfClass'),
      value,
      shares: Number.isFinite(shares) ? shares : 0,
    });
  }
  return rows;
}

function aggregateRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const existing = grouped.get(row.cusip);
    if (existing) {
      existing.value += row.value;
      existing.shares += row.shares;
    } else {
      grouped.set(row.cusip, { ...row });
    }
  }
  const totalValue = [...grouped.values()].reduce(
    (sum, holding) => sum + holding.value,
    0,
  );
  return [...grouped.values()]
    .map((holding) => ({
      ...holding,
      ticker: CUSIP_TO_TICKER[holding.cusip] || holding.cusip,
      weight: totalValue > 0 ? holding.value / totalValue : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

async function fetchFiling(cik, filing) {
  const cikNumber = String(Number(cik));
  const accession = filing.accession.replaceAll('-', '');
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accession}`;
  const index = await fetchSec(`${baseUrl}/index.json`, 'json');
  const xmlCandidates = (index.directory?.item || [])
    .filter((item) => item.name.toLowerCase().endsWith('.xml'))
    .filter((item) => !item.name.toLowerCase().includes('primary'))
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
  const informationTable = xmlCandidates[0];
  if (!informationTable) {
    throw new Error(`No 13F information table found for ${filing.accession}`);
  }
  const xml = await fetchSec(`${baseUrl}/${informationTable.name}`, 'text');
  const holdings = aggregateRows(parseInformationTable(xml));
  return {
    reportDate: filing.reportDate,
    filedAt: filing.filingDate,
    accession: filing.accession,
    filingUrl: `${baseUrl}/${filing.accession}-index.html`,
    holdings,
    totalValue: holdings.reduce((sum, holding) => sum + holding.value, 0),
  };
}

function filingRows(submissions) {
  const recent = submissions.filings?.recent || {};
  return (recent.form || [])
    .map((form, index) => ({
      form,
      filingDate: recent.filingDate[index],
      reportDate: recent.reportDate[index],
      accession: recent.accessionNumber[index],
    }))
    .filter((filing) => filing.form === '13F-HR')
    .filter((filing) => filing.reportDate && filing.accession)
    .slice(0, 2);
}

function addQuarterlyChanges(current, previous) {
  const previousMap = new Map(
    previous.holdings.map((holding) => [holding.cusip, holding]),
  );
  const currentCusips = new Set(current.holdings.map((holding) => holding.cusip));
  const holdings = current.holdings.map((holding) => {
    const before = previousMap.get(holding.cusip);
    const sharesChange = before ? holding.shares - before.shares : holding.shares;
    const weightChange = holding.weight - (before?.weight || 0);
    const status = !before
      ? 'new'
      : Math.abs(sharesChange) < 0.5
        ? 'unchanged'
        : sharesChange > 0
          ? 'increased'
          : 'decreased';
    return { ...holding, status, sharesChange, weightChange };
  });
  const exits = previous.holdings
    .filter((holding) => !currentCusips.has(holding.cusip))
    .map((holding) => ({
      ...holding,
      value: 0,
      weight: 0,
      status: 'exited',
      sharesChange: -holding.shares,
      weightChange: -holding.weight,
    }));
  const topMoves = [...holdings, ...exits]
    .filter((holding) => holding.status !== 'unchanged')
    .sort((a, b) => Math.abs(b.weightChange) - Math.abs(a.weightChange))
    .slice(0, 4)
    .map(({ ticker, issuer, status, weightChange }) => ({
      ticker,
      issuer,
      status,
      weightChange,
    }));
  return {
    holdings,
    topMoves,
    positionCount: holdings.length,
    totalValueChange:
      previous.totalValue > 0
        ? current.totalValue / previous.totalValue - 1
        : null,
  };
}

async function fetchInvestor(investor) {
  const submissions = await fetchSec(
    `https://data.sec.gov/submissions/CIK${investor.cik}.json`,
    'json',
  );
  const filings = filingRows(submissions);
  if (filings.length < 2) {
    throw new Error(`Two recent 13F filings were not found for ${investor.name}`);
  }
  const fetched = [];
  for (const filing of filings) fetched.push(await fetchFiling(investor.cik, filing));
  const latest = fetched[0];
  const prior = fetched[1];
  const changes = addQuarterlyChanges(latest, prior);
  return {
    ...investor,
    secEntityUrl: `https://www.sec.gov/edgar/browse/?CIK=${investor.cik}`,
    reportDate: latest.reportDate,
    filedAt: latest.filedAt,
    previousReportDate: prior.reportDate,
    filingUrl: latest.filingUrl,
    totalValue: latest.totalValue,
    ...changes,
  };
}

async function main() {
  const investors = [];
  for (const investor of INVESTORS) investors.push(await fetchInvestor(investor));
  const sourceUpdatedAt = investors
    .map((investor) => investor.filedAt)
    .sort()
    .at(-1);
  const output = {
    version: 1,
    source: 'SEC EDGAR Form 13F filings',
    sourceUpdatedAt,
    caveat:
      '13F filings are delayed and cover reportable long U.S. securities only. They do not show cash, shorts, or a complete portfolio.',
    investors,
  };
  const outputUrl = new URL('../public/data/superinvestors.json', import.meta.url);
  await fs.mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
  await fs.writeFile(outputUrl, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${investors.length} investors to public/data/superinvestors.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
