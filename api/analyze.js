module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, chunks, apiKey } = req.body || {};
  const key = process.env.ANTHROPIC_API_KEY || apiKey;
  if (!key) return res.status(400).json({ error: 'API 키가 없습니다.' });

  const chunkText = (chunks || []).map((c, i) => `[청크 ${i + 1} | ${c.doc}]\n${c.text}`).join('\n\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: `당신은 RAG 검색 품질 분석 전문가입니다. 검색 쿼리와 검색된 청크들을 분석해서 다음을 간결하게 답하세요:
1. 검색 품질: 상/중/하 + 이유 1줄
2. 핵심 근거: 가장 관련 있는 문장 1개 인용
3. 개선 제안: 더 나은 쿼리 예시 1개
한국어로 간결하게.`,
        messages: [{
          role: 'user',
          content: `쿼리: "${query}"\n\n검색 결과:\n${chunkText}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });
    res.json({ analysis: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
