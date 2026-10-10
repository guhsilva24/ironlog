import {
  CHAT_SYSTEM_INSTRUCTION,
  generateContentWithRetry,
  getServerApiKey,
} from './_gemini.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido. Use POST.',
      statusCode: 405,
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }

    const { messages, context } = body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Nenhuma mensagem informada.',
        statusCode: 400,
        message: 'O corpo da requisição deve conter um array "messages" não vazio.',
      });
    }

    // Leitura estrita de GEMINI_API_KEY no servidor (sem prefixo VITE_)
    const apiKey = getServerApiKey();
    if (!apiKey) {
      console.error('[Chat API Serverless] GEMINI_API_KEY não configurada no servidor.');
      return res.status(500).json({
        error: 'GEMINI_API_KEY não configurada no servidor',
        statusCode: 500,
        message: 'GEMINI_API_KEY não configurada no servidor',
        tip: 'No painel da Vercel (Settings > Environment Variables), cadastre GEMINI_API_KEY com a sua chave do Google AI Studio e faça Redeploy.',
      });
    }

    // Formatar histórico de mensagens para o Gemini
    const rawTurns = messages
      .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0 && !m.isError)
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content.trim() }],
      }));

    const firstUserIdx = rawTurns.findIndex((t: any) => t.role === 'user');
    if (firstUserIdx === -1) {
      return res.status(400).json({
        error: 'Nenhuma mensagem de usuário encontrada.',
        statusCode: 400,
        message: 'O histórico deve conter pelo menos uma mensagem de usuário.',
      });
    }

    const validTurns = rawTurns.slice(firstUserIdx);
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const turn of validTurns) {
      if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
        contents[contents.length - 1].parts[0].text += `\n\n${turn.parts[0].text}`;
      } else {
        contents.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
      }
    }

    let effectiveSystemInstruction = CHAT_SYSTEM_INSTRUCTION;
    if (context && typeof context === 'string' && context.trim().length > 0) {
      effectiveSystemInstruction = `${CHAT_SYSTEM_INSTRUCTION}\n\nA seguir estão os dados reais do usuário registrados no app. Use-os para responder de forma personalizada. Se faltarem dados para concluir algo, diga isso em vez de supor. Dados do usuário: ${context.trim()}`;
    }

    const result = await generateContentWithRetry({
      apiKey,
      contents,
      systemInstruction: effectiveSystemInstruction,
    });

    return res.json({
      reply: result.text,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    });
  } catch (err: any) {
    const rawStatus = err?.status || err?.statusCode || err?.code;
    const statusCode = typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
    const fullMessage =
      err?.error?.message ||
      err?.message ||
      (typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err));

    console.error('[Chat API Serverless Erro]:', {
      statusCode,
      message: fullMessage,
      errorObj: err,
    });

    return res.status(statusCode).json({
      error: 'Erro na API do Google Gemini',
      statusCode,
      message: fullMessage,
      details: err?.error || err?.details || undefined,
    });
  }
}
