INSERT INTO users (id, username, password_hash)
VALUES ('usr_owner_main', 'owner', '92925488b28ab12584ac8fcaa8a27a0f497b2c62940c8f4fbc8ef19ebc87c43e')
ON CONFLICT (username) DO UPDATE SET password_hash = '92925488b28ab12584ac8fcaa8a27a0f497b2c62940c8f4fbc8ef19ebc87c43e';

INSERT INTO portfolios (id, user_id, name, base_currency, fx_json, quote_updated_at)
VALUES ('port_default_jpy', 'usr_owner_main', '我的组合', 'JPY', '{"JPY":1,"USD":157.976447,"HKD":20.1312046,"CNY":23.6102025,"EUR":171.5,"GBP":203.2}', '2026-10-15T16:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  base_currency = 'JPY',
  fx_json = '{"JPY":1,"USD":157.976447,"HKD":20.1312046,"CNY":23.6102025,"EUR":171.5,"GBP":203.2}',
  quote_updated_at = '2026-10-15T16:00:00.000Z',
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM holdings WHERE portfolio_id = 'port_default_jpy';

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-1482-1',
  'port_default_jpy',
  '1482.T',
  '美债 7-10年 (对冲)',
  '乐天证券',
  '日元证券账户 · 批次1',
  'Japan',
  'JPY',
  100,
  1479,
  1479,
  147900,
  'Defensive',
  'Bonds & Index (美债对冲)',
  'manual',
  1,
  '防守仓：日元对冲7-10年期美国国债ETF，提供低波动底仓缓冲。',
  0
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-1482-2',
  'port_default_jpy',
  '1482.T',
  '美债 7-10年 (对冲)',
  '乐天证券',
  '日元证券账户 · 批次2',
  'Japan',
  'JPY',
  3200,
  1479,
  1479,
  4732800,
  'Defensive',
  'Bonds & Index (美债对冲)',
  'manual',
  1,
  '防守仓：日元对冲7-10年期美国国债ETF主力仓位。',
  1
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-1571',
  'port_default_jpy',
  '1571.T',
  '日经反向',
  '乐天证券',
  '日元证券账户',
  'Japan',
  'JPY',
  8000,
  297,
  297,
  2376000,
  'Satellite',
  'Tactical Hedge (日股空头对冲)',
  'manual',
  1,
  '战术对冲仓：用于对冲日本本土个股多头的系统性Beta风险。',
  2
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-2563-1',
  'port_default_jpy',
  '2563.T',
  'S&P 500 (对冲)',
  '乐天证券',
  '日元证券账户 · 批次1',
  'Japan',
  'JPY',
  3000,
  405.4,
  405.4,
  1216200,
  'Defensive',
  'Bonds & Index (标普500定投)',
  'manual',
  1,
  '防守仓定投：平滑组合波动、获取美国企业效率长期红利（日元对冲型）。',
  3
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-2563-2',
  'port_default_jpy',
  '2563.T',
  'S&P 500 (对冲)',
  '乐天证券',
  '日元证券账户 · 批次2',
  'Japan',
  'JPY',
  12500,
  405.4,
  405.4,
  5067500,
  'Defensive',
  'Bonds & Index (标普500定投)',
  'manual',
  1,
  '防守仓定投：标普500 ETF主力持仓。',
  4
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-2845-1',
  'port_default_jpy',
  '2845.T',
  '纳斯达克 100 (对冲)',
  '乐天证券',
  '日元证券账户 · 批次1',
  'Japan',
  'JPY',
  922,
  3560,
  3560,
  3282320,
  'Core',
  'AI Ecosystem (美股科技平台篮子)',
  'manual',
  1,
  '核心仓（美股科技主线）：通过日元挂牌直投纳斯达克100核心科技龙头。',
  5
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-2845-2',
  'port_default_jpy',
  '2845.T',
  '纳斯达克 100 (对冲)',
  '乐天证券',
  '日元证券账户 · 批次2',
  'Japan',
  'JPY',
  2500,
  3560,
  3560,
  8900000,
  'Core',
  'AI Ecosystem (美股科技平台篮子)',
  'manual',
  1,
  '核心仓主力：纳斯达克100 ETF重仓头寸。',
  6
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-7581',
  'port_default_jpy',
  '7581.T',
  '萨莉亚',
  '乐天证券',
  '日元证券账户',
  'Japan',
  'JPY',
  700,
  6960,
  6960,
  4872000,
  'Satellite',
  'Consumer & Retail (连锁餐饮高ROE龙头)',
  'manual',
  1,
  '卫星仓（优质消费龙头）：高供应链壁垒与抗通胀韧性标的。',
  7
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-rakuten-9616',
  'port_default_jpy',
  '9616.T',
  '共立维护',
  '乐天证券',
  '日元证券账户',
  'Japan',
  'JPY',
  1400,
  3312,
  3312,
  4636800,
  'Satellite',
  'Japan Hospitality (日本酒店与旅游复苏)',
  'manual',
  1,
  '卫星仓（日本旅游与住宿）：Dormy Inn及度假酒店龙头。',
  8
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-moomoo-2845',
  'port_default_jpy',
  '2845.T',
  '纳斯达克 100 (对冲)',
  'moomoo证券',
  '日元证券账户',
  'Japan',
  'JPY',
  2000,
  3557,
  3557,
  7114000,
  'Core',
  'AI Ecosystem (美股科技平台篮子)',
  'manual',
  1,
  '核心仓（美股主线）：与乐天证券2845合并，为组合第一大重仓。',
  9
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-moomoo-3905',
  'port_default_jpy',
  '3905.T',
  'DataSection',
  'moomoo证券',
  '日元证券账户',
  'Japan',
  'JPY',
  2000,
  1320,
  1320,
  2640000,
  'Core',
  'AI Ecosystem (AI算力与数据中心)',
  'manual',
  1,
  '核心/高弹性AI算力节点：日本AI数据中心与算力基础设施布局。',
  10
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-moomoo-9023',
  'port_default_jpy',
  '9023.T',
  '东京地铁',
  'moomoo证券',
  '日元证券账户',
  'Japan',
  'JPY',
  5300,
  1453,
  1453,
  7700900,
  'Defensive',
  'Urban Transport (东京核心特许公共基础设施)',
  'manual',
  1,
  '防守仓（城市核心资产）：东京核心轨道网络特许经营垄断资产。',
  11
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-moomoo-emaxis-sp500',
  'port_default_jpy',
  'EMAXIS_SP500',
  'S&P 500',
  'moomoo证券',
  '日元基金账户',
  'Japan',
  'JPY',
  1,
  3320941.19,
  3320941.19,
  3320941.19,
  'Defensive',
  'Bonds & Index (标普500定投)',
  'manual',
  1,
  '防守仓定投：无汇率对冲型标普500场外公募基金。',
  12
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-moomoo-cash-jpy',
  'port_default_jpy',
  'Cash_JPY_Moomoo',
  'moomoo证券可用现金',
  'moomoo证券',
  '日元证券账户现金',
  'Cash',
  'JPY',
  912626,
  1,
  1,
  912626,
  'Cash',
  'Brokerage Cash (券商交易子弹)',
  'manual',
  1,
  '券商内可直接下单的日元流动资金子弹。',
  13
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-crcl',
  'port_default_jpy',
  'CRCL',
  'Circle',
  'Tiger证券',
  '美元账户',
  'US',
  'USD',
  400,
  75.49,
  75.49,
  30196,
  'Satellite',
  'Web3 / Stablecoin (链上金融基础设施)',
  'manual',
  1,
  '卫星仓（Web3/稳定币）：USDC发行方与跨境链上结算合规基础设施核心标的。',
  14
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-nvda',
  'port_default_jpy',
  'NVDA',
  '英伟达',
  'Tiger证券',
  '美元账户',
  'US',
  'USD',
  100,
  216.69,
  216.69,
  21669,
  'Core',
  'AI Ecosystem (AI算力与芯片生态)',
  'manual',
  1,
  '核心仓（美股AI主线）：CUDA生态、软件栈与加速计算系统化优势龙头。',
  15
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-smr',
  'port_default_jpy',
  'SMR',
  'NuScale Power',
  'Tiger证券',
  '美元账户',
  'US',
  'USD',
  2000,
  5.56,
  5.56,
  11120,
  'Core',
  'Energy Support (AI核能供电侧)',
  'manual',
  1,
  '核心供电侧配套：AI用电硬约束下的小型模块化核电（SMR）布局。',
  16
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-cash-usd',
  'port_default_jpy',
  'Cash_USD_Tiger',
  'Tiger美元现金',
  'Tiger证券',
  '美元现金',
  'Cash',
  'USD',
  13938.18,
  1,
  1,
  13938.18,
  'Cash',
  'Brokerage Cash (券商交易子弹)',
  'manual',
  1,
  'Tiger券商内美元现金储备，可直接加仓美股核心标的。',
  17
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-00700',
  'port_default_jpy',
  '00700.HK',
  '腾讯',
  'Tiger证券',
  '港币账户',
  'Hong Kong',
  'HKD',
  800,
  417.8,
  417.8,
  334240,
  'Core',
  'Digital Platform (互联网与社交金融平台)',
  'manual',
  1,
  '核心仓（中国互联网龙头）：全域社交黏性、高自由现金流与稳健分红回购标的。',
  18
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-01810',
  'port_default_jpy',
  '01810.HK',
  '小米',
  'Tiger证券',
  '港币账户',
  'Hong Kong',
  'HKD',
  19600,
  27.08,
  27.08,
  530768,
  'Core',
  'EV & Smart IoT (人车家全生态与智能硬件)',
  'manual',
  1,
  '核心仓（人车家全生态龙头）：智能手机高端化稳固，智能纯电车爆发式放量增长。',
  19
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-tiger-cash-hkd',
  'port_default_jpy',
  'Cash_HKD_Tiger',
  'Tiger港币现金',
  'Tiger证券',
  '港币现金',
  'Cash',
  'HKD',
  193491.7,
  1,
  1,
  193491.7,
  'Cash',
  'Brokerage Cash (券商交易子弹)',
  'manual',
  1,
  'Tiger券商内港币现金储备，可直接用于港股主线回调加仓。',
  20
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-rakuten',
  'port_default_jpy',
  'Cash_JPY_RakutenBank',
  '乐天银行',
  '乐天银行',
  '日元银证联动活期',
  'Cash',
  'JPY',
  9664482,
  1,
  1,
  9664482,
  'Cash',
  'Linked Bank Reserve (银证联动储备)',
  'manual',
  1,
  '与乐天证券MoneyBridge银证联动的高流动性资金池，随时可作为补仓弹药（计入投资现金）。',
  21
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-smbc',
  'port_default_jpy',
  'Cash_JPY_SMBC',
  '三井住友银行',
  '三井住友银行',
  '日元活期储蓄',
  'Cash',
  'JPY',
  2009016,
  1,
  1,
  2009016,
  'Cash',
  'Living & Emergency (日常与应急储备)',
  'manual',
  1,
  '日常生活消费与应急安全垫存款（独立备忘）。',
  22
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-sony',
  'port_default_jpy',
  'Cash_JPY_SonyBank',
  'Sony银行',
  'Sony银行',
  '日元结算活期',
  'Cash',
  'JPY',
  1416603,
  1,
  1,
  1416603,
  'Cash',
  'Living & Emergency (日常与应急储备)',
  'manual',
  1,
  '多币种外币兑换与日常备用存款（独立备忘）。',
  23
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wallet-wise',
  'port_default_jpy',
  'Cash_JPY_Wise',
  'Wise',
  'Wise',
  '多币种跨境账户',
  'Cash',
  'JPY',
  547891,
  1,
  1,
  547891,
  'Cash',
  'Payment Wallet (跨境与支付钱包)',
  'manual',
  1,
  '跨境资金调拨与国际汇款流动备付金（独立备忘）。',
  24
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wallet-revolut',
  'port_default_jpy',
  'Cash_JPY_Revolut',
  'Revolut',
  'Revolut',
  '日元支付账户',
  'Cash',
  'JPY',
  53324,
  1,
  1,
  53324,
  'Cash',
  'Payment Wallet (跨境与支付钱包)',
  'manual',
  1,
  '日常刷卡与跨境消费支付余额（独立备忘）。',
  25
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-mizuho',
  'port_default_jpy',
  'Cash_JPY_Mizuho',
  '瑞穗银行',
  '瑞穗银行',
  '日元结算活期',
  'Cash',
  'JPY',
  43249,
  1,
  1,
  43249,
  'Cash',
  'Living & Emergency (日常与应急储备)',
  'manual',
  1,
  '瑞穗银行备用日常小额存款（独立备忘）。',
  26
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-sbi-shinsei',
  'port_default_jpy',
  'Cash_JPY_SBI新生',
  'SBI新生银行',
  'SBI新生银行',
  '日元储蓄活期',
  'Cash',
  'JPY',
  62144,
  1,
  1,
  62144,
  'Cash',
  'Living & Emergency (日常与应急储备)',
  'manual',
  1,
  '日常生活消费与银行备忘账户：SBI新生银行日元活期储蓄。',
  27
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wallet-paypal',
  'port_default_jpy',
  'Cash_JPY_PayPal',
  'PayPal',
  'PayPal',
  '日元支付账户',
  'Cash',
  'JPY',
  9797,
  1,
  1,
  9797,
  'Cash',
  'Payment Wallet (跨境与支付钱包)',
  'manual',
  1,
  'PayPal线上支付零钱余额（独立备忘）。',
  28
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-ant-vietnam-qdii',
  'port_default_jpy',
  'CN_QDII_VN',
  '越南 VN30',
  '蚂蚁财富',
  '人民币基金账户',
  'China',
  'CNY',
  93652.36,
  1,
  1,
  93652.36,
  'Satellite',
  'Vietnam Growth (越南供应链转移与新兴市场)',
  'manual',
  1,
  '卫星仓（新兴市场区域分散）：天弘越南市场股票QDII（越南VN30指数）。',
  29
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-ant-yuebao',
  'port_default_jpy',
  'Cash_CNY_Yuebao',
  '余额宝',
  '蚂蚁财富',
  '人民币货币基金',
  'Cash',
  'CNY',
  75590.61,
  1,
  1,
  75590.61,
  'Cash',
  'Linked Bank Reserve (银证联动储备)',
  'manual',
  1,
  '人民币高流动性货币基金储备，用于国内日常支出及理财（独立备忘）。',
  30
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-cmb',
  'port_default_jpy',
  'Cash_CNY_CMB',
  '招商银行',
  '招商银行',
  '人民币综合账户',
  'Cash',
  'CNY',
  62159.96,
  1,
  1,
  62159.96,
  'Cash',
  'Linked Bank Reserve (银证联动储备)',
  'manual',
  1,
  '招商银行人民币资产（含闲置资金，独立备忘）。',
  31
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wallet-wechat',
  'port_default_jpy',
  'Cash_CNY_WeChatPay',
  '微信支付',
  '微信支付',
  '人民币零钱',
  'Cash',
  'CNY',
  10000,
  1,
  1,
  10000,
  'Cash',
  'Payment Wallet (跨境与支付钱包)',
  'manual',
  1,
  '国内日常移动支付流动资金（独立备忘）。',
  32
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-bank-antbank-hkd',
  'port_default_jpy',
  'Cash_HKD_AntBank',
  'ANT BANK',
  'ANT BANK',
  '港币理财账户',
  'Cash',
  'HKD',
  2937.18,
  1,
  1,
  2937.18,
  'Cash',
  'Linked Bank Reserve (银证联动储备)',
  'manual',
  1,
  '蚂蚁银行(香港)港币综合理财资产（独立备忘）。',
  33
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-crypto-bitget',
  'port_default_jpy',
  'CRYPTO_BITGET',
  'Bitget Wallet',
  'Bitget Wallet',
  '数字钱包',
  'Global / Other',
  'USD',
  74.98,
  1,
  1,
  74.98,
  'Satellite',
  'Web3 / Stablecoin (链上金融基础设施)',
  'manual',
  1,
  'Web3链上交互钱包估值（独立备忘，不计入美元现金）。',
  34
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-crypto-worldcoin',
  'port_default_jpy',
  'CRYPTO_WLD',
  'Worldcoin',
  'Worldcoin',
  '数字资产钱包',
  'Global / Other',
  'JPY',
  7067,
  1,
  1,
  7067,
  'Satellite',
  'Web3 / Stablecoin (链上金融基础设施)',
  'manual',
  1,
  'Worldcoin数字身份与代币钱包估值（独立备忘，不计入日元现金）。',
  35
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wechatsec-513130',
  'port_default_jpy',
  '513130.SS',
  '恒生科技',
  '微信证券',
  '人民币证券账户 (场内ETF)',
  'China',
  'CNY',
  951400,
  0.5015,
  0.51,
  485214,
  'Core',
  'Digital Platform (港股科技平台龙头)',
  'manual',
  1,
  '核心仓（中国科技互联网主线）：华泰柏瑞恒生科技ETF。',
  36
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wechatsec-513500',
  'port_default_jpy',
  '513500.SS',
  'S&P 500',
  '微信证券',
  '人民币证券账户 (场内ETF)',
  'China',
  'CNY',
  90000,
  2.634,
  2.679,
  241110,
  'Defensive',
  'Bonds & Index (标普500定投)',
  'manual',
  1,
  '防守仓定投：博时标普500 ETF（与2563.T及eMAXIS Slim同属标普500指数）。',
  37
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wechatsec-300750',
  'port_default_jpy',
  '300750.SZ',
  '宁德时代',
  '微信证券',
  '人民币证券账户 (A股)',
  'China',
  'CNY',
  200,
  268.5,
  276.08,
  55216,
  'Core',
  'EV Revolution (智能电动车与电池龙头)',
  'manual',
  1,
  '核心仓（EV电池端）：全球动力与储能电池绝对龙头。',
  38
);

INSERT INTO holdings (
  id, portfolio_id, ticker, name, broker, account, market, currency,
  quantity, cost_per_unit, market_price, market_value, layer, theme,
  source_type, confidence, investment_thesis, sort_order
) VALUES (
  'real-wechatsec-cash-cny',
  'port_default_jpy',
  'Cash_CNY_WeChatSec',
  '微信证券可用资金',
  '微信证券',
  '人民币证券账户现金',
  'Cash',
  'CNY',
  31.7,
  1,
  1,
  31.7,
  'Cash',
  'Brokerage Cash (券商交易子弹)',
  'manual',
  1,
  '微信证券账户内剩余可用资金。',
  39
);