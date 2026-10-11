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
Quando o usuário mencionar uma marca específica de produto industrializado (ex: manteiga Deline, leite Itálac, iogurte Nestlé, pão Pullman, entre outras marcas comuns no Brasil), utilize seu conhecimento sobre a tabela nutricional real e a porção padrão informada na embalagem desse produto específico para estimar os macronutrientes, em vez de usar um valor genérico da categoria do alimento. Considere o tamanho de porção típico informado na embalagem (ex: 1 colher de sopa = 10g de manteiga, 1 copo = 200ml de leite) ao calcular, a menos que o usuário informe uma quantidade diferente. Se você não tiver certeza sobre os valores exatos de uma marca específica, informe isso claramente no campo "observacao" (ex: 'estimativa aproximada, marca não confirmada com certeza'). Se a quantidade consumida não foi informada, faça uma pergunta de esclarecimento (type: "clarification").

3. Precisão, TACO, Medidas Caseiras e Preparo:
Use como referência principal a Tabela Brasileira de Composição de Alimentos (TACO) e, para produtos de marca, a tabela nutricional da embalagem. Antes de calcular, converta toda medida caseira em gramas (ex.: 1 ovo médio ≈ 50 g, 1 pão francês ≈ 50 g, 1 fatia de pão de forma ≈ 25 g, 1 copo = 200 ml) e informe o resultado em quantidade_g. Considere o ESTADO e o PREPARO do alimento (cru, cozido, grelhado, frito, com óleo ou manteiga) porque mudam muito as calorias; arroz, feijão, macarrão e carnes devem ser calculados pelo valor COZIDO quando o usuário disser cozido ou não especificar. Pratos compostos (ex.: x-caboquinho, tacacá, baião de dois) devem ser decompostos em ingredientes, somando cada parte. Nunca invente: se a confiança for baixa, marque confianca "baixa" e explique em observacao o que foi assumido. Os valores devem refletir a quantidade EXATA consumida, não a porção de 100 g.`;

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
          quantidade: { type: 'STRING', description: 'Porção consumida ou quantidade estimada descritiva (ex: 150g, 2 colheres de sopa)' },
          calorias: { type: 'NUMBER', description: 'Calorias totais em kcal (número inteiro)' },
          proteina_g: { type: 'NUMBER', description: 'Proteína em gramas' },
          carboidrato_g: { type: 'NUMBER', description: 'Carboidratos em gramas' },
          gordura_g: { type: 'NUMBER', description: 'Gordura total em gramas' },
          quantidade_g: { type: 'NUMBER', description: 'Peso total estimado em gramas ou ml consumido' },
          fibra_g: { type: 'NUMBER', description: 'Fibras em gramas' },
          sodio_mg: { type: 'NUMBER', description: 'Sódio em miligramas' },
          confianca: { type: 'STRING', enum: ['alta', 'media', 'baixa'], description: 'Nível de certeza sobre os macronutrientes da porção' },
          base: { type: 'STRING', enum: ['taco', 'rotulo', 'estimativa'], description: 'Fonte de referência utilizada' },
          observacao: { type: 'STRING', description: 'Observação opcional da tabela, modo de preparo ou marca' },
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
  temperature?: number;
}): Promise<{ text: string; modelUsed: string; attempts: string[] }> {
  const { apiKey, contents, systemInstruction, responseMimeType, responseSchema, temperature } = params;

  const { candidateList } = await getOrDiscoverModels(apiKey);

  const bodyPayload: any = { contents };
  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const generationConfig: any = {};
  if (typeof temperature === 'number') {
    generationConfig.temperature = temperature;
  }
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
      temperature: 0.1,
    });

    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // Se não for JSON direto mas for uma pergunta curta de esclarecimento
      if (cleanJson.includes('?') && cleanJson.length < 350) {
        return res.json({
          type: 'clarification',
          question: cleanJson.replace(/^["']|["']$/g, '').trim(),
          modelUsed: result.modelUsed,
        });
      }

      // Tentativa de 1 nova chamada com instrução explícita de corrigir o JSON
      try {
        console.warn('[Nutrition API] Resposta em formato inválido. Tentando 1 nova chamada para corrigir o JSON...');
        const retryContents = [
          ...contents,
          {
            role: 'model',
            parts: [{ text: cleanJson }],
          },
          {
            role: 'user',
            parts: [
              {
                text: 'A resposta anterior não é um JSON válido. Retorne EXCLUSIVAMENTE o objeto JSON válido correspondente ao schema especificado, sem formatação markdown ou texto adicional.',
              },
            ],
          },
        ];

        const retryResult = await generateContentWithRetry({
          apiKey,
          contents: retryContents,
          systemInstruction: NUTRITION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: NUTRITION_RESPONSE_SCHEMA,
          temperature: 0.1,
        });

        let retryClean = retryResult.text.trim();
        if (retryClean.startsWith('```')) {
          retryClean = retryClean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        parsed = JSON.parse(retryClean);
      } catch {
        // Se ainda falhar, devolve a mensagem amigável pedindo para descrever de outra forma
        return res.status(400).json({
          error: 'Não foi possível interpretar a resposta nutricional.',
          statusCode: 400,
          message: 'Tente descrever o alimento de outra forma com mais detalhes (ex: "150g de frango grelhado e 1 concha de arroz").',
        });
      }
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
        message: 'Tente descrever o alimento de outra forma com mais detalhes (ex: "2 fatias de pão com 1 colher de manteiga").',
      });
    }

    // Helper: sanitização numérica
    const sanitizeNonNegative = (val: any): number | undefined => {
      if (val === null || val === undefined || val === '') return undefined;
      const num = Number(val);
      if (isNaN(num) || num < 0) return undefined;
      return num;
    };

    const isZeroCalorieBeverage = (name: string): boolean => {
      const lower = name.toLowerCase();
      return (
        lower.includes('água') ||
        lower.includes('agua') ||
        lower.includes('café sem açúcar') ||
        lower.includes('cafe sem acucar') ||
        lower.includes('chá sem açúcar') ||
        lower.includes('cha sem acucar') ||
        lower.includes('chá verde') ||
        lower.includes('cha verde')
      );
    };

    const items = rawItems.map((item: any) => {
      const nome = String(item.nome || item.name || 'Alimento').trim();
      const quantidade = String(item.quantidade || item.quantity || '1 porção').trim();

      // Macros arredondados para 1 casa decimal; descarta negativos e NaN
      const rawProt = sanitizeNonNegative(item.proteina_g ?? item.protein);
      const rawCarb = sanitizeNonNegative(item.carboidrato_g ?? item.carbs);
      const rawFat = sanitizeNonNegative(item.gordura_g ?? item.fat);

      const proteina_g = rawProt !== undefined ? Math.round(rawProt * 10) / 10 : 0;
      const carboidrato_g = rawCarb !== undefined ? Math.round(rawCarb * 10) / 10 : 0;
      const gordura_g = rawFat !== undefined ? Math.round(rawFat * 10) / 10 : 0;

      // Conferência de calorias: kcal_macros = 4*prot + 4*carb + 9*fat
      const kcal_macros = Math.round(4 * proteina_g + 4 * carboidrato_g + 9 * gordura_g);
      const rawCals = sanitizeNonNegative(item.calorias ?? item.calories);

      let calorias = rawCals !== undefined ? Math.round(rawCals) : kcal_macros;
      let observacao = item.observacao ? String(item.observacao).trim() : (item.notes ? String(item.notes).trim() : '');

      if (rawCals === undefined || Math.abs(calorias - kcal_macros) > kcal_macros * 0.12) {
        calorias = kcal_macros;
        const recalcNote = 'calorias recalculadas a partir dos macros';
        if (!observacao.toLowerCase().includes('calorias recalculadas')) {
          observacao = observacao ? `${observacao} (${recalcNote})` : recalcNote;
        }
      }

      // Novos campos opcionais
      const rawQtdG = sanitizeNonNegative(item.quantidade_g ?? item.weight_g ?? item.gramas);
      const quantidade_g = rawQtdG !== undefined ? Math.round(rawQtdG * 10) / 10 : undefined;

      const rawFibra = sanitizeNonNegative(item.fibra_g ?? item.fiber);
      const fibra_g = rawFibra !== undefined ? Math.round(rawFibra * 10) / 10 : undefined;

      const rawSodio = sanitizeNonNegative(item.sodio_mg ?? item.sodium);
      const sodio_mg = rawSodio !== undefined ? Math.round(rawSodio) : undefined;

      let confianca: 'alta' | 'media' | 'baixa' =
        item.confianca === 'alta' || item.confianca === 'media' || item.confianca === 'baixa'
          ? item.confianca
          : 'media';

      const base: 'taco' | 'rotulo' | 'estimativa' =
        item.base === 'taco' || item.base === 'rotulo' || item.base === 'estimativa'
          ? item.base
          : 'taco';

      // Regra de verificação: se calorias > 2500 ou todos macros forem zero (exceto água/café/chá)
      const allZeros = proteina_g === 0 && carboidrato_g === 0 && gordura_g === 0 && calorias === 0;
      if (calorias > 2500 || (allZeros && !isZeroCalorieBeverage(nome))) {
        confianca = 'baixa';
        const reviewNote = 'valores atípicos, por favor revise';
        if (!observacao.toLowerCase().includes('revise')) {
          observacao = observacao ? `${observacao} (${reviewNote})` : reviewNote;
        }
      }

      // Escala por 100g para recálculo proporcional no app
      let kcal100: number | undefined;
      let p100: number | undefined;
      let c100: number | undefined;
      let g100: number | undefined;

      if (quantidade_g && quantidade_g > 0) {
        const factor = 100 / quantidade_g;
        kcal100 = Math.round(calorias * factor);
        p100 = Math.round(proteina_g * factor * 10) / 10;
        c100 = Math.round(carboidrato_g * factor * 10) / 10;
        g100 = Math.round(gordura_g * factor * 10) / 10;
      }

      return {
        nome,
        quantidade,
        calorias,
        proteina_g,
        carboidrato_g,
        gordura_g,
        quantidade_g,
        fibra_g,
        sodio_mg,
        confianca,
        base,
        kcal100,
        p100,
        c100,
        g100,
        observacao: observacao || undefined,
      };
    });

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
