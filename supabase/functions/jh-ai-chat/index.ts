const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { kind, prompt, context } = await req.json()
    const sect = context?.sect ? `（当前门派：${context.sect}）` : ''
    const systemMap: Record<string, string> = {
      xiaoer: '你是江湖客栈的店小二，见多识广，市井八卦，说话口语化带江湖气，回复控制在30字以内，不要超过30字。',
      anecdote: '你是云游四方的说书先生，文白夹杂，讲武侠传说轶事，回复控制在100字以内。',
    }
    const system = systemMap[kind] ?? '你是江湖中人，简短回复，带武侠气息，30字以内。'
    const key = Deno.env.get('MIMO_API_KEY')
    if (!key) return json({ text: null })
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let text: string | null = null
    try {
      const res = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'mimo-v2.6-pro-ultraspeed',
          messages: [{ role: 'system', content: system }, { role: 'user', content: sect + prompt }],
          max_tokens: kind === 'anecdote' ? 512 : 256,
        }),
        signal: ctrl.signal,
      })
      const j = await res.json()
      text = j?.choices?.[0]?.message?.content?.trim() ?? null
    } finally { clearTimeout(timer) }
    return json({ text })
  } catch (e) {
    return json({ text: null })
  }
})
