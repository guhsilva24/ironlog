import {
  generateContentWithRetry,
  getServerApiKey,
  NUTRITION_RESPONSE_SCHEMA,
  NUTRITION_SYSTEM_INSTRUCTION,
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

    const { text, history } = body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Descrição do alimento não informada.',
        statusCode: 400,
        message: 'Por favor, descreva o que você comeu.',
      });
    }

    // Leitura estrita de GEMINI_API_KEY no servidor (sem prefixo VITE_)
    const apiKey = getServerApiKey();
    if (!apiKey) {
      console.error('[Nutrition API Serverless] GEMINI_API_KEY não configurada no servidor.');
      return res.status(500).json({
        error: 'GEMINI_API_KEY não configurada no servidor',
        statusCode: 500,
        message: 'GEMINI_API_KEY não configurada no servidor',
        tip: 'No painel da Vercel (Settings > Environment Variables), cadastre GEMINI_API_KEY com a sua chave do Google AI Studio e faça Redeploy.',
      });
    }

    const contents: { role: string; parts: { text: string }[] }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        if (turn && typeof turn.content === 'string' && turn.content.trim().length > 0) {
          contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content.trim() }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [
        {
          text:
            contents.length > 0
              ? text.trim()
              : `Alimento ou refeição: "${text.trim()}". Estime os macronutrientes considerando a marca e tabela nutricional real se especificada, ou faça uma pergunta rápida de esclarecimento sobre a quantidade/ingredientes se não informado.`,
        },
      ],
    });

    const result = await generateContentWithRetry({
      apiKey,
      contents,
      systemInstruction: NUTRITION_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: NUTRITION_RESPONSE_SCHEMA,
    });

    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // Se não for JSON direto mas for uma pergunta curta de esclarecimento
      if (cleanJson.includes('?') || cleanJson.length < 350) {
        return res.json({
          type: 'clarification',
          question: cleanJson.replace(/^["']|["']$/g, '').trim(),
          modelUsed: result.modelUsed,
        });
      }
      return res.status(500).json({
        error: 'Formato de resposta inválido retornado pela IA.',
        statusCode: 500,
        message: `A IA retornou um formato inesperado:\n${cleanJson}`,
      });
    }

    // Fluxo de esclarecimento (pratos regionais, marcas, quantidade)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (
        parsed.type === 'clarification' ||
        (parsed.question && !parsed.items && !parsed.nome) ||
        (parsed.pergunta && !parsed.items && !parsed.nome)
      ) {
        return res.json({
          type: 'clarification',
          question: String(parsed.question || parsed.pergunta || '').trim(),
          modelUsed: result.modelUsed,
        });
      }
    }

    // Fluxo de estimativa de alimentos
    let rawItems: any[] = [];
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else if (parsed && typeof parsed === 'object' && (parsed.nome || parsed.name)) {
      rawItems = [parsed];
    }

    if (rawItems.length === 0) {
      if (parsed?.question || parsed?.pergunta) {
        return res.json({
          type: 'clarification',
          question: String(parsed.question || parsed.pergunta).trim(),
          modelUsed: result.modelUsed,
        });
      }

      return res.status(400).json({
        error: 'Nenhum alimento identificado.',
        statusCode: 400,
        message: 'Tente descrever o alimento com mais detalhes (ex: "2 fatias de pão com 1 colher de manteiga").',
      });
    }

    const items = rawItems.map((item: any) => ({
      nome: String(item.nome || item.name || 'Alimento').trim(),
      quantidade: String(item.quantidade || item.quantity || '1 porção').trim(),
      calorias: Math.max(0, Math.round(Number(item.calorias ?? item.calories) || 0)),
      proteina_g: Math.max(0, Math.round(Number(item.proteina_g ?? item.protein) || 0)),
      carboidrato_g: Math.max(0, Math.round(Number(item.carboidrato_g ?? item.carbs) || 0)),
      gordura_g: Math.max(0, Math.round(Number(item.gordura_g ?? item.fat) || 0)),
      observacao: item.observacao ? String(item.observacao).trim() : (item.notes ? String(item.notes).trim() : undefined),
    }));

    return res.json({
      type: 'estimate',
      items,
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

    console.error('[Nutrition API Serverless Erro]:', {
      statusCode,
      message: fullMessage,
      errorObj: err,
    });

    return res.status(statusCode).json({
      error: 'Erro na estimativa de nutrição do Gemini',
      statusCode,
      message: fullMessage,
      details: err?.error || err?.details || undefined,
    });
  }
}
