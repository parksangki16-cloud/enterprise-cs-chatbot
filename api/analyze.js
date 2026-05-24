module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, chunks, apiKey } = req.body || {};
  const key = process.env.ANTHROPIC_API_KEY || apiKey;
  if (!key) return res.status(400).json({ error: 'API 키가 없습니다.' });

  // 상위 2개 청크만 사용, 각 150자 제한 (토큰 절약)
  const topChunks = (chunks || []).slice(0, 2)
    .map((c, i) => `[${i + 1}] ${c.doc}: ${c.text.slice(0, 150)}`)
    .join('\n');

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
        max_tokens: 200,
        system: [
          {
            type: 'text',
            cache_control: { type: 'ephemeral' },
            text: '검색품질 분석가. 쿼리와 청크를 보고 3줄로만 답변: 1)검색품질(상/중/하+이유) 2)핵심근거(인용) 3)개선쿼리 제안. 한국어.'
          }
        ],
        messages: [{
          role: 'user',
          content: `쿼리: "${query}"\n검색결과:\n${topChunks}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    const usage = data.usage || {};
    res.json({
      analysis: data.content[0].text,
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
