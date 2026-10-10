// Arquivo autossuficiente: sem imports relativos (evita ERR_MODULE_NOT_FOUND na Vercel).

/**
 * Descoberta dinâmica de modelos do Google Gemini e execução resiliente com retry.
 */

interface ModelCache {
  candidateList: string[];
  chosenModel: string;
  allModels: string[];
  timestamp: number;
}

let modelCache: ModelCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de cache em memória

const CHAT_SYSTEM_INSTRUCTION =
  'Você é um especialista em musculação, treinamento de força e nutrição esportiva, com conhecimento equivalente a um educador físico e nutricionista experientes. Responda dúvidas sobre exercícios, técnica de execução, divisão de treino, volume, progressão de carga, macronutrientes, calorias, hipertrofia, emagrecimento e hábitos alimentares de forma clara, prática e baseada em evidências científicas atuais. Explique o raciocínio por trás das recomendações de forma acessível. Sempre que a pergunta envolver lesões, dores, condições de saúde pré-existentes, uso de medicamentos ou suplementos de risco (ex: anabolizantes, termogênicos fortes), oriente o usuário a procurar um médico ou profissional habilitado antes de agir, deixando claro que você não substitui uma avaliação profissional individualizada. Não invente informações; se não tiver certeza, diga isso.';

const NUTRITION_SYSTEM_INSTRUCTION = `Você é um nutricionista especialista em tabela de composição de alimentos e cálculo de macronutrientes.
Você tem conhecimento amplo sobre culinária regional brasileira (Norte/Manaus, Nordeste, Centro-Oeste, Sudeste e Sul), pratos internacionais e produtos industrializados comuns no Brasil.

1. Pratos e Culinária Regional:
Ao receber o nome de um prato ou alimento regional (ex: caboquinho, tacacá, tambaqui assado, x-caboquinho, baião de dois, açaí com farinha, pamonha, vatapá, etc.), use seu conhecimento sobre os ingredientes típicos dessa preparação na região de origem para estimar os macronutrientes com a maior precisão possível, considerando o modo de preparo tradicional. Se o nome do prato for ambíguo, variar muito de preparo entre regiões, ou você não tiver certeza suficiente para estimar com confiança, retorne uma pergunta rápida de esclarecimento ao usuário (type: "clarification") antes de gerar os valores. Sempre priorize precisão regional sobre suposições genéricas.

2. Marcas e Produtos Industrializados:
Quando o usuário mencionar uma marca específica de produto industrializado (ex: manteiga Deline, leite Itálac, iogurte Nestlé, pão Pullman, entre outras marcas comuns no Brasil), utilize seu conhecimento sobre a tabela nutricional real e a porção padrão informada na embalagem desse produto específico para estimar os macronutrientes, em vez de usar um valor genérico da categoria do alimento. Considere o tamanho de porção típico informado na embalagem (ex: 1 colher de sopa = 10g de manteiga, 1 copo = 200ml de leite) ao calcular, a menos que o usuário informe uma quantidade diferente. Se você não tiver certeza sobre os valores exatos de uma marca específica, informe isso claramente no campo "observacao" (ex: 'estimativa aproximada, marca não confirmada com certeza'). Se a quantidade consumida não foi informada, faça uma pergunta de esclarecimento (type: "clarification").`;

const NUTRITION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: {
      type: 'STRING',
      enum: ['estimate', 'clarification'],
      description: 'Use "estimate" quando os dados forem suficientes para estimar os alimentos, ou "clarification" caso precise perguntar a porção consumida ou ingredientes.',
    },
    question: {
      type: 'STRING',
      description: 'Pergunta curta e amigável ao usuário caso type seja "clarification".',
    },
    items: {
      type: 'ARRAY',
      description: 'Lista de alimentos quando type for "estimate".',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING', description: 'Nome do alimento ou prato' },
          quantidade: { type: 'STRING', description: 'Porção consumida ou quantidade estimada' },
          calorias: { type: 'NUMBER', description: 'Calorias totais em kcal (número inteiro)' },
          proteina_g: { type: 'NUMBER', description: 'Proteína em gramas' },
          carboidrato_g: { type: 'NUMBER', description: 'Carboidratos em gramas' },
          gordura_g: { type: 'NUMBER', description: 'Gordura total em gramas' },
          observacao: { type: 'STRING', description: 'Observação opcional da tabela ou marca' },
        },
        required: ['nome', 'quantidade', 'calorias', 'proteina_g', 'carboidrato_g', 'gordura_g'],
      },
    },
  },
  required: ['type'],
};

