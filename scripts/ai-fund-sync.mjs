#!/usr/bin/env node
// scripts/ai-fund-sync.mjs
// Lightweight CLI tool to check & sync OTC mutual fund NAVs to Cloudflare D1
import process from 'node:process';

const SYNC_ENDPOINT = process.env.PORTFOLIO_SYNC_URL || 'https://portfolio-kfb.pages.dev/api/agent/sync';
const OWNER_PIN = process.env.OWNER_PIN || '8888';

async function fetchStatus() {
  const res = await fetch(SYNC_ENDPOINT, {
    headers: { 'X-Owner-Pin': OWNER_PIN },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch status: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function postSync(payload) {
  const res = await fetch(SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Owner-Pin': OWNER_PIN,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sync failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  console.log(`🤖 Portfolio AI Sync Tool [Endpoint: ${SYNC_ENDPOINT}]`);

  const status = await fetchStatus();
  console.log(`\n📊 组合概览: ${status.portfolioName} (基准币种: ${status.baseCurrency})`);
  console.log(`📅 上次行情更新: ${status.quoteUpdatedAt || '未记录'}`);
  if (status.totalPortfolioValueJpy) {
    console.log(`💰 总资产估值: ¥${status.totalPortfolioValueJpy.toLocaleString()} JPY`);
  }
  if (status.layerSummary) {
    console.log(`🛡️ 资产层级结构:`);
    console.log(`   • 防守仓: ¥${status.layerSummary.Defensive.valueJpy.toLocaleString()} (${(status.layerSummary.Defensive.weight * 100).toFixed(1)}%)`);
    console.log(`   • 核心仓: ¥${status.layerSummary.Core.valueJpy.toLocaleString()} (${(status.layerSummary.Core.weight * 100).toFixed(1)}%)`);
    console.log(`   • 卫星仓: ¥${status.layerSummary.Satellite.valueJpy.toLocaleString()} (${(status.layerSummary.Satellite.weight * 100).toFixed(1)}%)`);
    console.log(`   • 现金储备: ¥${status.layerSummary.Cash.valueJpy.toLocaleString()} (${(status.layerSummary.Cash.weight * 100).toFixed(1)}%)`);
  }
  console.log(`📋 总标的数: ${status.totalHoldingsCount} 项`);

  if (status.recentSnapshots && status.recentSnapshots.length > 0) {
    console.log(`\n📜 最近月度资产归档 (${status.recentSnapshots.length} 次记录):`);
    for (const snap of status.recentSnapshots.slice(0, 3)) {
      console.log(`   [${snap.createdAt.slice(0, 10)}] ${snap.summaryNotes || snap.actionType}`);
    }
  }

  if (status.needsPriceUpdate && status.needsPriceUpdate.length > 0) {
    console.log(`\n🔍 需要更新净值的场外基金/特殊标的 (${status.needsPriceUpdate.length} 项):`);
    for (const item of status.needsPriceUpdate) {
      console.log(`  • [${item.ticker}] ${item.name} (${item.broker})`);
      console.log(`    当前单价: ${item.currentPrice ?? '无'} ${item.currency}`);
      console.log(`    搜索提示: "${item.searchHint}"`);
      if (item.note) console.log(`    说明: ${item.note}`);
    }
  }

  // Parse snapshot argument: --snapshot [notes]
  const snapIndex = args.indexOf('--snapshot');
  if (snapIndex !== -1) {
    const notes = args[snapIndex + 1] || '月度实盘资产快照归档';
    console.log(`\n📸 正在封存月度资产快照: "${notes}"...`);
    const result = await postSync({
      recordSnapshot: true,
      actionType: 'monthly_snapshot',
      notes,
    });
    console.log(`✅ 月度快照归档成功!`, result);
    return;
  }

  // Parse manual set arguments: --set TICKER=PRICE ...
  const setIndex = args.indexOf('--set');
  if (setIndex !== -1) {
    const pairs = args.slice(setIndex + 1).filter((arg) => arg.includes('='));
    const quotes = pairs.map((p) => {
      const [ticker, val] = p.split('=');
      return { ticker: ticker.trim(), price: parseFloat(val) };
    });

    if (quotes.length > 0) {
      console.log(`\n🚀 正在推送 ${quotes.length} 项净值更新到 Cloudflare D1...`);
      const result = await postSync({
        quotes,
        notes: `CLI update: ${quotes.map((q) => `${q.ticker}=${q.price}`).join(', ')}`,
      });
      console.log(`✅ 同步成功!`, result);
    }
  } else {
    console.log(`\n💡 提示: 您可以直接使用 Antigravity 对话框自动检索并更新，或运行:`);
    console.log(`   node scripts/ai-fund-sync.mjs --set CN_QDII_VN=1.5360 EMAXIS_SP500=4.5093`);
  }
}

main().catch((err) => {
  console.error('❌ 出错:', err.message);
  process.exit(1);
});
