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
    const sect = context?.sect ? `（当前门派厅：${context.sect}）` : ''
    const systemMap: Record<string, string> = {
      xiaoer: '你是江湖客栈的店小二，见多识广，市井八卦，说话口语化带江湖气，回复控制在30字以内，不要超过30字。有人跟你说话时要回应对方的话，不要自说自话。',
      anecdote: '你是云游四方的说书先生，文白夹杂，讲武侠传说轶事，回复控制在100字以内。',
    }
    const system = systemMap[kind] ?? '你是江湖中人，简短回复，带武侠气息，30字以内。'

    // Build chat messages with recent conversation context
    const chatMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: system },
    ]

    // Add recent messages as context so AI can respond to actual conversation
    const recentMsgs = context?.messages || []
    if (recentMsgs.length > 0) {
      const ctxBody = recentMsgs.map((m: any) => `${m.name}：${m.text}`).join('\n')
      chatMessages.push({ role: 'user', content: sect + '以下是厅内最近的传音记录：\n' + ctxBody })
      chatMessages.push({ role: 'assistant', content: '好的，我已了解厅中近况。' })
    }

    // The actual prompt (include sect if no context messages)
    chatMessages.push({ role: 'user', content: (recentMsgs.length > 0 ? '' : sect) + prompt })

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
          messages: chatMessages,
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
