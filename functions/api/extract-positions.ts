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
          '截图识别服务尚未配置。请使用 CSV，或在 Cloudflare Pages 中设置 GROQ_API_KEY。',
      },
      503,
    );
  }

  const contentLength = Number(
    context.request.headers.get('content-length') ?? 0,
  );
  if (contentLength > MAX_REQUEST_BYTES) {
    return json({ error: '截图请求不能超过 4 MB。' }, 413);
  }

  let body: ExtractRequest;
  try {
    body = await context.request.json<ExtractRequest>();
  } catch {
    return json({ error: '请求格式无效。' }, 400);
  }

  const image = typeof body.image === 'string' ? body.image : '';
  if (!ALLOWED_IMAGE_PREFIXES.some((prefix) => image.startsWith(prefix))) {
    return json({ error: '仅支持 PNG、JPG 和 WebP 图片。' }, 400);
  }
  const base64 = image.slice(image.indexOf(',') + 1);
  const estimatedBytes = Math.ceil((base64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return json({ error: 'Base64 截图请求不能超过 4 MB。' }, 413);
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
        model:
          context.env.GROQ_VISION_MODEL ||
          'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'Extract every visible investment position from this brokerage screenshot.',
                  'The screenshot may contain Chinese, Japanese, or English labels.',
                  'Return one row per visible account position. Do not invent missing numbers.',
                  'Normalize currency to ISO codes such as JPY, USD, HKD, or CNY.',
                  'Use Core, Satellite, Defensive, or Cash for layer only when the image explicitly provides it; otherwise return an empty string.',
                  'Cash balances must use a ticker such as Cash_JPY or Cash_USD.',
                  'Confidence reflects the reliability of the row, especially ticker and quantity.',
                  'Return only data matching the provided JSON schema.',
                ].join(' '),
              },
              {
                type: 'image_url',
                image_url: { url: image },
              },
            ],
          },
        ],
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
            ? '免费 OCR 暂时达到使用限制，请稍后重试或改用 CSV。'
            : '截图未能识别，请换一张更清晰的图片或改用 CSV。',
      },
      upstream.status === 429 ? 429 : 502,
    );
  }

  const result = await upstream.json<GroqResponse>();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    return json({ error: '截图识别没有返回结果，请改用 CSV。' }, 502);
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
    return json({ error: '截图识别结果格式异常，请重试或改用 CSV。' }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async () =>
  json({ error: 'Method not allowed' }, 405);
