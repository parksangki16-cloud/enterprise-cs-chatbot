module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, context, apiKey } = req.body || {};
  const key = process.env.ANTHROPIC_API_KEY || apiKey;
  if (!key) return res.status(400).json({ error: 'API 키가 없습니다. 설정에서 Anthropic API 키를 입력해주세요.' });
  if (!query) return res.status(400).json({ error: 'query가 필요합니다.' });

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
        max_tokens: 600,
        system: `당신은 기업 고객서비스(CS) AI 어시스턴트입니다. 반드시 제공된 내부 정책 문서만 근거로 답변하세요.

규칙:
1. 정책에 없는 내용은 "담당자 확인 후 안내드리겠습니다"라고 답하세요.
2. 금기어 절대 사용 금지: 몰라요 / 안됩니다 / 고객님 책임 / 환불 절대 불가 / 법대로
3. 공감하는 정중한 어투 유지
4. 핵심만 2~4문장으로 간결하게
5. 한국어로만 답변`,
        messages: [{
          role: 'user',
          content: `[내부 정책]\n${context || '정책 정보 없음'}\n\n[고객 문의]\n${query}`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || `API 오류 (${response.status})` });
    }
    res.json({ answer: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: `서버 오류: ${err.message}` });
  }
};
