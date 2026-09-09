import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION =
  'Você é um especialista em musculação, treinamento de força e nutrição esportiva, com conhecimento equivalente a um educador físico e nutricionista experientes. Responda dúvidas sobre exercícios, técnica de execução, divisão de treino, volume, progressão de carga, macronutrientes, calorias, hipertrofia, emagrecimento e hábitos alimentares de forma clara, prática e baseada em evidências científicas atuais. Explique o raciocínio por trás das recomendações de forma acessível. Sempre que a pergunta envolver lesões, dores, condições de saúde pré-existentes, uso de medicamentos ou suplementos de risco (ex: anabolizantes, termogênicos fortes), oriente o usuário a procurar um médico ou profissional habilitado antes de agir, deixando claro que você não substitui uma avaliação profissional individualizada. Não invente informações; se não tiver certeza, diga isso.';

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

export default async function handler(req: any, res: any) {
  // Configura cabeçalhos CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
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

    const { messages } = body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Nenhuma mensagem informada.',
        statusCode: 400,
        message: 'O corpo da requisição deve conter um array "messages" não vazio.',
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      console.error('[Gemini API - Vercel] Chave de API não encontrada.');
      return res.status(500).json({
        error: 'Chave de API não configurada no Vercel',
        statusCode: 500,
        message:
          'A variável GEMINI_API_KEY ou VITE_GEMINI_API_KEY não foi encontrada nas Environment Variables da Vercel.',
        tip: 'Acesse o painel da Vercel em Settings > Environment Variables, adicione VITE_GEMINI_API_KEY e GEMINI_API_KEY e faça Redeploy.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Formatar mensagens para o Gemini
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

    let lastError: any = null;
    let reply: string | null | undefined = null;
    let successfulModel = '';

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[Gemini Chat - Vercel] Tentando modelo: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });

        if (response && response.text) {
          reply = response.text;
          successfulModel = modelName;
          console.log(`[Gemini Chat - Vercel] Sucesso com modelo: ${modelName}`);
          break;
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        const status = modelErr?.status || modelErr?.statusCode || modelErr?.code || 'desconhecido';
        console.warn(`[Gemini Chat - Vercel] Falha no modelo ${modelName} (status ${status}):`, modelErr?.message || modelErr);
      }
    }

    if (!reply) {
      const statusCode = lastError?.status || lastError?.statusCode || 500;
      const rawMessage = lastError?.message || 'Falha ao obter resposta dos modelos do Gemini.';

      return res.status(typeof statusCode === 'number' ? statusCode : 500).json({
        error: 'Não foi possível obter resposta dos modelos do Gemini',
        statusCode: typeof statusCode === 'number' ? statusCode : 500,
        message: rawMessage,
        modelsAttempted: CANDIDATE_MODELS,
      });
    }

    return res.json({ reply, modelUsed: successfulModel });
  } catch (err: any) {
    const statusCode = err?.status || err?.statusCode || 500;
    const rawMessage = err?.message || 'Erro ao processar mensagem.';
    return res.status(typeof statusCode === 'number' ? statusCode : 500).json({
      error: 'Não foi possível obter resposta da API',
      statusCode: typeof statusCode === 'number' ? statusCode : 500,
      message: rawMessage,
    });
  }
}
