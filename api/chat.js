module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, context, apiKey } = req.body || {};
  const key = process.env.ANTHROPIC_API_KEY || apiKey;
  if (!key) return res.status(400).json({ error: 'API 키가 없습니다.' });
  if (!query) return res.status(400).json({ error: 'query 누락' });

  // 컨텍스트를 600자로 제한 (토큰 절약)
  const trimmedContext = (context || '정책 없음').slice(0, 600);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system: [
          {
            type: 'text',
            // 프롬프트 캐싱: 시스템 프롬프트는 고정이므로 캐싱 → 90% 비용 절감
            cache_control: { type: 'ephemeral' },
            text: `CS 챗봇. 제공된 정책만 근거로 2~3문장 한국어 답변. 금기어(몰라요/안됩니다/고객님책임/법대로) 금지. 정책 외 내용은 "담당자 확인 후 안내드리겠습니다" 답변.`
          }
        ],
        messages: [{
          role: 'user',
          content: `정책: ${trimmedContext}\n\n문의: ${query}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || `오류 ${response.status}` });

    const usage = data.usage || {};
    res.json({
      answer: data.content[0].text,
      usage: {
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        cache_read: usage.cache_read_input_tokens || 0,
        cache_write: usage.cache_creation_input_tokens || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