/**
 * Lê exclusivamente a variável GEMINI_API_KEY no ambiente servidor.
 */
function getServerApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (typeof key === 'string' && key.trim().length > 0) {
    return key.trim();
  }
  return null;
}

/**
 * Descoberta dinâmica de modelos com cache e regras de prioridade.
 */
async function getOrDiscoverModels(apiKey: string): Promise<{
  chosenModel: string;
  candidateList: string[];
}> {
  const envOverride = process.env.GEMINI_MODEL?.trim();
  if (envOverride) {
    console.log(`[Gemini Server] Modelo sobrescrito via variável GEMINI_MODEL: "${envOverride}"`);
    return {
      chosenModel: envOverride,
      candidateList: [envOverride],
    };
  }

  const now = Date.now();
  if (modelCache && now - modelCache.timestamp < CACHE_TTL_MS) {
    return {
      chosenModel: modelCache.chosenModel,
      candidateList: modelCache.candidateList,
    };
  }

  try {
    console.log('[Gemini Server] Consultando https://generativelanguage.googleapis.com/v1beta/models para descoberta dinâmica...');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Gemini Server] Falha ao listar modelos (Status ${res.status}): ${errText}`);
      const fallbackList = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
      return {
        chosenModel: fallbackList[0],
        candidateList: fallbackList,
      };
    }

    const data = await res.json();
    const rawList: any[] = data.models || [];

    // Filtra apenas os modelos cujo campo supportedGenerationMethods inclua "generateContent"
    const validModels = rawList
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((name) => name.length > 0);

    // Registra no console do servidor a lista completa de modelos retornados
    console.log('[Gemini Server] Lista completa de modelos com generateContent:', validModels);

    // Escolha: primeiro modelo cujo nome contenha "flash"
    const deprecated = ['gemini-2.5-flash', 'gemini-2.0', 'gemini-1.5', 'gemini-pro'];
    const nonText = ['lite', 'preview', 'exp', 'thinking', 'image', 'tts', 'omni'];

    const flashPrimary = validModels.filter(
      (m) =>
        m.includes('flash') &&
        !nonText.some((w) => m.toLowerCase().includes(w)) &&
        !deprecated.some((d) => m.startsWith(d))
    );

    if (flashPrimary.includes('gemini-flash-latest')) {
      flashPrimary.splice(flashPrimary.indexOf('gemini-flash-latest'), 1);
      flashPrimary.unshift('gemini-flash-latest');
    }

    const flashLite = validModels.filter(
      (m) =>
        m.includes('flash') &&
        m.includes('lite') &&
        !['preview', 'exp', 'thinking', 'image', 'tts', 'omni'].some((w) =>
          m.toLowerCase().includes(w)
        ) &&
        !deprecated.some((d) => m.startsWith(d))
    );

    if (flashLite.includes('gemini-flash-lite-latest')) {
      flashLite.splice(flashLite.indexOf('gemini-flash-lite-latest'), 1);
      flashLite.unshift('gemini-flash-lite-latest');
    }

    const otherModels = validModels.filter(
      (m) =>
        !flashPrimary.includes(m) &&
        !flashLite.includes(m) &&
        !deprecated.some((d) => m.startsWith(d))
    );

    const orderedCandidates = [
      flashPrimary[0] || 'gemini-flash-latest',
      flashLite[0] || 'gemini-flash-lite-latest',
      ...flashPrimary.slice(1),
      ...flashLite.slice(1),
      ...otherModels,
    ].filter(Boolean);

    const chosenModel = orderedCandidates[0] || 'gemini-flash-latest';
    console.log('[Gemini Server] Modelo escolhido pela descoberta automática:', chosenModel);

    modelCache = {
      candidateList: orderedCandidates.length > 0 ? orderedCandidates : ['gemini-flash-latest'],
      chosenModel,
      allModels: validModels,
      timestamp: now,
    };

    return {
      chosenModel,
      candidateList: modelCache.candidateList,
    };
  } catch (err: any) {
    console.warn('[Gemini Server] Exceção na descoberta de modelos:', err?.message || err);
    const fallbackList = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
    return {
      chosenModel: fallbackList[0],
      candidateList: fallbackList,
    };
  }
}

/**
 * Executa generateContent com fallback de até 3 tentativas caso ocorra 404 (Requested entity not found),
 * ou erros temporários como 503 (alta demanda) / 429.
 */
async function generateContentWithRetry(params: {
  apiKey: string;
  contents: any[];
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
}): Promise<{ text: string; modelUsed: string; attempts: string[] }> {
  const { apiKey, contents, systemInstruction, responseMimeType, responseSchema } = params;

  const { candidateList } = await getOrDiscoverModels(apiKey);

  const bodyPayload: any = { contents };
  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const generationConfig: any = {};
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }
  if (responseSchema) {
    generationConfig.responseSchema = responseSchema;
  }
  if (Object.keys(generationConfig).length > 0) {
    bodyPayload.generationConfig = generationConfig;
  }

  const maxAttempts = Math.min(3, candidateList.length);
  const attemptedModels: string[] = [];
  let lastError: any = null;

  for (let i = 0; i < maxAttempts; i++) {
    const modelToTry = candidateList[i];
    attemptedModels.push(modelToTry);

    console.log(`[Gemini Execução] Tentativa ${i + 1}/${maxAttempts} com modelo: "${modelToTry}"`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const rawText = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {}

      if (!resp.ok) {
        const errorMsg =
          data?.error?.message ||
          (data ? JSON.stringify(data) : '') ||
          rawText ||
          `HTTP ${resp.status} ${resp.statusText}`;

        const err = new Error(errorMsg);
        (err as any).status = resp.status;
        (err as any).statusCode = resp.status;
        (err as any).body = data || rawText;
        lastError = err;

        console.warn(`[Gemini Execução] Falha na tentativa ${i + 1} (${modelToTry}) - Status ${resp.status}:`, errorMsg);

        const canRetryNextModel =
          resp.status === 404 ||
          resp.status === 503 ||
          resp.status === 429 ||
          errorMsg.includes('404') ||
          errorMsg.includes('NOT_FOUND') ||
          errorMsg.includes('Requested entity was not found') ||
          errorMsg.includes('no longer available') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('high demand');

        if (canRetryNextModel && i + 1 < maxAttempts) {
          console.log(`[Gemini Execução] Erro recuperável (Status ${resp.status}). Tentando próximo modelo...`);
          continue;
        }

        break;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text !== undefined && text !== null) {
        console.log(`[Gemini Execução] Sucesso no modelo: "${modelToTry}"`);
        return { text, modelUsed: modelToTry, attempts: attemptedModels };
      }

      throw new Error(`Resposta do modelo ${modelToTry} não continha texto válido.`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      const status = err?.status || err?.statusCode || (err.name === 'AbortError' ? 504 : 500);
      const msg = err?.message || String(err);

      console.warn(`[Gemini Execução] Erro de rede/timeout na tentativa ${i + 1} (${modelToTry}):`, msg);

      if (i + 1 < maxAttempts) {
        console.log(`[Gemini Execução] Timeout/Erro no modelo ${modelToTry}. Tentando próximo modelo...`);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

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
