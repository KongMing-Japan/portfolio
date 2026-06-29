# Portfolio methodology

This product combines positions from multiple brokers into one consistent portfolio view. It is designed to make structure, concentration, and exposure easier to understand. It does not provide investment advice or trading instructions.

## The four-layer model

Every position belongs to one of four functional layers:

- **Core** — long-term holdings that anchor the portfolio and express its main investment convictions.
- **Satellite** — thematic or growth positions that complement the core and may carry higher volatility.
- **Defensive** — lower-volatility or stabilizing assets intended to balance portfolio risk.
- **Cash** — liquid reserves available for future allocation and near-term needs.

Cash balances are always classified as Cash. Imported classifications take priority when they are explicit; otherwise the product applies simple asset rules and asks the user to review uncertain results.

## How portfolio values are calculated

Each position is valued as quantity multiplied by its latest available price. Values are converted into one base currency using the latest available exchange rates. Changing the display currency does not change portfolio weights.

Positions with the same ticker are aggregated for portfolio analysis while their broker and account details remain available underneath.

## How to read the dashboard

Start with the total value and four-layer allocation. Then review:

1. **Top holdings** to see which securities drive the portfolio.
2. **Exposure** by currency, theme, and broker.
3. **Largest holding** and **Top 5** weight for intuitive concentration checks.
4. **Concentration score**, calculated as the sum of squared position weights.

A lower concentration score generally indicates a more distributed portfolio, while a higher score means more value is concentrated in fewer securities. This is a structural observation, not a recommendation to buy or sell.

## Data quality

Market prices and exchange rates may be delayed, missing, or unavailable. When live data cannot be retrieved, the dashboard clearly falls back to an imported value or manually entered price. Always check the market-data timestamp before relying on a displayed value.

Screenshots are processed temporarily for position extraction. Portfolio data is stored locally in the browser unless the user explicitly exports it.
