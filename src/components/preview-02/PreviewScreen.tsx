import React, { useState } from "react"
import {
  TrendingUp,
  LayoutGrid,
  Coins,
  Settings,
  ArrowLeft,
  ExternalLink,
  Code2,
  SlidersHorizontal,
} from "lucide-react"
import Preview02Example from "./index"
import {
  StockPerformance,
  IndexInvesting,
  DividendIncome,
  ContributionHistory,
  SavingsProgress,
  SavingsTargets,
  RecentTransactions,
  CardOverview,
  ClaimableBalance,
  Payments,
  TransferFunds,
  PayoutThreshold,
  UpcomingPayments,
  AccountAccess,
  NotificationSettings,
  Preferences,
  Faq,
} from "./cards"

interface PreviewScreenProps {
  onBack?: () => void
}

type TabType = "all" | "finance" | "settings"

export function PreviewScreen({ onBack }: PreviewScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>("finance")

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b bg-card/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground transition-colors flex items-center gap-1.5 text-xs font-medium"
                title="返回我的投资组合"
              >
                <ArrowLeft className="size-4" />
                <span>返回组合</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  Shadcn UI 设计系统展板
                </h1>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Preset: b1Ymqvgiu
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Base UI · Nova · Blue
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                完整复刻自 shadcn 官方 preview-02 预设，包含股票走势、定投分析、股息收益、交易流水等 35 个卡片组件。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://ui.shadcn.com/create?item=preview&preset=b1Ymqvgiu"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-muted text-muted-foreground transition-colors"
            >
              <span>查看官方源站</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        {/* View switcher tabs */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-2 border-t pt-3">
          <button
            onClick={() => setActiveTab("finance")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "finance"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <TrendingUp className="size-3.5" />
            <span>股票与持仓组件 (精选)</span>
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span>全景画布 (35 个卡片 1:1 展板)</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>账户与交互控件</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "all" && (
        <div className="w-full">
          <div className="bg-muted/40 p-3 border-b text-center text-xs text-muted-foreground">
            💡 全景画布模式：横向滚动可查看 7 列共 35 个卡片排布，与 shadcn 官方 preview 视觉 100% 一致。
          </div>
          <Preview02Example />
        </div>
      )}

      {activeTab === "finance" && (
        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Code2 className="size-4" />
                组件直接引入指南 (Direct Import)
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              所有卡片已经完成依赖桥接并完全适配 Vite 与 Tailwind v4，可在任何页面直接引入：
            </p>
            <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto text-foreground">
              <code>{`import { StockPerformance, DividendIncome, RecentTransactions } from "@/components/preview-02/cards";`}</code>
            </pre>
          </div>

          <div>
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <Coins className="size-4 text-primary" />
              股票、持仓与资产配置核心组件展示
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {/* Column 1 */}
              <div className="flex flex-col gap-6">
                <StockPerformance />
                <IndexInvesting />
                <ClaimableBalance />
              </div>

              {/* Column 2 */}
              <div className="flex flex-col gap-6">
                <DividendIncome />
                <ContributionHistory />
                <SavingsProgress />
              </div>

              {/* Column 3 */}
              <div className="flex flex-col gap-6">
                <SavingsTargets />
                <RecentTransactions />
                <CardOverview />
                <Payments />
              </div>
            </div>
          </div>
        </main>
      )}

      {activeTab === "settings" && (
        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div>
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <Settings className="size-4 text-primary" />
              账户安全、通知与表单交互卡片
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              <div className="flex flex-col gap-6">
                <TransferFunds />
                <PayoutThreshold />
              </div>
              <div className="flex flex-col gap-6">
                <AccountAccess />
                <NotificationSettings />
              </div>
              <div className="flex flex-col gap-6">
                <Preferences />
                <UpcomingPayments />
                <Faq />
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
export default PreviewScreen
