# MoneyOS Portfolio

一个极简、独立的多券商、多币种个人投资组合与再平衡系统。

主流程只有四步：

1. 上传 CSV、券商持仓截图，或直接手写 / 粘贴持仓
2. 仅确认低置信度、缺字段或行情缺失的记录
3. 自动统一证券、账户、币种和价格
4. 生成核心仓、卫星仓、防御仓、现金四层组合报告

## 本地运行

```bash
npm install
npm run dev
```

使用 Cloudflare Pages Functions 运行完整前后端：

```bash
npm run dev:cf
```

生产构建与测试：

```bash
npm run build
npm test
```

## 截图识别

截图识别由 Groq 的视觉模型在 Cloudflare Pages Function
`/api/extract-positions` 中完成。生产密钥通过 Cloudflare Secret 设置：

```bash
npx wrangler pages secret put GROQ_API_KEY --project-name=portfolio
```

模型名称已经保存在 `wrangler.jsonc`：

```text
qwen/qwen3.8-27b
```

未配置 Groq 密钥时，CSV、JSON 导入、行情和报告功能仍可使用。API
密钥只存在于 Cloudflare 服务端 Secret，不会进入 GitHub 或浏览器包。

## Cloudflare Pages

- Project：`portfolio`
- Production URL：<https://portfolio-kfb.pages.dev>
- Custom domain：<https://portfolio.kongmingjapan.com>
- Build command：`npm run build`
- Output directory：`dist`
- Functions：`functions/api/*`

手动部署：

```bash
npm run deploy:cf
```

GitHub 自动部署通过 Cloudflare Pages 原生 Git 集成完成，push 到
`main` 后由 Cloudflare 构建并发布。`GROQ_API_KEY` 不放 GitHub，继续放
Cloudflare Pages Secret。

## 数据与隐私

- 公开模式只使用示例或用户在当前浏览器导入的数据；私享云端组合必须通过服务端会话读取。
- 生产认证需要四个 Cloudflare Pages Secret：`SESSION_SECRET`、`OWNER_USERNAME`、`OWNER_PASSWORD_HASH`（强密码的 SHA-256 十六进制摘要）和仅限 `/api/agent/sync` 的 `PORTFOLIO_SYNC_TOKEN`。只有 `OWNER_USERNAME` 指定的 D1 用户可登录。
- 私有持仓快照通过未跟踪的 `PORTFOLIO_SEED_FILE` 输入生成临时 `migrations/seed_data.sql`；真实 CSV、JSON、生成种子和前端 TypeScript 数据文件均被忽略，禁止提交。
- 图片只发送给当次识别请求；可导出 Portfolio JSON，在其他设备重新导入。
- 行情接口通过 `/api/quotes` 获取证券价格与汇率；行情失败时保留导入值或成本估值并要求确认。

## 主要目录

- `src/`：React + TypeScript 前端
- `functions/`：Cloudflare Pages Functions
- `public/sample-positions.csv`：Berkshire Hathaway 13F 风格演示数据
- `docs/`：原有投资组合方法论
- `scripts/fetch-prices.js`：静态行情文件更新脚本
