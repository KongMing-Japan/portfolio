const MAX_REQUEST_BYTES = 5_600_000;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
];

const positionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    positions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ticker: { type: 'string' },
          name: { type: 'string' },
          broker: { type: 'string' },
          account: { type: 'string' },
          currency: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          costPerUnit: { type: ['number', 'null'] },
          marketValue: { type: ['number', 'null'] },
          theme: { type: 'string' },
          layer: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: [
          'ticker',
          'name',
          'broker',
          'account',
          'currency',
          'quantity',
          'costPerUnit',
          'marketValue',
          'theme',
          'layer',
          'confidence',
        ],
      },
    },
  },
  required: ['positions'],
} as const;

interface ExtractRequest {
  image?: unknown;
  text?: unknown;
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.GROQ_API_KEY) {
    return json(
      {
        error:
          'AI recognition is not configured. Use CSV or set GROQ_API_KEY in Cloudflare Pages.',
      },
      503,
    );
  }

  const contentLength = Number(
    context.request.headers.get('content-length') ?? 0,
  );
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: 'Requests must be 4 MB or smaller.' }, 413);
  }

  let body: ExtractRequest;
  try {
    body = await context.request.json<ExtractRequest>();
  } catch {
    return json({ error: 'Invalid request format.' }, 400);
  }

  const isImageRequest = typeof body.image === 'string' && body.image.trim().length > 0;
  const isTextRequest = typeof body.text === 'string' && body.text.trim().length > 0;

  if (!isImageRequest && !isTextRequest) {
    return json({ error: 'Please provide a screenshot image or pasted text to analyze.' }, 400);
  }

  let messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  let model: string;

  if (isImageRequest) {
    const image = (body.image as string).trim();
    if (!ALLOWED_IMAGE_PREFIXES.some((prefix) => image.startsWith(prefix))) {
      return json({ error: 'Only PNG, JPG, and WebP images are supported.' }, 400);
    }
    const base64 = image.slice(image.indexOf(',') + 1);
    const estimatedBytes = Math.ceil((base64.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return json({ error: 'Screenshot must be 4 MB or smaller.' }, 413);
    }

    model = context.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract every visible investment position from this single brokerage screenshot.',
              'Focus primarily on extracting:',
              '1. Ticker symbol (e.g. 7203.T, 1482.T, NVDA, AAPL, 00700.HK, 513500.SS) or clear stock/fund name.',
              '2. Latest holding quantity (持仓数/持股数/保有数量/份额).',
              '3. Current unit price (现价/当前单价) or total market value (市值/评估额) if visible, allowing manual/fallback pricing if live market quotes are unavailable.',
              'The screenshot may contain Chinese, Japanese, or English labels.',
              'Normalize currency to ISO codes: JPY, USD, HKD, CNY. Default to JPY for Japanese brokerages (Rakuten, SBI, Moomoo JP), USD for US, CNY for China, HKD for HK.',
              'Cash balances must use tickers such as Cash_JPY or Cash_USD.',
              'Do not invent fictional numbers. Return strictly matching the JSON schema.',
            ].join(' '),
          },
          {
            type: 'image_url',
            image_url: { url: image },
          },
        ],
      },
    ];
  } else {
    // Text extraction mode
    const text = (body.text as string).trim();
    if (text.length > 50_000) {
      return json({ error: 'Pasted text is too long (limit 50,000 characters).' }, 400);
    }

    model =
      context.env.GROQ_TEXT_MODEL ||
      context.env.GROQ_VISION_MODEL ||
      'llama-3.3-70b-versatile';
    messages = [
      {
        role: 'system',
        content: [
          'You are an expert investment portfolio extractor.',
          'Extract all investment positions from the user-provided text (which may be a copied broker statement, trade confirmation, account balance summary, or message).',
          'Extract for each position:',
          '1. ticker: Standard stock/fund ticker symbol if identifiable (e.g. 7203.T, 1482.T, AAPL, 00700, 513500.SS) or recognizable security name.',
          '2. name: Security or fund name in Chinese, Japanese, or English.',
          '3. quantity: Latest holding quantity / shares / units (持股数/持仓数/数量/份额). Must be a positive number.',
          '4. costPerUnit / marketPrice: Latest unit price (现价/净值) if mentioned, otherwise null.',
          '5. marketValue: Total position market value if mentioned, otherwise null.',
          '6. currency: ISO currency code (JPY, USD, HKD, CNY). Default to JPY for Japanese assets/brokers, USD for US assets, etc.',
          '7. broker: Brokerage name if mentioned (e.g. 乐天证券, SBI, moomoo, 招商银行, 微信证券), otherwise empty string.',
          '8. layer: Core, Satellite, Defensive, or Cash if determinable, otherwise empty string.',
          'For cash accounts or cash balances, use tickers such as Cash_JPY, Cash_USD, Cash_CNY.',
          'Do not hallucinate fake positions. Return strictly valid data conforming to the JSON schema.',
        ].join(' '),
      },
      {
        role: 'user',
        content: text,
      },
    ];
  }

  const upstream = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_completion_tokens: 6000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'portfolio_positions',
            strict: false,
            schema: positionSchema,
          },
        },
      }),
    },
  );

  if (!upstream.ok) {
    const errorText = await upstream.text();
    console.error(
      JSON.stringify({
        message: 'Groq OCR request failed',
        status: upstream.status,
        error: errorText.slice(0, 500),
      }),
    );
    return json(
      {
        error:
          upstream.status === 429
            ? 'The free OCR limit has been reached. Try again later or use CSV.'
            : 'The screenshot could not be recognized. Use a clearer image or CSV.',
        upstreamStatus: upstream.status,
        details: errorText.slice(0, 500),
      },
      upstream.status === 429 ? 429 : 502,
    );
  }

  const result = await upstream.json<GroqResponse>();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    return json({ error: 'Screenshot recognition returned no positions. Try CSV instead.' }, 502);
  }

  try {
    const parsed = JSON.parse(content) as { positions?: unknown };
    if (!Array.isArray(parsed.positions)) {
      throw new Error('positions array missing');
    }
    return json({ positions: parsed.positions });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'Groq OCR response parsing failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return json({ error: 'The screenshot result was invalid. Try again or use CSV.' }, 502);
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!context.env.GROQ_API_KEY) {
    return json({ configured: false, error: 'GROQ_API_KEY is not set' }, 503);
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${context.env.GROQ_API_KEY}`,
      },
    });
    if (!res.ok) {
      const err = await res.text();
      return json({ configured: true, groqStatus: res.status, error: err }, res.status);
    }
    const data = await res.json<{ data?: Array<{ id: string }> }>();
    const models = data.data?.map((m) => m.id) ?? [];
    return json({
      configured: true,
      currentVisionModel:
        context.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
      models,
    });
  } catch (err) {
    return json({ configured: true, error: String(err) }, 500);
  }
};
